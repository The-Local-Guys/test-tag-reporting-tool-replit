# Report Add Item Navigation Plan

## Goal

Change the **Add Item** action in the **View & Edit Report** modal so it continues the selected report and navigates the user to that report's existing item-selection screen instead of opening the admin-only **Add New Item** form modal.

## Current behavior

- The report viewer is rendered in `client/src/pages/admin-dashboard.tsx`.
- Clicking **Add Item** calls `handleAddItem(viewingSession.session)`.
- `handleAddItem` initializes a second set of test-result form state and opens `TestResultEditModal` in add mode.
- Saving that form posts directly to `POST /api/sessions/:id/results` and refreshes the report viewer.
- The dashboard already has a **Continue Report** flow. `proceedWithContinue` stores `currentSessionId` and `selectedService` in `sessionStorage`, displays the existing loading transition, and navigates to `/items`.
- `client/src/pages/item-selection.tsx` and `client/src/hooks/use-session.ts` use those stored values to load the selected session, restore its results/counters, and continue through the normal service-specific item testing flow.

## Desired flow

1. The user opens **View & Edit Report** for a report.
2. The user clicks **Add Item**.
3. The selected report becomes the active session by storing its session ID and service type through the existing continuation flow.
4. The dashboard shows its existing "continuing report" loading state.
5. The browser navigates to `/items`.
6. The item-selection screen loads the selected report and allows the user to choose and test another item using the standard workflow.

## Implementation steps

### 1. Route Add Item through the existing continuation flow

Update `client/src/pages/admin-dashboard.tsx`:

- Change the **Add Item** button handler in the **View & Edit Report** modal to call `handleContinueReport(viewingSession.session)` (or a small shared navigation helper used by both actions).
- Keep the existing `proceedWithContinue` behavior as the single source of truth for:
  - setting `currentSessionId`;
  - setting `selectedService` with the existing `electrical` fallback;
  - enabling the dashboard's continuation loading screen; and
  - navigating to `/items`.
- Do not create a new route or a second session-loading mechanism.

### 2. Comment out the legacy Add Item modal implementation

Once the button no longer opens the form, retain but comment out the code in `client/src/pages/admin-dashboard.tsx` that exists only for the modal-based add flow. Do not delete it. Add a short comment explaining that it is the previous direct-add implementation and is intentionally preserved for possible future reference or restoration.

Comment out:

- `isAddItemModalOpen` and `addingToSession` state;
- `newItemData` and `newItemAssetNumberError` state;
- `createEmptyTestResultData`;
- `addItemMutation`;
- the old `handleAddItem` modal opener;
- `validateNewItemAssetNumber`;
- `handleNewItemAssetNumberChange`;
- `handleNewItemFrequencyChange`;
- `handleSaveNewItem`; and
- the **Add Item Modal** `TestResultEditModal` instance near the end of the component.

Use valid block or line comments appropriate to each TypeScript/TSX section so the commented code cannot create unused-symbol errors or affect runtime behavior. Keep the commented sections clearly grouped and labeled rather than interleaving them with the active navigation flow.

Retain the active edit-result modal and its supporting code. In particular, keep `TestResultEditModal`, `renumberAssets`, `assetNumberError`, `handleAssetNumberChange`, and `handleFrequencyChange`, because they are still used by the existing item-edit flow.

### 3. Preserve report/session semantics

- Pass `viewingSession.session`, not the outer report-list row, so navigation always uses the exact report currently displayed in the modal.
- Do not clear the active report before navigation; the destination relies on the session bridge to fetch its metadata and results.
- Do not change the report's `status`. This request changes navigation only; the current continuation workflow already supports opening reports from the dashboard.
- Do not change server routes, schemas, or storage. New results will continue to be saved by the standard test workflow.

## Verification

### Static checks

- Run `npm run check`.
- Run `npm run build`.
- Confirm the legacy add-modal implementation remains present only inside clearly labeled comments and none of its handlers, state, or mutation are active.

### Manual checks

For at least one existing report:

1. Open the dashboard and open **View & Edit Report**.
2. Click **Add Item**.
3. Confirm the add-item form modal does not appear.
4. Confirm the existing continuation loading state appears, followed by navigation to `/items`.
5. Confirm the item-selection header shows the selected report/client and the service-specific item choices are correct.
6. Select an item, complete its service-specific test form, and verify the new result is attached to the same report.
7. Return to the report preview/dashboard and verify both existing and newly added results are present.

Repeat the navigation check for each service type because `/items` branches to different test screens:

- Electrical -> `/test`
- Emergency exit light -> `/emergency-test`
- Fire testing -> `/fire-test`
- RCD reporting -> `/rcd-test`
- Microwave leakage -> `/microwave-test`

Also verify that:

- the existing **Continue Report** buttons still work;
- editing an existing item in **View & Edit Report** still opens the edit modal; and
- deleting an item from the report viewer remains unchanged.

## Acceptance criteria

- **Add Item** in **View & Edit Report** never opens an add-item form modal.
- Clicking it activates the report shown in the modal and navigates to `/items` through the existing continuation flow.
- The previous modal-based Add Item implementation remains in `admin-dashboard.tsx` as clearly labeled, non-executing commented code.
- The destination loads the correct client, service type, existing results, locations, and asset-number counters.
- A newly tested item is saved to the selected report through the normal item-testing workflow.
- Existing report continuation, item editing, deletion, TypeScript checking, and production build behavior remain intact.
