import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Plus, FileText, Trash2 } from "lucide-react";
import { useCertificates } from "./useCertificates";
import { CertificateModal } from "./CertificateModal";
import { generateCertificatePDF, downloadCertificatePDF } from "@/lib/certificate-generator";
import type { Certificate } from "@shared/schema";

export function CertificatesTab() {
  const { certificates, certificatesLoading, createCertificateMutation, deleteCertificateMutation } =
    useCertificates();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleCreateCertificate = (data: any) => {
    createCertificateMutation.mutate(data, {
      onSuccess: () => {
        setIsCreateModalOpen(false);
      },
    });
  };

  const handleViewCertificate = async (cert: Certificate) => {
    try {
      const blob = await generateCertificatePDF({ certificate: cert });
      downloadCertificatePDF(blob, cert.clientName);
    } catch (error) {
      console.error("Error generating certificate PDF:", error);
    }
  };

  const handleDeleteCertificate = (id: number) => {
    if (confirm("Are you sure you want to delete this certificate?")) {
      deleteCertificateMutation.mutate(id);
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
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2"
            data-testid="button-create-certificate"
          >
            <Plus className="w-4 h-4" />
            Create Certificate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
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
                {(certificates as any[] || []).map((cert: any) => {
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
                            title="View & Download"
                            data-testid={`button-view-certificate-${cert.id}`}
                          >
                            <FileText className="w-4 h-4" />
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
                {(certificates as any[] || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No certificates created yet. Click "Create Certificate" to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <CertificateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateCertificate}
      />
    </Card>
  );
}
