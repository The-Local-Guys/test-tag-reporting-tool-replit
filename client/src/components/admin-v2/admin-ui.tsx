import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Building blocks for the redesigned admin dashboard (/admin/v2). */

const SERVICE_STYLES: Record<string, { label: string; dot: string }> = {
  emergency_exit_light: { label: "Emergency Exit Light", dot: "bg-red-500" },
  fire_testing: { label: "Fire Testing", dot: "bg-orange-500" },
  rcd_reporting: { label: "RCD Reporting", dot: "bg-violet-500" },
  microwave_leakage: { label: "Microwave Leakage", dot: "bg-teal-500" },
  electrical: { label: "Electrical Test & Tag", dot: "bg-blue-500" },
};

/**
 * Service type label with a colour dot. The reports table labels microwave
 * sessions "Microwave Leakage Testing" while the drafts tables use the short form.
 */
export function ServiceBadge({ serviceType, longMicrowaveLabel = false }: { serviceType?: string; longMicrowaveLabel?: boolean }) {
  const style = SERVICE_STYLES[serviceType ?? ""] ?? SERVICE_STYLES.electrical;
  const label =
    serviceType === "microwave_leakage" && longMicrowaveLabel ? "Microwave Leakage Testing" : style.label;
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
      <span className={cn("h-2 w-2 rounded-full", style.dot)} />
      {label}
    </span>
  );
}

/** Passed / failed counts for a session row, with a thin ratio bar. */
export function PassFailCounts({ totalItems, failedItems, hideLabelsOnMobile = false }: { totalItems?: number; failedItems?: number; hideLabelsOnMobile?: boolean }) {
  const failed = failedItems || 0;
  const passed = (totalItems || 0) - failed;
  const total = passed + failed;
  const passPct = total > 0 ? (passed / total) * 100 : 0;
  const labelClass = hideLabelsOnMobile ? "hidden sm:inline" : "";
  return (
    <div className="min-w-[96px] space-y-1.5">
      <div className="flex items-center gap-3 text-xs tabular-nums">
        <span className="font-semibold text-emerald-700">
          {passed} <span className={cn("font-normal text-slate-500", labelClass)}>Pass</span>
        </span>
        <span className={cn("font-semibold", failed > 0 ? "text-red-600" : "text-slate-400")}>
          {failed} <span className={cn("font-normal text-slate-500", labelClass)}>Fail</span>
        </span>
      </div>
      <div className="flex h-1 w-full overflow-hidden rounded-full bg-slate-100">
        {total > 0 && (
          <>
            <div className="bg-emerald-500" style={{ width: `${passPct}%` }} />
            <div className="bg-red-500" style={{ width: `${100 - passPct}%` }} />
          </>
        )}
      </div>
    </div>
  );
}

/** The certificate a session is linked to, or a dash. */
export function CertificateCell({ clientName }: { clientName?: string | null }) {
  if (!clientName) return <span className="text-xs text-slate-300">—</span>;
  return (
    <span
      className="inline-flex max-w-[170px] items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
      title={clientName}
    >
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{clientName}</span>
    </span>
  );
}

const ACTION_TONES = {
  neutral: "hover:text-slate-900 hover:bg-slate-100",
  green: "hover:text-emerald-700 hover:bg-emerald-50",
  emerald: "hover:text-teal-700 hover:bg-teal-50",
  blue: "hover:text-blue-700 hover:bg-blue-50",
  red: "hover:text-red-600 hover:bg-red-50",
} as const;

