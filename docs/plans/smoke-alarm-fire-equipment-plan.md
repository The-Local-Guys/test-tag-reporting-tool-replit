# Add "Smoke Alarm" item to Fire Equipment Testing

## Context

Fire Equipment Testing currently supports 4 equipment types (Fire Extinguisher, Fire Blanket, Fire Hose Reel, Fire Hydrant), all modeled as one `equipmentType` field within a single fire test form/page. The user wants a 5th item, **Smoke Alarm**, with its own fixed 12-monthly frequency, its own standard (AS 3786), a Battery Powered / Hard Wired type selector, and 4 checkboxes (Push Button test, Decibel test, Battery test/replacement, Smoke test).

The codebase already models fire equipment as "one service, one `equipmentType` enum, conditional fields/checkboxes per type" (see `fire-test-details.tsx`), so Smoke Alarm slots into that existing pattern rather than needing a new page or service.

## Data model changes (`shared/schema.ts`)

1. Add `'smoke_alarm'` to `fireEquipmentTypes` (line 322).
2. Add new nullable columns to `testResults` (near the existing fire fields, ~line 122-133):
   - `smokeAlarmType: text("smoke_alarm_type")` — `'battery_powered' | 'hard_wired'`
   - `decibelTest: boolean("decibel_test")`
   - `batteryTestReplacement: boolean("battery_test_replacement")`
   - `smokeTest: boolean("smoke_test")`
   - Reuse the existing `pushButtonTest` column (currently only used by RCD; it's generic/nullable, same reuse pattern already used for `operationalTest`/`pressureTest` across fire equipment types) for "Push Button testing".
3. Add 2 smoke-alarm-specific failure reasons to `fireFailureReasons` (line 328): `'battery_dead'`, `'sensor_fault'` (keep `physical_damage`, `expired`, `other` reusable).
4. No changes needed to `insertTestResultSchema` — it's derived via `createInsertSchema(testResults)`, so new columns are picked up automatically.
5. Frequency: no new enum value needed. `'annually'` already represents a 12-month cycle (see asset-numbering logic in `fire-test-details.tsx` lines 326-339, "`nextTwelvemonthly`"). Smoke Alarm will just always use `'annually'`, displayed as "12 Monthly".
6. After editing the schema, run `npm run db:push` to apply the new columns to the dev database.

## Item list (`client/src/pages/item-selection.tsx`)

- Add `{ type: 'smoke-alarm', name: 'Smoke Alarm', icon: '🚨', description: 'Smoke Alarm' }` to `fireItems` (line 113-118), following the existing emoji-icon pattern used for extinguisher/blanket.

## Fire test form (`client/src/pages/fire-test-details.tsx`)

- `fireTestSchema` (line 21-40): add `'smoke_alarm'` to the `equipmentType` enum; add `smokeAlarmType: z.enum(['battery_powered', 'hard_wired']).optional()`, `decibelTest`, `batteryTestReplacement`, `smokeTest` (all `z.boolean().default(true)`), and reuse `pushButtonTest: z.boolean().default(true)`.
- `getEquipmentType()` (line 62-68): add `if (type.includes('smoke')) return 'smoke_alarm';`.
- `getComplianceStandard()` (line 256-261): add a branch so `watchEquipmentType === 'smoke_alarm'` always returns `'AS 3786'`, regardless of country (mirrors the existing fire-hydrant/NZ override already there).
- Frequency handling: add a `useEffect` that forces `form.setValue('frequency', 'annually')` whenever `watchEquipmentType` becomes `'smoke_alarm'`. When `watchEquipmentType === 'smoke_alarm'`, render the Test Frequency control as a disabled/locked single option labeled "12 Monthly" instead of the normal 2-option Select (lines 567-584), since it's fixed for this item type.
- Equipment Type dropdown (line 346-361): add `<SelectItem value="smoke_alarm">Smoke Alarm</SelectItem>`.
- New conditional block (pattern-matching the extinguisher-type block at lines 364-385): when `watchEquipmentType === 'smoke_alarm'`, show a "Smoke Alarm Type" Select with `battery_powered` → "Battery Powered" and `hard_wired` → "Hard Wired".
- Checkbox section (lines 419-531): add a new `watchEquipmentType === 'smoke_alarm'` block with 4 checkboxes bound to `pushButtonTest` ("Push Button Testing"), `decibelTest` ("Decibel Testing (noise loud enough)"), `batteryTestReplacement` ("Battery Testing and Replacement (if required)"), `smokeTest` ("Smoke Test (Spraying with smoke in a can)"). Do **not** show the common `visionInspection`/`accessibilityCheck`/`signageCheck` checks for smoke alarm, since the requested checklist is self-contained (confirm this is desired at review — see note below).
- Failure reason Select (lines 598-607): when `watchEquipmentType === 'smoke_alarm'`, show `battery_dead`, `sensor_fault`, `physical_damage`, `expired`, `other` instead of the full extinguisher-oriented list.
- `onSubmit`/`addToBatch` (lines 109-199): include the new fields (`smokeAlarmType`, `decibelTest`, `batteryTestReplacement`, `smokeTest`, `pushButtonTest`) in the payload sent to `addToBatch`.

## Edit modal (`client/src/components/test-result-edit-modal.tsx`)

- Mirror the same conditional checkboxes/type-select for `editResultData.classification === 'smoke_alarm'`, following the existing per-equipment-type blocks at lines 617-683 and the extinguisher-type Select at lines 686-706.

## PDF report (`client/src/lib/pdf-generator.ts`)

- In the "Test Criteria Summary" per-item loop (lines 1092-1140):
  - Per-item standard override (lines 1097-1101): add `equipmentType === 'smoke_alarm'` → `'AS 3786'`.
  - Add a new branch (alongside the `fire_extinguisher`/`fire_hose_reel`/`fire_hydrant`/`fire_blanket` branches at lines 1112-1128) for `smoke_alarm` that prints Push Button / Decibel / Battery / Smoke test results instead of the generic vision/accessibility/signage lines (those three don't apply to this checklist).
  - Show `result.smokeAlarmType` (Battery Powered / Hard Wired) in place of the extinguisher-type line (lines 1130-1140).

## Excel report (`client/src/lib/excel-generator.ts`)

- Header row for fire_testing (line 343): extend with 4 new trailing columns: `'Push Button Test'`, `'Decibel Test'`, `'Battery Test/Replacement'`, `'Smoke Test'` (values are `'N/A'` for non-smoke-alarm rows, matching the existing `pressureTestResult` N/A convention at lines 421-426).
- Row builder (lines 414-454): add the 4 new cell values using the same `toTestCell` helper.
- Failure-reason label mapping (lines 367-385): add `battery_dead` → "Battery Dead", `sensor_fault` → "Sensor Fault".
- Column widths (around line 612-615): add widths for the 4 new columns.

## Verification

1. `npm run check` — confirm no TypeScript errors after schema/type changes.
2. `npm run db:push` — apply the new `testResults` columns.
3. Run `npm run dev`, log in as `Humayun15` / `Baseball`, start a Fire Equipment Testing session, select **Smoke Alarm**, confirm:
   - Frequency shows locked "12 Monthly".
   - Header shows "AS 3786 Compliance".
   - Type Select offers Battery Powered / Hard Wired.
   - The 4 requested checkboxes appear (and only those).
   - Submit a pass and a fail (check the smoke-alarm-specific failure reasons appear).
4. Finalize the session and generate both PDF and Excel reports; confirm the Smoke Alarm row/section shows the right standard, type, and checklist results.
5. Edit a saved Smoke Alarm result via the edit modal and confirm the same fields are editable.

## Open question to confirm before implementing

The requested checklist (Push Button, Decibel, Battery, Smoke test) doesn't include the generic Visual Inspection / Accessibility / Signage checks that every other fire item has. Plan assumes Smoke Alarm **only** shows the 4 requested checkboxes (no vision/accessibility/signage). Flag if you'd actually like those 3 generic checks kept in addition.
