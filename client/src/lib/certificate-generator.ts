import jsPDF from 'jspdf';
import letterheadPath from "@assets/1_1763032250172.png";
import footerPath from "@assets/0_1763032956375.png";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";
import greatVibesFont from '@/lib/fonts/GreatVibes-Regular.ttf?url';
import type { Certificate } from '@shared/schema';

/**
 * Certificate data structure for PDF generation
 */
export interface CertificateData {
  certificate: Certificate;
}

/**
 * Country a certificate applies to, from its test session(s): 'australia', 'newzealand',
 * 'national_client', or null when unknown or the linked reports span countries.
 */
export type CertificateCountry = string | null;

/**
 * Loads a custom font into jsPDF
 * @param doc - jsPDF document instance
 * @param fontUrl - URL path to the TTF font file
 * @param fontName - Name to use for the font in jsPDF
 */
async function loadCustomFont(doc: jsPDF, fontUrl: string, fontName: string): Promise<void> {
  try {
    // Fetch TTF as ArrayBuffer
    const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
    const uint8Array = new Uint8Array(fontBytes);
    
    // Convert to binary string
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    
    // Encode to base64
    const base64String = btoa(binaryString);
    
    // Add to jsPDF
    const fileName = `${fontName}.ttf`;
    doc.addFileToVFS(fileName, base64String);
    doc.addFont(fileName, fontName, 'normal');
  } catch (error) {
    console.error(`Failed to load custom font ${fontName}:`, error);
  }
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
 * Renders a Certificate of Compliance onto an existing jsPDF document, as a new page.
 * Used both by the standalone certificate PDF (below) and to append a certificate to
 * the end of a test report PDF so they ship as one file.
 * @param doc - An existing jsPDF document; a new page is added before drawing
 * @param certificate - Certificate data including client info, services, and validity dates
 * @param country - Country used to pick the fire equipment standard; null shows both AU and NZ
 */
export async function renderCertificateIntoDoc(doc: jsPDF, certificate: Certificate, country: CertificateCountry = null): Promise<void> {
  doc.addPage();

  // Load custom cursive font for technician signature
  await loadCustomFont(doc, greatVibesFont, 'GreatVibes');

  // Page setup
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  let yPosition = 0;

  // Parse services and validity dates from JSONB
  const services = certificate.services as any as string[];
  const validityDates = certificate.validityDates as any as Record<string, string>;

  // Add header image at top - full width, maintaining aspect ratio
  try {
    const letterheadResponse = await fetch(letterheadPath);
    const letterheadBlob = await letterheadResponse.blob();
    const letterheadDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(letterheadBlob);
    });
    
    // Load image to get natural dimensions
    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = letterheadDataUrl;
    });
    
    // Calculate height to maintain aspect ratio at full page width
    const aspectRatio = img.height / img.width;
    const headerWidth = pageWidth;
    const headerHeight = headerWidth * aspectRatio;
    
    // Add header at top with natural aspect ratio
    doc.addImage(letterheadDataUrl, 'PNG', 0, 0, headerWidth, headerHeight);
    
    // Start content below header
    yPosition = headerHeight + 15;
  } catch (error) {
    console.error('Failed to load letterhead:', error);
    yPosition = 30;
  }

  // Title: THE LOCAL GUYS TEST & TAG (red, larger size)
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(237, 28, 36); // Red color
  doc.text('THE LOCAL GUYS TEST & TAG', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Main Title: CERTIFICATE OF COMPLIANCE (black, larger size)
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0); // Reset to black
  doc.text('CERTIFICATE OF COMPLIANCE', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // "This certificate acknowledges that"
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('This certificate acknowledges that', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Client Name (bold, larger, centered, blue color)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 102, 204); // Blue color
  doc.text(certificate.clientName, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  // Client Address (centered, blue color, with text wrapping)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 102, 204); // Blue color
  
  // Split address into multiple lines if needed (max width: 150mm)
  const addressLines = doc.splitTextToSize(certificate.address, 150);
  addressLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5; // Line spacing for address
  });
  yPosition += 5; // Extra spacing after address block
  
  // Reset text color to black for remaining content
  doc.setTextColor(0, 0, 0);

  // Compliance statement (3 lines, centered)
  const complianceLines = [
    'Is compliant with their obligations and duty of care for staff, visitors',
    'and contractors under the relevant Australian/New Zealand Standards for the',
    'services listed below.'
  ];
  
  complianceLines.forEach(line => {
    doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
  });
  yPosition += 15;

  // Services Completed section - always show 5 lines with underlines
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const servicesLabel = 'Services Completed:';
  doc.text(servicesLabel, margin, yPosition);
  
  // Service names appear on lines below, indented (always 5 lines with underlines)
  doc.setFont('helvetica', 'normal');
  const serviceLabelWidth = doc.getTextWidth(servicesLabel);
  const serviceX = margin + serviceLabelWidth + 10;
  const underlineEndX = pageWidth - margin; // Underline extends to right margin
  
  // Always show 5 lines for services with underlines; first service sits on the label's line
  for (let i = 0; i < 5; i++) {
    if (i > 0) yPosition += 6;
    if (services[i]) {
      drawServiceLine(doc, services[i], country, serviceX, yPosition, underlineEndX - serviceX);
    }
    doc.line(serviceX, yPosition + 1, underlineEndX, yPosition + 1);
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  yPosition += 12; // Gap after services

  // Date section - all dates RIGHT-ALIGNED at far right of page
  const rightX = pageWidth - margin - 5; // Right edge position for dates
  
  doc.setFontSize(11);
  
  // Date of Certification
  doc.setFont('helvetica', 'bold');
  doc.text('Date of Certification:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDateForCertificate(certificate.certificationDate), rightX, yPosition, { align: 'right' });
  yPosition += 7;

  // All service validity dates - always show all 5 testing types
  const allServiceTypes = [
    { type: 'electrical', label: 'Electrical Test and Tag Valid Until:' },
    { type: 'emergency_exit_light', label: 'Emergency Exit Light Testing Valid Until:' },
    { type: 'fire_testing', label: 'Fire Equipment Testing Valid Until:' },
    { type: 'rcd_reporting', label: 'RCD Reporting Valid Until:' },
    { type: 'microwave_leakage', label: 'Microwave Leakage Testing Valid Until:' }
  ];

  allServiceTypes.forEach(({ type, label }) => {
    // "Valid Until" labels in normal (thinner) font
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(label, margin, yPosition);

    // Only show date if this service was selected
    if (services.includes(type) && validityDates[type]) {
      doc.text(formatDateForCertificate(validityDates[type]), rightX, yPosition, { align: 'right' });
    }

    yPosition += 7;
  });

  // Optional general note - only rendered when a note was entered
  if (certificate.notes) {
    yPosition += 5;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', margin, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(certificate.notes, pageWidth - margin * 2);
    noteLines.forEach((line: string) => {
      doc.text(line, margin, yPosition);
      yPosition += 5;
    });
  }

  // Add footer image at bottom - full width, maintaining aspect ratio
  let footerImageHeight = 0;
  try {
    const footerResponse = await fetch(footerPath);
    const footerBlob = await footerResponse.blob();
    const footerDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(footerBlob);
    });
    
    // Load footer image to get natural dimensions
    const footerImg = new Image();
    await new Promise<void>((resolve) => {
      footerImg.onload = () => resolve();
      footerImg.src = footerDataUrl;
    });
    
    // Calculate height to maintain aspect ratio at full page width
    const footerAspectRatio = footerImg.height / footerImg.width;
    const footerWidth = pageWidth;
    footerImageHeight = footerWidth * footerAspectRatio;
    
    // Position footer at bottom of page
    const footerYPosition = pageHeight - footerImageHeight;
    doc.addImage(footerDataUrl, 'PNG', 0, footerYPosition, footerWidth, footerImageHeight);
  } catch (error) {
    console.error('Failed to load footer image:', error);
  }

  // Footer text section - positioned above the footer image (closer to footer)
  const footerTextY = pageHeight - footerImageHeight - 18;
  
  // Technician information - bottom left
  // Technician name in elegant cursive/script font (Great Vibes - matching template signature style)
  doc.setFontSize(16);
  doc.setFont('GreatVibes', 'normal');
  doc.text(certificate.technicianName, margin, footerTextY);
  
  // License number in regular font below name
  if (certificate.technicianLicense) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(certificate.technicianLicense, margin, footerTextY + 6);
  }
}

