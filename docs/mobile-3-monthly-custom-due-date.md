# 3 Monthly Custom Due Date — Web Implementation & Mobile App Port Guide

Feature: **"Add optional custom due date for 3 monthly electrical items"**
Web commit: `4670a7d` (2026-09-25)

This explains exactly what was changed in the web app and what the mobile app needs to do to
match it. **No backend or database changes were made.** The feature reuses the existing
`expiryDate` field on test results, so the mobile app needs only UI, validation and
report-calculation changes.

---

## 1. Summary of the behaviour

| # | Rule | Applies to |
|---|---|---|
| 1 | When frequency is **3 Monthly** (`threemonthly`), show an **optional** "Custom Due Date" date picker. | Electrical test & tag only |
| 2 | If it is left blank, the due date is **3 months from the session test date** (same as before). | Electrical, 3 Monthly |
| 3 | If it is set, the due date shown on reports is **the entered date**. | Electrical, 3 Monthly |
| 4 | The date **cannot be before the session test date**. This also applies to the existing required **Custom Frequency** expiry date. | Electrical, 3 Monthly + Custom Frequency |
| 5 | Changing the frequency **clears** the entered date. | Test screen + edit dialog |
| 6 | **Failed** items still show the test date as their due date (immediate retest), even if a custom date is set. | All |
| 7 | The edit dialog for **Emergency Exit Light** and **Fire Testing** only offers **6 Monthly** (`sixmonthly`) and **12 Monthly** (`annually`), matching their test screens. | Edit dialog, EEL + Fire |

---

## 2. Data model and API (unchanged, reused)

### 2.1 Field

| | |
|---|---|
| DB column | `test_results.expiry_date` (`text`, nullable) |
| Drizzle / JSON key | `expiryDate` (responses from raw SQL may also return `expiry_date`, so read both) |
| Format | ISO date string **`yyyy-mm-dd`** (e.g. `"2026-12-31"`), or `null` |
| Defined in | `shared/schema.ts:98` |

Before this feature `expiryDate` was used only by `customfrequency`. Now it means:

| `frequency` | `expiryDate` |
|---|---|
| `customfrequency` | **Required.** The explicit expiry date. |
| `threemonthly` (electrical) | **Optional.** A custom due date. `null` means use test date + 3 months. |
| anything else | Must be `null`. |

The session test date is `test_sessions.test_date` (`testDate`), also a `yyyy-mm-dd` string
(`shared/schema.ts:65`).

### 2.2 Endpoints that carry the field (no changes needed)

| Action | Endpoint | Where `expiryDate` is handled |
|---|---|---|
| Create one result | `POST /api/sessions/:id/results` | `server/routes.ts:1204` → `req.body.expiryDate \|\| null` |
| Create batched results | `POST /api/sessions/:id/batch-results` | `server/routes.ts:1028` → `batchedResult.expiryDate \|\| null` |
| Edit a result | `PATCH /api/sessions/:id/results/:resultId` | `server/routes.ts:1394` → updated only if the key is present; `""` or `null` clears it |
| Read results | `GET /api/sessions/:id/results` | returned as `expiryDate` / `expiry_date` |

Example create payload (3 Monthly with a custom due date):

```json
{
  "assetNumber": "3001",
  "itemName": "Extension Lead",
  "frequency": "threemonthly",
  "expiryDate": "2026-11-15",
  "result": "pass"
}
```

Example create payload (3 Monthly, left blank):

```json
{ "frequency": "threemonthly", "expiryDate": null }
```

Example edit payload (user changed frequency from 3 Monthly to 6 Monthly, so the date must be cleared):

```json
{ "frequency": "sixmonthly", "expiryDate": null }
```

> **Important: the server does NOT validate this.** It doesn't check that the date is after the
> test date, and it doesn't clear `expiryDate` when the frequency changes. The web app enforces all
> of this on the client, so **the mobile app must enforce it too.** If you send
> `expiryDate` with a non-3-monthly/non-custom frequency, it is stored as-is and can leak into
> reports later if the frequency is changed back.

---

## 3. Web implementation, file by file

### 3.1 Test screen: `client/src/pages/test-details.tsx` (electrical)

1. **State.** One shared `customExpiryDate` string state (`''` when empty) is reused for both the
   Custom Frequency expiry date and the new 3 Monthly custom due date.
2. **Session test date.** It is read from the session:
   `const testDate = sessionData?.session?.testDate || '';`
