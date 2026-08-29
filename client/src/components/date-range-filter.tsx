import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

type Preset = "all" | "today" | "week" | "month" | "custom_date" | "custom_range";

/** `from`/`to` are YYYY-MM-DD strings; an empty string means "no bound". */
export type DateFilter = { preset: Preset; from: string; to: string };

export const EMPTY_DATE_FILTER: DateFilter = { preset: "all", from: "", to: "" };

/** Today's date in Australian Central Time as YYYY-MM-DD. */
function australianToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Adelaide",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Shifts a YYYY-MM-DD date by whole days, staying in UTC so no timezone drift creeps in. */
function addDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Resolves a preset to its full calendar period, so records dated later in the
 * current week/month still match.
 */
function presetRange(preset: Preset): { from: string; to: string } {
  const today = australianToday();

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "week": {
      // Weeks run Monday to Sunday
      const daysSinceMonday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
      return { from: addDays(today, -daysSinceMonday), to: addDays(today, 6 - daysSinceMonday) };
    }
    case "month": {
      const [year, month] = today.split("-").map(Number);
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-${lastDay}` };
    }
    default:
      return { from: "", to: "" };
  }
}

/** YYYY-MM-DD to the DD/MM/YYYY form used elsewhere in the app. */
function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

interface DateRangeFilterProps {
  label?: string;
  value: DateFilter;
  onChange: (value: DateFilter) => void;
  testIdPrefix?: string;
}

/**
 * Date filter used by the reports, drafts and certificates lists. Offers quick
 * presets plus a single custom date or a custom range.
 *
 * Fully controlled — the selected preset is part of `value` so that it survives
 * re-renders and stays in step when the parent clears the filter.
 */
export function DateRangeFilter({
  label = "Filter by Date",
  value,
  onChange,
  testIdPrefix = "date-range",
}: DateRangeFilterProps) {
  const { preset, from, to } = value;

  const handlePresetChange = (next: Preset) => {
    if (next === "custom_date") {
      // A single day, seeded from whatever the range already started at
      onChange({ preset: next, from, to: from });
    } else if (next === "custom_range") {
      // Keep the current bounds for the user to adjust
      onChange({ preset: next, from, to });
    } else {
      onChange({ preset: next, ...presetRange(next) });
    }
  };

  const isCustom = preset === "custom_date" || preset === "custom_range";
  const showResolvedRange = !isCustom && Boolean(from && to);

  return (
    <div>
      <Label className="text-sm font-medium block mb-1">{label}</Label>
      <div className="flex items-center gap-2">
        <Select value={preset} onValueChange={(next) => handlePresetChange(next as Preset)}>
          <SelectTrigger className="w-40" data-testid={`${testIdPrefix}-preset`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="custom_date">Custom Date</SelectItem>
            <SelectItem value="custom_range">Custom Range</SelectItem>
          </SelectContent>
        </Select>

        {preset === "custom_date" && (
          <Input
            type="date"
            className="w-40"
            value={from}
            aria-label="Date"
            onChange={(e) => onChange({ preset, from: e.target.value, to: e.target.value })}
            data-testid={`${testIdPrefix}-date`}
          />
        )}

        {preset === "custom_range" && (
          <>
            <Input
              type="date"
              className="w-40"
              value={from}
              max={to || undefined}
              aria-label="From date"
              onChange={(e) => onChange({ preset, from: e.target.value, to })}
              data-testid={`${testIdPrefix}-from`}
            />
            <span className="text-sm text-gray-500">to</span>
            <Input
              type="date"
              className="w-40"
              value={to}
              min={from || undefined}
              aria-label="To date"
              onChange={(e) => onChange({ preset, from, to: e.target.value })}
              data-testid={`${testIdPrefix}-to`}
            />
          </>
        )}

        {showResolvedRange && (
          <span className="text-xs text-gray-500 whitespace-nowrap" data-testid={`${testIdPrefix}-resolved`}>
            {from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`}
          </span>
        )}

        {(preset !== "all" || from || to) && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_DATE_FILTER)}
            className="text-gray-500 hover:text-gray-900"
            title="Clear date filter"
            aria-label="Clear date filter"
            data-testid={`${testIdPrefix}-clear`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
