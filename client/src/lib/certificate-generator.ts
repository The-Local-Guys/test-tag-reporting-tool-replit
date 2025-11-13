import jsPDF from 'jspdf';
import letterheadPath from "@assets/Letterheads_1754455497882.png";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";
import type { Certificate } from '@shared/schema';

/**
 * Certificate data structure for PDF generation
 */
export interface CertificateData {
  certificate: Certificate;
}


/**
 * Generates a professionally formatted Certificate of Compliance PDF
 * Matches the design from the attached certificate template
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
  let yPosition = margin;

  // Add letterhead
  try {
    const letterheadResponse = await fetch(letterheadPath);
    const letterheadBlob = await letterheadResponse.blob();
    const letterheadDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(letterheadBlob);
    });
    
    // Add letterhead at 115% width and 112% height of the page, centered
    const letterheadWidth = pageWidth * 1.15;
    const letterheadHeight = pageHeight * 1.12;
    
    // Center the letterhead on the page
    const xOffset = (pageWidth - letterheadWidth) / 2;
    const yOffset = (pageHeight - letterheadHeight) / 2;
    doc.addImage(letterheadDataUrl, 'PNG', xOffset, yOffset, letterheadWidth, letterheadHeight);
    
    // Give space for letterhead content at top
    yPosition += 60;
  } catch (error) {
    // Fallback to logo and text if letterhead fails to load
    try {
      const logoResponse = await fetch(logoPath);
      const logoBlob = await logoResponse.blob();
      const logoDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });
      
      const logoWidth = 40;
      const logoHeight = 15;
      doc.addImage(logoDataUrl, 'PNG', (pageWidth - logoWidth) / 2, yPosition, logoWidth, logoHeight);
      yPosition += logoHeight + 10;
      
      // Add company name
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('THE LOCAL GUYS TEST & TAG', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;
    } catch (logoError) {
      console.error('Failed to load logo:', logoError);
      yPosition += 20;
    }
  }

  // Title: CERTIFICATE OF COMPLIANCE
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICATE OF COMPLIANCE', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // "This certificate acknowledges that" text
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('This certificate acknowledges that', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Client name (bold and larger)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(certificate.clientName, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  // Client address
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(certificate.address, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Compliance statement
  const complianceText = [
    'Is compliant with their obligations and duty of care for staff, visitors',
    'and contractors under the relevant Australian standards for the',
    'services listed.'
  ];
  
  complianceText.forEach(line => {
    doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
  });
  yPosition += 10;

  // Services Completed section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Services Completed:', margin, yPosition);
  yPosition += 8;

  // Parse services and validity dates from JSONB
  const services = certificate.services as any as string[];
  const validityDates = certificate.validityDates as any as Record<string, string>;
  
  // List completed services
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  services.forEach(serviceType => {
    const serviceName = getServiceDisplayName(serviceType);
    doc.text(`          ${serviceName}`, margin, yPosition);
    yPosition += 6;
  });
  yPosition += 10;

  // Date of Certification
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const certDateLabel = 'Date of Certification:';
  const certDateValue = certificate.certificationDate;
  doc.text(certDateLabel, margin, yPosition);
  doc.setFont('helvetica', 'normal');
  const certDateLabelWidth = doc.getTextWidth(certDateLabel);
  doc.text(certDateValue, margin + certDateLabelWidth + 15, yPosition);
  yPosition += 8;

  // Validity dates for each service
  services.forEach(serviceType => {
    const serviceName = getServiceDisplayName(serviceType);
    const labelText = `${serviceName} Valid Until:`;
    
    doc.setFont('helvetica', 'bold');
    doc.text(labelText, margin, yPosition);
    
    doc.setFont('helvetica', 'normal');
    const labelWidth = doc.getTextWidth(labelText);
    doc.text(validityDates[serviceType] || '', margin + labelWidth + 5, yPosition);
    yPosition += 8;
  });

  // Footer with technician information
  yPosition = pageHeight - 40;
  
  // Technician name and license
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(certificate.technicianName, margin, yPosition);
  yPosition += 6;
  
  if (certificate.technicianLicense) {
    doc.setFont('helvetica', 'normal');
    doc.text(certificate.technicianLicense, margin, yPosition);
    yPosition += 6;
  }

  // Company information (right-aligned)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const footerText1 = 'This certificate is property of The Local Guys Test & Tag Wollongong';
  const footerText2 = 'Tel: 1800 056 225 | Email: admin@thelocalguys.com.au';
  const footerText3 = 'www.thelocalguystestandtag.com.au';
  
  const footerY = pageHeight - 25;
  doc.text(footerText1, pageWidth / 2, footerY, { align: 'center' });
  doc.text(footerText2, pageWidth / 2, footerY + 5, { align: 'center' });
  doc.text(footerText3, pageWidth / 2, footerY + 10, { align: 'center' });

  // Generate blob
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