3. **Reset on frequency change.** In the frequency `Select`'s `onValueChange`, it calls
   `setCustomExpiryDate('')` so a date entered for one frequency never carries over to another.
4. **New field.** Rendered only when `selectedFrequency === 'threemonthly'`:
   - Label: **"Custom Due Date (Optional)"**
   - `type="date"` input with `min={testDate}` (the picker can't select earlier dates)
   - Helper text: **"Leave blank to use 3 months from the test date"**
5. **The existing Custom Frequency date input** also got `min={testDate}`.
6. **Validation on submit** (after the existing "Custom frequency requires an expiry date" check):
   ```ts
   const usesExpiryDate = selectedFrequency === 'customfrequency' || selectedFrequency === 'threemonthly';
   if (usesExpiryDate && customExpiryDate && testDate && customExpiryDate < testDate) {
     toast({ title: 'Invalid date', description: 'The date cannot be before the test date.', variant: 'destructive' });
     return;
   }
   ```
   (The string comparison works because both values are `yyyy-mm-dd`.)
7. **Payload:**
   ```ts
   expiryDate: usesExpiryDate ? customExpiryDate || null : null,
   ```

### 3.2 Edit dialog: `client/src/components/test-result-edit-modal.tsx`

Used from **Report Preview** (technician) and the **Admin Dashboard**.

1. **New prop `testDate`** (`yyyy-mm-dd`). It is passed in from:
   - `client/src/pages/report-preview.tsx`: `testDate={session?.testDate}`
   - `client/src/pages/admin-dashboard.tsx`: `testDate={viewingSession?.session?.testDate}`
2. **Frequency change clears the date** unless the new frequency uses it:
   ```ts
   const keepsExpiryDate = value === 'customfrequency' || value === 'threemonthly';
   setEditResultData(prev => ({ ...prev, frequency: value, expiryDate: keepsExpiryDate ? prev.expiryDate : null }));
   ```
3. **Frequency options per service:**

   | Service | Options shown (label → value) |
   |---|---|
   | `emergency_exit_light`, `fire_testing` | 6 Monthly → `sixmonthly`, 12 Monthly → `annually` |
   | everything else | Monthly → `monthly`, 3 Monthly → `threemonthly`, 6 Monthly → `sixmonthly`, 12 Monthly → `twelvemonthly`, 24 Monthly → `twentyfourmonthly`, 5 Yearly → `fiveyearly`, plus Custom Frequency → `customfrequency` (**electrical only**) |

   > Note: fire testing previously showed "12 Monthly" as `twelvemonthly` in the edit dialog, but
   > its test screen saves `annually`. Fire and EEL now both use `annually`, so check the mobile
   > edit screen uses the same value.
4. **New field.** Shown when `serviceType === 'electrical' && frequency === 'threemonthly'`. It has
   the same label, `min`, and helper text as the test screen, and is bound to
   `editResultData.expiryDate` (an empty input becomes `null`).
5. **Inline error.** It also covers the existing Custom Frequency field:
   ```ts
   const isExpiryBeforeTestDate =
     (frequency === 'customfrequency' || frequency === 'threemonthly') &&
     !!expiryDate && !!testDate && expiryDate < testDate;
   ```
   When this is true, it shows red text **"The date cannot be before the test date."** under the field.
6. **Save button disabled** when `isExpiryBeforeTestDate` is true. This is in addition to the
   existing disabled conditions, including "custom frequency with no expiry date".

### 3.3 Reports: `client/src/lib/pdf-generator.ts` and `client/src/lib/excel-generator.ts`

Both have an identical `calculateNextDueDate(testDate, frequency, result, customExpiryDate)`.
The only change is that the custom-date branch now also accepts `threemonthly`:

```ts
function calculateNextDueDate(testDate, frequency, result, customExpiryDate) {
  const date = new Date(testDate);

  if (result === 'fail') return format(date);            // failed = due immediately

  if ((frequency === 'customfrequency' || frequency === 'threemonthly') && customExpiryDate) {
    return format(new Date(customExpiryDate));           // custom date wins
  }

  switch (frequency) {
    case 'monthly':           date.setMonth(date.getMonth() + 1); break;
    case 'threemonthly':      date.setMonth(date.getMonth() + 3); break;   // fallback when blank
    case 'sixmonthly':        date.setMonth(date.getMonth() + 6); break;
    case 'twelvemonthly':     date.setFullYear(date.getFullYear() + 1); break;
    case 'twentyfourmonthly': date.setFullYear(date.getFullYear() + 2); break;
    case 'fiveyearly':        date.setFullYear(date.getFullYear() + 5); break;
    default:                  date.setFullYear(date.getFullYear() + 1);   // incl. 'annually'
  }
  return format(date);
}
// format = toLocaleDateString('en-AU') → dd/mm/yyyy
```

Callers pass `result.expiryDate` as the 4th argument (PDF: `pdf-generator.ts:686, 715, 820`;
Excel: `excel-generator.ts:145, 253, 404, 446, 546`).

The frequency **code/label** columns did not change. A 3 Monthly item with a custom due date
still shows as 3 Monthly (`3M`). Only the due date column is different.

---

## 4. What to do in the mobile app

### 4.1 Checklist

- [ ] **Electrical test screen:** add an optional "Custom Due Date" date picker, shown only when
      frequency = 3 Monthly.
- [ ] **Electrical test screen:** clear the date whenever the frequency changes.
- [ ] **Electrical test screen:** set the date picker's minimum date to the session test date, for
      both the 3 Monthly field and the existing Custom Frequency field.
- [ ] **Electrical test screen:** on save, block a date before the test date with the message
      "The date cannot be before the test date."
- [ ] **Electrical test screen:** send `expiryDate` as `yyyy-mm-dd` for `threemonthly` /
      `customfrequency`, and send `null` for everything else, including blank 3 Monthly.
- [ ] **Edit result screen:** add the same optional field for electrical + 3 Monthly, using the
      same minimum date.
- [ ] **Edit result screen:** when the frequency changes to anything other than
      `threemonthly`/`customfrequency`, set `expiryDate` to `null` and **send it in the PATCH**.
- [ ] **Edit result screen:** show an inline error and disable Save when the date is before the test
      date.
- [ ] **Edit result screen:** restrict EEL and Fire frequencies to `sixmonthly` / `annually` only.
- [ ] **Edit result screen:** load an existing `expiryDate` (or `expiry_date`) into the field when
      opening a 3 Monthly item.
- [ ] **Due date display:** anywhere the app calculates or shows "Next Due" (result list, item
      detail, on-device PDF, labels or tags), use the custom date for `threemonthly` when it is set.
- [ ] **Offline queue / local DB:** make sure `expiryDate` is stored, synced, and not dropped for
      `threemonthly` items. Some code may only keep it for `customfrequency`.

### 4.2 Test screen logic (pseudo-code)

```ts
// state
const [frequency, setFrequency] = useState(lastFrequency ?? 'twelvemonthly');
const [customExpiryDate, setCustomExpiryDate] = useState<string>(''); // yyyy-mm-dd or ''
const testDate = session.testDate; // yyyy-mm-dd

const usesExpiryDate = frequency === 'customfrequency' || frequency === 'threemonthly';

function onFrequencyChange(value) {
  setFrequency(value);
  setCustomExpiryDate('');            // never carry a date across frequencies
}

function onSubmit() {
  if (frequency === 'customfrequency' && !customExpiryDate) {
    return showError('Expiry date required', 'Please enter an expiry date for the custom frequency.');
  }
  if (usesExpiryDate && customExpiryDate && testDate && customExpiryDate < testDate) {
    return showError('Invalid date', 'The date cannot be before the test date.');
  }
  save({
    ...,
    frequency,
    expiryDate: usesExpiryDate ? (customExpiryDate || null) : null,
  });
}
```

UI (render only when `frequency === 'threemonthly'`):

```
Custom Due Date (Optional)
[ dd/mm/yyyy  📅 ]  (minimum date = session test date, with a clear/reset option)
Leave blank to use 3 months from the test date
```

> **Mobile date picker note:** native pickers (`@react-native-community/datetimepicker`, etc.) do
> not have an "empty" state. Add a **Clear** button (or "×") so the user can go back to blank,
> otherwise they can never undo the custom date. Use `minimumDate` for the test date restriction,
> but **keep the save-time check as well**, because a date can also come from loaded data.

### 4.3 Edit screen logic (pseudo-code)

```ts
function onFrequencyChange(value) {
  const keeps = value === 'customfrequency' || value === 'threemonthly';
  setEdit(prev => ({ ...prev, frequency: value, expiryDate: keeps ? prev.expiryDate : null }));
}

const isExpiryBeforeTestDate =
  (edit.frequency === 'customfrequency' || edit.frequency === 'threemonthly') &&
  !!edit.expiryDate && !!testDate && edit.expiryDate < testDate;

const saveDisabled =
  isSaving || !edit.assetNumber?.trim() ||
  (edit.frequency === 'customfrequency' && !edit.expiryDate) ||
  isExpiryBeforeTestDate;

const frequencyOptions =
  serviceType === 'emergency_exit_light' || serviceType === 'fire_testing'
    ? [{ label: '6 Monthly', value: 'sixmonthly' }, { label: '12 Monthly', value: 'annually' }]
    : [
        { label: 'Monthly', value: 'monthly' },
        { label: '3 Monthly', value: 'threemonthly' },
        { label: '6 Monthly', value: 'sixmonthly' },
        { label: '12 Monthly', value: 'twelvemonthly' },
        { label: '24 Monthly', value: 'twentyfourmonthly' },
        { label: '5 Yearly', value: 'fiveyearly' },
        ...(serviceType === 'electrical' ? [{ label: 'Custom Frequency', value: 'customfrequency' }] : []),
      ];
```

PATCH body: always include `frequency` and `expiryDate`, so a cleared date is actually saved to
the server.

### 4.4 Due date calculation

Use the same function as section 3.3 (port it as-is). Key points:

1. `fail` comes first: return the test date.
2. Then, if `frequency` is `customfrequency` **or** `threemonthly` and `expiryDate` is set, return
   `expiryDate`.
3. Otherwise add the interval to the test date.

### 4.5 Date handling pitfalls

- **Keep dates as `yyyy-mm-dd` strings** for storage, comparison, and API calls. Only format for
  display (`dd/mm/yyyy`, en-AU). Comparing the strings directly (`a < b`) is correct and avoids
  timezone bugs.
- When turning a native picker's `Date` into a string, use the **local** date parts (`getFullYear`,
  `getMonth()+1`, `getDate`, zero-padded), **not** `toISOString()`. In AU/NZ (UTC+8 to +13),
  `toISOString()` can move the date back by one day.