/**
 * Generates a standalone Certificate of Compliance PDF matching the exact template format
 * @param data - Certificate data including client info, services, and validity dates
 * @returns Promise resolving to Blob object containing the PDF file for download
 */
export async function generateCertificatePDF(data: CertificateData): Promise<Blob> {
  const doc = new jsPDF();
  const country = await resolveCertificateCountry(data.certificate);
  // renderCertificateIntoDoc always calls addPage() first, so the fresh doc starts with
  // an extra blank page — remove it once the certificate page has been added.
  await renderCertificateIntoDoc(doc, data.certificate, country);
  doc.deletePage(1);
  return doc.output('blob');
}

/**
 * Looks up the country of the report(s) behind a certificate.
 * Uses the reports attached to it, falling back to the session it was auto-created from.
 * Returns null for freestanding certificates, mixed-country reports, or a failed lookup.
 */
async function resolveCertificateCountry(certificate: Certificate): Promise<CertificateCountry> {
  try {
    let sessions: { country?: string }[] = [];
    const attachedRes = await fetch(`/api/certificates/${certificate.id}/sessions`, { credentials: 'include' });
    if (attachedRes.ok) sessions = await attachedRes.json();

    if (sessions.length === 0 && certificate.sessionId) {
      const sessionRes = await fetch(`/api/sessions/${certificate.sessionId}`, { credentials: 'include' });
      if (sessionRes.ok) sessions = [await sessionRes.json()];
    }

    const countries = Array.from(new Set(sessions.map(s => s.country).filter(Boolean)));
    return countries.length === 1 ? countries[0]! : null;
  } catch (error) {
    console.error('Failed to resolve certificate country:', error);
    return null;
  }
}

