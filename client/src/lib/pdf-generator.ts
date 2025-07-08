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
  
  // Header title - different for emergency exit light testing
  const headerTitle = session.serviceType === 'emergency_exit_light' 
    ? 'Emergency Exit Light Testing Report'
    : 'Electrical Safety Testing Report';
  
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

  // Table headers - different for emergency exit light testing
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('Asset#', margin, yPosition);
  doc.text('Item', margin + 12, yPosition);
  doc.text('Location', margin + 30, yPosition);
  doc.text('Class', margin + 48, yPosition);
  doc.text('Result', margin + 62, yPosition);
  
  if (session.serviceType === 'emergency_exit_light') {
    doc.text('Manufacturer', margin + 78, yPosition);
    doc.text('Install Date', margin + 100, yPosition);
    doc.text('Frequency', margin + 122, yPosition);
    doc.text('Due Date', margin + 140, yPosition);
    doc.text('Failure Reason', margin + 158, yPosition);
  } else {
    doc.text('V', margin + 78, yPosition);
    doc.text('E', margin + 85, yPosition);
    doc.text('Frequency', margin + 92, yPosition);
    doc.text('Due Date', margin + 115, yPosition);
    doc.text('Failure Reason', margin + 135, yPosition);
    doc.text('Action Taken', margin + 158, yPosition);
  }
  yPosition += 7;

  // Table content
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  results.forEach((result, index) => {
    // Check if we need a new page
    if (yPosition > doc.internal.pageSize.height - 30) {
      doc.addPage();
      yPosition = margin;
    }

    // Use index + 1 as the asset number (count)
    doc.text((index + 1).toString(), margin, yPosition);
    doc.text(result.itemName, margin + 12, yPosition);
    doc.text(result.location, margin + 30, yPosition);
    doc.text(result.classification.toUpperCase(), margin + 48, yPosition);
    
    // Color code the result
    if (result.result === 'pass') {
      doc.setTextColor(0, 128, 0); // Green
      doc.text('PASS', margin + 62, yPosition);
    } else {
      doc.setTextColor(255, 0, 0); // Red
      doc.text('FAIL', margin + 62, yPosition);
    }
    doc.setTextColor(0, 0, 0); // Reset to black

    if (session.serviceType === 'emergency_exit_light') {
      // Show manufacturer and installation date for emergency exit light testing
      doc.text(result.manufacturerInfo || 'N/A', margin + 78, yPosition);
      doc.text(result.installationDate || 'N/A', margin + 100, yPosition);
      doc.text(getFrequencyLabel(result.frequency), margin + 122, yPosition);
      doc.text(calculateNextDueDate(session.testDate, result.frequency, result.result), margin + 140, yPosition);
    } else {
      // Add vision inspection and electrical test status with proper tick/cross marks
      doc.text(result.visionInspection !== false ? 'Y' : 'N', margin + 78, yPosition);
      doc.text(result.electricalTest !== false ? 'Y' : 'N', margin + 85, yPosition);
      
      // Add frequency and next due date
      doc.text(getFrequencyLabel(result.frequency), margin + 92, yPosition);
      doc.text(calculateNextDueDate(session.testDate, result.frequency, result.result), margin + 115, yPosition);
    }

    // Add failure reason (positioning differs by service type)
    if (result.result === 'fail') {
      const failureReason = result.failureReason || 'Not specified';
      
      // Convert failure reason for display
      let displayFailureReason = failureReason;
      if (session.serviceType === 'emergency_exit_light') {
        // Emergency exit light failure reasons
        if (failureReason === 'physical_damage') {
          displayFailureReason = 'Physical Damage';
        } else if (failureReason === 'battery_failure') {
          displayFailureReason = 'Battery Failure';
        } else if (failureReason === 'lamp_failure') {
          displayFailureReason = 'Lamp Failure';
        } else if (failureReason === 'insufficient_illumination') {
          displayFailureReason = 'Insufficient Illumination';
        } else if (failureReason !== 'Not specified') {
          displayFailureReason = failureReason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        doc.text(displayFailureReason, margin + 158, yPosition);
      } else {
        // Standard electrical testing failure reasons
        if (failureReason === 'vision') {
          displayFailureReason = 'Visual Inspection';
        } else if (failureReason !== 'Not specified') {
          displayFailureReason = failureReason.charAt(0).toUpperCase() + failureReason.slice(1);
        }
        
        const actionTaken = result.actionTaken || 'Not specified';
        let displayActionTaken = actionTaken;
        if (actionTaken === 'given') {
          displayActionTaken = 'Given to Site Contact';
        } else if (actionTaken === 'removed') {
          displayActionTaken = 'Removed from Site';
        } else if (actionTaken !== 'Not specified') {
          displayActionTaken = actionTaken.charAt(0).toUpperCase() + actionTaken.slice(1);
        }
        
        doc.text(displayFailureReason, margin + 135, yPosition);
        doc.text(displayActionTaken, margin + 158, yPosition);
      }
    } else {
      if (session.serviceType === 'emergency_exit_light') {
        doc.text('-', margin + 158, yPosition);
      } else {
        doc.text('-', margin + 135, yPosition);
        doc.text('-', margin + 158, yPosition);
      }
    }

    yPosition += 6;
  });

  // Add emergency exit light test criteria details (AS/NZS 2293.2:2019)
  if (session.serviceType === 'emergency_exit_light') {
    yPosition += 10;
    
    // Check if we need a new page
    if (yPosition > doc.internal.pageSize.height - 100) {
      doc.addPage();
      yPosition = margin;
    }
    
    // Test criteria section header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Test Criteria Summary (AS 2293.2:2019)', margin, yPosition);
    yPosition += 12;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Group results by item and show test details
    results.forEach((result, index) => {
      if (yPosition > doc.internal.pageSize.height - 50) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text(`Asset #${index + 1} - ${result.itemName} (${result.location})`, margin, yPosition);
      yPosition += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`• Visual Inspection (Physical condition, mounting, damage): ${result.visionInspection ? 'PASS' : 'FAIL'}`, margin + 5, yPosition);
      yPosition += 6;
      doc.text(`• 90-Minute Discharge Test (Battery backup duration): ${result.dischargeTest ? 'PASS' : 'FAIL'}`, margin + 5, yPosition);
      yPosition += 6;
      doc.text(`• Automatic Switching Test (Power failure simulation): ${result.switchingTest ? 'PASS' : 'FAIL'}`, margin + 5, yPosition);
      yPosition += 6;
      doc.text(`• Charging Circuit Test (Battery charging verification): ${result.chargingTest ? 'PASS' : 'FAIL'}`, margin + 5, yPosition);
      yPosition += 6;
      
      // Show battery voltage and lux level if available
      if (result.batteryVoltage) {
        doc.text(`• Battery Voltage: ${result.batteryVoltage}V`, margin + 5, yPosition);
        yPosition += 6;
      }
      if (result.luxLevel) {
        doc.text(`• Lux Level: ${result.luxLevel} lux`, margin + 5, yPosition);
        yPosition += 6;
      }
      
      // Show notes if any
      if (result.notes) {
        doc.text(`• Additional Notes: ${result.notes}`, margin + 5, yPosition);
        yPosition += 6;
      }
      
      yPosition += 6; // Space between items
    });
  }

  // Add footer
  const footerY = doc.internal.pageSize.height - 20;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  const footerText = session.serviceType === 'emergency_exit_light' 
    ? 'This report complies with AS 2293.2:2019 emergency lighting standards.'
    : 'This report complies with AS/NZS 3760 electrical safety standards.';
  doc.text(
    footerText,
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
