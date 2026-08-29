import { FileText, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NoResultsProps {
  /** True when any search/filter is narrowing the list. */
  hasFilters: boolean;
  /** Shown when the list is genuinely empty rather than filtered down to nothing. */
  emptyTitle: string;
  emptyHint?: string;
  onClearFilters?: () => void;
  testId?: string;
}

/**
 * Empty state for the report, draft and certificate lists. Distinguishes
 * "nothing here yet" from "nothing matches the current filters", so an
 * over-narrow filter doesn't read as missing data.
 */
export function NoResults({
  hasFilters,
  emptyTitle,
  emptyHint,
  onClearFilters,
  testId = "no-results",
}: NoResultsProps) {
  if (hasFilters) {
    return (
      <div className="text-center py-8 text-gray-500" data-testid={`${testId}-filtered`}>
        <SearchX className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="font-medium text-gray-700">No records found with the selected filters</p>
        <p className="text-sm">Try widening the date range or clearing the other filters.</p>
        {onClearFilters && (
          <Button variant="outline" size="sm" className="mt-3" onClick={onClearFilters} data-testid={`${testId}-clear`}>
            Clear all filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-8 text-gray-500" data-testid={testId}>
      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p>{emptyTitle}</p>
      {emptyHint && <p className="text-sm">{emptyHint}</p>}
    </div>
  );
}
