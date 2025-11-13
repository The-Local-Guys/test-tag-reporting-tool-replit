import jsPDF from 'jspdf';
import letterheadPath from "@assets/1_1763032250172.png";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";
import type { Certificate } from '@shared/schema';

/**
 * Certificate data structure for PDF generation
 */
export interface CertificateData {
  certificate: Certificate;
}

/**
 * Formats a date string from YYYY-MM-DD to "DD Month YYYY" format
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Formatted date string (e.g., "01 February 2023")
 */
function formatDateForCertificate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Generates a Certificate of Compliance PDF matching the exact template format
 * @param data - Certificate data including client info, services, and validity dates
 * @returns Promise resolving to Blob object containing the PDF file for download
 */
export async function generateCertificatePDF(data: CertificateData): Promise<Blob> {
  const { certificate } = data;
  const doc = new jsPDF();
  
  // Page setup
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  let yPosition = 30;

  // Parse services and validity dates from JSONB
  const services = certificate.services as any as string[];
  const validityDates = certificate.validityDates as any as Record<string, string>;

  // Add letterhead background if available
  try {
    const letterheadResponse = await fetch(letterheadPath);
    const letterheadBlob = await letterheadResponse.blob();
    const letterheadDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(letterheadBlob);
    });
    
    const letterheadWidth = pageWidth * 1.15;
    const letterheadHeight = pageHeight * 1.12;
    const xOffset = (pageWidth - letterheadWidth) / 2;
    const yOffset = (pageHeight - letterheadHeight) / 2;
    doc.addImage(letterheadDataUrl, 'PNG', xOffset, yOffset, letterheadWidth, letterheadHeight);
  } catch (error) {
    console.error('Failed to load letterhead:', error);
  }

  // Title: THE LOCAL GUYS TEST & TAG
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('THE LOCAL GUYS TEST & TAG', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Main Title: CERTIFICATE OF COMPLIANCE
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICATE OF COMPLIANCE', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // "This certificate acknowledges that"
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('This certificate acknowledges that', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Client Name (bold, larger, centered)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(certificate.clientName, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  // Client Address (centered)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(certificate.address, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Compliance statement (3 lines, centered)
  const complianceLines = [
    'Is compliant with their obligations and duty of care for staff, visitors',
    'and contractors under the relevant Australian standards for the',
    'services listed.'
  ];
  
  complianceLines.forEach(line => {
    doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
  });
  yPosition += 15;

  // Services Completed section - label and service names on SAME LINE
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const servicesLabel = 'Services Completed:';
  doc.text(servicesLabel, margin, yPosition);
  
  // Service names appear on the same line, after the label
  doc.setFont('helvetica', 'normal');
  const serviceLabelWidth = doc.getTextWidth(servicesLabel);
  let serviceX = margin + serviceLabelWidth + 10;
  
  services.forEach((serviceType, index) => {
    const serviceName = getServiceDisplayName(serviceType);
    if (index > 0) {
      // If multiple services, put them on new lines but indented
      yPosition += 6;
      doc.text(serviceName, serviceX, yPosition);
    } else {
      doc.text(serviceName, serviceX, yPosition);
    }
  });
  
  yPosition += 25; // Large gap after services

  // Date section - all dates RIGHT-ALIGNED at far right of page
  const rightX = pageWidth - margin - 5; // Right edge position for dates
  
  doc.setFontSize(11);
  
  // Date of Certification
  doc.setFont('helvetica', 'bold');
  doc.text('Date of Certification:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDateForCertificate(certificate.certificationDate), rightX, yPosition, { align: 'right' });
  yPosition += 10;

  // All service validity dates - always show all types
  const allServiceTypes = [
    { type: 'electrical', label: 'Electrical Appliance Testing Valid Until:' },
    { type: 'rcd_reporting', label: 'Residual Current Device Testing Valid Until:' },
    { type: 'fire_testing', label: 'Fire Equipment Maintenance Valid Until:' }
  ];
  
  allServiceTypes.forEach(({ type, label }) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPosition);
    
    // Only show date if this service was selected
    if (services.includes(type) && validityDates[type]) {
      doc.setFont('helvetica', 'normal');
      doc.text(formatDateForCertificate(validityDates[type]), rightX, yPosition, { align: 'right' });
    }
    
    yPosition += 10;
  });

  // Footer section - positioned at bottom of page
  const footerY = pageHeight - 30;
  
  // Technician information - bottom left
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(certificate.technicianName, margin, footerY);
  
  if (certificate.technicianLicense) {
    doc.setFont('helvetica', 'normal');
    doc.text(certificate.technicianLicense, margin + 5, footerY + 5);
  }

  // Company footer - centered at bottom
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const companyFooter1 = 'This certificate is property of The Local Guys Test & Tag Wollongong';
  const companyFooter2 = 'Tel: 1800 056 225 | Email: admin@thelocalguys.com.au';
  const companyFooter3 = 'www.thelocalguystestandtag.com.au';
  
  doc.text(companyFooter1, pageWidth / 2, footerY, { align: 'center' });
  doc.text(companyFooter2, pageWidth / 2, footerY + 5, { align: 'center' });
  doc.text(companyFooter3, pageWidth / 2, footerY + 10, { align: 'center' });

  return doc.output('blob');
}

/**
 * Helper function to get display name for service types
 */
function getServiceDisplayName(serviceType: string): string {
  switch (serviceType) {
    case 'electrical':
      return 'Electrical Appliance Test & Tag';
    case 'emergency_exit_light':
      return 'Emergency Exit Light Testing';
    case 'fire_testing':
      return 'Fire Equipment Maintenance';
    case 'rcd_reporting':
      return 'Residual Current Device Testing';
    case 'microwave_leakage':
      return 'Microwave Leakage Testing';
    default:
      return serviceType;
  }
}

/**
 * Downloads the certificate PDF with a descriptive filename
 * @param blob - PDF blob to download
 * @param clientName - Client name for the filename
 */
export function downloadCertificatePDF(blob: Blob, clientName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeClientName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
  link.download = `certificate-of-compliance-${safeClientName}-${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