- When parsing `yyyy-mm-dd` to show in a picker, build a local date
  (`new Date(y, m - 1, d)`) instead of `new Date('yyyy-mm-dd')`, which is parsed as UTC.
- The same day as the test date is **allowed**; only earlier dates are blocked.

---

## 5. Test cases for the mobile app

| # | Steps | Expected |
|---|---|---|
| 1 | Electrical, 3 Monthly, leave date blank, pass, generate report | Due = test date + 3 months; API stored `expiryDate: null` |
| 2 | Electrical, 3 Monthly, set date = test date + 45 days | Saved; report Due = that date; frequency still shows 3 Monthly / 3M |
| 3 | Electrical, 3 Monthly, try a date before the test date | Picker blocks it; if forced, save is blocked with "The date cannot be before the test date." |
| 4 | Electrical, 3 Monthly, date = test date | Allowed |
| 5 | Pick 3 Monthly, set a date, switch to 6 Monthly, save | `expiryDate: null` saved; due = +6 months |
| 6 | Pick 3 Monthly + date, switch to Custom Frequency | Field is empty; Custom Frequency still requires a date |
| 7 | Custom Frequency with a date before the test date | Blocked (new rule) |
| 8 | 3 Monthly + custom date, result = **fail** | Report Due = test date |
| 9 | Edit an existing 3 Monthly item that has a custom date | Field is pre-filled; clearing it and saving falls back to +3 months |
| 10 | Edit an item: 3 Monthly + date → 12 Monthly → save | PATCH sends `expiryDate: null`; web report shows +12 months |
| 11 | Edit an EEL item or Fire item | Only 6 Monthly and 12 Monthly are offered; 12 Monthly saves as `annually` |
| 12 | Create on mobile, open in web Report Preview / Admin edit dialog | Web shows the same custom due date (shared field, check both directions) |
| 13 | Offline: create a 3 Monthly item with a date, then sync | `expiryDate` reaches the server unchanged |

---

## 6. Optional hardening (server, not done yet)

Since mobile and web both rely on client-side checks, consider adding these to `server/routes.ts`
for the create, batch and PATCH result routes:

- Reject `expiryDate < session.testDate` with `400 { message: "The date cannot be before the test date." }`.
- Force `expiryDate = null` when `frequency` is not `threemonthly` or `customfrequency`.

This would protect the data from older mobile builds that don't have this feature yet.
