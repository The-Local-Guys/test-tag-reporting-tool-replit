import { ChevronLeft, ChevronRight, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTableFrame } from "@/components/admin-v2/admin-ui";
import { formatFrequencyLabel } from "@/lib/report-formatters";
import { formatReportDetail, type DashboardVariant } from "../utils";

/** Column headers that depend on the report's service type. */
function ServiceColumnHeads({ serviceType }: { serviceType: string }) {
  switch (serviceType) {
    case "electrical":
      return (
        <>
          <TableHead>Classification</TableHead>
          <TableHead>Frequency</TableHead>
        </>
      );
    case "emergency_exit_light":
    case "fire_testing":
      return (
        <>
          <TableHead>Equipment Details</TableHead>
          <TableHead>Frequency</TableHead>
        </>
      );
    case "rcd_reporting":
      return (
        <>
          <TableHead>Equipment Type</TableHead>
          <TableHead>DB / CB</TableHead>
          <TableHead>Trip Times</TableHead>
        </>
      );
    case "microwave_leakage":
      return <TableHead>Leakage Reading</TableHead>;
    default:
      return null;
  }
}

/** Cells that depend on the report's service type; matches ServiceColumnHeads. */
function ServiceColumnCells({ result, serviceType }: { result: any; serviceType: string }) {
  const frequencyCell = (
    <TableCell data-label="Frequency">
      <Badge variant="outline">{formatFrequencyLabel(result.frequency, serviceType)}</Badge>
    </TableCell>
  );

  switch (serviceType) {
    case "electrical":
      return (
        <>
          <TableCell data-label="Classification">
            <Badge variant="outline">{formatReportDetail(result.classification)}</Badge>
          </TableCell>
          {frequencyCell}
        </>
      );
    case "emergency_exit_light":
      return (
        <>
          <TableCell data-label="Equipment Details">
            <div className="font-medium">{formatReportDetail(result.maintenanceType)}</div>
            <div className="text-xs text-muted-foreground">
              {result.manufacturerInfo || "Manufacturer not recorded"}
            </div>
            {result.globeType && (
              <div className="text-xs text-muted-foreground">
                Globe: {formatReportDetail(result.globeType)}
              </div>
            )}
          </TableCell>
          {frequencyCell}
        </>
      );
    case "fire_testing":
      return (
        <>
          <TableCell data-label="Equipment Details">
            <div className="font-medium">
              {formatReportDetail(result.classification || result.equipmentType)}
            </div>
            {result.extinguisherType && (
              <div className="text-xs text-muted-foreground">
                {formatReportDetail(result.extinguisherType)}
              </div>
            )}
            {(result.size || result.weight) && (
              <div className="text-xs text-muted-foreground">
                Size: {result.size || "-"} / Weight: {result.weight || "-"}
              </div>
            )}
          </TableCell>
          {frequencyCell}
        </>
      );
    case "rcd_reporting": {
      const tripTimes = Array.isArray(result.tripTimes)
        ? result.tripTimes.filter((time: unknown) => time !== null && time !== undefined)
        : [];
      return (
        <>
          <TableCell data-label="Equipment Type">
            <Badge variant="outline">{formatReportDetail(result.classification)}</Badge>
          </TableCell>
          <TableCell data-label="DB / CB">
            <div>DB: {result.distributionBoardNumber || "-"}</div>
            <div>CB: {result.circuitBreakerNumber || "-"}</div>
          </TableCell>
          <TableCell data-label="Trip Times">
            {tripTimes.length > 0 ? `${tripTimes.join(", ")} ms` : "-"}
          </TableCell>
        </>
      );
    }
    case "microwave_leakage":
      return (
        <TableCell data-label="Leakage Reading">
          {result.leakageReading ? `${result.leakageReading} mW/cm²` : "-"}
        </TableCell>
      );
    default:
      return null;
  }
}

/** Previous / page numbers / Next for the report items. Hidden when everything fits on one page. */
function ResultsPagination({
  totalItems,
  currentPage,
  itemsPerPage,
  onPageChange,
}: {
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
      <div className="text-sm text-gray-500">
        Showing {startIndex + 1} to {endIndex} of {totalItems} items
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        {/* Page numbers */}
        <div className="flex items-center space-x-1">
          {Array.from({ length: totalPages }, (_, i) => {
            const pageNum = i + 1;
            const shouldShow =
              pageNum === 1 ||
              pageNum === totalPages ||
              (pageNum >= currentPage - 1 && pageNum <= currentPage + 1);

            if (!shouldShow) {
              if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                return (
                  <span key={pageNum} className="px-2 text-gray-400">
                    ...
                  </span>
                );
              }
              return null;
            }

            return (
              <Button
                key={pageNum}
                variant={pageNum === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="w-8 h-8 p-0"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

/** Paginated test results of the open report, with per-item Edit and Delete. */
export function ReportResultsTable({
  results,
  serviceType,
  currentPage,
  itemsPerPage,
  onPageChange,
  onEdit,
  onDelete,
  variant,
}: {
  /** Already filtered and sorted. */
  results: any[];
  serviceType: string;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onEdit: (result: any) => void;
  onDelete: (result: any) => void;
  variant: DashboardVariant;
}) {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedResults = results.slice(startIndex, startIndex + itemsPerPage);

  const table = (
    <Table className={variant === "classic" ? "min-w-[1100px]" : undefined}>
      <TableHeader>
        <TableRow>
          <TableHead>Asset #</TableHead>
          <TableHead>Item Name</TableHead>
          <TableHead>Location</TableHead>
          <ServiceColumnHeads serviceType={serviceType} />
          <TableHead>Result</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {paginatedResults.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
              No report items match the current search and filter.
            </TableCell>
          </TableRow>
        ) : (
          paginatedResults.map((result: any) => (
            <TableRow key={result.id}>
              <TableCell data-label="Asset #" className="font-mono">
                {result.assetNumber}
              </TableCell>
              <TableCell data-label="Item Name">
                <div className="font-medium">{result.itemName || result.itemType || "-"}</div>
                {result.itemType &&
                  result.itemType.trim().toLowerCase() !== result.itemName?.trim().toLowerCase() && (
                    <div className="text-xs text-muted-foreground">Type: {result.itemType}</div>
                  )}
              </TableCell>
              <TableCell data-label="Location">{result.location || "-"}</TableCell>
              <ServiceColumnCells result={result} serviceType={serviceType} />
              <TableCell data-label="Result">
                <Badge variant={result.result === "pass" ? "default" : "destructive"}>
                  {result.result?.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell data-actions>
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline" onClick={() => onEdit(result)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDelete(result)}
                    className="text-red-600 hover:bg-red-50 hover:border-red-300"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <>
      {variant === "classic" ? (
        <div className="border rounded-lg overflow-x-auto">{table}</div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <DataTableFrame bleed={false}>{table}</DataTableFrame>
        </div>
      )}
      <ResultsPagination
        totalItems={results.length}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        onPageChange={onPageChange}
      />
    </>
  );
}
