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
    case 'annually':
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
    case 'annually': return 'Annually';
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
  const { session, summary } = data;
  
  // Sort results by asset number: monthly frequencies first (1, 2, 3...) then 5-yearly (10001, 10002, 10003...)
  const results = [...data.results].sort((a, b) => {
    const aAssetNum = parseInt(a.assetNumber) || 0;
    const bAssetNum = parseInt(b.assetNumber) || 0;
    return aAssetNum - bAssetNum;
  });
  
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
  
  // Test results header - different headers for each service type
  const resultsHeader = session.serviceType === 'emergency_exit_light' 
    ? ['Asset #', 'Item Name', 'Location', 'Result', 'Manufacturer', 'Install Date', 'Frequency', 'Next Due Date', 'Failure Reason', 'Notes', 'Visual Inspection', 'Discharge Test', 'Switching Test', 'Charging Test', 'Maintenance Type', 'Globe Type']
    : session.serviceType === 'fire_testing'
    ? ['Asset #', 'Item Name', 'Location', 'Type', 'Result', 'Size/Weight', 'Manufacturer', 'Frequency', 'Next Due Date', 'Failure Reason', 'Notes', 'Visual Inspection', 'Accessibility', 'Signage', 'Operational Test', 'Pressure Test']
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
    } else if (session.serviceType === 'fire_testing') {
      // Fire equipment failure reasons
      if (displayFailureReason === 'physical_damage') {
        displayFailureReason = 'Physical Damage';
      } else if (displayFailureReason === 'pressure_loss') {
        displayFailureReason = 'Pressure Loss';
      } else if (displayFailureReason === 'corrosion') {
        displayFailureReason = 'Corrosion';
      } else if (displayFailureReason === 'blocked_nozzle') {
        displayFailureReason = 'Blocked Nozzle';
      } else if (displayFailureReason === 'damaged_seal') {
        displayFailureReason = 'Damaged Seal';
      } else if (displayFailureReason === 'expired') {
        displayFailureReason = 'Expired';
      } else if (displayFailureReason === 'mounting_issue') {
        displayFailureReason = 'Mounting Issue';
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
    } else if (session.serviceType === 'fire_testing') {
      // Use structured fire equipment fields instead of notes parsing
      const sizeWeight = [result.size, result.weight].filter(Boolean).join(' / ') || 'N/A';
      
      // Helper function to render fire test results with proper null handling
      const toTestCell = (value: boolean | null | undefined) => value == null ? 'N/A' : (value ? 'PASS' : 'FAIL');
      
      // Pressure test is only applicable for fire extinguishers
      const pressureTestResult = result.equipmentType !== 'fire_extinguisher' 
        ? 'N/A' 
        : toTestCell((result as any).pressureTest);
      
      return [
        result.assetNumber, // Asset number
        result.itemName,
        result.location,
        result.equipmentType ? result.equipmentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A',
        result.result.toUpperCase(),
        sizeWeight,
        result.manufacturerInfo || 'N/A',
        getFrequencyLabel(result.frequency),
        calculateNextDueDate(session.testDate, result.frequency, result.result),
        displayFailureReason,
        result.notes || '',
        toTestCell((result as any).fireVisualInspection),
        toTestCell((result as any).accessibilityCheck),
        toTestCell((result as any).signageCheck),
        toTestCell((result as any).operationalTest),
        pressureTestResult
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
      : session.serviceType === 'fire_testing'
      ? `This report complies with ${session.country === 'newzealand' ? 'NZS 4503:2005' : 'AS 1851'} fire equipment standards.`
      : (session.country === 'australia' 
        ? 'This report complies with AS/NZS 3760 electrical safety standards.'
        : 'This report complies with NZS 5262 electrical safety standards.')]
  ];
  
  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  
  // Set column widths dynamically based on service type
  let columnWidths;
  if (session.serviceType === 'emergency_exit_light') {
    columnWidths = [
      { wch: 8 },  // Asset #
      { wch: 20 }, // Item Name
      { wch: 15 }, // Location
      { wch: 12 }, // Classification
      { wch: 8 },  // Result
      { wch: 12 }, // Manufacturer
      { wch: 12 }, // Install Date
      { wch: 10 }, // Frequency
      { wch: 12 }, // Next Due Date
      { wch: 15 }, // Failure Reason
      { wch: 20 }, // Notes
      { wch: 12 }, // Visual Inspection
      { wch: 12 }, // Discharge Test
      { wch: 12 }, // Switching Test
      { wch: 12 }, // Charging Test
      { wch: 12 }, // Maintenance Type
      { wch: 10 }  // Globe Type
    ];
  } else if (session.serviceType === 'fire_testing') {
    columnWidths = [
      { wch: 8 },  // Asset #
      { wch: 20 }, // Item Name
      { wch: 15 }, // Location
      { wch: 15 }, // Type
      { wch: 8 },  // Result
      { wch: 12 }, // Size/Weight
      { wch: 12 }, // Manufacturer
      { wch: 10 }, // Frequency
      { wch: 12 }, // Next Due Date
      { wch: 15 }, // Failure Reason
      { wch: 20 }, // Notes
      { wch: 12 }, // Visual Inspection
      { wch: 12 }, // Accessibility
      { wch: 10 }, // Signage
      { wch: 12 }, // Operational Test
      { wch: 12 }  // Pressure Test
    ];
  } else {
    // Electrical testing
    columnWidths = [
      { wch: 8 },  // Asset #
      { wch: 20 }, // Item Name
      { wch: 15 }, // Location
      { wch: 12 }, // Classification
      { wch: 8 },  // Result
      { wch: 12 }, // Vision Inspection
      { wch: 12 }, // Electrical Test
      { wch: 10 }, // Frequency
      { wch: 12 }, // Next Due Date
      { wch: 15 }, // Failure Reason
      { wch: 12 }, // Action Taken
      { wch: 20 }  // Notes
    ];
  }
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