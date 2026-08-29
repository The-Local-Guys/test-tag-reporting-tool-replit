import { useState } from "react";
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
import { Plus, FileText, Trash2, Edit, Download, Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCertificates } from "./useCertificates";
import { DateRangeFilter, EMPTY_DATE_FILTER, type DateFilter } from "@/components/date-range-filter";
import { NoResults } from "@/components/no-results";
import { CertificateModal } from "./CertificateModal";
import { CertificatePreview } from "./CertificatePreview";
import { generateCertificatePDF, downloadCertificatePDF } from "@/lib/certificate-generator";
import type { Certificate } from "@shared/schema";

export function CertificatesTab() {
  const { certificates, certificatesLoading, createCertificateMutation, updateCertificateMutation, deleteCertificateMutation } =
    useCertificates();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCertificate, setEditingCertificate] = useState<Certificate | null>(null);
  const [previewCertificate, setPreviewCertificate] = useState<Certificate | null>(null);
  const [certificateToDelete, setCertificateToDelete] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  // Issue date filter (preset + resolved YYYY-MM-DD bounds)
  const [dateRange, setDateRange] = useState<DateFilter>(EMPTY_DATE_FILTER);

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

  const allCerts: any[] = certificates as any[] || [];

  const uniqueClients = Array.from(
    new Set(allCerts.map((c) => c.clientName).filter(Boolean))
  ).sort();

  const filteredCerts = allCerts.filter((cert) => {
    const matchesDropdown = selectedClient === "all" || cert.clientName === selectedClient;
    const matchesSearch =
      !clientSearch.trim() ||
      (cert.clientName || "").toLowerCase().includes(clientSearch.toLowerCase());
    // certificationDate is stored as YYYY-MM-DD, so string comparison is chronological
    const certDate = (cert.certificationDate || "").slice(0, 10);
    const matchesDate =
      (!dateRange.from || certDate >= dateRange.from) &&
      (!dateRange.to || certDate <= dateRange.to);
    return matchesDropdown && matchesSearch && matchesDate;
  });

  const hasCertificateFilters =
    selectedClient !== "all" || Boolean(clientSearch.trim()) || Boolean(dateRange.from || dateRange.to);

  const clearCertificateFilters = () => {
    setSelectedClient("all");
    setClientSearch("");
    setDateRange(EMPTY_DATE_FILTER);
  };

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
              }}
              className="w-full pl-9 pr-8 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {clientSearch && (
              <button
                onClick={() => setClientSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter by client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {uniqueClients.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangeFilter
            label="Issue Date"
            value={dateRange}
            onChange={setDateRange}
            testIdPrefix="certificates-date"
          />
          {hasCertificateFilters && (
            <button
              onClick={clearCertificateFilters}
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
                {filteredCerts.map((cert: any) => {
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
                {filteredCerts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
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
