# Electrical Test Readings Plan

## Goal

Add measured test readings to the **Electrical Test & Tag** flow (`/test`), save them with each result, and show them in the PDF and Excel exports.

| Field | Input | Unit | Default |
| --- | --- | --- | --- |
| Visual inspection | Existing checkbox — **no change** | — | Pass (checked) |
| Earth continuity | Number + **<0.10** quick-select chip | Ω | Blank — **required** |
| Insulation resistance | Operator (`>` / `<` / `=`) + number | MΩ | `>` 99.99 — **required** |
| Polarity | Pass / Fail / N/A toggle | — | Pass — **required** (N/A always allowed) |
| Leakage current **(Optional)** | Number | mA | Blank — last field |

## Current state

- `client/src/pages/test-details.tsx` has a grey box with **Visual Inspection** and **Electrical Test** checkboxes, then PASS/FAIL buttons.
- `test_results` has no reading columns for electrical. The existing `leakage_reading` column is microwave-only (mW/cm²) — **not reused**.
- PDF electrical table shows `V` / `E` Y/N columns; Excel shows Vision Inspection / Electrical Test.

## 1. Database — `shared/schema.ts`

Add nullable text columns to `testResults` (text keeps values like `<0.10` exactly as entered):

- `earthContinuity` → `earth_continuity`
- `insulationOperator` → `insulation_operator`
- `insulationResistance` → `insulation_resistance`
- `polarity` → `polarity` (`pass` | `fail` | `na`)
- `leakageCurrent` → `leakage_current`

Run `npm run db:push`. Old results stay null and render as `—`.

## 2. Server

- `server/routes.ts` — pass the 5 fields through in single create, batch create and PATCH (same pattern as `leakageReading`), plus the results mapping around line 721.
- `server/storage.ts` — add the 5 columns to the raw `INSERT` (~line 875).

## 3. Client data flow

Add the fields everywhere `leakageReading` is mapped today:
- `client/src/hooks/use-session.ts` (type, DB→state mapping, batch save, server response merge)
- `client/src/pages/report-preview.tsx`, `client/src/pages/admin-dashboard.tsx`

## 4. Test screen UI — `test-details.tsx`

New **Test Readings** card below the existing Visual/Electrical checkboxes, above PASS/FAIL:

```
┌ Test Readings ───────────────────────────┐
│ Earth Continuity (Ω)   [ 0.05 ] [<0.10]  │
│ Insulation (MΩ)        [ > ▾ ] [ 99.99 ] │
│ Polarity               [Pass][Fail][N/A] │
│ Leakage Current (mA)   [      ] Optional │
└──────────────────────────────────────────┘
```

Rules:
- **All fields shown for every classification** (Class 1, Class 2, EPOD, RCD, 3 Phase) — nothing hidden or disabled.
- **Required:** earth continuity, insulation resistance and polarity. **Only leakage current is optional.**
- **Earth continuity** — required, starts blank; enter a reading or tap `<0.10` to fill it.
- **Insulation** — required; prefilled `>` / `99.99`, editable, can't be cleared.
- **Polarity** — defaults Pass for every item; Pass / Fail / N/A always selectable.
- **Leakage current** — always last, grey “Optional” label, no validation.
- **Validation:** tapping PASS or FAIL with a required field empty (or a non-numeric value) shows a red message under that field plus a toast, and the result isn't saved.
- Numeric inputs use `inputMode="decimal"` for mobile keypads.
- Selecting **Fail** on polarity pre-selects `polarity` as failure reason on `/failure`.
- Reset to defaults when moving to the next item; readings travel with `pendingTestResult` to the failure page.

Also add the same fields to `client/src/components/test-result-edit-modal.tsx` (electrical only) so admins can correct them, with the same required-field checks for new items. Old results with no readings can still be opened and saved.

## 5. PDF — `client/src/lib/pdf-generator.ts`

**Decision: separate readings table.** The portrait electrical table stays unchanged; add a new section after it:

**Electrical Test Readings**

| Asset # | Item | Visual | Earth (Ω) | Insulation (MΩ) | Polarity | Leakage (mA) |
| --- | --- | --- | --- | --- | --- | --- |
| 1001 | Kettle | Pass | <0.10 | >99.99 | N/A | — |

- Only for `serviceType === 'electrical'`, and only if at least one result has a reading.
- Blank values print `—`; Fail values print red.
- Uses the existing page-break logic.

## 6. Excel — `client/src/lib/excel-generator.ts`

Append 4 columns to the electrical sheet after *Electrical Test*: `Earth Continuity (Ω)`, `Insulation Resistance (MΩ)`, `Polarity`, `Leakage Current (mA)`.

## 7. Verify

- `npm run check`
- Manual run (Humayun15): test Class 1, Class 2 and extension-cord items; pass + fail; resume a draft; edit via admin modal; export PDF and Excel; confirm old reports still render.

