import { AlertCircle, Clock, FileText, Link2, PlayCircle, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/date-range-filter";
import { NoResults } from "@/components/no-results";
import { ReportsPagination } from "../components/ReportsPagination";
import { ServiceTypeSelectContent, TechnicianFilterCombobox } from "../components/filters";
import type { AdminDrafts } from "../hooks/useAdminDrafts";
import { formatLastActivity, type ReportRowActions } from "../utils";
import { ClassicCertificateBadge, ClassicPassFailCounts, ClassicRowAction, ClassicServiceBadge } from "./classic-ui";

/** Every technician's unfinished reports, with bulk delete. Admin roles only. */
export function AdminDraftsTab({
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <div>
            <CardTitle>Draft Reports</CardTitle>
            <CardDescription>
              Unfinished reports from all technicians. Use this to recover or manage incomplete work.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Technician Filter and Bulk Actions for Drafts */}
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-sm font-medium block mb-1">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-8 w-64"
                placeholder="Search by client, technician..."
                value={drafts.search}
                onChange={(e) => drafts.setSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium block mb-1">Filter by Technician</Label>
            <TechnicianFilterCombobox
              value={drafts.technicianFilter}
              onChange={drafts.setTechnicianFilter}
              technicians={technicians}
              className="w-64"
            />
          </div>

          <div>
            <Label className="text-sm font-medium block mb-1">Filter by Service Type</Label>
            <Select value={drafts.serviceTypeFilter} onValueChange={drafts.setServiceTypeFilter}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All Service Types" />
              </SelectTrigger>
              <ServiceTypeSelectContent />
            </Select>
          </div>

          <DateRangeFilter
            label="Filter by Created Date"
            value={drafts.dateRange}
            onChange={drafts.setDateRange}
            testIdPrefix="drafts-date"
          />

          {/* Bulk Delete Button */}
          {drafts.selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{drafts.selectedIds.size} selected</span>
              <Button size="sm" variant="destructive" onClick={onBulkDelete} disabled={drafts.isBulkDeleting}>
                <Trash2 className="w-4 h-4 mr-1" />
                {drafts.isBulkDeleting ? 'Deleting...' : `Delete ${drafts.selectedIds.size} Draft(s)`}
              </Button>
            </div>
          )}
        </div>

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
                />
              </div>
            )}
            <div className="overflow-x-auto">
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
                    <TableHead className="min-w-[120px]">Client Name</TableHead>
                    <TableHead className="min-w-[120px]">Technician</TableHead>
                    <TableHead className="min-w-[140px]">Service Type</TableHead>
                    <TableHead className="min-w-[80px]">Items</TableHead>
                    <TableHead className="min-w-[130px]">Last Activity (DD/MM, HH:MM)</TableHead>
                    <TableHead className="min-w-[110px]">Created (DD/MM/YYYY)</TableHead>
                    <TableHead className="min-w-[140px]">Certificate</TableHead>
                    <TableHead className="min-w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.drafts.map((draft: any) => (
                    <TableRow key={draft.id} className={drafts.selectedIds.has(draft.id) ? "bg-blue-50" : "bg-yellow-50/30"}>
                      <TableCell>
                        <Checkbox
                          checked={drafts.selectedIds.has(draft.id)}
                          onCheckedChange={(checked) => drafts.toggleSelected(draft.id, Boolean(checked))}
                          aria-label={`Select ${draft.clientName || 'draft'}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {draft.clientName || <span className="text-gray-400 italic">No client name</span>}
                      </TableCell>
                      <TableCell className="text-gray-700">{draft.technicianName || 'Unknown'}</TableCell>
                      <TableCell>
                        <ClassicServiceBadge serviceType={draft.serviceType} />
                      </TableCell>
                      <TableCell>
                        <ClassicPassFailCounts totalItems={draft.totalItems} failedItems={draft.failedItems} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Clock className="w-3 h-3" />
                          {formatLastActivity(draft.lastActivityAt)}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(draft.createdAt).toLocaleDateString("en-AU")}</TableCell>
                      <TableCell>
                        <ClassicCertificateBadge clientName={draft.certificateClientName} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <ClassicRowAction icon={FileText} title="View Draft" onClick={() => actions.onView(draft)} />
                          <ClassicRowAction
                            icon={PlayCircle}
                            title="Continue Report"
                            tone="green"
                            onClick={() => actions.onContinue(draft)}
                          />
                          <ClassicRowAction
                            icon={draft.certificateClientName ? RefreshCw : Link2}
                            title={draft.certificateClientName ? "Change Certificate" : "Attach Certificate"}
                            tone="emerald"
                            onClick={() => actions.onAttachCertificate(draft)}
                            testId={`button-attach-certificate-${draft.id}`}
                          />
                          <ClassicRowAction
                            icon={Trash2}
                            title="Delete Draft"
                            tone="red"
                            onClick={() => onDelete(draft.id)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {drafts.data && (
              <div className="mt-4">
                <ReportsPagination
                  page={drafts.page}
                  totalPages={drafts.totalPages}
                  total={drafts.total}
                  limit={drafts.pageSize}
                  onPageChange={drafts.setPage}
                  pageSize={drafts.pageSize}
                  onPageSizeChange={drafts.setPageSize}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
