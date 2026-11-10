/** Formatting helpers and constants shared by the admin dashboards (/admin and /admin/v2). */

export type UserRole = "super_admin" | "support_center" | "technician";

export type AdminUser = { fullName?: string; role?: UserRole; id?: number };

/** Style family of the dashboard: the original /admin page or the /admin/v2 redesign. */
export type DashboardVariant = "classic" | "v2";

/** Row-level actions a report or draft table can trigger. */
export interface ReportRowActions {
  onView: (session: any) => void;
  onEditSession: (session: any) => void;
  onContinue: (session: any) => void;
  onAttachCertificate: (session: any) => void;
  onCopy: (session: any) => void;
}

export const REPORTS_PAGE_SIZE_OPTIONS = [50, 100, 150, 200] as const;
export const DEFAULT_REPORTS_PAGE_SIZE = 50;

export const SERVICE_TYPE_FILTER_OPTIONS = [
  { value: "electrical", label: "Electrical Test & Tag" },
  { value: "emergency_exit_light", label: "Emergency Exit Light Testing" },
  { value: "fire_testing", label: "Fire Equipment Testing" },
  { value: "rcd_reporting", label: "RCD Testing" },
  { value: "microwave_leakage", label: "Microwave Leakage Testing" },
] as const;

/** Turns a stored role such as `support_center` into "Support Center". */
export function formatRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    super_admin: "Super Admin",
    support_center: "Support Center",
    technician: "Technician",
  };
  return (
    labels[role] ||
    role
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

/** Badge colours for the user roles shown in user management. */
export function getRoleBadgeClass(role: string): string {
  switch (role) {
    case "super_admin":
      return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800";
    case "support_center":
      return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800";
    case "technician":
      return "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
}

export function formatReportDetail(value?: string | null): string {
  if (!value) return "-";

  const labels: Record<string, string> = {
    class1: "Class 1",
    class2: "Class 2",
    epod: "EPOD",
    rcd: "RCD",
    "3phase": "3 Phase",
    "fixed-rcd": "Fixed RCD",
    "portable-rcd": "Portable RCD",
    fire_extinguisher: "Fire Extinguisher",
    fire_blanket: "Fire Blanket",
    fire_hose_reel: "Fire Hose Reel",
    fire_hydrant: "Fire Hydrant",
    non_maintained: "Non-Maintained",
    led: "LED",
    co2: "CO2",
  };

  return (
    labels[value] ||
    value
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

/**
 * Service type label for table rows. The reports table labels microwave sessions
 * "Microwave Leakage Testing" while the drafts tables use the short form.
 */
export function getServiceTypeLabel(serviceType?: string, longMicrowaveLabel = false): string {
  switch (serviceType) {
    case "emergency_exit_light":
      return "Emergency Exit Light";
    case "fire_testing":
      return "Fire Testing";
    case "rcd_reporting":
      return "RCD Reporting";
    case "microwave_leakage":
      return longMicrowaveLabel ? "Microwave Leakage Testing" : "Microwave Leakage";
    default:
      return "Electrical Test & Tag";
  }
}

/** Last-activity timestamp of a draft as DD/MM, HH:MM. */
export function formatLastActivity(value?: string | null): string {
  return value
    ? new Date(value).toLocaleString("en-AU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A";
}

/** Local YYYY-MM-DD key for a timestamp, matching the date shown in the Created column. */
export function toLocalDateKey(value: any): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Sort test results by asset number with proper numerical order
 * Monthly frequencies (1, 2, 3...) display first, then 5-yearly (10001, 10002, 10003...)
 */
export function sortAssetNumbers(results: any[]): any[] {
  return [...results].sort((a: any, b: any) => {
    const aAssetNum = parseInt(a.assetNumber) || 0;
    const bAssetNum = parseInt(b.assetNumber) || 0;
    return aAssetNum - bAssetNum;
  });
}

/** Whether the role can see every user's reports and drafts. */
export function isAdminRole(role?: string): boolean {
  return role === "super_admin" || role === "support_center";
}
