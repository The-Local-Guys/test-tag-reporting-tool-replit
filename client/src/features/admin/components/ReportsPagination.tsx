import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { REPORTS_PAGE_SIZE_OPTIONS, type DashboardVariant } from "../utils";

const STYLES = {
  classic: {
    summary: "text-sm text-gray-600",
    controls: "flex items-center gap-3",
    sizeLabel: "text-sm whitespace-nowrap",
    sizeTrigger: "w-20",
    pages: "flex items-center gap-1",
    arrow: "p-2 h-8 w-8",
    page: () => "h-8 w-8 p-0 text-sm",
  },
  v2: {
    summary: "text-sm text-slate-500 tabular-nums",
    controls: "flex flex-wrap items-center gap-3",
    sizeLabel: "text-sm font-normal text-slate-500 whitespace-nowrap",
    sizeTrigger: "h-8 w-20 rounded-lg border-slate-200",
    pages: "flex flex-wrap items-center gap-1",
    arrow: "p-2 h-8 w-8 rounded-lg border-slate-200",
    page: (active: boolean) =>
      cn("h-8 min-w-8 px-2 rounded-lg text-sm tabular-nums", active ? "bg-slate-900 hover:bg-slate-800" : "border-slate-200 text-slate-600"),
  },
};

export function ReportsPagination({
  page,
  totalPages,
  total,
  limit = 50,
  onPageChange,
  pageSize,
  onPageSizeChange,
  variant = "classic",
}: {
  page: number;
  totalPages: number;
  total: number;
  limit?: number;
  onPageChange: (p: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  variant?: DashboardVariant;
}) {
  const styles = STYLES[variant];

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <p className={styles.summary}>
        Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} reports
      </p>
      <div className={styles.controls}>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <Label className={styles.sizeLabel}>Show:</Label>
            <Select
              value={(pageSize ?? limit).toString()}
              onValueChange={(value) => onPageSizeChange(parseInt(value))}
            >
              <SelectTrigger className={styles.sizeTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORTS_PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {totalPages > 1 && (
          <div className={styles.pages}>
            <Button
              variant="outline"
              size="sm"
              className={styles.arrow}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {getPageNumbers().map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1 text-sm text-gray-400">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  className={styles.page(p === page)}
                  onClick={() => onPageChange(p as number)}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              className={styles.arrow}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
