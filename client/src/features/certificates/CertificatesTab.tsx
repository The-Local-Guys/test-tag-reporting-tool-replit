import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, FileText, Trash2, Edit, Download, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCertificates } from "./useCertificates";
import { CertificateModal } from "./CertificateModal";
import { CertificatePreview } from "./CertificatePreview";
import { generateCertificatePDF, downloadCertificatePDF } from "@/lib/certificate-generator";
import type { Certificate } from "@shared/schema";

const CERTIFICATES_PAGE_SIZE = 10;

export function CertificatesTab() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCertificate, setEditingCertificate] = useState<Certificate | null>(null);
  const [previewCertificate, setPreviewCertificate] = useState<Certificate | null>(null);
  const [certificateToDelete, setCertificateToDelete] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(clientSearch.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [clientSearch]);

  const {
    certificates,
    total,
    totalPages,
    limit,
    clientNames,
    certificatesLoading,
    certificatesFetching,
    createCertificateMutation,
    updateCertificateMutation,
    deleteCertificateMutation,
  } = useCertificates({
    page,
    limit: CERTIFICATES_PAGE_SIZE,
    search: debouncedSearch || undefined,
    clientName: selectedClient === "all" ? undefined : selectedClient,
  });

  useEffect(() => {
    if (!certificatesLoading && page > Math.max(1, totalPages)) {
      setPage(Math.max(1, totalPages));
    }
  }, [certificatesLoading, page, totalPages]);

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

  const getServiceDisplayName = (serviceType: string): string => {
    switch (serviceType) {
      case 'electrical':
        return 'Electrical';
      case 'emergency_exit_light':
        return 'Emergency Exit';
      case 'fire_testing':
        return 'Fire Equipment';
      case 'rcd_reporting':
        return 'RCD';
      case 'microwave_leakage':
        return 'Microwave';
      default:
        return serviceType.replace('_', ' ');
    }
  };

  const getPageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages: (number | "ellipsis")[] = [1];
    if (page > 3) pages.push("ellipsis");
    for (let pageNumber = Math.max(2, page - 1); pageNumber <= Math.min(totalPages - 1, page + 1); pageNumber++) {
      pages.push(pageNumber);
    }
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  };

  const hasActiveFilters = selectedClient !== "all" || debouncedSearch.length > 0;
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Certificates of Compliance</CardTitle>
            <CardDescription>
              Manage and generate compliance certificates for clients
            </CardDescription>
          </div>
          <Button
            onClick={handleCreateNew}
            className="flex items-center gap-2"
            data-testid="button-create-certificate"
          >
            <Plus className="w-4 h-4" />
            Create Certificate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Client filter row */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search by client name..."
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setSelectedClient("all");
                setPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {clientSearch && (
              <button
                onClick={() => {
                  setClientSearch("");
                  setPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear client search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <Select
            value={selectedClient}
            onValueChange={(val) => {
              setSelectedClient(val);
              setClientSearch("");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter by client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clientNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(selectedClient !== "all" || clientSearch) && (
            <button
              onClick={() => {
                setSelectedClient("all");
                setClientSearch("");
                setPage(1);
              }}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Clear filter
            </button>
          )}
        </div>

        {certificatesLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificates.map((cert) => {
                  const services = cert.services as string[];
                  return (
                    <TableRow key={cert.id}>
                      <TableCell className="font-medium">
                        {cert.clientName}
                      </TableCell>
                      <TableCell>{cert.address}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {services?.map((serviceType: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {getServiceDisplayName(serviceType)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(cert.certificationDate).toLocaleDateString('en-AU')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewCertificate(cert)}
                            className="p-2 h-8 w-8"
                            title="View Preview"
                            data-testid={`button-view-certificate-${cert.id}`}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDirectDownload(cert)}
                            disabled={downloadingId === cert.id}
                            className="p-2 h-8 w-8"
                            title="Download PDF"
                            data-testid={`button-download-certificate-${cert.id}`}
                          >
                            {downloadingId === cert.id ? (
                              <LoadingSpinner className="w-4 h-4" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditCertificate(cert)}
                            className="p-2 h-8 w-8"
                            title="Edit"
                            data-testid={`button-edit-certificate-${cert.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteCertificate(cert.id)}
                            className="p-2 h-8 w-8 text-red-600 hover:text-red-700"
                            title="Delete"
                            data-testid={`button-delete-certificate-${cert.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {certificates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      {hasActiveFilters
                        ? "No certificates match the current filter."
                        : 'No certificates created yet. Click "Create Certificate" to get started.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              </Table>
            </div>

            {total > 0 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="text-certificates-pagination-summary"
                >
                  Showing {rangeStart}–{rangeEnd} of {total} certificates
                </p>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1" aria-label="Certificate pages">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="p-2 h-8 w-8"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1 || certificatesFetching}
                      aria-label="Go to previous certificate page"
                      data-testid="button-certificates-page-previous"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>

                    {getPageNumbers().map((pageNumber, index) =>
                      pageNumber === "ellipsis" ? (
                        <span
                          key={`ellipsis-${index}`}
                          className="px-1 text-sm text-muted-foreground"
                          aria-hidden="true"
                        >
                          …
                        </span>
                      ) : (
                        <Button
                          key={pageNumber}
                          type="button"
                          variant={pageNumber === page ? "default" : "outline"}
                          size="sm"
                          className="h-8 w-8 p-0 text-sm"
                          onClick={() => setPage(pageNumber)}
                          disabled={certificatesFetching}
                          aria-label={`Go to certificate page ${pageNumber}`}
                          aria-current={pageNumber === page ? "page" : undefined}
                          data-testid={`button-certificates-page-${pageNumber}`}
                        >
                          {pageNumber}
                        </Button>
                      ),
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="p-2 h-8 w-8"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page === totalPages || certificatesFetching}
                      aria-label="Go to next certificate page"
                      data-testid="button-certificates-page-next"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

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
    </Card>
  );
}
