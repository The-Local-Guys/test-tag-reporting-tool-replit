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

function formatAssetNumberWithFrequency(
  assetNumber: string, 
  frequency: string, 
  serviceType?: string,
  allResults?: Array<{ assetNumber: string }>
): string {
  // Only apply formatting for Electrical Test & Tag
  if (serviceType !== 'electrical') {
    return assetNumber;
  }
  
  // Check if there are multiple items with the same asset number
  const hasDuplicates = allResults && allResults.filter(r => r.assetNumber === assetNumber).length > 1;
  
  // If no duplicates, return just the asset number
  if (!hasDuplicates) {
    return assetNumber;
  }
  
  const frequencyMap: Record<string, string> = {
    'monthly': '1M',
    'threemonthly': '3M',
    'sixmonthly': '6M',
    'twelvemonthly': '12M',
    'twentyfourmonthly': '24M',
    'fiveyearly': '5Y',
  };
  
  const frequencyCode = frequencyMap[frequency] || frequency;
  return `${assetNumber} - ${frequencyCode}`;
}

function generateReflectionsExcelReport(data: ReportData): Blob {
  const { session } = data;

  const results = [...data.results].sort((a, b) => {
    return (parseInt(a.assetNumber) || 0) - (parseInt(b.assetNumber) || 0);
  });

  const workbook = XLSX.utils.book_new();
  const testDateFormatted = new Date(session.testDate).toLocaleDateString('en-AU');

  // Header section (rows 1-7) matching the Reflections template exactly
  const wsData: any[][] = [
    ['Site Name', session.clientName],                     // Row 1
    ['Technician Name', session.technicianName],           // Row 2
    ['Business Name', ''],                                 // Row 3 (A3:B3 merged label)
    ['ABN', ''],                                           // Row 4
    ['Mobile Number', ''],                                 // Row 5
    ['Email', ''],                                         // Row 6 (A6:B6 merged label)
    [],                                                    // Row 7 empty separator
    // Row 8: column headers
    ['Item Count', 'Tag Number', 'Item (Description)', 'Location', 'Frequency',
     'Visual Test', 'Electrical Test', 'Result', 'Test Date', 'Next Test Due',
     'If Failed, Reported to Site?'],
  ];

  // Data rows starting at row 9
  results.forEach((result, index) => {
    let actionDisplay = '';
    if (result.result === 'fail' && result.actionTaken) {
      if (result.actionTaken === 'given') actionDisplay = 'Given to Site Contact';
      else if (result.actionTaken === 'removed') actionDisplay = 'Removed from Site';
      else actionDisplay = result.actionTaken.charAt(0).toUpperCase() + result.actionTaken.slice(1);
    }

    wsData.push([
      index + 1,
      result.assetNumber,
      result.itemName,
      result.location,
      getFrequencyLabel(result.frequency),
      result.visionInspection ? 'PASS' : 'FAIL',
      result.electricalTest ? 'PASS' : 'FAIL',
      result.result.toUpperCase(),
      testDateFormatted,
      calculateNextDueDate(session.testDate, result.frequency, result.result),
      actionDisplay,
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Replicate template merges: A3:B3 (Business Name label) and A6:B6 (Email label)
  worksheet['!merges'] = [
    { s: { c: 0, r: 2 }, e: { c: 1, r: 2 } },
    { s: { c: 0, r: 5 }, e: { c: 1, r: 5 } },
  ];

  worksheet['!cols'] = [
    { wch: 12 }, // A: Item Count
    { wch: 14 }, // B: Tag Number
    { wch: 28 }, // C: Item (Description)
    { wch: 20 }, // D: Location
    { wch: 12 }, // E: Frequency
    { wch: 12 }, // F: Visual Test
    { wch: 14 }, // G: Electrical Test
    { wch: 10 }, // H: Result
    { wch: 12 }, // I: Test Date
    { wch: 14 }, // J: Next Test Due
    { wch: 28 }, // K: If Failed, Reported to Site?
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Test & Tag Template');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function generateReflectionsRCDExcelReport(data: ReportData): Blob {
  const { session } = data;

  const results = [...data.results].sort((a, b) => {
    return (parseInt(a.assetNumber) || 0) - (parseInt(b.assetNumber) || 0);
  });

  const workbook = XLSX.utils.book_new();
  const testDateFormatted = new Date(session.testDate).toLocaleDateString('en-AU');

  const toTestCell = (value: boolean | null | undefined) =>
    value == null ? 'N/A' : value ? 'PASS' : 'FAIL';

  // Header section (rows 1-7) matching the RCD Template exactly
  const wsData: any[][] = [
    ['Site Name', session.clientName],
    ['Technician Name', session.technicianName],
    ['Business Name', ''],
    ['ABN', ''],
    ['Mobile Number', ''],
    ['Email', ''],
    [],
    // Row 8: column headers
    ['Circuit No./RCD No.', 'Item Count', 'Tag Number', 'Location',
     'Push Test', 'Timed Test', 'Trip Test Time', 'Test Date',
     'Next Test Due', 'Result', 'Comments', 'If Failed, Reported to Site?'],
  ];

  results.forEach((result, index) => {
    // Circuit No./RCD No. from CB/DB fields — circuit breaker first, then distribution board
    const dbNum = (result as any).distributionBoardNumber || '';
    const cbNum = (result as any).circuitBreakerNumber || '';
    let circuitDisplay = '';
    if (cbNum && dbNum) circuitDisplay = `${cbNum} / ${dbNum}`;
    else if (cbNum) circuitDisplay = cbNum;
    else if (dbNum) circuitDisplay = `- / ${dbNum}`;

    // Trip times with fallback to notes field
    let validTripTimes: number[] = [];
    const tripTimesArray = (result as any).tripTimes;
    if (Array.isArray(tripTimesArray) && tripTimesArray.length > 0) {
      validTripTimes = tripTimesArray.map((t: any) => Number(t)).filter((t: number) => isFinite(t) && t > 0);
    }
    if (validTripTimes.length === 0) {
      const match = (result.notes || '').match(/\[TRIP_TIMES:\[([^\]]*)\]\]/);
      if (match?.[1]) {
        validTripTimes = match[1].split(',').map((t: string) => Number(t.trim())).filter((t: number) => isFinite(t) && t > 0);
      }
    }
    const tripTimeDisplay = validTripTimes.length > 0 ? validTripTimes.join(', ') : '-';

    // Comments: strip internal [TRIP_TIMES:...] marker
    const comments = (result.notes || '').replace(/\[TRIP_TIMES:\[[^\]]*\]\]/g, '').trim();

    // Action taken for "If Failed" column
    let actionDisplay = '';
    if (result.actionTaken) {
      actionDisplay = result.actionTaken.split(', ').map((action: string) => {
        if (action === 'notified') return 'Site Contact Notified';
        if (action === 'off_position') return 'RCD left in off position';
        if (action === 'given') return 'Given to Site Contact';
        if (action === 'removed') return 'Removed from Site';
        return action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      }).join(', ');
    }

    wsData.push([
      circuitDisplay,
      index + 1,
      result.assetNumber,
      result.location,
      toTestCell((result as any).pushButtonTest),
      toTestCell((result as any).injectionTimedTest),
      tripTimeDisplay,
      testDateFormatted,
      calculateNextDueDate(session.testDate, result.frequency || 'twelvemonthly', result.result),
      result.result.toUpperCase(),
      comments,
      actionDisplay,
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  worksheet['!merges'] = [
    { s: { c: 0, r: 2 }, e: { c: 1, r: 2 } },
    { s: { c: 0, r: 5 }, e: { c: 1, r: 5 } },
  ];

  worksheet['!cols'] = [
    { wch: 20 }, // A: Circuit No./RCD No.
    { wch: 12 }, // B: Item Count
    { wch: 14 }, // C: Tag Number
    { wch: 20 }, // D: Location
    { wch: 12 }, // E: Push Test
    { wch: 12 }, // F: Timed Test
    { wch: 16 }, // G: Trip Test Time
    { wch: 12 }, // H: Test Date
    { wch: 14 }, // I: Next Test Due
    { wch: 10 }, // J: Result
    { wch: 25 }, // K: Comments
    { wch: 28 }, // L: If Failed, Reported to Site?
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'RCD Template');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Generates an Excel spreadsheet report with test results and compliance data
 * Creates downloadable .xlsx files with formatted data, calculations, and summaries
 * @param data - Complete session data including test results and summary statistics
 * @returns Blob object containing the Excel file for download
 */
export function generateExcelReport(data: ReportData): Blob {
  // Reflections electrical sessions use a dedicated template format
  if (data.session.country === 'reflections' && data.session.serviceType === 'electrical') {
    return generateReflectionsExcelReport(data);
  }
  // Reflections RCD sessions use the RCD Template format
  if (data.session.country === 'reflections' && data.session.serviceType === 'rcd_reporting') {
    return generateReflectionsRCDExcelReport(data);
  }

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
    : session.serviceType === 'rcd_reporting'
    ? ['Asset #', 'Equipment Type', 'DB / CB', 'Push Button Test', 'Timed Test', 'Trip Time (ms)', 'Result', 'Location', 'Comments', 'Failure Reason', 'Action Taken']
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
      
      // For fire extinguishers, show the specific extinguisher type (Dry Powder, CO2, etc.)
      // For other equipment, show the equipment type (Fire Hose Reel, Fire Blanket, etc.)
      let displayType = 'N/A';
      if (result.equipmentType === 'fire_extinguisher' && (result as any).extinguisherType) {
        displayType = ((result as any).extinguisherType as string).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      } else if (result.equipmentType) {
        displayType = result.equipmentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
      
      return [
        result.assetNumber, // Asset number
        result.itemName,
        result.location,
        displayType,
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
    } else if (session.serviceType === 'rcd_reporting') {
      // RCD reporting specific format
      const equipmentTypeDisplay = (result.classification === 'fixed-rcd' || (!result.classification && result.itemName?.includes('Fixed'))) ? 'Fixed RCD' : 'Portable RCD';
      const toTestCell = (value: boolean | null | undefined) => value == null ? 'N/A' : (value ? 'Yes' : 'No');
      // Extract trip times from the trip_times NUMERIC[] array column
      let validTripTimes: number[] = [];
      const tripTimesArray = (result as any).tripTimes;

      if (Array.isArray(tripTimesArray) && tripTimesArray.length > 0) {
        validTripTimes = tripTimesArray.map((t: any) => Number(t)).filter((t: number) => isFinite(t) && t > 0);
      }

      // Fallback: legacy notes embedding for records predating the trip_times column
      if (validTripTimes.length === 0) {
        const notesValue = result.notes || '';
        const tripTimesMatch = notesValue.match(/\[TRIP_TIMES:\[([^\]]*)\]\]/);
        if (tripTimesMatch && tripTimesMatch[1]) {
          validTripTimes = tripTimesMatch[1].split(',').map((t: string) => Number(t.trim())).filter((t: number) => isFinite(t) && t > 0);
        }
      }

      // Fallback: legacy single trip_time scalar column
      if (validTripTimes.length === 0) {
        const singleTripTime = (result as any).trip_time || (result as any).tripTime;
        if (singleTripTime != null && Number(singleTripTime) > 0) {
          validTripTimes = [Number(singleTripTime)];
        }
      }

      const tripTimeDisplay = validTripTimes.length > 0 ? validTripTimes.join(', ') : '-';

      // DB / CB column
      const dbNum = (result as any).distributionBoardNumber || (result as any).distribution_board_number || '';
      const cbNum = (result as any).circuitBreakerNumber || (result as any).circuit_breaker_number || '';
      let dbCbDisplay = '';
      if (dbNum && cbNum) {
        dbCbDisplay = `${dbNum} / ${cbNum}`;
      } else if (dbNum) {
        dbCbDisplay = dbNum;
      } else if (cbNum) {
        dbCbDisplay = `- / ${cbNum}`;
      }

      // Format action taken
      let rcdActionTaken = result.actionTaken || '';
      if (rcdActionTaken) {
        rcdActionTaken = rcdActionTaken.split(', ').map(action => {
          if (action === 'notified') return 'Site Contact Notified';
          if (action === 'off_position') return 'RCD left in off position';
          if (action === 'given') return 'Given to Site Contact';
          if (action === 'removed') return 'Removed from Site';
          return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }).join(', ');
      }

      return [
        result.assetNumber,
        equipmentTypeDisplay,
        dbCbDisplay,
        toTestCell((result as any).pushButtonTest),
        toTestCell((result as any).injectionTimedTest),
        tripTimeDisplay,
        result.result.toUpperCase(),
        result.location,
        result.notes || '',
        displayFailureReason,
        rcdActionTaken
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
        formatAssetNumberWithFrequency(result.assetNumber, result.frequency, session.serviceType, results), // Asset number with frequency
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
      ? `This report complies with ${session.country === 'newzealand' ? 'NZS 4503:2005' : 'AS 1851'} fire equipment standards.` // Default to AS 1851 for Australia and ARA Compliance
      : session.serviceType === 'rcd_reporting'
      ? 'This report complies with AS/NZS 3760 RCD testing standards.'
      : (session.country === 'newzealand' 
        ? 'This report complies with NZS 5262 electrical safety standards.'
        : 'This report complies with AS/NZS 3760 electrical safety standards.')] // Default to AS/NZS 3760 for Australia and ARA Compliance
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
  } else if (session.serviceType === 'rcd_reporting') {
    // RCD reporting
    columnWidths = [
      { wch: 10 }, // Asset #
      { wch: 15 }, // Equipment Type
      { wch: 15 }, // DB / CB
      { wch: 15 }, // Push Button Test
      { wch: 15 }, // Timed Test
      { wch: 12 }, // Trip Time (ms)
      { wch: 8 },  // Result
      { wch: 15 }, // Location
      { wch: 20 }, // Comments
      { wch: 18 }, // Failure Reason
      { wch: 18 }  // Action Taken
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