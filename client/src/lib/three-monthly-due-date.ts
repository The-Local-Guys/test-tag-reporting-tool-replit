// Suggested due date for 3 monthly electrical items: the last day of the 3-month block
// (Dec–Feb, Mar–May, Jun–Aug, Sep–Nov) that the test date falls in.
// Dates are plain yyyy-mm-dd strings, handled in UTC so the local timezone can't shift the day.

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getSuggestedThreeMonthlyDueDate(testDate: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(testDate || '');
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]); // 1-12
  if (month < 1 || month > 12) return null;

  // Block end month (1-based) for each test month Jan..Dec. December belongs to next year's Feb block.
  const endMonth = [2, 2, 5, 5, 5, 8, 8, 8, 11, 11, 11, 2][month - 1];
  const endYear = month === 12 ? year + 1 : year;

  // Day 0 of the following month is the last day of endMonth (handles leap years)
  const lastDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
  return `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

// Block a suggested due date closes, e.g. "2026-11-30" -> "Sep–Nov"
export function getThreeMonthlyBlockLabel(dueDate: string): string {
  const month = Number(dueDate.split('-')[1]);
  return `${MONTH_LABELS[(month + 9) % 12]}–${MONTH_LABELS[month - 1]}`;
}

// "2026-11-30" -> "30 Nov 2026"
export function formatSuggestedDueDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${MONTH_LABELS[month - 1]} ${year}`;
}