/** Compact icon-only row action. `title` doubles as the tooltip and accessible name. */
export function RowAction({
  icon: Icon,
  title,
  onClick,
  tone = "neutral",
  testId,
}: {
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  tone?: keyof typeof ACTION_TONES;
  testId?: string;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onClick}
      className={cn("h-7 w-7 rounded-md p-0 text-slate-400 transition-colors", ACTION_TONES[tone])}
      title={title}
      aria-label={title}
      data-testid={testId}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

/** Headline number card. */
export function StatTile({
  label,
  value,
  icon: Icon,
  accent,
  hint,
  progress,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  accent: "blue" | "emerald" | "violet" | "amber";
  hint?: ReactNode;
  /** 0–100; draws a thin bar under the number. */
  progress?: number;
}) {
  const accents = {
    blue: { icon: "text-blue-600 bg-blue-50", bar: "bg-blue-500" },
    emerald: { icon: "text-emerald-600 bg-emerald-50", bar: "bg-emerald-500" },
    violet: { icon: "text-violet-600 bg-violet-50", bar: "bg-violet-500" },
    amber: { icon: "text-amber-600 bg-amber-50", bar: "bg-amber-500" },
  };
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="truncate text-sm font-medium text-slate-500">{label}</div>
        <div className={cn("hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex", accents[accent].icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-slate-900 sm:text-3xl">{value}</div>
      {progress !== undefined && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
          <div className={cn("h-full rounded-full", accents[accent].bar)} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {hint && <div className="mt-2 truncate text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

/** Card that frames one admin section: header, optional filter toolbar, body. */
export function SectionPanel({
  title,
  count,
  description,
  actions,
  toolbar,
  children,
}: {
  title: string;
  /** Optional record count shown beside the title. */
  count?: number;
  description?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
            {count !== undefined && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
                {count}
              </span>
            )}
          </div>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {toolbar && (
        <div
          className={cn(
            "mt-4 flex flex-wrap items-end gap-3 border-y border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6",
            // Uniform control sizing, including the shared DateRangeFilter
            "[&_div.flex]:flex-wrap [&_label]:mb-1.5 [&_label]:text-xs [&_label]:font-medium [&_label]:text-slate-500",
            "[&_input]:h-9 [&_input]:rounded-lg [&_input]:border-slate-200 [&_input]:bg-white [&_input]:shadow-none",
            "[&_button[role=combobox]]:h-9 [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:border-slate-200 [&_button[role=combobox]]:bg-white",
          )}
        >
          {toolbar}
        </div>
      )}
      <div className={cn("px-5 pb-5 sm:px-6", toolbar ? "pt-4" : "pt-5")}>{children}</div>
    </section>
  );
}

/** Labelled filter control in a section toolbar. */
export function FilterField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="w-full sm:w-auto">
      <label htmlFor={htmlFor} className="block">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Table wrapper with the v2 table styling. Never scrolls sideways: from `xl`
 * up it is a compact table, below that each row becomes a card whose cells
 * are labelled from their `data-label` attribute. Cells marked
 * `data-span="full"` take a whole card row; `data-actions` cells sit at the
 * bottom of the card.
 *
 * `bleed` pulls the table out to the edges of a SectionPanel body.
 */
export function DataTableFrame({ children, bleed = true }: { children: ReactNode; bleed?: boolean }) {
  return (
    <div
      className={cn(
        bleed && "-mx-5 sm:-mx-6",
        // The shared <Table> wraps itself in an overflow-auto div; keep it from scrolling
        "[&_div.overflow-auto]:overflow-visible",
        // Table layout (xl and up)
        "[&_thead_tr]:border-slate-100 [&_thead_tr]:bg-slate-50/70 [&_thead_tr:hover]:bg-slate-50/70",
        "[&_th]:h-10 [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:leading-tight [&_th]:text-slate-500",
        "[&_tbody_tr]:border-slate-100 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-slate-50/80",
        "[&_td]:px-3 [&_td]:py-3.5 [&_td]:text-sm",
        bleed &&
          "xl:[&_th:first-child]:pl-6 xl:[&_td:first-child]:pl-6 xl:[&_th:last-child]:pr-6 xl:[&_td:last-child]:pr-6",
        // Card layout (below xl)
        "max-xl:[&_thead]:hidden max-xl:[&_table]:block max-xl:[&_tbody]:block",
        "max-xl:[&_tbody_tr]:grid max-xl:[&_tbody_tr]:grid-cols-2 md:max-xl:[&_tbody_tr]:grid-cols-3 lg:max-xl:[&_tbody_tr]:grid-cols-4",
        "max-xl:[&_tbody_tr]:gap-x-4 max-xl:[&_tbody_tr]:gap-y-3 max-xl:[&_tbody_tr]:py-4",
        bleed ? "max-xl:[&_tbody_tr]:px-5 sm:max-xl:[&_tbody_tr]:px-6" : "max-xl:[&_tbody_tr]:px-4",
        "max-xl:[&_td]:flex max-xl:[&_td]:min-w-0 max-xl:[&_td]:flex-col max-xl:[&_td]:items-start max-xl:[&_td]:gap-1 max-xl:[&_td]:p-0",
        "max-xl:[&_td[data-label]]:before:content-[attr(data-label)] max-xl:[&_td[data-label]]:before:text-[11px] max-xl:[&_td[data-label]]:before:font-medium max-xl:[&_td[data-label]]:before:uppercase max-xl:[&_td[data-label]]:before:tracking-wide max-xl:[&_td[data-label]]:before:text-slate-400",
        "max-xl:[&_td[colspan]]:col-span-full max-xl:[&_td[data-span=full]]:col-span-full",
        "max-xl:[&_td[data-actions]]:col-span-full max-xl:[&_td[data-actions]]:border-t max-xl:[&_td[data-actions]]:border-slate-100 max-xl:[&_td[data-actions]]:pt-2",
      )}
    >
      {children}
    </div>
  );
}

/** Small initials avatar. */
export function InitialsAvatar({ name, className }: { name?: string | null; className?: string }) {
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600",
        className,
      )}
    >
      {initials}
    </span>
  );
}
