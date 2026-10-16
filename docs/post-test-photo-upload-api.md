# Post-Test Photo Upload — API & Implementation Reference

Feature: **"Allow adding failed-item photos after testing with drag-and-drop upload"**
Commit: `695deea` (2026-09-09)

This documents the API used when a technician or admin attaches / replaces / removes a photo on a
test result **after** the test has already been recorded, plus every supporting detail (schema,
validation, client pipeline, limits, error cases).

---

## 1. Summary

There is **no dedicated photo-upload endpoint**. The photo is not a multipart file upload and there
is no object storage. The photo is compressed in the browser to a **base64 JPEG data URL** and sent
as one ordinary JSON field (`photoData`) inside the existing "update test result" request.

| | |
|---|---|
| Endpoint | `PATCH /api/sessions/:id/results/:resultId` |
| Content type | `application/json` (not `multipart/form-data`) |
| Photo field | `photoData` — string data URL, or `null` / `""` to clear |
| Auth | Session cookie (`requireAuth`) + ownership/role check |
| Storage | `test_results.photo_data` — Postgres `text` column |
| Defined in | `server/routes.ts:1273-1377` |

---

## 2. Entry points in the UI

| Where | File | Path to the API |
|---|---|---|
| Report preview (technician, own draft session) | `client/src/pages/report-preview.tsx:1122` → `TestResultEditModal` | `updateBatchedResult()` → `autoUpdateResultMutation` → `PATCH /api/sessions/:id/results/:resultId` |
| Admin dashboard (viewing any session) | `client/src/pages/admin-dashboard.tsx:4005` → `TestResultEditModal` | `updateResultMutation` (`admin-dashboard.tsx:790-806`) → same `PATCH` |

The photo widget itself is `TestPhotoInput` (`client/src/components/test-photo-input.tsx`), rendered
by `TestResultEditModal` **only when `editResultData.result === 'fail'`**
(`test-result-edit-modal.tsx:884-888`).

> The admin "Add New Item" modal (`admin-dashboard.tsx:4023`) is commented out / legacy. It is not a
> live entry point today.

---

## 3. The endpoint

### 3.1 Request

```
PATCH /api/sessions/:id/results/:resultId
Content-Type: application/json
Cookie: connect.sid=...        (session auth — credentials: 'include')
```

**Path params**

| Param | Type | Notes |
|---|---|---|
| `id` | integer | Test session id. Parsed with `parseInt`. |
| `resultId` | integer | Test result id. Must belong to `:id` (enforced). |

### 3.2 Minimal body (photo only)

Every field on this route is optional — only keys that are `!== undefined` are written. So the
smallest valid photo update is:

```json
{ "photoData": "data:image/jpeg;base64,/9j/4AAQSkZJRg..." }
```

Clear the photo:

```json
{ "photoData": null }
```

(`""` also clears it — `updateData.photoData = req.body.photoData || null`, `routes.ts:1329`.)

### 3.3 Body actually sent by the app

The clients do **not** send a photo-only patch; they send the whole merged result object. This is
the payload built in `client/src/hooks/use-session.ts:1286-1331`:

```jsonc
{
  // ---- core ----
  "itemName": "Kettle",
  "itemType": "appliance",
  "location": "Kitchen",
  "classification": "class1",
  "result": "fail",                 // 'pass' | 'fail'
  "frequency": "twelvemonthly",
  "assetNumber": "42",

  // ---- failure / notes / photo ----
  "failureReason": "Damaged cord",
  "actionTaken": "Tagged out of service",
  "notes": "Frayed near plug",
  "photoData": "data:image/jpeg;base64,...",   // <-- the photo

  // ---- electrical ----
  "visionInspection": true,
  "electricalTest": true,

  // ---- emergency exit light ----
  "maintenanceType": null,          // 'maintained' | 'non_maintained'
  "globeType": null,                // 'led' | 'fluorescent'
  "dischargeTest": false,
  "switchingTest": false,
  "chargingTest": false,
  "luxTest": false,                 // legacy
  "luxReading": null,               // legacy
  "luxCompliant": false,            // legacy
  "manufacturerInfo": null,
  "installationDate": null,
  "expiryDate": null,               // required when frequency === 'customfrequency'

  // ---- fire ----
  "equipmentType": null,
  "extinguisherType": null,
  "size": null,
  "weight": null,
  "testType": null,
  "fireVisualInspection": false,
  "accessibilityCheck": false,
  "signageCheck": false,
  "operationalTest": false,
  "pressureTest": false,

  // ---- RCD ----
  "pushButtonTest": null,
  "injectionTimedTest": null,
  "tripTimes": null,                // number[] | null (coerced to numbers client-side)
  "distributionBoardNumber": null,
  "circuitBreakerNumber": null,

  // ---- microwave ----
  "leakageReading": null
}
```

