# Plan: Auto-create a CoC when a report is finalized

## Goal
Stop requiring technicians to create a Certificate of Compliance separately. When a test session is finalized, the system automatically creates a matching CoC behind the scenes — no modal, no manual step.

## Trigger
Hook into the existing session finalize path: `PATCH /api/sessions/:id/finalize` in `server/routes.ts` (~line 616) → `storage.finalizeSession`. Right after a session is successfully finalized, auto-create a certificate for it. This is the natural "job done" moment and already exists — no new UI action needed.

**Idempotency:** only auto-create if this session doesn't already have a certificate. A session can only be finalized once (status flips draft → finalized), so in practice this runs once per session — but check anyway so retries/re-finalize attempts don't produce duplicates.

## Schema change (small, required for idempotency + traceability)
Add `sessionId: integer("session_id").references(() => testSessions.id)` to the `certificates` table in `shared/schema.ts` (nullable, since existing freestanding certificates have no session). Push with `npm run db:push`.

## Auto-fill mapping (same as before, now applied server-side)
| CoC field | Source |
|---|---|
| clientName | `session.clientName` |
| address | `session.address` |
| certificationDate | `session.testDate` |
| technicianName | `session.technicianName` |
| services | `[session.serviceType]` |
| validityDates | `certificationDate + 12 months` (fixed default — no per-service choice at creation time) |
| notes | `session.reportNotes`, truncated to 250 chars, or null |
| technicianLicense | null (no source) |
| sessionId | `session.id` |
| userId | `session.userId` |

## Implementation
1. **Schema**: add `sessionId` column to `certificates` (shared/schema.ts) + `db:push`.
2. **storage.ts**: add `getCertificateBySessionId(sessionId)` and extend `createCertificate` call sites to accept `sessionId`.
3. **routes.ts finalize handler**: after `storage.finalizeSession(...)` succeeds, check `getCertificateBySessionId`; if none exists, build the certificate payload from the finalized session and call `storage.createCertificate`. Wrap in try/catch that logs but does not fail the finalize request if certificate creation errors (finalizing the report is the priority; the technician can always create one manually as a fallback — see below).
4. **Report page**: remove the manual "Create Certificate" button added in the previous iteration (no longer needed once finalize does it automatically). After finalize succeeds, show a simple "Certificate created" confirmation, with a link to view/edit it in Admin → Certificates (technicians still go there to add a license number or change the validity period, same as editing any certificate today).
5. **CertificateModal's `initialData` prop** (added last iteration): keep it, but it's now only used by the manual "Create Certificate" fallback in Admin → Certificates when a technician wants to override the auto-created one, or create one for a session that errored out.

## Out of scope (keep this simple)
- No multi-service aggregation across sessions — one session's `serviceType` → one certificate with one service.
- No configurable default validity period — fixed at 12 months; technician edits it afterward in Admin → Certificates if a different period is needed.
- No retroactive certificate creation for already-finalized sessions — only applies going forward.
- No blocking the finalize flow if certificate creation fails — finalize succeeds regardless; failures are logged server-side.

## Files touched
- `shared/schema.ts` — add `sessionId` column + migration
- `server/storage.ts` — `getCertificateBySessionId`, pass `sessionId` through `createCertificate`
- `server/routes.ts` — auto-create certificate inside the finalize endpoint
- `client/src/pages/report-preview.tsx` — remove manual button, add post-finalize confirmation/link
