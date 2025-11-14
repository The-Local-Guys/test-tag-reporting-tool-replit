import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Download, X, FileCheck } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { generateCertificatePDF, downloadCertificatePDF } from "@/lib/certificate-generator";
import type { Certificate } from "@shared/schema";
import { format } from "date-fns";

interface CertificatePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: Certificate | null;
}

// Map service type codes to display names
function getServiceDisplayName(serviceType: string): string {
  const serviceNames: Record<string, string> = {
    electrical: "Electrical Appliance Test & Tag",
    emergency_exit_light: "Emergency Exit Light Testing",
    fire_testing: "Fire Equipment Maintenance",
    rcd_reporting: "Residual Current Device Testing",
    microwave_leakage: "Microwave Leakage Testing",
  };
  return serviceNames[serviceType] || serviceType;
}

export function CertificatePreview({ isOpen, onClose, certificate }: CertificatePreviewProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!certificate) return;
    
    setIsDownloading(true);
    try {
      const blob = await generateCertificatePDF({ certificate });
      downloadCertificatePDF(blob, certificate.clientName);
    } catch (err) {
      console.error("Error downloading certificate:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!certificate) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Certificate Preview"
      className="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3 mb-2">
            <FileCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              Certificate of Compliance
            </h2>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            This certifies compliance with Australian/New Zealand safety standards
          </p>
        </div>

        {/* Client Information */}
        <div className="space-y-4">
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Client Name
            </h3>
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {certificate.clientName}
            </p>
          </div>

          <div className="border-l-4 border-purple-500 pl-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Address
            </h3>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {certificate.address}
            </p>
          </div>

          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Certification Date
            </h3>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {format(new Date(certificate.certificationDate), "dd MMMM yyyy")}
            </p>
          </div>
        </div>

        {/* Services Section */}
        <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Services Certified
          </h3>
          <div className="space-y-3">
            {(certificate.services as string[]).map((service: string, index: number) => {
              const validUntil = (certificate.validityDates as Record<string, string>)[service];
              return (
                <div 
                  key={index}
                  className="bg-white dark:bg-gray-900 p-4 rounded-md border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {getServiceDisplayName(service)}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Valid Until
                      </p>
                      <p className="font-semibold text-green-700 dark:text-green-400">
                        {format(new Date(validUntil), "dd MMM yyyy")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Technician Information */}
        <div className="bg-amber-50 dark:bg-amber-950 p-5 rounded-lg border border-amber-200 dark:border-amber-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Certified By
          </h3>
          <div className="space-y-2">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Technician Name</p>
              <p className="font-medium text-gray-900 dark:text-gray-100 text-lg" style={{ fontFamily: "'Great Vibes', cursive" }}>
                {certificate.technicianName}
              </p>
            </div>
            {certificate.technicianLicense && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">License Number</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {certificate.technicianLicense}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="button-close-preview"
          >
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2"
            data-testid="button-download-from-preview"
          >
            {isDownloading ? (
              <>
                <LoadingSpinner className="w-4 h-4" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
