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

function calculateNextDueDate(testDate: string, frequency: string): string {
  const date = new Date(testDate);
  
  switch (frequency) {
    case 'threemonthly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'sixmonthly':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'twelvemonthly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    case 'twentyfourmonthly':
      date.setFullYear(date.getFullYear() + 2);
      break;
    case 'fiveyearly':
      date.setFullYear(date.getFullYear() + 5);
      break;
    default:
      date.setFullYear(date.getFullYear() + 1);
  }
  
  return date.toLocaleDateString();
}

function getFrequencyLabel(frequency: string): string {
  switch (frequency) {
    case 'threemonthly': return '3 Monthly';
    case 'sixmonthly': return '6 Monthly';
    case 'twelvemonthly': return '12 Monthly';
    case 'twentyfourmonthly': return '24 Monthly';
    case 'fiveyearly': return '5 Yearly';
    default: return '12 Monthly';
  }
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
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Asset#', margin, yPosition);
  doc.text('Item', margin + 20, yPosition);
  doc.text('Location', margin + 55, yPosition);
  doc.text('Class', margin + 85, yPosition);
  doc.text('Result', margin + 105, yPosition);
  doc.text('Frequency', margin + 125, yPosition);
  doc.text('Next Due', margin + 155, yPosition);
  yPosition += 7;

  // Table content
  doc.setFont('helvetica', 'normal');
  results.forEach((result, index) => {
    // Check if we need a new page
    if (yPosition > doc.internal.pageSize.height - 30) {
      doc.addPage();
      yPosition = margin;
    }

    // Use index + 1 as the asset number (count)
    doc.text((index + 1).toString(), margin, yPosition);
    doc.text(result.itemName, margin + 20, yPosition);
    doc.text(result.location, margin + 55, yPosition);
    doc.text(result.classification.toUpperCase(), margin + 85, yPosition);
    
    // Color code the result
    if (result.result === 'pass') {
      doc.setTextColor(0, 128, 0); // Green
      doc.text('PASS', margin + 105, yPosition);
    } else {
      doc.setTextColor(255, 0, 0); // Red
      doc.text('FAIL', margin + 105, yPosition);
    }
    doc.setTextColor(0, 0, 0); // Reset to black

    // Add frequency and next due date
    doc.text(getFrequencyLabel(result.frequency), margin + 125, yPosition);
    doc.text(calculateNextDueDate(session.testDate, result.frequency), margin + 155, yPosition);

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
