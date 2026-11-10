# Large File Refactoring Analysis

_Analysis date: 2026-11-10_

This covers every source file under `client/`, `server/` and `shared/`, excluding the shadcn `client/src/components/ui/` folder. Files are ranked by how much splitting them would help.

## Biggest problems

### 1. `client/src/pages/admin-dashboard.tsx`: 4,693 lines

This is one component, `AdminDashboard`, starting at line 303. It holds 66 `useState`, 12 `useMutation` and 8 `useQuery` calls. Its JSX return alone runs from line 2094 to the end of the file, about 2,600 lines.

Suggested split (folder `client/src/features/admin/`):

- **Tabs:** `UsersTab` (~L2215), `ReportsTab` (~L2396, with filters and pagination), `DraftsTab` (~L2738), and a technician version of the drafts tab (~L3114). The admin and technician drafts tabs are nearly duplicates and could become one component with a role prop.
- **Modals:**
  - `CreateUserModal` (L3382)
  - `EditSessionModal` (L3524)
  - `CopyReportDialog` (L3671)
  - `ViewReportModal` (L3703–4250, about 550 lines on its own, with its own pagination and stats)
  - `ChangePasswordModal` (L4302)
  - `EditUserModal` (L4428)
  - `DeleteResultDialog` (L4569)
- **Confirmation dialogs:** the three delete confirmations (L4617, L4643, L4669) are the same pattern, so they could be one shared `ConfirmDeleteDialog`.
- **Hooks:** move the queries and mutations into `useAdminUsers`, `useAdminReports` and `useAdminDrafts`. Most of the 66 state variables are open/closed flags and form data for the modals, so they would move into the modals themselves.
- **Shared pieces:** `ReportsPagination` (L213) is already a separate component in this file, but it should live in its own file. The duplicated pagination inside `ViewReportModal` (~L4086) should use it too.

### 2. `client/src/pages/admin-v2/index.tsx`: 4,464 lines (untracked, new)

This is a copy of the dashboard above. It contains the same helpers (`formatRoleLabel`, `getRoleBadgeClass`, `formatReportDetail`, `createEmptyTestResultData`, `ReportsPagination`) and the same modals, and `App.tsx` routes to both pages. A line diff shows about 2,250 changed lines, so roughly half of the file is identical copy-paste.

**Recommendation:** do the extraction from #1 first, and have both v1 and v2 import the shared modals, hooks and helpers. Otherwise every fix has to be made twice. Since v2 is not committed yet, now is the cheapest time to do this.

### 3. `server/routes.ts`: 2,327 lines

All endpoints are in one file.

| Route prefix | Endpoints |
|---|---|
| sessions | 17 |
| admin | 10 |
| certificates | 8 |
| environments | 6 |
| custom-forms | 6 |
| auth / login / register / logout | 5 |

**Split:** a `server/routes/` folder with `auth.ts`, `sessions.ts`, `admin.ts`, `certificates.ts`, `environments.ts` and `custom-forms.ts`, each an `express.Router()`. `routes.ts` would then just mount them.

### 4. `client/src/hooks/use-session.ts`: 1,828 lines

One hook mixes several jobs:

- asset-number counters (8 refs, `renumberAssets`, custom starting numbers)
- server sync effects (L281–586, about 300 lines)
- auto-save mutations (`autoSaveNewResultMutation` at L1164 and `autoUpdateResultMutation` at L1339, about 170 lines each)
- batch management (`addToBatch`, which is about 300 lines, plus update and remove)

**Split:** `useAssetCounters`, `useSessionSync`, `useResultAutoSave`, and a thin `useSession` that combines them. The counter logic is also pure enough to move into `lib/asset-numbering.ts`.

### 5. `server/storage.ts`: 1,703 lines

This is one `DatabaseStorage` class with 62 methods. The `IStorage` interface already groups them (users, admin, sessions, drafts, results, asset progress, reports, environments, form types, certificates).

**Split:** one module per group (`storage/users.ts`, `storage/sessions.ts`, `storage/results.ts`, and so on), combined into the existing class. The `IStorage` interface stays the same, so callers don't change.

### 6. `client/src/lib/pdf-generator.ts`: 1,517 lines

`generatePDFReport` (L194 to about L1507) is a single function of about 1,300 lines, with `serviceType ===` branches throughout.

**Split:** `pdf/header.ts` (letterhead and client info), `pdf/summary.ts`, and one table-layout file per service (`electrical`, `emergency`, `fire`, `rcd`, `microwave`) behind a common column-definition interface.

### 7. `client/src/pages/report-preview.tsx`: 1,417 lines

About 900 lines of handler logic come before the JSX:

- asset-number validation and generation (L254–400), which repeats logic from `use-session`
- PDF and Excel export handlers (L401–590)
- edit and delete flows (L661–980)

**Split:** move the asset-number functions into the shared `lib/asset-numbering.ts` mentioned above, add a `useReportExport` hook, and make `ReportResultsTable` and `ReportSummary` components.

## Medium priority

| File | Lines | Suggestion |
|---|---|---|
| `client/src/components/test-result-edit-modal.tsx` | 1,046 | Split the form fields into one section per service, as `EditFieldsElectrical`, `EditFieldsRcd`, and so on. |
| `client/src/lib/posthog.ts` | 1,013 | Group the 38 exported functions into files by domain (session events, report events, auth events). |
| `client/src/pages/environments.tsx` | 962 | `IconPicker` and `ItemFormDialog` are already separate components, so just move them to their own files. |
| `client/src/pages/fire-test-details.tsx`, `emergency-test-details.tsx`, `rcd-test-details.tsx`, `test-details.tsx` | 530–840 each | These four pages share a lot of structure (header, photo capture, pass/fail, navigation). A shared `TestDetailsLayout` plus a field component per service would shrink them. |
| `client/src/lib/excel-generator.ts` | 694 | Fine on size, but see the duplication note below. |

`client/src/data/national-client-items.ts` (967 lines) is static data, so its length is fine.

## Duplicated helpers

- `formatAssetNumberWithFrequency`, `calculateNextDueDate` and `getFrequencyLabel` appear in **three** files: `pdf-generator.ts`, `excel-generator.ts` and `report-preview.tsx`. Move them into one `lib/report-formatting.ts`.
- The five admin helpers are duplicated between `admin-dashboard.tsx` and `admin-v2/index.tsx` (see #2).

## Where to start

1. **Admin dashboard extraction:** pull the modals, tabs and hooks into shared components that both v1 and v2 use. This has the best return, since it removes about 4,000 lines of copied code at once.
2. **`server/routes.ts` split:** a mechanical, low-risk change.
3. **Shared helper consolidation:** `lib/report-formatting.ts` and `lib/asset-numbering.ts`.
4. **`use-session.ts` split:** the riskiest, because the auto-save and sync logic is fragile. Test session resume, offline mode and asset numbering carefully afterwards.
5. **`pdf-generator.ts` and `storage.ts`:** both are internal changes that don't affect the public API.
