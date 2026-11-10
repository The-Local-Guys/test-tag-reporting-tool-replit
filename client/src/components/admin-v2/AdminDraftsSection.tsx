import { Clock, FileText, Link2, PlayCircle, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/date-range-filter";
import { NoResults } from "@/components/no-results";
import { ReportsPagination } from "@/features/admin/components/ReportsPagination";
import { ServiceTypeSelectContent, TechnicianFilterCombobox } from "@/features/admin/components/filters";
import type { AdminDrafts } from "@/features/admin/hooks/useAdminDrafts";
import { formatLastActivity, type ReportRowActions } from "@/features/admin/utils";
import {
  CertificateCell,
  DataTableFrame,
  FilterField,
  InitialsAvatar,
  PassFailCounts,
  RowAction,
  SectionPanel,
  ServiceBadge,
} from "./admin-ui";

/** Every technician's unfinished reports, with bulk delete. Admin roles only. */
export function AdminDraftsSection({
  drafts,
  technicians,
  onDelete,
  onBulkDelete,
  actions,
}: {
  drafts: AdminDrafts;
  technicians: string[];
  onDelete: (sessionId: number) => void;
  onBulkDelete: () => void;
  actions: ReportRowActions;
}) {
  return (
    <SectionPanel
      title="Draft Reports"
      count={drafts.data?.total}
      description="Unfinished reports from all technicians. Use this to recover or manage incomplete work."
      actions={
        drafts.selectedIds.size > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">{drafts.selectedIds.size} selected</span>
            <Button size="sm" variant="destructive" onClick={onBulkDelete} disabled={drafts.isBulkDeleting}>
              <Trash2 className="w-4 h-4 mr-1" />
              {drafts.isBulkDeleting ? 'Deleting...' : `Delete ${drafts.selectedIds.size} Draft(s)`}
            </Button>
          </div>
        ) : undefined
      }
      toolbar={
        <>
          <FilterField label="Search">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-8 w-full sm:w-64 bg-white"
                placeholder="Search by client, technician..."
                value={drafts.search}
                onChange={(e) => drafts.setSearch(e.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Filter by Technician">
            <TechnicianFilterCombobox
              value={drafts.technicianFilter}
              onChange={drafts.setTechnicianFilter}
              technicians={technicians}
              className="w-full sm:w-64 bg-white"
            />
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
            testIdPrefix="drafts-date"
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
          emptyHint="All reports have been completed or there are no unfinished sessions."
          onClearFilters={drafts.clearFilters}
          testId="drafts-no-results"
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
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={drafts.allSelected}
                      onCheckedChange={(checked) => drafts.toggleAllSelected(Boolean(checked))}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Technician</TableHead>
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
                  <TableRow key={draft.id} className={drafts.selectedIds.has(draft.id) ? "bg-blue-50" : ""}>
                    <TableCell data-label="Select">
                      <Checkbox
                        checked={drafts.selectedIds.has(draft.id)}
                        onCheckedChange={(checked) => drafts.toggleSelected(draft.id, Boolean(checked))}
                        aria-label={`Select ${draft.clientName || 'draft'}`}
                      />
                    </TableCell>
                    <TableCell data-span="full" className="font-medium text-slate-900 max-xl:order-first">
                      {draft.clientName || <span className="text-gray-400 italic">No client name</span>}
                    </TableCell>
                    <TableCell data-label="Technician">
                      <div className="flex items-center gap-2 text-slate-700">
                        <InitialsAvatar name={draft.technicianName} />
                        <span>{draft.technicianName || 'Unknown'}</span>
                      </div>
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
                        <RowAction icon={FileText} title="View Draft" onClick={() => actions.onView(draft)} />
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
