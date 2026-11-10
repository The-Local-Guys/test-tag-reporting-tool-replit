import { Copy, Edit, FileText, Link2, PlayCircle, RefreshCw, Search, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/date-range-filter";
import { NoResults } from "@/components/no-results";
import { ReportsPagination } from "../components/ReportsPagination";
import { ServiceTypeSelectContent, TechnicianFilterCombobox } from "../components/filters";
import type { ReportsList } from "../hooks/useReportsList";
import type { ReportRowActions } from "../utils";
import { ClassicCertificateBadge, ClassicPassFailCounts, ClassicRowAction, ClassicServiceBadge } from "./classic-ui";

export function ReportsTab({
  reports,
  technicians,
  showTechnicianFilter,
  canDelete,
  onDelete,
  actions,
}: {
  reports: ReportsList;
  technicians: string[];
  showTechnicianFilter: boolean;
  canDelete: (session: any) => boolean;
  onDelete: (sessionId: number) => void;
  actions: ReportRowActions;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Test Reports</CardTitle>
        <CardDescription>View, download, and manage all test and tag reports</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-sm font-medium block mb-1">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-8 w-64"
                placeholder="Search by client, technician..."
                value={reports.search}
                onChange={(e) => reports.setSearch(e.target.value)}
              />
            </div>
          </div>
          {/* Technician Filter - Only show for super admin and support center */}
          {showTechnicianFilter && (
            <div>
              <Label className="text-sm font-medium block mb-1">Filter by Technician</Label>
              <TechnicianFilterCombobox
                value={reports.technicianFilter}
                onChange={reports.setTechnicianFilter}
                technicians={technicians}
                className="w-64"
              />
            </div>
          )}
          <div>
            <Label className="text-sm font-medium block mb-1">Filter by Service Type</Label>
            <Select value={reports.serviceTypeFilter} onValueChange={reports.setServiceTypeFilter}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All Service Types" />
              </SelectTrigger>
              <ServiceTypeSelectContent />
            </Select>
          </div>
          <DateRangeFilter
            label="Filter by Test Date"
            value={reports.dateRange}
            onChange={reports.setDateRange}
            testIdPrefix="reports-date"
          />
        </div>

        {reports.isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {/* Top pagination controls */}
            {reports.data && reports.totalPages > 1 && (
              <div className="mb-4">
                <ReportsPagination
                  page={reports.page}
                  totalPages={reports.totalPages}
                  total={reports.total}
                  limit={reports.pageSize}
                  onPageChange={reports.setPage}
                />
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Client Name</TableHead>
                    <TableHead className="min-w-[120px]">Technician</TableHead>
                    <TableHead className="min-w-[140px]">Service Type</TableHead>
                    <TableHead className="min-w-[110px]">Date (DD/MM/YYYY)</TableHead>
                    <TableHead className="min-w-[100px]">Results</TableHead>
                    <TableHead className="min-w-[140px]">Certificate</TableHead>
                    <TableHead className="min-w-[160px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.sessions.map((session: any) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.clientName}</TableCell>
                      <TableCell className="text-gray-700">
                        {session.technicianFullName || session.technicianName || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <ClassicServiceBadge serviceType={session.serviceType} longMicrowaveLabel />
                      </TableCell>
                      <TableCell>{new Date(session.testDate).toLocaleDateString("en-AU")}</TableCell>
                      <TableCell>
                        <ClassicPassFailCounts
                          totalItems={session.totalItems}
                          failedItems={session.failedItems}
                          hideLabelsOnMobile
                        />
                      </TableCell>
                      <TableCell>
                        <ClassicCertificateBadge clientName={session.certificateClientName} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <ClassicRowAction icon={FileText} title="View Report" onClick={() => actions.onView(session)} />
                          <ClassicRowAction icon={Edit} title="Edit Session" onClick={() => actions.onEditSession(session)} />
                          <ClassicRowAction
                            icon={PlayCircle}
                            title="Continue Report"
                            tone="green"
                            onClick={() => actions.onContinue(session)}
                          />
                          <ClassicRowAction
                            icon={session.certificateClientName ? RefreshCw : Link2}
                            title={session.certificateClientName ? "Change Certificate" : "Attach Certificate"}
                            tone="emerald"
                            onClick={() => actions.onAttachCertificate(session)}
                            testId={`button-attach-certificate-${session.id}`}
                          />
                          {session.serviceType !== "electrical" && (
                            <ClassicRowAction
                              icon={Copy}
                              title="Copy Report"
                              tone="blue"
                              onClick={() => actions.onCopy(session)}
                            />
                          )}
                          {/* Delete button - visible for admins and session owners */}
                          {canDelete(session) && (
                            <ClassicRowAction
                              icon={Trash2}
                              title="Delete Report"
                              tone="red"
                              onClick={() => onDelete(session.id)}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {reports.sessions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <NoResults
                          hasFilters={reports.hasFilters}
                          emptyTitle="No reports found"
                          emptyHint="Reports will appear here once test sessions have been created."
                          onClearFilters={reports.clearFilters}
                          testId="reports-no-results"
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Bottom pagination controls */}
            {reports.data && (
              <div className="mt-4">
                <ReportsPagination
                  page={reports.page}
                  totalPages={reports.totalPages}
                  total={reports.total}
                  limit={reports.pageSize}
                  onPageChange={reports.setPage}
                  pageSize={reports.pageSize}
                  onPageSizeChange={reports.setPageSize}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
