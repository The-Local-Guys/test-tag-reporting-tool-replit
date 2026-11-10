import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, FileText, Trash2, Edit, Download, Search, X, ChevronLeft, ChevronRight, Link2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCertificates } from "@/features/certificates/useCertificates";
import { DateRangeFilter, EMPTY_DATE_FILTER, type DateFilter } from "@/components/date-range-filter";
import { Label } from "@/components/ui/label";
import { NoResults } from "@/components/no-results";
import { CertificateModal } from "@/features/certificates/CertificateModal";
import { CertificatePreview } from "@/features/certificates/CertificatePreview";
import { generateCertificatePDF, downloadCertificatePDF } from "@/lib/certificate-generator";
import { getServiceDisplayName, getServiceBadgeClass } from "@/features/certificates/certificate-display";
import type { Certificate } from "@shared/schema";
import { SectionPanel, FilterField, DataTableFrame, RowAction } from "@/components/admin-v2/admin-ui";

const CERTIFICATES_PAGE_SIZE_OPTIONS = [50, 100, 150, 200] as const;
const DEFAULT_CERTIFICATES_PAGE_SIZE = 50;

/**
 * Certificates tab for the redesigned admin dashboard (/admin/v2). Same data,
 * actions and dialogs as features/certificates/CertificatesTab, restyled to
 * match the v2 page and laid out without sideways scrolling.
 */
