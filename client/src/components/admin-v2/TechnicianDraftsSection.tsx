import { Clock, Edit, FileText, Link2, PlayCircle, RefreshCw, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/date-range-filter";
import { NoResults } from "@/components/no-results";
import { ReportsPagination } from "@/features/admin/components/ReportsPagination";
import { ServiceTypeSelectContent } from "@/features/admin/components/filters";
import type { TechnicianDrafts } from "@/features/admin/hooks/useTechnicianDrafts";
import { formatLastActivity, type ReportRowActions } from "@/features/admin/utils";
import {
  CertificateCell,
  DataTableFrame,
  FilterField,
  PassFailCounts,
  RowAction,
  SectionPanel,
  ServiceBadge,
} from "./admin-ui";

/** The signed-in technician's own unfinished reports. */
export function TechnicianDraftsSection({
  drafts,
  onDelete,
  actions,
}: {
  drafts: TechnicianDrafts;
  onDelete: (sessionId: number) => void;
  actions: ReportRowActions;
}) {
  return (
    <SectionPanel
      title="Draft Reports"
      count={drafts.data?.total}
      description="Your unfinished reports. Continue where you left off or discard them."
      toolbar={
        <>
          <FilterField label="Search">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-8 w-full sm:w-64 bg-white"
                placeholder="Search by client name..."
                value={drafts.search}
                onChange={(e) => drafts.setSearch(e.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Filter by Service Type">
            <Select value={drafts.serviceTypeFilter} onValueChange={drafts.setServiceTypeFilter}>
              <SelectTrigger className="w-full sm:w-64 bg-white">
                <SelectValue placeholder="All Service Types" />
              </SelectTrigger>
              <ServiceTypeSelectContent />
            </Select>
          </FilterField>
          <DateRangeFilter
            label="Filter by Created Date"
            value={drafts.dateRange}
            onChange={drafts.setDateRange}
            testIdPrefix="tech-drafts-date"
          />
        </>
      }
    >
      {drafts.isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : drafts.drafts.length === 0 ? (
        <NoResults
          hasFilters={drafts.hasFilters}
          emptyTitle="No draft reports found"
          emptyHint="You have no unfinished reports."
          onClearFilters={drafts.clearFilters}
          testId="tech-drafts-no-results"
        />
      ) : (
        <>
          {drafts.data && drafts.totalPages > 1 && (
            <div className="mb-4">
              <ReportsPagination
                page={drafts.page}
                totalPages={drafts.totalPages}
                total={drafts.total}
                limit={drafts.pageSize}
                onPageChange={drafts.setPage}
                variant="v2"
              />
            </div>
          )}
          <DataTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Last Activity (DD/MM, HH:MM)</TableHead>
                  <TableHead>Created (DD/MM/YYYY)</TableHead>
                  <TableHead>Certificate</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.drafts.map((draft: any) => (
                  <TableRow key={draft.id}>
                    <TableCell data-span="full" className="font-medium text-slate-900">
                      {draft.clientName || <span className="text-gray-400 italic">No client name</span>}
                    </TableCell>
                    <TableCell data-label="Service Type">
                      <ServiceBadge serviceType={draft.serviceType} />
                    </TableCell>
                    <TableCell data-label="Items">
                      <PassFailCounts totalItems={draft.totalItems} failedItems={draft.failedItems} />
                    </TableCell>
                    <TableCell data-label="Last Activity (DD/MM, HH:MM)">
                      <div className="flex items-center gap-1 text-sm text-slate-600 tabular-nums">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatLastActivity(draft.lastActivityAt)}
                      </div>
                    </TableCell>
                    <TableCell data-label="Created (DD/MM/YYYY)" className="text-slate-600 tabular-nums">
                      {new Date(draft.createdAt).toLocaleDateString("en-AU")}
                    </TableCell>
                    <TableCell data-label="Certificate">
                      <CertificateCell clientName={draft.certificateClientName} />
                    </TableCell>
                    <TableCell data-actions>
                      <div className="flex items-center gap-0.5">
                        <RowAction icon={FileText} title="View Report" onClick={() => actions.onView(draft)} />
                        <RowAction icon={Edit} title="Edit Session" onClick={() => actions.onEditSession(draft)} />
                        <RowAction
                          icon={PlayCircle}
                          title="Continue Report"
                          tone="green"
                          onClick={() => actions.onContinue(draft)}
                        />
                        <RowAction
                          icon={draft.certificateClientName ? RefreshCw : Link2}
                          title={draft.certificateClientName ? "Change Certificate" : "Attach Certificate"}
                          tone="emerald"
                          onClick={() => actions.onAttachCertificate(draft)}
                          testId={`button-attach-certificate-${draft.id}`}
                        />
                        <RowAction icon={Trash2} title="Delete Draft" tone="red" onClick={() => onDelete(draft.id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableFrame>
          {drafts.data && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <ReportsPagination
                page={drafts.page}
                totalPages={drafts.totalPages}
                total={drafts.total}
                limit={drafts.pageSize}
                onPageChange={drafts.setPage}
                pageSize={drafts.pageSize}
                onPageSizeChange={drafts.setPageSize}
                variant="v2"
              />
            </div>
          )}
        </>
      )}
    </SectionPanel>
  );
}
