import { LoadingSpinner } from "@/components/ui/loading-spinner";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";
import type { DashboardVariant } from "../utils";

const STYLES = {
  classic: {
    page: "min-h-screen bg-gray-50 flex items-center justify-center",
    card: "text-center space-y-6",
    logo: "h-24 w-auto object-contain",
    title: "text-lg font-medium text-gray-700",
    hint: "text-sm text-gray-500",
  },
  v2: {
    page: "min-h-screen bg-slate-50 flex items-center justify-center",
    card: "w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-6",
    logo: "h-20 w-auto object-contain",
    title: "text-lg font-semibold text-slate-800",
    hint: "text-sm text-slate-500",
  },
};

/** Full-screen loader shown while navigating into the testing flow to continue a report. */
export function ContinuingReportScreen({ variant = "classic" }: { variant?: DashboardVariant }) {
  const styles = STYLES[variant];
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className="flex justify-center">
          <img src={logoPath} alt="The Local Guys" className={styles.logo} />
        </div>
        <div className="space-y-2">
          <LoadingSpinner />
          <p className={styles.title}>Continuing Report...</p>
          <p className={styles.hint}>Loading item selection page</p>
        </div>
      </div>
    </div>
  );
}