### 3.4 `photoData` field spec

| Property | Value |
|---|---|
| Type | `string \| null` |
| Format | RFC 2397 data URL: `data:image/<jpeg\|png\|webp>;base64,<base64>` |
| Server regex | `/^data:image\/(jpeg\|png\|webp);base64,[A-Za-z0-9+/]+={0,2}$/` |
| Max length | `2 * 1024 * 1024` = **2,097,152 characters** of the *whole data URL* (≈1.5 MB decoded) |
| Produced by | `compressTestPhoto()` — always `image/jpeg` in practice |
| Nullable | Yes. `null` or `""` skips validation and clears the column. |
| Whitespace | Not allowed (regex is anchored, no `\s` class) — no line-wrapped base64 |

The regex validates *shape only*. It does not decode the base64, does not check
`length % 4 === 0`, and does not verify magic bytes — a syntactically valid but corrupt payload is
accepted and stored.

### 3.5 Validation & authorization order (`routes.ts:1277-1308`)

1. `requireAuth` — 401 if no `req.session.userId`.
2. `storage.getTestSession(sessionId)` → **404** `{ "error": "Session not found" }`.
3. `storage.getTestResult(resultId)` → **404** `{ "error": "Test result not found" }`.
4. Role check: `role === 'super_admin' || role === 'support_center'` ⇒ admin.
   Non-admin whose `session.userId !== req.session.userId` ⇒ **403**
   `{ "error": "You cannot edit this session" }`.
5. Cross-session check: `currentResult.sessionId !== sessionId` ⇒ **404**
   `{ "error": "Test result not found in this session" }`.
6. Photo check (only when `photoData != null && photoData !== ''`): type/length/regex ⇒ **400**
   `{ "error": "Invalid photo. Upload a JPEG, PNG or WebP image under 2 MB after compression." }`.
7. Build `updateData` from defined keys, `notes` passed through `clampTestResultNotes()`.
8. `storage.updateTestResult(resultId, updateData)` → `res.json(result)`.

There is **no session-status check** — a `finalized` session's results can still be patched, and a
photo can be added after finalization.

### 3.6 Responses

**200 OK** — the full updated Drizzle row, camelCase, including the stored photo:

```json
{
  "id": 1234,
  "sessionId": 87,
  "assetNumber": "42",
  "itemName": "Kettle",
  "itemType": "appliance",
  "location": "Kitchen",
  "classification": "class1",
  "result": "fail",
  "failureReason": "Damaged cord",
  "actionTaken": "Tagged out of service",
  "frequency": "twelvemonthly",
  "expiryDate": null,
  "notes": "Frayed near plug",
  "photoData": "data:image/jpeg;base64,...",
  "visionInspection": true,
  "electricalTest": true,
  "maintenanceType": null, "globeType": null,
  "dischargeTest": null, "switchingTest": null, "chargingTest": null,
  "manufacturerInfo": null, "installationDate": null,
  "luxTest": null, "luxReading": null, "luxCompliant": null,
  "equipmentType": null, "extinguisherType": null, "size": null, "weight": null,
  "testType": null, "fireVisualInspection": null, "accessibilityCheck": null,
  "signageCheck": null, "operationalTest": null, "pressureTest": null,
  "pushButtonTest": null, "injectionTimedTest": null, "tripTimes": null,
  "distributionBoardNumber": null, "circuitBreakerNumber": null,
  "leakageReading": null,
  "createdAt": "2026-09-09T10:12:00.000Z",
  "deletedAt": null,
  "deletedBy": null
}
```