/**
 * Standard each service is certified against. Fire equipment depends on country:
 * AS 1851 for Australia (and national clients), NZS 4503:2005 for New Zealand,
 * and both when the country isn't known.
 */
export function getServiceStandard(serviceType: string, country: CertificateCountry): string | null {
  switch (serviceType) {
    case 'electrical':
    case 'rcd_reporting':
      return 'AS/NZS 3760:2022';
    case 'emergency_exit_light':
      return 'AS/NZS 2293.2';
    case 'microwave_leakage':
      return 'AS/NZS 60335.2.25';
    case 'fire_testing':
      if (country === 'newzealand') return 'NZS 4503:2005';
      if (country) return 'AS 1851';
      return 'AS 1851 (AU) / NZS 4503:2005 (NZ)';
    default:
      return null;
  }
}

/**
 * Draws "Service Name - Standard" on one underlined service line, shrinking the font
 * (down to 8pt) when the combined text would run past the underline.
 */
function drawServiceLine(doc: jsPDF, serviceType: string, country: CertificateCountry, x: number, y: number, maxWidth: number) {
  const serviceName = getServiceDisplayName(serviceType);
  const standard = getServiceStandard(serviceType, country);
  const text = standard ? `${serviceName} - ${standard}` : serviceName;

  doc.setFont('helvetica', 'normal');
  let fontSize = 11;
  doc.setFontSize(fontSize);
  while (fontSize > 8 && doc.getTextWidth(text) > maxWidth) {
    fontSize -= 0.5;
    doc.setFontSize(fontSize);
  }
  doc.text(text, x, y);
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
      return 'RCD Reporting';
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
