# Plan: Link reports to a Certificate of Compliance, and bundle it into the report PDF

## Goal
- A test report (`testSessions` row) can be linked to **one** Certificate of Compliance.
- A Certificate of Compliance can be linked to **many** reports (e.g. one CoC covering electrical + fire testing, each generated as a separate session/report).
- Exporting a report's PDF appends the linked certificate's pages to the **same PDF file**, at the bottom, so the technician/client gets one document.
- The existing auto-create-on-finalize flow ([docs/coc-from-report-plan.md](./coc-from-report-plan.md)) is unchanged in trigger/behavior — it just also auto-*attaches* the new certificate to the session it was created from.

## Relationship direction (important)
The current schema has `certificates.sessionId` (nullable FK → `test_sessions.id`), which models **one certificate per session** — the opposite of what's needed. To support "many reports → one certificate", the FK must live on the **many** side:

- **New column**: `testSessions.certificateId` (nullable FK → `certificates.id`). This is the link actually used for PDF export and the "attach" UI.
- **Existing column**: `certificates.sessionId` is kept as-is (read-only going forward) — it's just provenance ("which session's finalize auto-created this certificate"), not the attachment relationship. No code should rely on it to find a report's certificate anymore.

This means a report has exactly one `certificateId`, and any number of reports can share the same `certificateId`. No new junction table needed.

## Schema changes
`shared/schema.ts`:
- Add `certificateId: integer("certificate_id").references(() => certificates.id)` to `testSessions`.
- Extend `insertTestSessionSchema` — no change needed since it's omitted/optional by default (nullable column); confirm it isn't required.

Migration (`migrations/add_session_certificate_id.sql`):
```sql
ALTER TABLE test_sessions
ADD COLUMN IF NOT EXISTS certificate_id INTEGER REFERENCES certificates(id) ON DELETE SET NULL;
```
`ON DELETE SET NULL` so deleting a certificate that's still attached to reports doesn't fail — it just unlinks (see "Deleting an attached certificate" below).

## Storage layer (`server/storage.ts`)
New methods on `IStorage` + `DatabaseStorage`:
- `attachCertificateToSession(sessionId: number, certificateId: number | null): Promise<TestSession>` — sets/clears `testSessions.certificateId`.
- `getCertificateForSession(sessionId: number): Promise<Certificate | undefined>` — join to fetch the attached certificate (used by report-preview and PDF export).
- `getSessionsByCertificateId(certificateId: number): Promise<TestSession[]>` — used by the admin Certificates tab to show "attached to N reports" / list them, and to warn before delete.

`createCertificate` is unchanged. The finalize flow (see below) calls `createCertificate` then `attachCertificateToSession` instead of relying on `certificates.sessionId` as the link.

## API routes (`server/routes.ts`)

### Finalize flow update (~line 626, existing auto-create block)
After `storage.createCertificate(...)` succeeds, call `storage.attachCertificateToSession(sessionId, certificate.id)` so the new certificate is immediately the report's attached certificate. Keep the existing try/catch-and-log-only behavior — attaching failure must not block finalize, same as certificate-creation failure today.

### New endpoints
- `PATCH /api/sessions/:id/certificate` — body `{ certificateId: number | null }`. Attaches or detaches a certificate from a session.
  - Permission: same ownership rule as other session routes (technician can only modify their own sessions; admin/support can modify any).
  - Validate the certificate exists and (for technicians) belongs to them before attaching — don't let a technician attach another technician's certificate.
  - This is what powers manual attach/change/detach from the report page or admin.
- `GET /api/certificates/:id/sessions` — list of reports (id, clientName, serviceType, testDate, status) attached to a certificate. Used by the admin Certificates tab to show/expand attached reports and to warn before delete.

### Certificate delete route (existing, ~line 2170)
Before deleting, call `getSessionsByCertificateId(id)`. If non-empty, the client (CertificatesTab) should warn "This certificate is attached to N report(s); deleting it will remove those reports' certificate" — but the delete itself proceeds (DB `ON DELETE SET NULL` handles it safely either way). No server-side block; this is a confirmation-dialog concern, not a data-integrity one.

## Client changes

### Report page (`client/src/pages/report-preview.tsx`)
- Fetch the session's attached certificate (new small query hook, e.g. `useSessionCertificate(sessionId)` hitting a `GET /api/sessions/:id/certificate` convenience route, or reuse `getCertificateForSession` via a dedicated endpoint — simplest to add `GET /api/sessions/:id/certificate` returning the attached certificate or `null`).
- Replace the current static line ("A Certificate of Compliance has been created — view it in Admin → Certificates.", line ~1274) with:
  - If attached: show which certificate (client name + services) with a "Change" action.
  - If not attached (e.g. auto-create failed, or this is an older report): an "Attach Certificate" action opening a picker (search existing certificates by client name, reusing `/api/certificates/paginated`) that calls `PATCH /api/sessions/:id/certificate`.
