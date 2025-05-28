import jsPDF from 'jspdf';
import type { TestSession, TestResult } from '@shared/schema';
import logoPath from '@assets/The Local Guys - with plug wide boarder - png seek.png';

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

function calculateNextDueDate(testDate: string, frequency: string, result: string): string {
  const date = new Date(testDate);
  
  // For failed items, next due date is the same as test date (immediate retest required)
  if (result === 'fail') {
    return date.toLocaleDateString('en-AU');
  }
  
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
  
  return date.toLocaleDateString('en-AU');
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

export async function generatePDFReport(data: ReportData): Promise<Blob> {
  const { session, results, summary } = data;
  const doc = new jsPDF();
  
  // Header title
  const headerTitle = 'Electrical Safety Testing Report';
  
  // Page setup
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  let yPosition = margin;

  // Add logo
  try {
    const logoResponse = await fetch(logoPath);
    const logoBlob = await logoResponse.blob();
    const logoDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(logoBlob);
    });
    
    // Calculate logo dimensions (make it more square and taller)
    const logoWidth = 45;
    const logoHeight = 35; // Taller to make it more square
    
    // Center the logo
    doc.addImage(logoDataUrl, 'PNG', pageWidth / 2 - logoWidth / 2, yPosition, logoWidth, logoHeight);
    yPosition += logoHeight + 10;
  } catch (error) {
    // Fallback to text if logo fails to load
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('THE LOCAL GUYS', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('TEST & TAG', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;
  }

  // Add header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(headerTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Add test date and reference
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Test Date: ${new Date(session.testDate).toLocaleDateString('en-AU')}`, margin, yPosition);
  doc.text(`Report Generated: ${new Date().toLocaleDateString('en-AU')}`, pageWidth - margin, yPosition, { align: 'right' });
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
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Asset#', margin, yPosition);
  doc.text('Item', margin + 15, yPosition);
  doc.text('Location', margin + 40, yPosition);
  doc.text('Class', margin + 65, yPosition);
  doc.text('Result', margin + 80, yPosition);
  doc.text('Visual Inspection', margin + 95, yPosition);
  doc.text('Electrical Test', margin + 125, yPosition);
  doc.text('Frequency', margin + 150, yPosition);
  doc.text('Next Due', margin + 175, yPosition);
  doc.text('Failure Reason', margin + 200, yPosition);
  doc.text('Action Taken', margin + 225, yPosition);
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
    doc.text(result.itemName, margin + 15, yPosition);
    doc.text(result.location, margin + 40, yPosition);
    doc.text(result.classification.toUpperCase(), margin + 65, yPosition);
    
    // Color code the result
    if (result.result === 'pass') {
      doc.setTextColor(0, 128, 0); // Green
      doc.text('PASS', margin + 80, yPosition);
    } else {
      doc.setTextColor(255, 0, 0); // Red
      doc.text('FAIL', margin + 80, yPosition);
    }
    doc.setTextColor(0, 0, 0); // Reset to black

    // Add vision inspection and electrical test status
    doc.text(result.visionInspection ? '✓' : '✗', margin + 95, yPosition);
    doc.text(result.electricalTest ? '✓' : '✗', margin + 125, yPosition);

    // Add frequency and next due date
    doc.text(getFrequencyLabel(result.frequency), margin + 150, yPosition);
    doc.text(calculateNextDueDate(session.testDate, result.frequency, result.result), margin + 175, yPosition);

    // Add failure reason and action taken (only for failed items)
    if (result.result === 'fail') {
      const failureReason = result.failureReason || 'Not specified';
      const actionTaken = result.actionTaken || 'Not specified';
      doc.text(failureReason.charAt(0).toUpperCase() + failureReason.slice(1), margin + 200, yPosition);
      doc.text(actionTaken.charAt(0).toUpperCase() + actionTaken.slice(1), margin + 225, yPosition);
    } else {
      doc.text('-', margin + 200, yPosition);
      doc.text('-', margin + 225, yPosition);
    }

    yPosition += 6;
  });

  // Add footer
  const footerY = doc.internal.pageSize.height - 20;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'This report complies with AS/NZS 3760 electrical safety standards.',
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  // Add failed item photos section
  const failedItemsWithPhotos = results.filter(result => result.result === 'fail' && result.photoData);
  
  if (failedItemsWithPhotos.length > 0) {
    // Add new page for photos
    doc.addPage();
    yPosition = margin;
    
    // Photos section header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Failed Items - Photo Documentation', margin, yPosition);
    yPosition += 15;
    
    for (const result of failedItemsWithPhotos) {
      // Check if we need a new page
      if (yPosition > doc.internal.pageSize.height - 120) {
        doc.addPage();
        yPosition = margin;
      }
      
      // Item header
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Asset #${results.indexOf(result) + 1} - ${result.itemName}`, margin, yPosition);
      yPosition += 7;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Location: ${result.location} | Failure: ${result.failureReason}`, margin, yPosition);
      yPosition += 10;
      
      // Add photo
      try {
        if (result.photoData) {
          const imgWidth = 80;
          const imgHeight = 60;
          doc.addImage(result.photoData, 'JPEG', margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 15;
        }
      } catch (error) {
        // If photo can't be added, add placeholder text
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text('Photo could not be displayed in PDF', margin, yPosition);
        yPosition += 15;
        doc.setTextColor(0, 0, 0);
      }
      
      yPosition += 5;
    }
  }

  return doc.output('blob');
}

export async function downloadPDF(data: ReportData, filename?: string) {
  const blob = await generatePDFReport(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `test-report-${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
