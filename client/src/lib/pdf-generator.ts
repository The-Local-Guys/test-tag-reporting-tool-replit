import jsPDF from 'jspdf';
import type { TestSession, TestResult } from '@shared/schema';
import logoPath from '@assets/The Local Guys - with plug wide boarder - png seek.png';
import letterheadPath from '@assets/Letterheads_1754455497882.png';

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
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
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
    case 'monthly': return 'Monthly';
    case 'threemonthly': return '3 Monthly';
    case 'sixmonthly': return '6 Monthly';
    case 'twelvemonthly': return '12 Monthly';
    case 'twentyfourmonthly': return '24 Monthly';
    case 'fiveyearly': return '5 Yearly';
    default: return '12 Monthly';
  }
}

async function addLetterheadToPage(doc: jsPDF, margin: number, pageWidth: number): Promise<number> {
  let yPosition = margin;
  
  try {
    const letterheadResponse = await fetch(letterheadPath);
    const letterheadBlob = await letterheadResponse.blob();
    const letterheadDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(letterheadBlob);
    });
    
    // Add letterhead at 115% width and 112% height of the page, centered
    const pageHeight = doc.internal.pageSize.height;
    const letterheadWidth = pageWidth * 1.15;
    const letterheadHeight = pageHeight * 1.12;
    
    // Center the letterhead on the page
    const xOffset = (pageWidth - letterheadWidth) / 2;
    const yOffset = (pageHeight - letterheadHeight) / 2;
    doc.addImage(letterheadDataUrl, 'PNG', xOffset, yOffset, letterheadWidth, letterheadHeight);
    
    // Return position with top margin for content to start below letterhead branding area
    yPosition += 60; // Give space for letterhead content at top
  } catch (error) {
    // Fallback - add minimal spacing for consistency
    yPosition += 20;
  }
  
  return yPosition;
}

/**
 * Generates a professionally formatted PDF report for electrical and emergency testing
 * Creates multi-page reports with company branding, test results, and compliance formatting
 * @param data - Complete session data including test results and client information
 * @returns Promise resolving to Blob object containing the PDF file for download
 */