export function CertificatesTabV2() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCertificate, setEditingCertificate] = useState<Certificate | null>(null);
  const [previewCertificate, setPreviewCertificate] = useState<Certificate | null>(null);
  const [certificateToDelete, setCertificateToDelete] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  // Issue date filter (preset + resolved YYYY-MM-DD bounds)
  const [dateRange, setDateRange] = useState<DateFilter>(EMPTY_DATE_FILTER);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_CERTIFICATES_PAGE_SIZE);
  const [linkedReportsCertificate, setLinkedReportsCertificate] = useState<Certificate | null>(null);

  const {
    certificates,
    total,
    totalPages,
    clientNames,
    certificatesLoading,
    createCertificateMutation,
    updateCertificateMutation,
    deleteCertificateMutation,
  } = useCertificates({
    page,
    limit: pageSize,
    search: clientSearch,
    clientName: selectedClient,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value));
    setPage(1);
  };

  const handleSubmitCertificate = (data: any) => {
    if (editingCertificate) {
      // Update existing certificate
      updateCertificateMutation.mutate(
        { id: editingCertificate.id, data },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setEditingCertificate(null);
          },
        }
      );
    } else {
      // Create new certificate
      createCertificateMutation.mutate(data, {
        onSuccess: () => {
          setIsModalOpen(false);
        },
      });
    }
  };

  const handleCreateNew = () => {
    setEditingCertificate(null);
    setIsModalOpen(true);
  };

  const handleEditCertificate = (cert: Certificate) => {
    setEditingCertificate(cert);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCertificate(null);
  };

  const handleViewCertificate = (cert: Certificate) => {
    setPreviewCertificate(cert);
  };

  const handleDirectDownload = async (cert: Certificate) => {
    setDownloadingId(cert.id);
    try {
      const blob = await generateCertificatePDF({ certificate: cert });
      downloadCertificatePDF(blob, cert.clientName);
    } catch (err) {
      console.error("Error downloading certificate:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteCertificate = (id: number) => {
    setCertificateToDelete(id);
  };

  const confirmDelete = () => {
    if (certificateToDelete !== null) {
      deleteCertificateMutation.mutate(certificateToDelete);
      setCertificateToDelete(null);
    }
  };

  // Attached-reports count for the certificate currently in the delete-confirmation dialog
  const { data: attachedSessions } = useQuery<any[]>({
    queryKey: [`/api/certificates/${certificateToDelete}/sessions`],
    enabled: certificateToDelete !== null,
  });

  // Reports linked to the certificate currently open in the "Linked Reports" modal
  const { data: linkedReports, isLoading: linkedReportsLoading } = useQuery<any[]>({
    queryKey: [`/api/certificates/${linkedReportsCertificate?.id}/sessions`],
    enabled: linkedReportsCertificate !== null,
  });

  const handleViewLinkedReports = (cert: Certificate) => {
    setLinkedReportsCertificate(cert);
  };

  const filteredCerts: any[] = certificates as any[];

  const hasCertificateFilters =
    selectedClient !== "all" || Boolean(clientSearch.trim()) || Boolean(dateRange.from || dateRange.to);

  const clearCertificateFilters = () => {
    setSelectedClient("all");
    setClientSearch("");
    setDateRange(EMPTY_DATE_FILTER);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setClientSearch(value);
    setSelectedClient("all");
    setPage(1);
  };

  const handleClientFilterChange = (value: string) => {
    setSelectedClient(value);
    setClientSearch("");
    setPage(1);
  };

  const handleDateRangeChange = (value: DateFilter) => {
    setDateRange(value);
    setPage(1);
  };

  return (
    <>
      <SectionPanel
        title="Certificates of Compliance"
        count={certificatesLoading ? undefined : total}
        description="Manage and generate compliance certificates for clients"
        actions={
          <Button
            onClick={handleCreateNew}
            className="h-9 gap-2 rounded-lg bg-blue-600 shadow-sm hover:bg-blue-700"
            data-testid="button-create-certificate"
          >
            <Plus className="w-4 h-4" />
            Create Certificate
          </Button>
        }
        toolbar={
          <>
            <FilterField label="Search" htmlFor="certificate-client-search">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  id="certificate-client-search"
                  type="text"
                  placeholder="Search by client name..."
                  value={clientSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full border pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                {clientSearch && (
                  <button
                    onClick={() => handleSearchChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </FilterField>
            <FilterField label="Filter by Client" htmlFor="certificate-client-filter">
              <Select value={selectedClient} onValueChange={handleClientFilterChange}>
                <SelectTrigger id="certificate-client-filter" className="w-full sm:w-56">
                  <SelectValue placeholder="Filter by client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clientNames.filter((name) => !!name && name.trim() !== "").map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <DateRangeFilter
              label="Issue Date"
              value={dateRange}
              onChange={handleDateRangeChange}
              testIdPrefix="certificates-date"
            />
            {hasCertificateFilters && (
              <button
                onClick={clearCertificateFilters}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 pb-2"
              >
                Clear filter
              </button>
            )}
          </>
        }
      >
        {certificatesLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <DataTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Issue Date (DD/MM/YYYY)</TableHead>
                  <TableHead>Linked Reports</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCerts.map((cert: any) => {
                  const services = cert.services as string[];
                  return (
                    <TableRow key={cert.id}>
                      <TableCell data-span="full" className="font-medium text-slate-900">
                        {cert.clientName}
                      </TableCell>
                      <TableCell data-label="Address" className="text-slate-600">
                        {cert.address || <span className="text-slate-300">—</span>}
                      </TableCell>
                      <TableCell data-label="Services">
                        <div className="flex flex-wrap gap-1">
                          {services?.map((serviceType: string, i: number) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className={`rounded-md text-xs font-medium ${getServiceBadgeClass(serviceType)}`}
                            >
                              {getServiceDisplayName(serviceType)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell data-label="Issue Date (DD/MM/YYYY)" className="text-slate-600 tabular-nums">
                        {new Date(cert.certificationDate).toLocaleDateString('en-AU')}
                      </TableCell>
                      <TableCell data-label="Linked Reports">
                        {cert.linkedReportCount > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewLinkedReports(cert)}
                            className="h-7 gap-1 rounded-md px-2 text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            data-testid={`button-linked-reports-${cert.id}`}
                          >
                            <Link2 className="w-3 h-3" />
                            {cert.linkedReportCount} report{cert.linkedReportCount === 1 ? "" : "s"}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">None</span>
                        )}
                      </TableCell>
                      <TableCell data-actions>
                        <div className="flex items-center gap-0.5">
                          <RowAction
                            icon={FileText}
                            title="View Preview"
                            onClick={() => handleViewCertificate(cert)}
                            testId={`button-view-certificate-${cert.id}`}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDirectDownload(cert)}
                            disabled={downloadingId === cert.id}
                            className="h-7 w-7 rounded-md p-0 text-slate-400 hover:bg-blue-50 hover:text-blue-700"
                            title="Download PDF"
                            aria-label="Download PDF"
                            data-testid={`button-download-certificate-${cert.id}`}
                          >
                            {downloadingId === cert.id ? (
                              <LoadingSpinner className="w-4 h-4" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                          <RowAction
                            icon={Edit}
                            title="Edit"
                            onClick={() => handleEditCertificate(cert)}
                            testId={`button-edit-certificate-${cert.id}`}
                          />
                          <RowAction
                            icon={Trash2}
                            title="Delete"
                            tone="red"
                            onClick={() => handleDeleteCertificate(cert.id)}
                            testId={`button-delete-certificate-${cert.id}`}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredCerts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <NoResults
                        hasFilters={hasCertificateFilters}
                        emptyTitle="No certificates created yet"
                        emptyHint='Click "Create Certificate" to get started.'
                        onClearFilters={clearCertificateFilters}
                        testId="certificates-no-results"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DataTableFrame>
        )}
        {!certificatesLoading && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500 tabular-nums">
              {total > 0
                ? `Showing ${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, total)} of ${total} certificates`
                : "No certificates"}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="certificates-page-size" className="text-sm font-normal text-slate-500">
                  Show:
                </Label>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger id="certificates-page-size" className="h-8 w-20 rounded-lg border-slate-200" data-testid="select-certificates-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CERTIFICATES_PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="p-2 h-8 w-8 rounded-lg border-slate-200"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-certificates-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm px-2 text-slate-600 tabular-nums">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="p-2 h-8 w-8 rounded-lg border-slate-200"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    data-testid="button-certificates-next-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </SectionPanel>

      <CertificateModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitCertificate}
        certificate={editingCertificate || undefined}
      />

      <CertificatePreview
        isOpen={previewCertificate !== null}
        onClose={() => setPreviewCertificate(null)}
        certificate={previewCertificate}
        onEdit={(cert) => {
          setPreviewCertificate(null);
          handleEditCertificate(cert);
        }}
      />

      <AlertDialog open={certificateToDelete !== null} onOpenChange={() => setCertificateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Certificate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this certificate? This action cannot be undone.
              {attachedSessions && attachedSessions.length > 0 && (
                <span className="block mt-2 font-medium text-amber-600">
                  This certificate is attached to {attachedSessions.length} report
                  {attachedSessions.length === 1 ? "" : "s"}; deleting it will remove the certificate from{" "}
                  {attachedSessions.length === 1 ? "that report" : "those reports"}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-certificate">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-certificate"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Modal
        isOpen={linkedReportsCertificate !== null}
        onClose={() => setLinkedReportsCertificate(null)}
        title={`Reports linked to ${linkedReportsCertificate?.clientName ?? "this certificate"}`}
      >
        {linkedReportsLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-2">
            {(linkedReports ?? []).map((report: any) => (
              <div
                key={report.id}
                className="flex items-center justify-between gap-2 p-3 rounded-lg border"
                data-testid={`linked-report-${report.id}`}
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">
                    {report.clientName || <span className="text-gray-400 italic">No client name</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(report.testDate).toLocaleDateString('en-AU')}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium ${getServiceBadgeClass(report.serviceType)}`}
                  >
                    {getServiceDisplayName(report.serviceType)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      report.status === "finalized"
                        ? "bg-green-50 text-green-700 border-green-200 text-xs"
                        : "bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"
                    }
                  >
                    {report.status === "finalized" ? "Finalized" : "Draft"}
                  </Badge>
                </div>
              </div>
            ))}
            {(linkedReports ?? []).length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">
                No reports are currently linked to this certificate.
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
