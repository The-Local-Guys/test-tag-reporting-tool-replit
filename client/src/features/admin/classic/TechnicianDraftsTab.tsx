import { AlertCircle, Clock, Edit, FileText, Link2, PlayCircle, RefreshCw, Search, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/date-range-filter";
import { NoResults } from "@/components/no-results";
import { ReportsPagination } from "../components/ReportsPagination";
import { ServiceTypeSelectContent } from "../components/filters";
import type { TechnicianDrafts } from "../hooks/useTechnicianDrafts";
import { formatLastActivity, type ReportRowActions } from "../utils";
import { ClassicCertificateBadge, ClassicPassFailCounts, ClassicRowAction, ClassicServiceBadge } from "./classic-ui";

/** The signed-in technician's own unfinished reports. */
export function TechnicianDraftsTab({
  drafts,
  onDelete,
  actions,
}: {
  drafts: TechnicianDrafts;
  onDelete: (sessionId: number) => void;
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
              Your unfinished reports. Continue where you left off or discard them.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-sm font-medium block mb-1">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-8 w-64"
                placeholder="Search by client name..."
                value={drafts.search}
                onChange={(e) => drafts.setSearch(e.target.value)}
              />
            </div>
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
            testIdPrefix="tech-drafts-date"
          />
        </div>
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
                />
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Client Name</TableHead>
                    <TableHead className="min-w-[140px]">Service Type</TableHead>
                    <TableHead className="min-w-[80px]">Items</TableHead>
                    <TableHead className="min-w-[130px]">Last Activity (DD/MM, HH:MM)</TableHead>
                    <TableHead className="min-w-[110px]">Created (DD/MM/YYYY)</TableHead>
                    <TableHead className="min-w-[140px]">Certificate</TableHead>
                    <TableHead className="min-w-[160px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.drafts.map((draft: any) => (
                    <TableRow key={draft.id} className="bg-yellow-50/30">
                      <TableCell className="font-medium">
                        {draft.clientName || <span className="text-gray-400 italic">No client name</span>}
                      </TableCell>
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
                          <ClassicRowAction icon={FileText} title="View Report" onClick={() => actions.onView(draft)} />
                          <ClassicRowAction icon={Edit} title="Edit Session" onClick={() => actions.onEditSession(draft)} />
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