**Error table**

| Status | Body | Cause |
|---|---|---|
| 400 | `{"error":"Invalid photo. Upload a JPEG, PNG or WebP image under 2 MB after compression."}` | Non-string, >2 MB string, or regex mismatch |
| 401 | `{"message":"Authentication required"}` | No session (`requireAuth`) |
| 403 | `{"error":"You cannot edit this session"}` | Technician patching someone else's session |
| 404 | `{"error":"Session not found"}` | Bad `:id` |
| 404 | `{"error":"Test result not found"}` | Bad `:resultId` |
| 404 | `{"error":"Test result not found in this session"}` | Result belongs to another session |
| 413 | Express `entity.too large` HTML/text | Body over the 10 MB JSON limit (`server/index.ts:21`, `routes.ts:125`) |
| 500 | `{"error":"Failed to update test result"}` | DB / unexpected error |

Client-side, `apiRequest()` throws `Error("<status>: <raw body text>")` for any non-2xx
(`client/src/lib/queryClient.ts:3-8`), so the toast shows e.g.
`400: {"error":"Invalid photo. ..."}`.

### 3.7 curl example

```bash
curl -X PATCH 'http://localhost:5000/api/sessions/87/results/1234' \
  -H 'Content-Type: application/json' \
  -b 'connect.sid=<session-cookie>' \
  -d '{"photoData":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA=="}'
```

---

## 4. Client-side pipeline

### 4.1 `compressTestPhoto()` — `client/src/lib/test-photo.ts`

```
File  →  type/size guard  →  objectURL  →  <img> decode  →  canvas resize  →  JPEG data URL
```

| Step | Rule | Error message on failure |
|---|---|---|
| MIME allow-list | `image/jpeg`, `image/png`, `image/webp` | `Choose a JPEG, PNG, or WebP image.` |
| Size guard | `file.size <= 10 * 1024 * 1024` (10 MB) | `Choose an image smaller than 10 MB.` |
| Decode | `<img>` load via `URL.createObjectURL` | `This image could not be read. Choose another photo.` |
| Canvas | `getContext('2d')` must exist | `Photo processing is unavailable. Please try again.` |
| Resize | `scale = min(1, 800/naturalWidth, 600/naturalHeight)` — fits inside **800×600**, never upscales, min 1px per side | — |
| Flatten | White `#ffffff` fill before `drawImage` (PNG/WebP transparency → white) | — |
| Encode | `canvas.toDataURL('image/jpeg', 0.7)` — **always JPEG** | — |
| Cleanup | `URL.revokeObjectURL` in `finally` (runs on success *and* decode failure) | — |

Net effect: a 10 MB phone photo lands at roughly 30–150 KB of base64, far under the 2 MB server cap.
Because output is always JPEG, the server's `png|webp` regex branches are unreachable from this UI —
they only matter for direct API callers.

Unit tests: `client/src/lib/test-photo.test.ts` (node:test). Covers the pre-decode rejections, both
resize bounds (1200×1100 → 655×600; 400×300 unchanged), and that `revokeObjectURL` fires 3× across
3 calls including the failing one. Note: **no test runner is configured in `package.json`** — run it
manually with `node --test` / `tsx --test`.

### 4.2 `TestPhotoInput` — `client/src/components/test-photo-input.tsx`

Props:

| Prop | Type | Purpose |
|---|---|---|
| `value` | `string \| null` | Current data URL (rendered as `<img src>` preview) |
| `onChange` | `(value: string \| null) => void` | Emits compressed data URL, or `null` on Remove |
| `disabled` | `boolean` | Parent passes `isSaving \|\| photoProcessing` |
| `onProcessingChange` | `(value: boolean) => void` | Lets the modal block Save/Cancel/close while compressing |

Behaviour:

- Three input paths: **drag-and-drop**, **Choose photo** (gallery `<input type=file>`), **Take photo**
  (`capture="environment"` → rear camera on mobile).
- Drop zone uses a `dragDepth` counter so nested `dragenter`/`dragleave` don't flicker the highlight;
  ignores drags whose `dataTransfer.types` lack `'Files'`; sets `dropEffect='none'` while busy.
- **One photo per item.** Dropping more than one file → `Please drop one photo at a time.`
  Dropping/selecting a new photo **replaces** the existing one.
- `processingRef` guard prevents concurrent compressions; a `generation` counter discards results
  from a superseded/unmounted request (stale-write protection).
- File inputs reset `event.target.value = ''` after selection so re-picking the same file re-fires.
- A11y: `<fieldset disabled aria-busy>`, `role="status"` overlays for "Drop photo here" /
  "Processing photo…", `role="alert"` for errors, `aria-describedby` help text, 44px min tap targets.
- Errors are local to the widget and never reach the API — invalid files are rejected before any
  request is made.

### 4.3 Save path (technician — `report-preview.tsx`)

```
TestPhotoInput.onChange
  → setEditResultData({ ...prev, photoData })
  → Save → handleUpdateResult()            (report-preview.tsx:814)
  → await updateBatchedResult(batchedId, resultData)   (use-session.ts:1420)
  → autoUpdateResultMutation.mutateAsync()  → PATCH ...
  → on success: local batchedResults patched, report query invalidated
```

Key behaviours introduced by the commit:

- `updateBatchedResult` became **async and server-first**: it awaits the PATCH and only then updates
  local state, so the UI can never show a photo that failed to persist. Previously it wrote local
  state first and fired a fire-and-forget mutation.
- If the result has no `serverId` yet it throws `This item is still saving. Please wait and try
  again.` (previously it silently updated locally only).
- After success it invalidates `[/api/sessions/${sessionId}/report]` so the report preview re-renders
  with the photo.
- `report-preview.tsx` now tracks `isSavingEdit` and passes it as the modal's `isSaving`, so the Save
  button shows the saving state for the (larger) photo request instead of being hardcoded `false`.
- Mutation retry: `retry: 3` with exponential backoff `min(1000 * 2^n, 10000)` ms
  (`use-session.ts:1338-1339`). A rejected photo (400) is therefore retried 3× before surfacing.

### 4.4 Save path (admin — `admin-dashboard.tsx`)

`updateResultMutation` (`:790`) does a plain `fetch` PATCH (no `credentials: 'include'` — same-origin
default suffices) and throws a generic `Failed to update test result` on non-OK, so the server's
specific photo error text is **not** surfaced in the admin UI. `photoData` is included in the payload
at `:1585` and hydrated from the row at `:1447` (`result.photoData ?? result.photo_data ?? null`).

### 4.5 Modal guards — `test-result-edit-modal.tsx`

- `photoProcessing` state resets whenever `isOpen` or `editResultData.result` changes.
- While compressing: Save disabled, Cancel disabled, and `onClose` is swallowed
  (`onClose={() => { if (!isSaving && !photoProcessing) onClose(); }}`) so a backdrop click cannot
  drop an in-flight photo.

---

## 5. Persistence

`shared/schema.ts:99`

```ts
photoData: text("photo_data"),   // Base64 encoded photo for failed items
```

- Plain `text`, nullable. No size constraint at the DB level — the 2 MB cap is application-only.
- Written via `storage.updateTestResult()` (`server/storage.ts:1042-1057`), a Drizzle
  `.update().set().returning()`; only keys present in `updateData` are touched.
- Test results are **soft-deleted** (`deletedAt`/`deletedBy`), so photo bytes persist after a "delete".

---

## 6. Other endpoints that carry `photoData`

