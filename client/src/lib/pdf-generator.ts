import jsPDF from 'jspdf';
import type { TestSession, TestResult } from '@shared/schema';

interface ReportData {
  session: TestSession;
  results: TestResult[];
  summary: {
    totalItems: number;
    passedItems: number;
    failedItems: number;
    passRate: number;
  };
}

export function generatePDFReport(data: ReportData): Blob {
  const { session, results, summary } = data;
  const doc = new jsPDF();
  
  // Header based on country
  const isAustralia = session.country === 'australia';
  const headerTitle = isAustralia 
    ? 'Electrical Safety Testing Report - Australia' 
    : 'Electrical Safety Testing Report - New Zealand';
  
  // Page setup
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  let yPosition = margin;

  // Add header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(headerTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Add test date and reference
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Test Date: ${new Date(session.testDate).toLocaleDateString()}`, margin, yPosition);
  doc.text(`Report Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 15;

  // Client information section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Client Information', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Business Name: ${session.clientName}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Site Contact: ${session.siteContact}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Address: ${session.address}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Technician: ${session.technicianName}`, margin, yPosition);
  yPosition += 15;

  // Summary section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Test Summary', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Items Tested: ${summary.totalItems}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Items Passed: ${summary.passedItems}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Items Failed: ${summary.failedItems}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Pass Rate: ${summary.passRate}%`, margin, yPosition);
  yPosition += 15;

  // Test results table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Test Results', margin, yPosition);
  yPosition += 10;

  // Table headers
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Asset#', margin, yPosition);
  doc.text('Item', margin + 25, yPosition);
  doc.text('Location', margin + 70, yPosition);
  doc.text('Class', margin + 110, yPosition);
  doc.text('Result', margin + 135, yPosition);
  doc.text('Notes', margin + 160, yPosition);
  yPosition += 7;

  // Table content
  doc.setFont('helvetica', 'normal');
  results.forEach((result) => {
    // Check if we need a new page
    if (yPosition > doc.internal.pageSize.height - 30) {
      doc.addPage();
      yPosition = margin;
    }

    doc.text(result.assetNumber, margin, yPosition);
    doc.text(result.itemName, margin + 25, yPosition);
    doc.text(result.location, margin + 70, yPosition);
    doc.text(result.classification.toUpperCase(), margin + 110, yPosition);
    
    // Color code the result
    if (result.result === 'pass') {
      doc.setTextColor(0, 128, 0); // Green
      doc.text('PASS', margin + 135, yPosition);
    } else {
      doc.setTextColor(255, 0, 0); // Red
      doc.text('FAIL', margin + 135, yPosition);
    }
    doc.setTextColor(0, 0, 0); // Reset to black

    // Add failure details if applicable
    if (result.result === 'fail' && result.failureReason) {
      const failureText = `${result.failureReason}${result.actionTaken ? `, ${result.actionTaken}` : ''}`;
      doc.text(failureText, margin + 160, yPosition);
    }

    yPosition += 6;
  });

  // Add footer
  const footerY = doc.internal.pageSize.height - 20;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(
    isAustralia 
      ? 'This report complies with AS/NZS 3760:2010 electrical safety standards.'
      : 'This report complies with NZS 5262:2003 electrical safety standards.',
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  return doc.output('blob');
}

export function downloadPDF(data: ReportData, filename?: string) {
  const blob = generatePDFReport(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `test-report-${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
