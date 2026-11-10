import { Copy, Edit, FileText, Link2, PlayCircle, RefreshCw, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/date-range-filter";
import { NoResults } from "@/components/no-results";
import { ReportsPagination } from "@/features/admin/components/ReportsPagination";
import { ServiceTypeSelectContent, TechnicianFilterCombobox } from "@/features/admin/components/filters";
import type { ReportsList } from "@/features/admin/hooks/useReportsList";
import type { ReportRowActions } from "@/features/admin/utils";
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

export function ReportsSection({
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
    <SectionPanel
      title="All Test Reports"
      count={reports.data?.total}
      description="View, download, and manage all test and tag reports"
      toolbar={
        <>
          <FilterField label="Search">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-8 w-full sm:w-64 bg-white"
                placeholder="Search by client, technician..."
                value={reports.search}
                onChange={(e) => reports.setSearch(e.target.value)}
              />
            </div>
          </FilterField>
          {/* Technician Filter - Only show for super admin and support center */}
          {showTechnicianFilter && (
            <FilterField label="Filter by Technician">
              <TechnicianFilterCombobox
                value={reports.technicianFilter}
                onChange={reports.setTechnicianFilter}
                technicians={technicians}
                className="w-full sm:w-64 bg-white"
              />
            </FilterField>
          )}
          <FilterField label="Filter by Service Type">
            <Select value={reports.serviceTypeFilter} onValueChange={reports.setServiceTypeFilter}>
              <SelectTrigger className="w-full sm:w-64 bg-white">
                <SelectValue placeholder="All Service Types" />
              </SelectTrigger>
              <ServiceTypeSelectContent />
            </Select>
          </FilterField>
          <DateRangeFilter
            label="Filter by Test Date"
            value={reports.dateRange}
            onChange={reports.setDateRange}
            testIdPrefix="reports-date"
          />
        </>
      }
    >
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
                variant="v2"
              />
            </div>
          )}
          <DataTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Date (DD/MM/YYYY)</TableHead>
                  <TableHead>Results</TableHead>
                  <TableHead>Certificate</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.sessions.map((session: any) => (
                  <TableRow key={session.id}>
                    <TableCell data-span="full">
                      <div className="max-w-[200px] font-medium text-slate-900">{session.clientName}</div>
                      {session.address && (
                        <div className="max-w-[220px] truncate text-xs text-slate-500" title={session.address}>
                          {session.address}
                        </div>
                      )}
                    </TableCell>
                    <TableCell data-label="Technician">
                      <div className="flex items-center gap-2 text-slate-700">
                        <InitialsAvatar name={session.technicianFullName || session.technicianName} />
                        <span>{session.technicianFullName || session.technicianName || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell data-label="Service Type">
                      <ServiceBadge serviceType={session.serviceType} longMicrowaveLabel />
                    </TableCell>
                    <TableCell data-label="Date (DD/MM/YYYY)" className="text-slate-600 tabular-nums">
                      {new Date(session.testDate).toLocaleDateString("en-AU")}
                    </TableCell>
                    <TableCell data-label="Results">
                      <PassFailCounts totalItems={session.totalItems} failedItems={session.failedItems} />
                    </TableCell>
                    <TableCell data-label="Certificate">
                      <CertificateCell clientName={session.certificateClientName} />
                    </TableCell>
                    <TableCell data-actions>
                      <div className="flex items-center gap-0.5">
                        <RowAction icon={FileText} title="View Report" onClick={() => actions.onView(session)} />
                        <RowAction icon={Edit} title="Edit Session" onClick={() => actions.onEditSession(session)} />
                        <RowAction
                          icon={PlayCircle}
                          title="Continue Report"
                          tone="green"
                          onClick={() => actions.onContinue(session)}
                        />
                        <RowAction
                          icon={session.certificateClientName ? RefreshCw : Link2}
                          title={session.certificateClientName ? "Change Certificate" : "Attach Certificate"}
                          tone="emerald"
                          onClick={() => actions.onAttachCertificate(session)}
                          testId={`button-attach-certificate-${session.id}`}
                        />
                        {session.serviceType !== "electrical" && (
                          <RowAction
                            icon={Copy}
                            title="Copy Report"
                            tone="blue"
                            onClick={() => actions.onCopy(session)}
                          />
                        )}
                        {/* Delete button - visible for admins and session owners */}
                        {canDelete(session) && (
                          <RowAction
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
          </DataTableFrame>

          {/* Bottom pagination controls */}
          {reports.data && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <ReportsPagination
                page={reports.page}
                totalPages={reports.totalPages}
                total={reports.total}
                limit={reports.pageSize}
                onPageChange={reports.setPage}
                pageSize={reports.pageSize}
                onPageSizeChange={reports.setPageSize}
                variant="v2"
              />
            </div>
          )}
        </>
      )}
    </SectionPanel>
  );
}
