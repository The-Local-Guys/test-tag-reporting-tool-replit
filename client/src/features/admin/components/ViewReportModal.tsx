import { useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Link2, Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TestResultEditModal } from "@/components/test-result-edit-modal";
import { ReportNotesEditor } from "@/components/report-notes-editor";
import { ServiceBadge } from "@/components/admin-v2/admin-ui";
import { PdfDownloadMenu } from "@/features/certificates/PdfDownloadMenu";
import { useReportResultEditor } from "../hooks/useReportResultEditor";
import type { ViewReport } from "../hooks/useViewReport";
import type { DashboardVariant } from "../utils";
import { DeleteResultModal } from "./DeleteResultModal";
import { ReportResultsTable } from "./ReportResultsTable";

const STYLES = {
  classic: {
    panel: "bg-gray-50 p-4 rounded-lg",
    totalTile: "bg-blue-50 p-3 rounded",
    totalValue: "text-2xl font-bold text-blue-600",
    totalLabel: "text-sm text-blue-600",
    passTile: "bg-green-50 p-3 rounded",
    passValue: "text-2xl font-bold text-green-600",
    passLabel: "text-sm text-green-600",
    failTile: "bg-red-50 p-3 rounded",
    failValue: "text-2xl font-bold text-red-600",
    failLabel: "text-sm text-red-600",
  },
  v2: {
    panel: "rounded-xl border border-slate-200 bg-slate-50/70 p-4",
    totalTile: "rounded-xl border border-slate-200 bg-white p-4",
    totalValue: "text-2xl font-semibold tracking-tight tabular-nums text-slate-900",
    totalLabel: "text-sm text-slate-500",
    passTile: "rounded-xl border border-emerald-100 bg-emerald-50/60 p-4",
    passValue: "text-2xl font-semibold tracking-tight tabular-nums text-emerald-700",
    passLabel: "text-sm text-green-600",
    failTile: "rounded-xl border border-red-100 bg-red-50/60 p-4",
    failValue: "text-2xl font-semibold tracking-tight tabular-nums text-red-600",
    failLabel: "text-sm text-red-600",
  },
};