- `downloadPDF` call (line ~464): after fetching the attached certificate, pass it into `generatePDFReport`/`downloadPDF` so it can be appended (see PDF merge section). If no certificate is attached, behave exactly as today — report PDF only, no change.

### Certificates admin tab (`client/src/features/certificates/CertificatesTab.tsx`)
- Add an "Attached reports" count/column per certificate (from `GET /api/certificates/:id/sessions`, lazily on expand to avoid N+1 on the list view — or include a `sessionCount` in the paginated list response via a single aggregate query if listing it inline is wanted; start with the expand-on-demand approach to keep the paginated query simple).
- Certificate delete confirmation dialog: if attached count > 0, show the warning described above.

## PDF merge (the core new behavior)
Two jsPDF documents can't be concatenated after the fact without a merge library — but both generators already build into a `jsPDF` instance directly, so the simplest approach is to **render the certificate onto the same `doc` instance** instead of creating a second one:

1. Refactor `client/src/lib/certificate-generator.ts`:
   - Extract the body of `generateCertificatePDF` into a new exported function `renderCertificateIntoDoc(doc: jsPDF, certificate: Certificate): Promise<void>` that takes an existing `doc`, calls `doc.addPage()` first, then does everything the current function does *except* `new jsPDF()` and the final `doc.output('blob')`.
   - `generateCertificatePDF` (still used standalone — e.g. CertificatePreview, manual certificate download from Admin → Certificates) becomes a thin wrapper: `new jsPDF()` → `renderCertificateIntoDoc(doc, certificate)` → `doc.output('blob')`. No behavior change for existing standalone certificate downloads.
2. In `client/src/lib/pdf-generator.ts`, `generatePDFReport` (line ~190): after all report pages are drawn, if a certificate was passed in (new optional param on `ReportData`, e.g. `attachedCertificate?: Certificate`), call `renderCertificateIntoDoc(doc, attachedCertificate)` before `doc.output(...)`. The certificate renders as a fresh page (or pages, if its content ever grows) appended at the end — i.e. "at the bottom" of the same PDF.
3. `downloadPDF` (line ~1499) and the `report-preview.tsx` call site pass the fetched certificate through unchanged otherwise.
4. No change to `excel-generator.ts` — Excel export stays report-only (out of scope, Excel has no concept of a certificate page).

## Auto-create flow — what changes vs. stays the same
Per the request, the auto-create trigger/shape is unchanged:
- Finalizing a session still auto-creates a CoC exactly as today (client, address, service, technician, test date, +12 months), still non-blocking on failure, still idempotent via the existing `getCertificateBySessionId` check.
- **New**: that auto-created certificate is now also auto-attached to the session via `attachCertificateToSession`, so the report's next PDF export includes it automatically with zero manual steps — this is the "auto-attach" the request asked for.
- If a technician later finalizes a *second* session for the same client (e.g. fire testing after electrical), a *second* certificate is still auto-created and auto-attached to *that* session (matching current one-session-one-auto-cert behavior). If the intent is actually "attach the client's existing certificate to the new report instead of creating a second one," that's a product decision to confirm separately — out of scope here, flagged below.

## Out of scope / open questions
- Merging/aggregating multiple sessions' auto-created certificates into a single shared certificate automatically (e.g. detecting "same client, same month, no certificate yet → reuse it") is not covered — only manual attach via the picker handles the "one cert, many reports" case today. Worth a follow-up decision.
- No change to Excel report export.
- No UI to attach a certificate from the Admin side except via the picker on the report page and the delete-warning on the certificates tab — no bulk "attach this certificate to these 5 reports" tool.
- No retroactive attachment for already-finalized sessions beyond the manual picker — nothing runs automatically against historical data.

## Files touched
- `shared/schema.ts` — add `certificateId` column + migration
- `migrations/add_session_certificate_id.sql` — new migration
- `server/storage.ts` — `attachCertificateToSession`, `getCertificateForSession`, `getSessionsByCertificateId`
- `server/routes.ts` — finalize flow auto-attach, `PATCH /api/sessions/:id/certificate`, `GET /api/sessions/:id/certificate`, `GET /api/certificates/:id/sessions`, delete-route warning data
- `client/src/lib/certificate-generator.ts` — extract `renderCertificateIntoDoc`
- `client/src/lib/pdf-generator.ts` — call `renderCertificateIntoDoc` when a certificate is attached
- `client/src/pages/report-preview.tsx` — fetch attached certificate, attach/change UI, pass certificate into PDF export
- `client/src/features/certificates/CertificatesTab.tsx` — attached-reports count + delete warning
- `client/src/features/certificates/useCertificates.ts` — new query hooks for attach/detach/list-sessions
