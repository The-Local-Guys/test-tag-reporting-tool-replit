# Admin Certificates Pagination Plan

## Goal

Add server-side pagination to the **Certificates** tab on `/admin` so the browser no longer loads every accessible certificate at once, while preserving certificate creation, preview, download, editing, deletion, client search, the exact-client dropdown, and role-based data access.

## Current behavior

- `client/src/features/certificates/CertificatesTab.tsx` renders every certificate returned by the API and applies both client filters in memory.
- `client/src/features/certificates/useCertificates.ts` queries `GET /api/certificates` with a single unparameterized React Query cache entry.
- `server/routes.ts` returns a bare certificate array. Super admins and support-center users receive all certificates; technicians receive only their own.
- `server/storage.ts` has separate unpaginated methods for all certificates and one user's certificates, ordered newest-first by `createdAt`.
- The admin dashboard already has a compact numbered-pagination pattern (`ReportsPagination`) that can be mirrored for visual consistency.
- There is currently no automated test framework configured; verification relies on TypeScript/build checks and focused manual testing.

## Proposed behavior and API contract

Use server-side, page-number pagination with a fixed initial page size of 10 certificates.

`GET /api/certificates?page=1&limit=10&search=acme&clientName=Acme%20Pty%20Ltd`

The endpoint should return:

```ts
type PaginatedCertificatesResponse = {
  certificates: Certificate[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  clientNames: string[];
};
```

- `search` performs a trimmed, case-insensitive partial match on `clientName`.
- `clientName` performs an exact match and is omitted when the UI selection is `all`.
- Filters are applied before the count and page query.
- The existing role scope remains mandatory for both the result query and count query: admins/support center can see all certificates; technicians can see only certificates they own.
- Results remain ordered by `createdAt DESC`, with `id DESC` as a deterministic tie-breaker so records do not jump between pages when timestamps match.
- `clientNames` contains distinct, non-empty client names from the user's full accessible certificate scope, sorted alphabetically. It must not be limited to the current page or narrowed by the current search/client filter; this preserves the existing dropdown behavior.
- Clamp `page` to at least 1 and `limit` to a safe range (1–100). An out-of-range positive page may return an empty list with the correct metadata; the client will correct it after mutations or count changes.

## Implementation steps

### 1. Add paginated certificate storage queries

Update the `IStorage` contract and `DatabaseStorage` implementation in `server/storage.ts`.

- Replace or supplement `getAllCertificates()` and `getCertificatesByUser()` with one paginated query method that accepts `page`, `limit`, optional `userId`, optional `search`, and optional exact `clientName`.
- Build a shared condition list so the same role and filter predicates are used by both the count query and the page query.
- Run a `count(*)` query for `total`, then fetch the requested rows with `limit`/`offset` and deterministic descending order.
- Add a distinct-client-name query scoped by `userId` when applicable, but intentionally independent of the active filters.
- Return `{ certificates, total, clientNames }` from storage. No schema migration is required.

### 2. Extend `GET /api/certificates`

Update the certificate list handler in `server/routes.ts`.

- Parse and clamp `page` and `limit` using the same defensive pattern as `/api/admin/sessions`.
- Read optional `search` and `clientName` query parameters.
- Derive the ownership scope from the authenticated session; do not trust a user ID supplied by the request.
- Call the paginated storage method and return the proposed response envelope, including `totalPages: Math.ceil(total / limit)`.
- Keep the existing `requireAuth` protection and error response behavior.
- Leave the create, get-by-id, update, and delete endpoint contracts unchanged.

This intentionally changes the list endpoint from a bare array to an envelope. Repository search shows `useCertificates` as the list endpoint's only client consumer, so update it in the same change.

### 3. Make the certificates hook pagination-aware

Update `client/src/features/certificates/useCertificates.ts`.

- Define/export the response and query-parameter types instead of leaving query data untyped.
- Accept `{ page, limit, search, clientName }` in `useCertificates` and construct the request URL with `URLSearchParams`.
- Use a structured React Query key such as `["/api/certificates", params]` plus an explicit query function. This lets mutation invalidation continue to target every certificate-list variant with the prefix `["/api/certificates"]`.
- Retain the previous page as placeholder data during page transitions to avoid flashing an empty table, while exposing the query's fetching state for disabled controls/loading feedback.
- Return `certificates`, `total`, `totalPages`, `limit`, and `clientNames` with safe defaults, along with the existing mutations.
- Keep create/update/delete success handlers invalidating the entire certificate query-key prefix so the current page, total, and client-name options refresh together.

### 4. Add pagination state and controls to the Certificates tab

Update `client/src/features/certificates/CertificatesTab.tsx`.

- Add local `page` state initialized to 1 and use a constant page size of 10.
- Debounce the free-text search (about 300 ms) before including it in the server request; keep the input itself responsive.
- Pass the debounced search and selected client to `useCertificates` and render the returned page directly. Remove the in-memory `allCerts`, `uniqueClients`, and `filteredCerts` derivations.
- Reset `page` to 1 whenever the search text changes, the exact-client selection changes, or filters are cleared.
- Populate the exact-client dropdown from `clientNames`, so clients not present on the current page remain selectable.
- Add a footer below the table showing `Showing X–Y of Z certificates` and compact previous/next plus numbered page buttons with ellipses, matching the existing `/admin` report pagination style. Controls should be buttons (not navigation links), expose an active-page state, have accessible labels, and be disabled at boundaries or while a new page is fetching.
- Only render numbered controls when `totalPages > 1`, but retain the count summary when results exist.
- If a delete or filter/count refresh leaves `page > max(1, totalPages)`, move to the last valid page and let the parameterized query fetch it. This covers deleting the only item on the last page.
- Preserve the two distinct empty states: no accessible certificates at all versus no certificates matching the active filters. Use `total` and active-filter state rather than the current page length to choose the message.
- Preserve all row action behavior and existing test IDs; add stable test IDs for the pagination summary, previous/next buttons, and page buttons.

### 5. Verification

Run:

```text
npm run check
npm run build
```

Then manually verify `/admin` with seeded data exceeding one page:

1. The first page shows the newest 10 certificates and the correct range/total.
2. Previous/next and numbered buttons fetch the expected records and disable correctly at the ends.
3. Searching by a partial client name resets to page 1 and paginates/counts only matching records.
4. Selecting a client that is absent from the current page still works; clearing either filter returns to page 1.
5. Search, exact-client filtering, and pagination work for super-admin/support-center scope and technician-owned scope without leaking other users' certificates.
6. Preview, PDF download, edit, and delete work from pages other than page 1.
7. Creating or editing a certificate refreshes rows, totals, and client options.
8. Deleting the final record on the last page moves to the preceding valid page.
9. Empty-database and no-filter-match messages remain correct, and rapid search/page interactions do not display stale results.

## Acceptance criteria

- The Certificates tab never requests the entire certificate collection for table rendering.
- At most the requested `limit` certificate rows are returned per list request.
- Server totals reflect the same role scope and filters as the returned rows.
- Filters operate across the full accessible dataset, not merely the current page.
- The client dropdown continues to represent all accessible client names.
- Pagination state remains valid after filter changes and create/update/delete mutations.
- Existing certificate actions and authorization behavior are unchanged.
- Type checking and the production build pass.

## Out of scope

- Changing certificate create/edit/preview/PDF behavior.
- Adding new certificate sorting options or URL-persisted pagination state.
- Changing certificate authorization rules or deletion semantics.
- Adding a database migration or a new testing framework solely for this change.