function SessionDetails({ session, variant }: { session: any; variant: DashboardVariant }) {
  const testDate = new Date(session.testDate).toLocaleDateString("en-AU");

  if (variant === "classic") {
    return (
      <div className={STYLES.classic.panel}>
        <h3 className="font-semibold mb-2">Test Session Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="font-medium">Client:</span> {session.clientName}</div>
          <div><span className="font-medium">Technician:</span> {session.technicianName}</div>
          <div><span className="font-medium">Date:</span> {testDate}</div>
          <div><span className="font-medium">Location:</span> {session.address}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={STYLES.v2.panel}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">Test Session Details</h3>
        <ServiceBadge serviceType={session.serviceType} longMicrowaveLabel />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs font-medium text-slate-500">Client</dt>
          <dd className="mt-0.5 font-medium text-slate-900">{session.clientName}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Technician</dt>
          <dd className="mt-0.5 text-slate-900">{session.technicianName}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Date</dt>
          <dd className="mt-0.5 text-slate-900 tabular-nums">{testDate}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Location</dt>
          <dd className="mt-0.5 text-slate-900">{session.address}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * View & Edit Report modal: session details, attached certificate, report notes and the
 * test results with per-item edit/delete. Also owns the edit-result and delete-result modals.
 */
export function ViewReportModal({
  viewReport,
  variant,
  onContinue,
  onCopy,
  onAttachCertificate,
  onDownload,
}: {
  viewReport: ViewReport;
  variant: DashboardVariant;
  onContinue: (session: any) => void;
  onCopy: (session: any) => void;
  onAttachCertificate: (target: { id: number; certificateId: number | null }) => void;
  onDownload: (session: any, format: "pdf" | "excel", includeCertificate?: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { viewingSession, setViewingSession, certificate } = viewReport;
  const editor = useReportResultEditor(viewingSession, setViewingSession);
  const styles = STYLES[variant];

  return (
    <>
      <Modal
        isOpen={viewReport.isOpen}
        onClose={viewReport.close}
        title="View & Edit Report"
        className="max-w-6xl"
      >
        {viewingSession && (
          <div className="space-y-6">
            <SessionDetails session={viewingSession.session} variant={variant} />

            {/* Certificate of Compliance — attaching saves immediately, no separate save step */}
            <div className={`${styles.panel} flex items-center justify-between gap-3`}>
              <div>
                <h3 className="font-semibold mb-1">Certificate of Compliance</h3>
                {certificate ? (
                  <div className="text-sm text-gray-700 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium">{certificate.clientName}</span>
                    <span className="text-gray-500">— attached</span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No certificate attached to this report</div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onAttachCertificate({
                    id: viewingSession.session.id,
                    certificateId: certificate?.id ?? null,
                  })
                }
                data-testid="button-attach-certificate-view-modal"
              >
                {certificate ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Change
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-1" />
                    Attach
                  </>
                )}
              </Button>
            </div>

            {/* Report-level notes (printed at the end of the PDF report) */}
            <div className={styles.panel}>
              <ReportNotesEditor
                sessionId={viewingSession.session.id}
                ownerUserId={viewingSession.session.userId}
                reportNotes={viewingSession.session.reportNotes}
                onSaved={(updated) => {
                  setViewingSession((prev: any) =>
                    prev ? { ...prev, session: { ...prev.session, reportNotes: updated.reportNotes } } : prev,
                  );
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
                }}
              />
            </div>

            {/* Test Results */}
            <div>
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h3 className="font-semibold">
                  Test Results ({viewReport.filteredResults.length} of {viewingSession.results.length} items)
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="itemsPerPage" className="text-sm">
                    Items per page:
                  </Label>
                  <Select
                    value={viewReport.itemsPerPage.toString()}
                    onValueChange={(value) => viewReport.setItemsPerPage(parseInt(value))}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => onContinue(viewingSession.session)} size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Item
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    value={viewReport.itemSearch}
                    onChange={(event) => viewReport.setItemSearch(event.target.value)}
                    placeholder="Search asset, item, type, or location..."
                    className="pl-9"
                    data-testid="input-report-item-search"
                  />
                </div>
                <Select value={viewReport.resultFilter} onValueChange={viewReport.setResultFilter}>
                  <SelectTrigger className="w-full sm:w-40" data-testid="select-report-result-filter">
                    <SelectValue placeholder="Filter result" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Results</SelectItem>
                    <SelectItem value="pass">Passed</SelectItem>
                    <SelectItem value="fail">Failed Only</SelectItem>
                  </SelectContent>
                </Select>
                {viewReport.hasItemFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={viewReport.clearItemFilters}
                    data-testid="button-clear-report-item-filters"
                  >
                    Clear filters
                  </Button>
                )}
              </div>
              <ReportResultsTable
                results={viewReport.filteredResults}
                serviceType={viewingSession.session.serviceType}
                currentPage={viewReport.currentPage}
                itemsPerPage={viewReport.itemsPerPage}
                onPageChange={viewReport.setCurrentPage}
                onEdit={editor.startEdit}
                onDelete={editor.requestDelete}
                variant={variant}
              />
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className={styles.totalTile}>
                <div className={styles.totalValue}>{viewingSession.results.length}</div>
                <div className={styles.totalLabel}>Total Items</div>
              </div>
              <div className={styles.passTile}>
                <div className={styles.passValue}>
                  {viewingSession.results.filter((r: any) => r.result === "pass").length}
                </div>
                <div className={styles.passLabel}>Passed</div>
              </div>
              <div className={styles.failTile}>
                <div className={styles.failValue}>
                  {viewingSession.results.filter((r: any) => r.result === "fail").length}
                </div>
                <div className={styles.failLabel}>Failed</div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onCopy(viewingSession.session)}>
                <Copy className="w-4 h-4 mr-1" />
                Copy Report & Open
              </Button>
              <PdfDownloadMenu
                hasCertificate={!!certificate}
                onDownload={(includeCertificate) =>
                  onDownload(viewingSession.session, "pdf", includeCertificate)
                }
              >
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-1" />
                  Download PDF
                </Button>
              </PdfDownloadMenu>
              <Button variant="outline" onClick={() => onDownload(viewingSession.session, "excel")}>
                <Download className="w-4 h-4 mr-1" />
                Download Excel
              </Button>
              <Button onClick={viewReport.close}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      <TestResultEditModal
        isOpen={editor.isEditOpen}
        onClose={editor.closeEdit}
        editResultData={editor.editResultData}
        setEditResultData={editor.setEditResultData}
        onSave={editor.saveEdit}
        serviceType={viewingSession?.session?.serviceType}
        testDate={viewingSession?.session?.testDate}
        assetNumberError={editor.assetNumberError}
        onAssetNumberChange={editor.handleAssetNumberChange}
        onFrequencyChange={editor.handleFrequencyChange}
        isSaving={editor.isSaving}
      />

      <DeleteResultModal
        isOpen={editor.isDeleteOpen}
        result={editor.deletingResult}
        isDeleting={editor.isDeleting}
        onCancel={editor.cancelDelete}
        onConfirm={editor.confirmDelete}
        variant={variant}
      />

      {/* Loading Progress Bar - Reusable for server operations */}
      <ProgressBar isVisible={editor.isDeleting} message="Deleting test result..." />
    </>
  );
}
