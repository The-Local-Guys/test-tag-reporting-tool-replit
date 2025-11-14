import { useEffect, useState, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { generateCertificatePDF, downloadCertificatePDF } from "@/lib/certificate-generator";
import type { Certificate } from "@shared/schema";

interface CertificatePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: Certificate | null;
}

export function CertificatePreview({ isOpen, onClose, certificate }: CertificatePreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [cachedBlob, setCachedBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen && certificate) {
      generatePdfPreview();
    }
    
    return () => {
      // Cleanup using ref to always access the latest URL
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
    };
  }, [isOpen, certificate]);

  const generatePdfPreview = async () => {
    if (!certificate) return;
    
    // Revoke previous URL if it exists
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const blob = await generateCertificatePDF({ certificate });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      pdfUrlRef.current = url;
      setCachedBlob(blob);
    } catch (err) {
      console.error("Error generating PDF preview:", err);
      setError("Failed to generate certificate preview");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!certificate || !cachedBlob) return;
    
    try {
      downloadCertificatePDF(cachedBlob, certificate.clientName);
    } catch (err) {
      console.error("Error downloading certificate:", err);
    }
  };

  const handleClose = () => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
    setPdfUrl(null);
    setCachedBlob(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Certificate Preview"
      className="max-w-5xl"
    >
      <div className="space-y-4">
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {pdfUrl && !isLoading && !error && (
          <>
            <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height: '70vh' }}>
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title={`Certificate of Compliance - ${certificate?.clientName || 'Preview'}`}
                data-testid="certificate-preview-iframe"
              >
                <p className="p-4 text-center text-gray-600">
                  Your browser does not support inline PDF viewing. 
                  Please use the Download button below to view the certificate.
                </p>
              </iframe>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleClose}
                data-testid="button-close-preview"
              >
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
              <Button
                onClick={handleDownload}
                className="flex items-center gap-2"
                data-testid="button-download-from-preview"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
