import type { LucideIcon } from "lucide-react";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getServiceTypeLabel } from "../utils";

/** Building blocks for the original admin dashboard (/admin). */

const SERVICE_BADGE_CLASSES: Record<string, string> = {
  emergency_exit_light: "bg-red-50 text-red-700",
  fire_testing: "bg-orange-50 text-orange-700",
  rcd_reporting: "bg-purple-50 text-purple-700",
  microwave_leakage: "bg-teal-50 text-teal-700",
};

export function ClassicServiceBadge({ serviceType, longMicrowaveLabel = false }: { serviceType?: string; longMicrowaveLabel?: boolean }) {
  return (
    <Badge variant="outline" className={SERVICE_BADGE_CLASSES[serviceType ?? ""] ?? "bg-blue-50 text-blue-700"}>
      {getServiceTypeLabel(serviceType, longMicrowaveLabel)}
    </Badge>
  );
}

/** Passed / failed counts for a session row as two coloured circles. */
export function ClassicPassFailCounts({ totalItems, failedItems, hideLabelsOnMobile = false }: { totalItems?: number; failedItems?: number; hideLabelsOnMobile?: boolean }) {
  const labelClass = hideLabelsOnMobile ? "hidden sm:inline" : "";
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <div className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-medium">
          {(totalItems || 0) - (failedItems || 0)}
        </div>
        <span className={cn("text-xs text-green-600", labelClass)}>Pass</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-medium">
          {failedItems || 0}
        </div>
        <span className={cn("text-xs text-red-600", labelClass)}>Fail</span>
      </div>
    </div>
  );
}

/** The certificate a session is linked to, or a dash. */
export function ClassicCertificateBadge({ clientName }: { clientName?: string | null }) {
  if (!clientName) return <span className="text-xs text-gray-400">—</span>;
  return (
    <Badge
      variant="outline"
      className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 font-normal"
      title={clientName}
    >
      <ShieldCheck className="w-3 h-3" />
      <span className="max-w-[120px] truncate">{clientName}</span>
    </Badge>
  );
}

const ACTION_TONES = {
  neutral: "",
  green: "text-green-600 hover:bg-green-50 hover:border-green-300",
  emerald: "text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300",
  blue: "text-blue-600 hover:bg-blue-50 hover:border-blue-300",
  red: "text-red-600 hover:bg-red-50 hover:border-red-300",
} as const;

/** Square outlined icon button for a table row. `title` doubles as the tooltip. */
export function ClassicRowAction({
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
      variant="outline"
      onClick={onClick}
      className={cn("p-2 h-8 w-8", ACTION_TONES[tone])}
      title={title}
      aria-label={title}
      data-testid={testId}
    >
      <Icon className="w-4 h-4" />
    </Button>
  );
}
