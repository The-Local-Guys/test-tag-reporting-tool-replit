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
    return date.toLocaleDateString();
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
    ['Test Date:', new Date(session.testDate).toLocaleDateString()],

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
  const resultsHeader = [
    'Asset #', 'Item Name', 'Location', 'Classification', 'Result', 'Frequency', 'Next Due Date', 'Failure Reason', 'Action Taken', 'Notes'
  ];
  
  // Test results data
  const resultsData = results.map((result, index) => [
    index + 1, // Asset number
    result.itemName,
    result.location,
    result.classification.toUpperCase(),
    result.result.toUpperCase(),
    getFrequencyLabel(result.frequency),
    calculateNextDueDate(session.testDate, result.frequency, result.result),
    result.failureReason || '',
    result.actionTaken || '',
    result.notes || ''
  ]);
  
  // Combine all data
  const worksheetData = [
    ...headerData,
    resultsHeader,
    ...resultsData,
    [''],
    ['Report Generated:', new Date().toLocaleDateString()],
    ['Compliance:', session.country === 'australia' 
      ? 'This report complies with AS/NZS 3760 electrical safety standards.'
      : 'This report complies with NZS 5262 electrical safety standards.']
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