import * as XLSX from 'xlsx';
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

/**
 * Generates an Excel spreadsheet report with test results and compliance data
 * Creates downloadable .xlsx files with formatted data, calculations, and summaries
 * @param data - Complete session data including test results and summary statistics
 * @returns Blob object containing the Excel file for download
 */
export function generateExcelReport(data: ReportData): Blob {
  const { session, results, summary } = data;
  
  // Create workbook
  const workbook = XLSX.utils.book_new();
  
  // Header information
  const headerData = [
    ['THE LOCAL GUYS - TEST & TAG REPORT'],
    [''],
    ['Client Information'],
    ['Business Name:', session.clientName],
    ['Site Contact:', session.siteContact],
    ['Address:', session.address],
    ['Technician:', session.technicianName],
    ['Test Date:', new Date(session.testDate).toLocaleDateString('en-AU')],

    [''],
    ['Report Summary'],
    ['Total Items:', summary.totalItems],
    ['Passed Items:', summary.passedItems],
    ['Failed Items:', summary.failedItems],
    ['Pass Rate:', `${summary.passRate}%`],
    [''],
    ['Test Results']
  ];
  
  // Test results header
  // Different headers for emergency exit light testing
  const resultsHeader = session.serviceType === 'emergency_exit_light' 
    ? ['Asset #', 'Item Name', 'Location', 'Classification', 'Result', 'Manufacturer', 'Install Date', 'Frequency', 'Next Due Date', 'Failure Reason', 'Notes', 'Visual Inspection', 'Discharge Test', 'Switching Test', 'Charging Test', 'Maintenance Type', 'Globe Type']
    : ['Asset #', 'Item Name', 'Location', 'Classification', 'Result', 'Vision Inspection', 'Electrical Test', 'Frequency', 'Next Due Date', 'Failure Reason', 'Action Taken', 'Notes'];
  
  // Test results data - different structure for emergency exit light testing
  const resultsData = results.map((result, index) => {
    // Format failure reason for display
    let displayFailureReason = result.failureReason || '';
    if (session.serviceType === 'emergency_exit_light') {
      // Emergency exit light failure reasons
      if (displayFailureReason === 'physical_damage') {
        displayFailureReason = 'Physical Damage';
      } else if (displayFailureReason === 'battery_failure') {
        displayFailureReason = 'Battery Failure';
      } else if (displayFailureReason === 'lamp_failure') {
        displayFailureReason = 'Lamp Failure';
      } else if (displayFailureReason === 'insufficient_illumination') {
        displayFailureReason = 'Insufficient Illumination';
      } else if (displayFailureReason && displayFailureReason !== '') {
        displayFailureReason = displayFailureReason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    } else {
      // Standard electrical testing failure reasons
      if (displayFailureReason === 'vision') {
        displayFailureReason = 'Visual Inspection';
      } else if (displayFailureReason && displayFailureReason !== '') {
        displayFailureReason = displayFailureReason.charAt(0).toUpperCase() + displayFailureReason.slice(1);
      }
    }

    if (session.serviceType === 'emergency_exit_light') {
      return [
        result.assetNumber, // Asset number
        result.itemName,
        result.location,
        result.classification.toUpperCase(),
        result.result.toUpperCase(),
        result.manufacturerInfo || 'N/A',
        result.installationDate || 'N/A',
        getFrequencyLabel(result.frequency),
        calculateNextDueDate(session.testDate, result.frequency, result.result),
        displayFailureReason,
        result.notes || '',
        result.visionInspection ? 'PASS' : 'FAIL',
        result.dischargeTest ? 'PASS' : 'FAIL',
        result.switchingTest ? 'PASS' : 'FAIL',
        result.chargingTest ? 'PASS' : 'FAIL',
        result.maintenanceType ? (result.maintenanceType === 'maintained' ? 'Maintained' : 'Non-Maintained') : 'N/A',
        result.globeType ? (result.globeType === 'led' ? 'LED' : 'Halogen') : 'N/A'
      ];
    } else {
      // Format action taken for display
      let displayActionTaken = result.actionTaken || '';
      if (displayActionTaken === 'given') {
        displayActionTaken = 'Given to Site Contact';
      } else if (displayActionTaken === 'removed') {
        displayActionTaken = 'Removed from Site';
      } else if (displayActionTaken && displayActionTaken !== '') {
        displayActionTaken = displayActionTaken.charAt(0).toUpperCase() + displayActionTaken.slice(1);
      }

      return [
        result.assetNumber, // Asset number
        result.itemName,
        result.location,
        result.classification.toUpperCase(),
        result.result.toUpperCase(),
        result.visionInspection ? 'Yes' : 'No',
        result.electricalTest ? 'Yes' : 'No',
        getFrequencyLabel(result.frequency),
        calculateNextDueDate(session.testDate, result.frequency, result.result),
        displayFailureReason,
        displayActionTaken,
        result.notes || ''
      ];
    }
  });
  
  // Combine all data
  const worksheetData = [
    ...headerData,
    resultsHeader,
    ...resultsData,
    [''],
    ['Report Generated:', new Date().toLocaleDateString()],
    ['Compliance:', session.serviceType === 'emergency_exit_light' 
      ? 'This report complies with AS 2293.2:2019 emergency lighting standards.'
      : (session.country === 'australia' 
        ? 'This report complies with AS/NZS 3760 electrical safety standards.'
        : 'This report complies with NZS 5262 electrical safety standards.')]
  ];
  
  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  
  // Set column widths
  const columnWidths = [
    { wch: 8 },  // Asset #
    { wch: 20 }, // Item Name
    { wch: 15 }, // Location
    { wch: 12 }, // Classification
    { wch: 8 },  // Result
    { wch: 12 }, // Frequency
    { wch: 12 }, // Next Due Date
    { wch: 15 }, // Failure Reason
    { wch: 12 }, // Action Taken
    { wch: 20 }  // Notes
  ];
  worksheet['!cols'] = columnWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Test Report');
  
  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadExcel(data: ReportData, filename?: string) {
  const blob = generateExcelReport(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `test-report-${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}