| Endpoint | Direction | Notes |
|---|---|---|
| `POST /api/sessions/:id/results` (`routes.ts:1139`) | in | Create one result during testing. `photoData: req.body.photoData \|\| null`. **No format/size validation** — the hardened check exists only on PATCH. |
| `POST /api/sessions/:id/batch-results` (`routes.ts:978`) | in | Bulk submit of batched results; same unvalidated passthrough. |
| `GET /api/sessions/:id/results` (`routes.ts:1449`) | out | Returns `{ results, total }` with full rows incl. `photoData`. No pagination — a session with many photos returns a large payload. |
| `GET /api/sessions/:id/report` (`routes.ts:1463`) | out | Report payload; technicians restricted to their own sessions (403 otherwise). |
| `POST /api/sessions/:id/copy` (`routes.ts:733`) | — | **`photoData` intentionally omitted** — copied sessions start without photos. |
| `DELETE /api/sessions/:id/results/:resultId` (`routes.ts:1380`) | — | Soft delete; row (and photo) retained. |

During original testing, photos are captured in the flow pages
(`failure-details.tsx`, `emergency-test-details.tsx`, `fire-test-details.tsx`,
`test-details.tsx:180` which uses `toDataURL('image/jpeg', 0.8)`), not through `TestPhotoInput`.

---

## 7. Limits at a glance

| Limit | Value | Enforced where |
|---|---|---|
| Source file size | 10 MB | Client — `test-photo.ts` |
| Source MIME | jpeg / png / webp | Client — `test-photo.ts` |
| Output dimensions | fits 800 × 600 | Client — canvas scale |
| Output format / quality | JPEG, 0.7 | Client — `toDataURL` |
| Stored data URL length | 2,097,152 chars | Server — PATCH only |
| Stored MIME (regex) | jpeg / png / webp | Server — PATCH only |
| HTTP JSON body | 10 MB | Express — `server/index.ts:21`, `routes.ts:125` |
| Photos per result | 1 | UI (`TestPhotoInput` is single-value) |

---

## 8. Downstream use

- **PDF** — `client/src/lib/pdf-generator.ts:1344-1371`: for failed items, the data URL is decoded
  via an `<Image>` to read natural dimensions, scaled to fit 80 × 60 pt preserving aspect ratio, then
  `doc.addImage(..., 'JPEG', ...)`. On failure it prints
  `Photo could not be displayed in PDF`. `pdf-generator.ts:1170` treats `notes || photoData` as the
  signal that a failed item has extra detail to render.
- **Analytics/logging** — `server/posthog.ts:88`: `photoData` is replaced with `'[DATA_PRESENT]'`
  before events are sent (note: the generic `length > 200` truncation branch is checked *first*, so a
  real photo is actually recorded as a 200-char prefix + `...[truncated]`, not `[DATA_PRESENT]`).
  Route logs print only a KB size (`routes.ts:1186-1194`), never the payload.

---

## 9. Known quirks / gotchas

1. **Validation asymmetry.** Only PATCH validates the photo. `POST /results` and
   `POST /batch-results` accept any string, so a client bypassing the compressor can store arbitrary
   text in `photo_data`.
2. **400s are retried.** `autoUpdateResultMutation` uses `retry: 3`, so an invalid photo produces 4
   requests over ~7 s before the user sees the error.
3. **Photo survives pass/fail flips.** `TestPhotoInput` is hidden when `result !== 'fail'`, but the
   existing `photoData` stays in `editResultData` and is re-sent on save — switching a failed item to
   pass keeps its photo in the DB.
4. **Finalized sessions are editable.** The PATCH route never checks `session.status`.
5. **camelCase/snake_case mismatch.** `autoUpdateResultMutation.onSuccess` (`use-session.ts:1340+`)
   reads `serverResult.globe_type`, `serverResult.notes`, etc. Drizzle returns camelCase, so most
   snake_case reads are `undefined` and fall back to `?? r.<field>` (local value) — harmless today
   because the local value is what was just sent, but misleading. Note `photoData` is **not** in that
   merge list at all; the explicit `setBatchedResults` in `updateBatchedResult` is what applies it.
6. **Admin UI hides the reason for a rejection.** See §4.4.
7. **Truncation before redaction in PostHog.** See §8.
8. **Base64 in JSON is ~33% overhead**, and `GET /results` returns every photo inline — large
   sessions produce heavy responses with no pagination.