export async function generatePDFReport(data: ReportData): Promise<Blob> {
  const { session, summary } = data;
  
  // Sort results by asset number: monthly frequencies first (1, 2, 3...) then 5-yearly (10001, 10002, 10003...)
  const results = [...data.results].sort((a, b) => {
    const aAssetNum = parseInt(a.assetNumber) || 0;
    const bAssetNum = parseInt(b.assetNumber) || 0;
    return aAssetNum - bAssetNum;
  });
  const doc = new jsPDF();
  
  // Header title - different for each service type
  const headerTitle = session.serviceType === 'emergency_exit_light' 
    ? 'Emergency Exit Light Testing Report'
    : session.serviceType === 'fire_testing'
    ? 'Fire Equipment Testing Report'
    : 'Electrical Safety Testing Report';
  
  // Page setup
  const pageWidth = doc.internal.pageSize.width;
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
    const pageHeight = doc.internal.pageSize.height;
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
      
      // Calculate logo dimensions (make it more square and taller)
      const logoWidth = 45;
      const logoHeight = 35; // Taller to make it more square
      
      // Center the logo
      doc.addImage(logoDataUrl, 'PNG', pageWidth / 2 - logoWidth / 2, yPosition, logoWidth, logoHeight);
      yPosition += logoHeight + 10;
    } catch (logoError) {
      // Final fallback to text
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('THE LOCAL GUYS', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('TEST & TAG', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;
    }
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

  // Table headers - different for each service type
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('Asset#', margin, yPosition);
  doc.text('Item', margin + 12, yPosition);
  doc.text('Location', margin + 30, yPosition);
  
  if (session.serviceType === 'emergency_exit_light') {
    doc.text('Result', margin + 48, yPosition);
    doc.text('Manufacturer', margin + 62, yPosition);
    doc.text('Install Date', margin + 84, yPosition);
    doc.text('Frequency', margin + 106, yPosition);
    doc.text('Due Date', margin + 124, yPosition);
    doc.text('Failure Reason', margin + 142, yPosition);
  } else if (session.serviceType === 'fire_testing') {
    doc.text('Type', margin + 48, yPosition);
    doc.text('Result', margin + 62, yPosition);
    // Wrap "Net Size/Gross Weight" header to prevent overlap
    const sizeWeightHeaderLines = doc.splitTextToSize('Net Size/Gross Weight', 20);
    sizeWeightHeaderLines.forEach((line: string, i: number) => {
      doc.text(line, margin + 78, yPosition + (i * 3));
    });
    doc.text('Manufacturer', margin + 100, yPosition);
    doc.text('Frequency', margin + 122, yPosition);
    doc.text('Due Date', margin + 140, yPosition);
    doc.text('Failure Reason', margin + 158, yPosition);
  } else {
    doc.text('Type', margin + 48, yPosition);
    doc.text('Result', margin + 62, yPosition);
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
  for (let index = 0; index < results.length; index++) {
    const result = results[index];

    // Calculate column widths for word wrapping
    const itemNameWidth = 17; // Width for item name column
    const locationWidth = 17; // Width for location column
    
    // Split text to fit column widths
    const itemNameLines = doc.splitTextToSize(result.itemName, itemNameWidth);
    const locationLines = doc.splitTextToSize(result.location, locationWidth);
    
    // For fire testing, also calculate size/weight lines and type lines
    let sizeWeightLines: string[] = [];
    let manufacturerLines: string[] = [];
    let typeLines: string[] = [];
    if (session.serviceType === 'fire_testing') {
      const notes = result.notes || '';
      const sizeMatch = notes.match(/Net Size: ([^|]+)/);
      const weightMatch = notes.match(/Gross Weight: ([^|]+)/);
      const sizeWeight = [sizeMatch?.[1]?.trim(), weightMatch?.[1]?.trim()].filter(Boolean).join(' / ') || 'N/A';
      const sizeWeightWidth = 20; // Width for size/weight column
      sizeWeightLines = doc.splitTextToSize(sizeWeight, sizeWeightWidth);
      
      // Add word wrapping for manufacturer info
      const manufacturerWidth = 20; // Width for manufacturer column
      manufacturerLines = doc.splitTextToSize(result.manufacturerInfo || 'N/A', manufacturerWidth);
      
      // Add word wrapping for type/classification
      const typeWidth = 13; // Width for type column
      typeLines = doc.splitTextToSize(result.classification.toUpperCase(), typeWidth);
    } else if (session.serviceType === 'emergency_exit_light') {
      // Add word wrapping for manufacturer info in emergency exit light
      const manufacturerWidth = 20;
      manufacturerLines = doc.splitTextToSize(result.manufacturerInfo || 'N/A', manufacturerWidth);
    } else {
      // For electrical testing, add word wrapping for type/classification
      const typeWidth = 13; // Width for type column
      typeLines = doc.splitTextToSize(result.classification.toUpperCase(), typeWidth);
    }
    
    // Calculate row height based on maximum lines needed
    const maxLines = Math.max(itemNameLines.length, locationLines.length, sizeWeightLines.length, manufacturerLines.length, typeLines.length);
    const lineHeight = 4; // Height per line
    const rowHeight = maxLines * lineHeight;
    
    // Check if we need a new page (accounting for row height)
    if (yPosition + rowHeight > doc.internal.pageSize.height - 30) {
      doc.addPage();
      yPosition = await addLetterheadToPage(doc, margin, pageWidth);
    }
    
    // Store starting Y position for this row
    const rowStartY = yPosition;

    // Use the actual asset number from the database
    doc.text(result.assetNumber.toString(), margin, rowStartY);
    
    // Draw item name with word wrapping
    itemNameLines.forEach((line: string, i: number) => {
      doc.text(line, margin + 12, rowStartY + (i * lineHeight));
    });
    
    // Draw location with word wrapping
    locationLines.forEach((line: string, i: number) => {
      doc.text(line, margin + 30, rowStartY + (i * lineHeight));
    });
    
    if (session.serviceType === 'emergency_exit_light') {
      // Color code the result for emergency exit light
      if (result.result === 'pass') {
        doc.setTextColor(0, 128, 0); // Green
        doc.text('PASS', margin + 48, rowStartY);
      } else {
        doc.setTextColor(255, 0, 0); // Red
        doc.text('FAIL', margin + 48, rowStartY);
      }
      doc.setTextColor(0, 0, 0); // Reset to black
      
      // Show manufacturer with word wrapping and installation date for emergency exit light testing
      manufacturerLines.forEach((line: string, i: number) => {
        doc.text(line, margin + 62, rowStartY + (i * lineHeight));
      });
      doc.text(result.installationDate || 'N/A', margin + 84, rowStartY);
      doc.text(getFrequencyLabel(result.frequency), margin + 106, rowStartY);
      doc.text(calculateNextDueDate(session.testDate, result.frequency, result.result), margin + 124, rowStartY);
    } else if (session.serviceType === 'fire_testing') {
      // For fire testing, show classification/type with word wrapping
      typeLines.forEach((line: string, i: number) => {
        doc.text(line, margin + 48, rowStartY + (i * lineHeight));
      });
      
      // Color code the result
      if (result.result === 'pass') {
        doc.setTextColor(0, 128, 0); // Green
        doc.text('PASS', margin + 62, rowStartY);
      } else {
        doc.setTextColor(255, 0, 0); // Red
        doc.text('FAIL', margin + 62, rowStartY);
      }
      doc.setTextColor(0, 0, 0); // Reset to black
      
      // Draw size/weight with word wrapping (already calculated earlier)
      sizeWeightLines.forEach((line: string, i: number) => {
        doc.text(line, margin + 78, rowStartY + (i * lineHeight));
      });
      
      // Draw manufacturer with word wrapping (already calculated earlier)
      manufacturerLines.forEach((line: string, i: number) => {
        doc.text(line, margin + 100, rowStartY + (i * lineHeight));
      });
      
      doc.text(getFrequencyLabel(result.frequency), margin + 122, rowStartY);
      doc.text(calculateNextDueDate(session.testDate, result.frequency, result.result), margin + 140, rowStartY);
    } else {
      // For regular electrical testing, show classification/type with word wrapping
      typeLines.forEach((line: string, i: number) => {
        doc.text(line, margin + 48, rowStartY + (i * lineHeight));
      });
      
      // Color code the result
      if (result.result === 'pass') {
        doc.setTextColor(0, 128, 0); // Green
        doc.text('PASS', margin + 62, rowStartY);
      } else {
        doc.setTextColor(255, 0, 0); // Red
        doc.text('FAIL', margin + 62, rowStartY);
      }
      doc.setTextColor(0, 0, 0); // Reset to black
      
      // Add vision inspection and electrical test status with proper tick/cross marks
      doc.text(result.visionInspection !== false ? 'Y' : 'N', margin + 78, rowStartY);
      doc.text(result.electricalTest !== false ? 'Y' : 'N', margin + 85, rowStartY);
      
      // Add frequency and next due date
      doc.text(getFrequencyLabel(result.frequency), margin + 92, rowStartY);
      doc.text(calculateNextDueDate(session.testDate, result.frequency, result.result), margin + 115, rowStartY);
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
        doc.text(displayFailureReason, margin + 142, rowStartY);
      } else if (session.serviceType === 'fire_testing') {
        // Fire equipment failure reasons
        if (failureReason === 'physical_damage') {
          displayFailureReason = 'Physical Damage';
        } else if (failureReason === 'pressure_loss') {
          displayFailureReason = 'Pressure Loss';
        } else if (failureReason === 'corrosion') {
          displayFailureReason = 'Corrosion';
        } else if (failureReason === 'blocked_nozzle') {
          displayFailureReason = 'Blocked Nozzle';
        } else if (failureReason === 'damaged_seal') {
          displayFailureReason = 'Damaged Seal';
        } else if (failureReason === 'expired') {
          displayFailureReason = 'Expired';
        } else if (failureReason === 'mounting_issue') {
          displayFailureReason = 'Mounting Issue';
        } else if (failureReason !== 'Not specified') {
          displayFailureReason = failureReason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        doc.text(displayFailureReason, margin + 142, rowStartY);
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
        
        doc.text(displayFailureReason, margin + 135, rowStartY);
        doc.text(displayActionTaken, margin + 158, rowStartY);
      }
    } else {
      if (session.serviceType === 'emergency_exit_light') {
        doc.text('-', margin + 142, rowStartY);
      } else if (session.serviceType === 'fire_testing') {
        doc.text('-', margin + 158, rowStartY);
      } else {
        doc.text('-', margin + 135, rowStartY);
        doc.text('-', margin + 158, rowStartY);
      }
    }

    // Use dynamic row height instead of fixed 6
    yPosition += rowHeight + 2; // Add 2 for spacing between rows
  }

  // Add emergency exit light test criteria details (AS/NZS 2293.2:2019)
  if (session.serviceType === 'emergency_exit_light') {
    yPosition += 10;
    
    // Check if we need a new page
    if (yPosition > doc.internal.pageSize.height - 100) {
      doc.addPage();
      yPosition = await addLetterheadToPage(doc, margin, pageWidth);
    }
    
    // Test criteria section header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Test Criteria Summary (AS 2293.2:2019)', margin, yPosition);
    yPosition += 12;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Group results by item and show test details
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      if (yPosition > doc.internal.pageSize.height - 50) {
        doc.addPage();
        yPosition = await addLetterheadToPage(doc, margin, pageWidth);
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text(`Asset #${result.assetNumber} - ${result.itemName} (${result.location})`, margin, yPosition);
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
      
      // Show lux test if performed (emergency exit light only)
      if ((result as any).luxTest) {
        const luxStatus = (result as any).luxCompliant ? 'PASS' : 'FAIL';
        const luxReading = (result as any).luxReading ? `${(result as any).luxReading} lux` : 'N/A';
        doc.text(`• Lux Level Test (Illumination measurement): ${luxStatus} - Reading: ${luxReading}`, margin + 5, yPosition);
        yPosition += 6;
      }
      
      // Show maintenance type if available
      if (result.maintenanceType) {
        const maintenanceTypeDisplay = result.maintenanceType === 'maintained' ? 'Maintained' : 'Non-Maintained';
        doc.text(`• Maintenance Type: ${maintenanceTypeDisplay}`, margin + 5, yPosition);
        yPosition += 6;
      }
      if (result.globeType) {
        const globeTypeDisplay = result.globeType === 'led' ? 'LED' : 'Halogen';
        doc.text(`• Globe Type: ${globeTypeDisplay}`, margin + 5, yPosition);
        yPosition += 6;
      }
      
      // Show notes if any
      if (result.notes) {
        doc.text(`• Additional Notes: ${result.notes}`, margin + 5, yPosition);
        yPosition += 6;
      }
      
      yPosition += 6; // Space between items
    }
  }

  // Add fire equipment test criteria details (AS 1851 / NZS 4503:2005)
  if (session.serviceType === 'fire_testing') {
    yPosition += 10;
    
    // Check if we need a new page
    if (yPosition > doc.internal.pageSize.height - 100) {
      doc.addPage();
      yPosition = await addLetterheadToPage(doc, margin, pageWidth);
    }
    
    // Test criteria section header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const complianceStandard = session.country === 'newzealand' ? 'NZS 4503:2005' : 'AS 1851'; // Default to AS 1851 for Australia and ARA Compliance
    doc.text(`Test Criteria Summary (${complianceStandard})`, margin, yPosition);
    yPosition += 12;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Group results by item and show test details
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      if (yPosition > doc.internal.pageSize.height - 50) {
        doc.addPage();
        yPosition = await addLetterheadToPage(doc, margin, pageWidth);
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text(`Asset #${result.assetNumber} - ${result.itemName} (${result.location})`, margin, yPosition);
      yPosition += 8;
      
      // Parse test details from notes
      const notes = result.notes || '';
      const equipmentTypeMatch = notes.match(/Equipment Type: ([^|]+)/);
      const visualInspectionMatch = notes.match(/Visual Inspection: ([^|]+)/);
      const operationalTestMatch = notes.match(/Operational Test: ([^|]+)/);
      const pressureTestMatch = notes.match(/Pressure Test: ([^|]+)/);
      const accessibilityMatch = notes.match(/Accessibility Check: ([^|]+)/);
      const signageMatch = notes.match(/Signage Check: ([^|]+)/);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`• Visual Inspection (Physical condition, damage, corrosion): ${visualInspectionMatch?.[1] || 'N/A'}`, margin + 5, yPosition);
      yPosition += 6;
      doc.text(`• Accessibility Check (Clear access, not obstructed): ${accessibilityMatch?.[1] || 'N/A'}`, margin + 5, yPosition);
      yPosition += 6;
      doc.text(`• Signage Check (Proper signage and instructions visible): ${signageMatch?.[1] || 'N/A'}`, margin + 5, yPosition);
      yPosition += 6;
      
      // Equipment-specific tests
      const equipmentType = equipmentTypeMatch?.[1] || result.classification;
      if (equipmentType === 'fire_extinguisher') {
        doc.text(`• Pressure Gauge Check (Pressure within operating range): ${pressureTestMatch?.[1] || 'N/A'}`, margin + 5, yPosition);
        yPosition += 6;
        doc.text(`• Operational Test (Trigger mechanism, hose, nozzle): ${operationalTestMatch?.[1] || 'N/A'}`, margin + 5, yPosition);
        yPosition += 6;
      } else if (equipmentType === 'fire_hose_reel') {
        doc.text(`• Operational Test (Hose reel operation, water flow): ${operationalTestMatch?.[1] || 'N/A'}`, margin + 5, yPosition);
        yPosition += 6;
      } else if (equipmentType === 'fire_blanket') {
        doc.text(`• Operational Test (Easy removal, blanket condition): ${operationalTestMatch?.[1] || 'N/A'}`, margin + 5, yPosition);
        yPosition += 6;
      }
      
      // Show equipment details if available
      const sizeMatch = notes.match(/Net Size: ([^|]+)/);
      const weightMatch = notes.match(/Gross Weight: ([^|]+)/);
      if (sizeMatch?.[1]) {
        doc.text(`• Net Size: ${sizeMatch[1]}`, margin + 5, yPosition);
        yPosition += 6;
      }
      if (weightMatch?.[1]) {
        doc.text(`• Gross Weight: ${weightMatch[1]}`, margin + 5, yPosition);
        yPosition += 6;
      }
      
      // Show notes if any (excluding the parsed fields)
      const remainingNotes = notes.split('|')[0]?.trim(); // Get first part before equipment details
      if (remainingNotes && remainingNotes !== notes) {
        doc.text(`• Additional Notes: ${remainingNotes}`, margin + 5, yPosition);
        yPosition += 6;
      }
      
      yPosition += 6; // Space between items
    }
  }

  // Add footer
  const footerY = doc.internal.pageSize.height - 20;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  const footerText = session.serviceType === 'emergency_exit_light' 
    ? 'This report complies with AS 2293.2:2019 emergency lighting standards.'
    : session.serviceType === 'fire_testing'
    ? `This report complies with ${session.country === 'newzealand' ? 'NZS 4503:2005' : 'AS 1851'} fire equipment standards.` // Default to AS 1851 for Australia and ARA Compliance
    : 'This report complies with AS/NZS 3760 electrical safety standards.';
  doc.text(
    footerText,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  // Add failed items details section
  const failedItemsWithDetails = results.filter(result => 
    result.result === 'fail' && (result.notes || result.photoData)
  );
  
  if (failedItemsWithDetails.length > 0) {
    // Add new page for failed items details
    doc.addPage();
    yPosition = await addLetterheadToPage(doc, margin, pageWidth);
    
    // Failed items section header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Failed Items - Additional Details', margin, yPosition);
    yPosition += 15;
    
    for (const result of failedItemsWithDetails) {
      // Check if we need a new page
      if (yPosition > doc.internal.pageSize.height - 120) {
        doc.addPage();
        yPosition = await addLetterheadToPage(doc, margin, pageWidth);
      }
      
      // Item header
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Asset #${result.assetNumber} - ${result.itemName}`, margin, yPosition);
      yPosition += 7;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Location: ${result.location} | Failure: ${result.failureReason}`, margin, yPosition);
      yPosition += 7;
      
      // Add action taken
      if (result.actionTaken) {
        const actionDisplay = result.actionTaken === 'given' ? 'Given to Site Contact' : 'Removed from Site';
        doc.text(`Action Taken: ${actionDisplay}`, margin, yPosition);
        yPosition += 7;
      }
      
      // Add notes if available with text wrapping
      if (result.notes) {
        doc.text('Comments: ', margin, yPosition);
        const maxCommentWidth = pageWidth - (2 * margin);
        const commentLines = doc.splitTextToSize(result.notes, maxCommentWidth);
        yPosition += 7;
        commentLines.forEach((line: string) => {
          // Check if we need a new page
          if (yPosition > doc.internal.pageSize.height - 30) {
            doc.addPage();
            yPosition = margin + 20;
          }
          doc.text(line, margin, yPosition);
          yPosition += 5;
        });
      }
      
      // Add photo if available
      if (result.photoData) {
        yPosition += 3; // Extra space before photo
        try {
          const imgWidth = 80;
          const imgHeight = 60;
          doc.addImage(result.photoData, 'JPEG', margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 10;
        } catch (error) {
          // If photo can't be added, add placeholder text
          doc.setFontSize(9);
          doc.setTextColor(150, 150, 150);
          doc.text('Photo could not be displayed in PDF', margin, yPosition);
          yPosition += 10;
          doc.setTextColor(0, 0, 0);
        }
      }
      
      yPosition += 10; // Space between items
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
