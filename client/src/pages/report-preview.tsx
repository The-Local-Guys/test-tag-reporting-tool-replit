import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { TestResultEditModal } from '@/components/test-result-edit-modal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Download, Mail, Share, Plus, Edit2, FileText, Trash2, Check, CheckCircle } from 'lucide-react';
import { WorkflowProgressBar, type ServiceType } from '@/components/workflow-progress-bar';
import { SaveStatusIndicator } from '@/components/save-status-indicator';
import { useSession, type BatchedTestResult } from '@/hooks/use-session';
import { useLocation } from 'wouter';
import { downloadPDF } from '@/lib/pdf-generator';
import { downloadExcel } from '@/lib/excel-generator';
import { resolveRcdTripTimes } from '@/lib/rcd-trip-times';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertTestResultSchema, type TestResult, type InsertTestResult, failureReasons, emergencyFailureReasons, fireFailureReasons, rcdFailureReasons } from '@shared/schema';
import { cn } from '@/lib/utils';
import { useConditionalNav } from '@/contexts/ConditionalNavContext';
import { useQuery } from '@tanstack/react-query';

/**
 * Helper function to format asset number with frequency for Electrical Test & Tag
 * Only shows frequency code if multiple items share the same asset number
 * @param assetNumber - The asset number
 * @param frequency - The test frequency
 * @param serviceType - The service type
 * @param allResults - All test results to check for duplicate asset numbers
 * @returns Formatted asset number (e.g., "2 - 6M" if duplicates exist, otherwise just "2")
 */
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

/**
 * Report preview and generation interface
 * Displays test session summary and provides PDF/Excel export functionality
 * Shows pass/fail statistics and enables report customization options
 */
export default function ReportPreview() {
  const { sessionData, batchedResults, submitBatch, isSubmittingBatch, updateBatchedResult, removeBatchedResult, clearSession, assetProgress, renumberAssets, sessionId, customStartingNumbers } = useSession();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [editingResult, setEditingResult] = useState<TestResult | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deletingResult, setDeletingResult] = useState<TestResult | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showPDFSuccess, setShowPDFSuccess] = useState(false);
  const [isFinishingReport, setIsFinishingReport] = useState(false);
  const [showFinishSuccess, setShowFinishSuccess] = useState(false);
  
  
  const { navigate, showConfirm, confirmNavigation, cancelNavigation } = useConditionalNav();

  // Fetch custom form types
  const { data: customFormTypes } = useQuery<any[]>({
    queryKey: ['/api/custom-forms'],
  });


  // Edit form state with manual asset number tracking
  const [editResultData, setEditResultData] = useState({
    itemName: "",
    itemType: "",
    location: "",
    assetNumber: "",
    classification: "class1" as any,
    result: "pass" as any,
    frequency: "twelvemonthly" as any,
    failureReason: null as any,
    actionTaken: null as any,
    notes: null as any,
    // Service-specific boolean criteria fields
    visionInspection: true as boolean,
    electricalTest: true as boolean,
    dischargeTest: false as boolean,
    switchingTest: false as boolean,
    chargingTest: false as boolean,
    // Emergency Exit Light specific fields
    luxTest: false as boolean,
    luxReading: null as number | null,
    luxCompliant: false as boolean,
    manufacturerInfo: null as string | null,
    installationDate: null as string | null,
    maintenanceType: null as string | null,
    globeType: null as string | null,
    // Fire Testing specific fields
    pressureTest: false as boolean,
    accessibilityCheck: false as boolean,
    signageCheck: false as boolean,
    operationalTest: false as boolean,
    extinguisherType: null as string | null,
    size: null as string | null,
    weight: null as string | null,
    // Microwave Leakage specific fields
    leakageReading: null as string | null,
    // RCD-specific fields
    pushButtonTest: null as boolean | null,
    injectionTimedTest: null as boolean | null,
    tripTimes: [] as number[],
    distributionBoardNumber: null as string | null,
    circuitBreakerNumber: null as string | null,
  });
  const [assetNumberError, setAssetNumberError] = useState<string>("");
  
  // Track manually entered asset numbers to prevent auto-generation conflicts
  const [manuallyEnteredAssetNumbers, setManuallyEnteredAssetNumbers] = useState<Set<string>>(new Set());

  // Helper function to get appropriate failure reasons based on service type
  const getFailureReasons = () => {
    const serviceType = sessionData?.session?.serviceType;
    switch (serviceType) {
      case 'emergency_exit_light':
        return emergencyFailureReasons;
      case 'fire_testing':
        return fireFailureReasons;
      case 'rcd_reporting':
        return rcdFailureReasons;
      default:
        return failureReasons; // electrical testing
    }
  };

  // Helper function to get country display name
  const getCountryDisplayName = (country: string | undefined) => {
    if (!country) return 'Unknown';
    if (country === 'australia') return 'Australia';
    if (country === 'newzealand') return 'New Zealand';
    if (country === 'national_client') return 'ARA Compliance';
    
    // Check if it's a custom form type (format: "custom_123")
    if (country.startsWith('custom_')) {
      const formId = parseInt(country.replace('custom_', ''));
      const formType = customFormTypes?.find(f => f.id === formId);
      return formType?.name || country;
    }
    
    return country;
  };

  // Helper function to convert snake_case to display labels
  const getFailureReasonLabel = (reason: string) => {
    const labelMap: { [key: string]: string } = {
      // Electrical testing reasons
      'vision': 'Vision',
      'earth': 'Earth',
      'insulation': 'Insulation',
      'polarity': 'Polarity',
      // Emergency exit light reasons
      'physical_damage': 'Physical Damage',
      'battery_failure': 'Battery Failure',
      'lamp_failure': 'Lamp/LED Failure',
      'wiring_fault': 'Wiring Fault',
      'charging_fault': 'Charging Fault',
      'insufficient_illumination': 'Insufficient Illumination',
      'mounting_issue': 'Mounting Issue',
      // Fire testing reasons
      'pressure_loss': 'Pressure Loss',
      'corrosion': 'Corrosion',
      'blocked_nozzle': 'Blocked Nozzle',
      'damaged_seal': 'Damaged Seal',
      'expired': 'Expired',
      // RCD testing reasons
      'push_button': 'Push Button Test Failed',
      'injection_timed': 'Injection/Timed Test Failed',
      'tripping_time': 'Incorrect Tripping Time',
      'no_trip': 'Failed to Trip',
      'visual': 'Visual Damage/Defect',
      // Common
      'other': 'Other'
    };
    return labelMap[reason] || reason;
  };



  if (!sessionData) {
    return (
      <div className="mobile-container flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-gray-500">Loading report...</div>
        </div>
      </div>
    );
  }

  const { session, summary } = sessionData;
  const isReflections = session?.country === 'reflections';

  /**
   * Helper function to find the next available asset number within a range
   * @param usedNumbers - Set of asset numbers already in use
   * @param start - Starting number for the range (1 for monthly, 10001 for 5-yearly)
   * @returns Next available asset number in the specified range
   */
  const getNextAvailableAssetNumber = (usedNumbers: Set<number>, start: number): number => {
    let candidate = start;
    
    // Keep incrementing until we find an unused number
    while (usedNumbers.has(candidate)) {
      candidate++;
    }
    
    return candidate;
  };

  /**
   * Validate asset number for duplicates and basic validity
   * Range validation removed since auto-generation handles correct ranges
   */
  const validateAssetNumber = (assetNumber: string, frequency: string): string => {
    if (!assetNumber.trim()) {
      return "Asset number is required";
    }

    const assetNum = parseInt(assetNumber);
    if (isNaN(assetNum) || assetNum <= 0) {
      return "Asset number must be a positive number";
    }

    // Check for duplicates in batched results (excluding the one being edited)
    const editingResultId = editingResult ? (editingResult as any).originalBatchedId : null;
    const isDuplicate = batchedResults.some((result: BatchedTestResult) =>
      result.assetNumber === assetNumber && result.id !== editingResultId
    );

    if (isDuplicate) {
      return `Asset number ${assetNumber} is already in use`;
    }

    return "";
  };

  /**
   * Generate unique asset number for auto-assignment
   * Takes into account both existing results and manually entered numbers
   * Uses proper frequency ranges based on service type and custom starting numbers
   */
  const generateUniqueAssetNumber = (editingResultId: string, newFrequency: string): string => {
    // Get service type to determine correct starting ranges
    const serviceType = sessionData?.session?.serviceType || 'electrical';
    const isElectrical = serviceType === 'electrical';

    // Define starting numbers based on service type and frequency
    const getStartingNumber = (freq: string): number => {
      // For electrical services, check if custom starting numbers are set
      if (isElectrical && customStartingNumbers && Object.keys(customStartingNumbers).length > 0) {
        const customNumber = customStartingNumbers[freq as keyof typeof customStartingNumbers];
        if (customNumber !== undefined) {
          console.log(`Using custom starting number for ${freq}: ${customNumber}`);
          return customNumber;
        }
      }

      // Fall back to default ranges
      if (isElectrical) {
        // Electrical service type default ranges
        const ranges: Record<string, number> = {
          'twelvemonthly': 1,
          'sixmonthly': 10001,
          'fiveyearly': 20001,
          'twentyfourmonthly': 30001,
          'threemonthly': 40001,
          'monthly': 50001,
        };
        return ranges[freq] || 1;
      } else {
        // Other service types (Emergency, Fire, RCD)
        const ranges: Record<string, number> = {
          'sixmonthly': 1,
          'twelvemonthly': 10001,
          'fiveyearly': 20001,
          'twentyfourmonthly': 30001,
          'threemonthly': 40001,
          'monthly': 50001,
        };
        return ranges[freq] || 1;
      }
    };

    // Get starting number for the new frequency
    const startNumber = getStartingNumber(newFrequency);

    // Guard against missing results
    if (!batchedResults.length && manuallyEnteredAssetNumbers.size === 0) {
      console.log(`generateUniqueAssetNumber: No existing results, returning start number ${startNumber} for ${newFrequency}`);
      return startNumber.toString();
    }

    // Get all existing asset numbers, excluding the one being changed
    const usedNumbers = new Set<number>();

    // Add numbers from batched results
    batchedResults.forEach((result: BatchedTestResult) => {
      // Skip the result being changed, as it will get a new number
      if (result.id === editingResultId) {
        return;
      }

      // Parse asset number and add to used set if valid
      const assetNum = parseInt(result.assetNumber || '');
      if (!isNaN(assetNum) && assetNum > 0) {
        usedNumbers.add(assetNum);
      }
    });

    // Add manually entered asset numbers to prevent conflicts
    Array.from(manuallyEnteredAssetNumbers).forEach(manualNumber => {
      const assetNum = parseInt(manualNumber);
      if (!isNaN(assetNum) && assetNum > 0) {
        usedNumbers.add(assetNum);
      }
    });

    // Find next available asset number for the new frequency range
    const nextAvailable = getNextAvailableAssetNumber(usedNumbers, startNumber);

    console.log(`generateUniqueAssetNumber: Generated ${nextAvailable} for ${newFrequency} (start: ${startNumber})`);
    return nextAvailable.toString();
  };

  // Sort batched results by frequency type and asset number
  const sortResultsByAssetNumber = (results: BatchedTestResult[]): BatchedTestResult[] => {
    return [...results].sort((a, b) => {
      const aAssetNum = parseInt(a.assetNumber || '0');
      const bAssetNum = parseInt(b.assetNumber || '0');

      // Monthly frequencies (1-9999) come first, then 5-yearly (10000+)
      const aIsMonthly = aAssetNum < 10000;
      const bIsMonthly = bAssetNum < 10000;

      if (aIsMonthly && !bIsMonthly) return -1; // Monthly before 5-yearly
      if (!aIsMonthly && bIsMonthly) return 1;  // 5-yearly after monthly

      // Within same category, sort by asset number (ascending)
      return aAssetNum - bAssetNum;
    });
  };

  // Use sorted batched results
  const results = sortResultsByAssetNumber(batchedResults);

  const handleExportPDF = async () => {
    setIsGeneratingPDF(true);
    setShowPDFSuccess(false);
    
    try {
      // Convert batched results to TestResult format for PDF generation
      const convertedResults = results.map((result) => ({
        id: parseInt(result.id.replace('temp_', '')),
        sessionId: sessionData?.session?.id || 0,
        assetNumber: result.assetNumber || '1', // Use stored asset numbers
        itemName: result.itemName,
        itemType: result.itemType,
        location: result.location,
        classification: result.classification,
        result: result.result,
        frequency: result.frequency,
        failureReason: result.failureReason || null,
        actionTaken: result.actionTaken || null,
        notes: result.notes || null,
        photoData: result.photoData || null,
        visionInspection: result.visionInspection,
        electricalTest: result.electricalTest,
        createdAt: new Date(result.timestamp),
        maintenanceType: result.maintenanceType || null,
        dischargeTest: result.dischargeTest || false,
        switchingTest: result.switchingTest || false,
        chargingTest: result.chargingTest || false,
        luxTest: result.luxTest || false,
        luxReading: result.luxReading || null,
        luxCompliant: result.luxCompliant || false,
        manufacturerInfo: result.manufacturerInfo || null,
        installationDate: result.installationDate || null,
        globeType: result.globeType || null,
        // RCD testing specific fields
        pushButtonTest: result.pushButtonTest || false,
        injectionTimedTest: result.injectionTimedTest || false,
        tripTimes: resolveRcdTripTimes(result),
        distributionBoardNumber: (result as any).distributionBoardNumber || null,
        circuitBreakerNumber: (result as any).circuitBreakerNumber || null,
        // Microwave leakage testing specific fields
        leakageReading: (result as any).leakageReading || null,
        // Fire testing specific fields
        pressureTest: (result as any).pressureTest ?? false,
        accessibilityCheck: (result as any).accessibilityCheck ?? false,
        signageCheck: (result as any).signageCheck ?? false,
        operationalTest: (result as any).operationalTest ?? false,
        extinguisherType: (result as any).extinguisherType || null,
        size: (result as any).size || null,
        weight: (result as any).weight || null,
      } as any));

      if (!sessionData?.session) {
        throw new Error('Session data is not available');
      }

      const previewData = {
        ...sessionData,
        session: sessionData.session,
        results: convertedResults,
      };

      await downloadPDF(previewData, `test-report-${sessionData.session.clientName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      
      // Show success animation
      setShowPDFSuccess(true);
      
      // Hide loading screen after animation
      setTimeout(() => {
        setIsGeneratingPDF(false);
        setShowPDFSuccess(false);
        toast({
          title: "PDF Generated",
          description: "Your test report has been downloaded successfully.",
        });
      }, 1500);
      
    } catch (error) {
      setIsGeneratingPDF(false);
      setShowPDFSuccess(false);
      toast({
        title: "Export Failed",
        description: "There was an error generating the PDF report.",
        variant: "destructive",
      });
    }
  };

  const handleExportExcel = () => {
    try {
      // Convert batched results to TestResult format for Excel generation
      const convertedResults = results.map((result) => ({
        id: parseInt(result.id.replace('temp_', '')),
        sessionId: sessionData?.session?.id || 0,
        assetNumber: result.assetNumber || '1', // Use stored asset numbers
        itemName: result.itemName,
        itemType: result.itemType,
        location: result.location,
        classification: result.classification,
        result: result.result,
        frequency: result.frequency,
        failureReason: result.failureReason || null,
        actionTaken: result.actionTaken || null,
        notes: result.notes || null,
        photoData: result.photoData || null,
        visionInspection: result.visionInspection,
        electricalTest: result.electricalTest,
        createdAt: new Date(result.timestamp),
        // RCD testing specific fields
        pushButtonTest: result.pushButtonTest || false,
        injectionTimedTest: result.injectionTimedTest || false,
        tripTimes: (() => {
          const tripTimes = (result as any).tripTimes;
          if (Array.isArray(tripTimes) && tripTimes.length > 0) {
            return tripTimes.map((t: any) => Number(t)).filter((t: number) => t > 0);
          }
          return null;
        })(),
        distributionBoardNumber: (result as any).distributionBoardNumber || null,
        circuitBreakerNumber: (result as any).circuitBreakerNumber || null,
        maintenanceType: result.maintenanceType || null,
        dischargeTest: result.dischargeTest || false,
        switchingTest: result.switchingTest || false,
        chargingTest: result.chargingTest || false,
        luxTest: result.luxTest || false,
        luxReading: result.luxReading || null,
        luxCompliant: result.luxCompliant || false,
        manufacturerInfo: result.manufacturerInfo || null,
        installationDate: result.installationDate || null,
        globeType: result.globeType || null,
        // Microwave leakage testing specific fields
        leakageReading: (result as any).leakageReading || null,
        // Fire testing specific fields
        pressureTest: (result as any).pressureTest ?? false,
        accessibilityCheck: (result as any).accessibilityCheck ?? false,
        signageCheck: (result as any).signageCheck ?? false,
        operationalTest: (result as any).operationalTest ?? false,
        extinguisherType: (result as any).extinguisherType || null,
        size: (result as any).size || null,
        weight: (result as any).weight || null,
      } as any));

      if (!sessionData?.session) {
        throw new Error('Session data is not available');
      }

      const previewData = {
        ...sessionData,
        session: sessionData.session,
        results: convertedResults,
      };

      downloadExcel(previewData, `test-report-${sessionData.session.clientName.replace(/\s+/g, '-').toLowerCase()}.xlsx`);
      toast({
        title: "Excel Generated",
        description: "Your test report has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error generating the Excel report.",
        variant: "destructive",
      });
    }
  };

  const handleNewJob = async () => {
    setIsFinishingReport(true);
    setShowFinishSuccess(false);

    try {
      // Only submit batch if there are results and an active session
      // (batch may have already been submitted when clicking "View Report")
      if (sessionId && batchedResults.length > 0) {
        console.log('Submitting batch results before finishing job...');
        await submitBatch();

        // Wait a moment to ensure submission completes
        console.log('Waiting for batch submission to complete...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('Batch already submitted, skipping submission step');
      }

      // DATABASE-FIRST: Finalize the session to mark it as completed
      // This prevents it from appearing in the drafts dialog
      if (sessionId) {
        try {
          console.log('Finalizing session:', sessionId);
          const response = await fetch(`/api/sessions/${sessionId}/finalize`, {
            method: 'PATCH',
            credentials: 'include',
          });

          if (!response.ok) {
            console.warn('Failed to finalize session, but continuing...');
          } else {
            console.log('Session finalized successfully');
          }
        } catch (error) {
          console.warn('Error finalizing session:', error);
          // Continue anyway - data is saved, just status wasn't updated
        }
      }

      // Clear sessionStorage navigation bridge
      sessionStorage.removeItem('currentSessionId');
      sessionStorage.removeItem('selectedService');

      // Show success animation
      setShowFinishSuccess(true);

      // Wait for success animation then redirect
      setTimeout(() => {
        setIsFinishingReport(false);
        setShowFinishSuccess(false);
        navigate('/');

        toast({
          title: "Job Completed",
          description: "Test results saved successfully. Ready for a new job.",
        });
      }, 1500);

    } catch (error) {
      console.error('Failed to submit results:', error);
      setIsFinishingReport(false);
      setShowFinishSuccess(false);

      toast({
        title: "Submission Failed",
        description: "Failed to save test results. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteResult = (result: BatchedTestResult) => {
    // Convert batched result to TestResult format for deletion
    const testResult: TestResult = {
      id: parseInt(result.id.replace('temp_', '')),
      sessionId: sessionData?.session?.id || 0,
      assetNumber: result.assetNumber || '1',
      itemName: result.itemName,
      itemType: result.itemType,
      location: result.location,
      classification: result.classification as any,
      result: result.result as any,
      frequency: result.frequency as any,
      failureReason: result.failureReason || null,
      actionTaken: result.actionTaken || null,
      notes: result.notes || null,
      photoData: result.photoData || null,
      visionInspection: result.visionInspection,
      electricalTest: result.electricalTest,
      createdAt: new Date(result.timestamp),

      maintenanceType: result.maintenanceType || null,
      dischargeTest: result.dischargeTest || false,
      switchingTest: result.switchingTest || false,
      chargingTest: result.chargingTest || false,
      luxTest: result.luxTest || false,
      luxReading: result.luxReading || null,
      luxCompliant: result.luxCompliant || false,
      manufacturerInfo: result.manufacturerInfo || null,
      installationDate: result.installationDate || null,
      globeType: result.globeType || null,
    };

    // Store the original batched ID for proper deletion (similar to edit functionality)
    setDeletingResult({ ...testResult, originalBatchedId: result.id } as any);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (!deletingResult) return;

    try {
      // Use the original batched ID for deletion
      const originalBatchedId = (deletingResult as any).originalBatchedId;

      if (originalBatchedId) {
        console.log('Deleting result with ID:', originalBatchedId);
        removeBatchedResult(originalBatchedId);
        toast({
          title: "Item Deleted",
          description: "Test result has been removed from the report.",
        });
      } else {
        console.error('No original batched ID found for deletion');
        toast({
          title: "Delete Failed",
          description: "Could not find the result to delete.",
          variant: "destructive",
        });
      }

      setShowDeleteConfirm(false);
      setDeletingResult(null);
    } catch (error) {
      console.error('Error deleting result:', error);
      toast({
        title: "Delete Failed",
        description: "There was an error removing the test result.",
        variant: "destructive",
      });
    }
  };

  /**
   * Handle asset number input changes with real-time validation
   */
  const handleAssetNumberChange = (value: string) => {
    setEditResultData(prev => ({ ...prev, assetNumber: value }));
    const error = validateAssetNumber(value, editResultData.frequency);
    setAssetNumberError(error);
  };

  /**
   * Handle frequency changes - auto-generate new asset number following report page logic
   */
  const handleFrequencyChange = (newFrequency: string) => {
    // Always auto-generate new asset number when frequency changes
    // This follows the same logic as when creating new items on report pages
    const editingResultId = editingResult ? (editingResult as any).originalBatchedId : '';
    const newAssetNumber = generateUniqueAssetNumber(editingResultId, newFrequency);

    console.log(`Frequency changed to ${newFrequency}, auto-generated asset number: ${newAssetNumber}`);

    setEditResultData(prev => ({
      ...prev,
      frequency: newFrequency,
      assetNumber: newAssetNumber
    }));

    // Validate the new asset number
    const error = validateAssetNumber(newAssetNumber, newFrequency);
    setAssetNumberError(error);
  };

  const handleEditResult = (result: BatchedTestResult) => {
    // Store the original batched result ID for proper updating
    const testResult: TestResult = {
      id: parseInt(result.id.replace('temp_', '')),
      sessionId: sessionData?.session?.id || 0,
      assetNumber: result.assetNumber || '1',
      itemName: result.itemName,
      itemType: result.itemType,
      location: result.location,
      classification: result.classification as any,
      result: result.result as any,
      frequency: result.frequency as any,
      failureReason: result.failureReason || null,
      actionTaken: result.actionTaken || null,
      notes: result.notes || null,
      photoData: result.photoData || null,
      visionInspection: result.visionInspection,
      electricalTest: result.electricalTest,
      createdAt: new Date(result.timestamp),

      maintenanceType: result.maintenanceType || null,
      dischargeTest: result.dischargeTest ?? false,
      switchingTest: result.switchingTest ?? false,
      chargingTest: result.chargingTest ?? false,
      manufacturerInfo: result.manufacturerInfo || null,
      installationDate: result.installationDate || null,
      globeType: result.globeType || null,
    };

    // Store the original batched result for updating
    console.log('Setting editing result with batched ID:', result.id);
    console.log('Session service type:', sessionData?.session?.serviceType);
    setEditingResult({ ...testResult, originalBatchedId: result.id } as any);

    // Set form data for manual editing
    setEditResultData({
      itemName: result.itemName,
      itemType: result.itemType,
      location: result.location,
      assetNumber: result.assetNumber || "",
      classification: result.classification as any,
      result: result.result as any,
      frequency: result.frequency as any,
      failureReason: result.failureReason || null,
      actionTaken: result.actionTaken || null,
      notes: result.notes || null,
      // Service-specific boolean criteria fields - use actual values, not defaults
      visionInspection: (result as any).visionInspection ?? false,
      electricalTest: (result as any).electricalTest ?? false,
      dischargeTest: (result as any).dischargeTest ?? false,
      switchingTest: (result as any).switchingTest ?? false,
      chargingTest: (result as any).chargingTest ?? false,
      // Emergency Exit Light specific fields
      luxTest: (result as any).luxTest ?? false,
      luxReading: (result as any).luxReading ? parseFloat((result as any).luxReading) : null,
      luxCompliant: (result as any).luxCompliant ?? false,
      manufacturerInfo: (result as any).manufacturerInfo || null,
      installationDate: (result as any).installationDate || null,
      maintenanceType: (result as any).maintenanceType || null,
      globeType: (result as any).globeType || null,
      // Fire Testing specific fields
      pressureTest: (result as any).pressureTest ?? false,
      accessibilityCheck: (result as any).accessibilityCheck ?? false,
      signageCheck: (result as any).signageCheck ?? false,
      operationalTest: (result as any).operationalTest ?? false,
      extinguisherType: (result as any).extinguisherType || null,
      size: (result as any).size || null,
      weight: (result as any).weight || null,
      // Microwave Leakage specific fields
      leakageReading: (result as any).leakageReading || null,
      // RCD-specific fields
      pushButtonTest: (result as any).pushButtonTest ?? false,
      injectionTimedTest: (result as any).injectionTimedTest ?? false,
      tripTimes: resolveRcdTripTimes(result),
      distributionBoardNumber: (result as any).distributionBoardNumber || null,
      circuitBreakerNumber: (result as any).circuitBreakerNumber || null,
    });
    
    // Clear any previous asset number errors
    setAssetNumberError("");
    
    setIsEditModalOpen(true);
  };

  /**
   * Manual asset number update function - follows admin dashboard pattern
   * Validates for duplicates and provides real-time feedback
   */
  const handleUpdateResult = (submittedData?: typeof editResultData) => {
    if (!editingResult) return;
    const resultData = submittedData ?? editResultData;

    // Validate asset number before proceeding
    const assetError = validateAssetNumber(resultData.assetNumber, resultData.frequency);
    if (assetError) {
      setAssetNumberError(assetError);
      toast({
        title: "Invalid Asset Number",
        description: assetError,
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('=== Starting handleUpdateResult ===');
      console.log('Form data to save:', resultData);
      console.log('Editing result:', editingResult);
      console.log('Original batched ID:', (editingResult as any).originalBatchedId);

      // Track manually entered asset number to prevent auto-generation conflicts
      if (resultData.assetNumber) {
        setManuallyEnteredAssetNumbers(prev => new Set(Array.from(prev).concat(resultData.assetNumber)));
        
        // manuallyEnteredAssetNumbers is tracked in React state via setManuallyEnteredAssetNumbers above
        console.log(`Manually entered asset number tracked: ${resultData.assetNumber}`);
      }

      // Use the original batched ID for updating local storage
      const batchedId = (editingResult as any).originalBatchedId || `temp_${editingResult.id}`;
      console.log('Using batched ID for update:', batchedId);

      console.log('Calling updateBatchedResult...');
      updateBatchedResult(batchedId, resultData);
      console.log('updateBatchedResult completed');

      setIsEditModalOpen(false);
      setEditingResult(null);
      
      // Clear form data
      setEditResultData({
        itemName: "",
        itemType: "",
        location: "",
        assetNumber: "",
        classification: "class1",
        result: "pass",
        frequency: "twelvemonthly",
        failureReason: null,
        actionTaken: null,
        notes: null,
        visionInspection: true,
        electricalTest: true,
        dischargeTest: false,
        switchingTest: false,
        chargingTest: false,
        luxTest: false,
        luxReading: null,
        luxCompliant: false,
        manufacturerInfo: null,
        installationDate: null,
        maintenanceType: null,
        globeType: null,
        pressureTest: false,
        accessibilityCheck: false,
        signageCheck: false,
        operationalTest: false,
        extinguisherType: null,
        size: null,
        weight: null,
        leakageReading: null,
        pushButtonTest: null,
        injectionTimedTest: null,
        tripTimes: [],
        distributionBoardNumber: null,
        circuitBreakerNumber: null,
      });
      setAssetNumberError("");

      toast({
        title: "Item Updated",
        description: "Test result has been successfully updated with your asset number.",
      });

      console.log('=== handleUpdateResult completed successfully ===');
    } catch (error) {
      console.error('=== Error in handleUpdateResult ===');
      console.error('Error details:', error);
      console.error('Error stack:', (error as Error).stack);

      toast({
        title: "Update Failed",
        description: `Error updating test result: ${(error as Error).message}`,
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="mobile-container pb-32">
      {/* Header */}
      <div className="bg-success text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate('/items')}
            className="text-white hover:text-green-200 p-1 rounded-lg hover:bg-green-700 transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-xl font-semibold">Test Report</h1>
            <div className="text-green-100 text-sm">Ready for Export</div>
          </div>
          <div className="flex gap-2">
            {!isReflections && (
              <button
                onClick={handleExportPDF}
                className="text-white hover:text-green-200 p-2 rounded-lg hover:bg-green-700 transition-colors"
                title="Download PDF"
              >
                <Download className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={handleExportExcel}
              className="text-white hover:text-green-200 p-2 rounded-lg hover:bg-green-700 transition-colors"
              title="Download Excel"
            >
              📊
            </button>
          </div>
        </div>
      </div>

      {/* Workflow Progress Bar */}
      <WorkflowProgressBar
        serviceType={(session?.serviceType || 'electrical') as ServiceType}
        currentStep="complete"
      />
      <div className="flex justify-center py-1">
        <SaveStatusIndicator />
      </div>

      {/* Report Summary */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-800">{summary.totalItems}</div>
            <div className="text-xs text-gray-500">Total Items</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-success">{summary.passedItems}</div>
            <div className="text-xs text-gray-500">Passed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-error">{summary.failedItems}</div>
            <div className="text-xs text-gray-500">Failed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{summary.passRate}%</div>
            <div className="text-xs text-gray-500">Pass Rate</div>
          </div>
        </div>
      </div>

      {/* Client Info */}
      <div className="bg-gray-50 p-4 border-b border-gray-200">
        <div className="text-sm text-gray-600 mb-2">Client Information</div>
        <div className="space-y-1">
          <div className="font-semibold">{sessionData?.session?.clientName}</div>
          <div className="text-gray-600">{sessionData?.session?.address}</div>
          <div className="text-gray-600">Contact: {sessionData?.session?.siteContact}</div>
          <div className="text-gray-600">Technician: {sessionData?.session?.technicianName}</div>
          <div className="text-gray-600">Date: {formatDate(sessionData?.session?.testDate || '')}</div>
          <div className="text-gray-600">
            Country: {getCountryDisplayName(sessionData?.session?.country)}
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="p-4 pb-24">
        <div className="text-sm font-medium text-gray-700 mb-3">Test Results</div>
        <div className="space-y-2">
          {results.map((result) => (
            <div key={result.id} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-gray-800">
                    #{formatAssetNumberWithFrequency(result.assetNumber || 'TBD', result.frequency, session?.serviceType, results)} - {
                      result.itemCode && session?.country === 'national_client' 
                        ? `${result.itemCode} - ${result.itemName}` 
                        : session?.serviceType === 'rcd_reporting' && result.classification === 'fixed-rcd' && (result as any).distributionBoardNumber
                          ? `${result.itemName} (${(result as any).distributionBoardNumber})`
                          : result.itemName
                    }
                  </div>
                  <div className="text-sm text-gray-500">
                    {result.location} • {result.classification.toUpperCase()}
                  </div>
                  
                  {/* Show lux testing information for emergency exit lights */}
                  {sessionData?.session?.serviceType === 'emergency_exit_light' && result.luxTest && (
                    <div className="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded">
                      Lux Test: {result.luxCompliant ? 'PASS' : 'FAIL'} 
                      {result.luxReading && ` (${result.luxReading} lux)`}
                    </div>
                  )}
                  
                  {result.result === 'fail' && (
                    <div className="text-xs text-red-600 mt-1">
                      {result.failureReason || 'Failed'}
                      {result.actionTaken && ` • ${result.actionTaken === 'given' ? 'Given to Site Contact' : 'Removed from Site'}`}
                      {result.notes && ` • ${result.notes}`}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditResult(result)}
                    className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors"
                    title="Edit item"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteResult(result)}
                    className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
                    title="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    result.result === 'pass' 
                      ? 'bg-success text-white' 
                      : 'bg-error text-white'
                  }`}>
                    {result.result.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 p-4 space-y-3">
        {isReflections ? (
          <Button
            onClick={handleExportExcel}
            className="w-full bg-primary text-white py-3 font-medium touch-button"
          >
            <FileText className="mr-1 h-4 w-4" />
            Download Excel
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleExportPDF}
              className="bg-primary text-white py-3 font-medium touch-button"
            >
              <Download className="mr-1 h-4 w-4" />
              PDF
            </Button>
            <Button
              onClick={handleExportExcel}
              variant="outline"
              className="py-3 font-medium touch-button"
            >
              <FileText className="mr-1 h-4 w-4" />
              Excel
            </Button>
          </div>
        )}
        <Button 
          onClick={handleNewJob}
          disabled={isSubmittingBatch || isFinishingReport}
          className="w-full bg-success text-white py-3 font-medium touch-button disabled:opacity-50"
        >
          {isSubmittingBatch || isFinishingReport ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving Results...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Save
            </>
          )}
        </Button>
      </div>

      {/* Edit Modal */}

      {/* Edit Modal */}
      <TestResultEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        editResultData={editResultData}
        setEditResultData={setEditResultData}
        onSave={handleUpdateResult}
        serviceType={session?.serviceType}
        assetNumberError={assetNumberError}
        onAssetNumberChange={handleAssetNumberChange}
        onFrequencyChange={handleFrequencyChange}
        isSaving={false}
      />


      {/* Delete Item Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Test Item?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingResult && (
                <>
                  Are you sure you want to delete <strong>#{deletingResult.assetNumber} - {deletingResult.itemCode && session?.country === 'national_client' ? `${deletingResult.itemCode} - ${deletingResult.itemName}` : deletingResult.itemName}</strong>? 
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Yes, Delete Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PDF Generation Loading Overlay */}
      {isGeneratingPDF && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 text-center">
            {!showPDFSuccess ? (
              <>
                <div className="mb-6">
                  <div className="mx-auto w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Generating Report</h3>
                <p className="text-gray-600">Please wait while your PDF is being created...</p>
              </>
            ) : (
              <div className={`transition-opacity duration-300 ${showPDFSuccess ? 'opacity-100' : 'opacity-0'}`}>
                <div className="mb-6">
                  <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                    <Check className="h-8 w-8 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-green-600 mb-2">Report Generated!</h3>
                <p className="text-gray-600">Your PDF has been created successfully.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Finish Report Loading Overlay */}
      {isFinishingReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 text-center">
            {!showFinishSuccess ? (
              <>
                <div className="mb-6">
                  <div className="mx-auto w-16 h-16 border-4 border-success border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Finishing Report</h3>
                <p className="text-gray-600">Saving your test results to the database...</p>
              </>
            ) : (
              <div className={`transition-opacity duration-300 ${showFinishSuccess ? 'opacity-100' : 'opacity-0'}`}>
                <div className="mb-6">
                  <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                    <Check className="h-8 w-8 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-green-600 mb-2">Report Completed!</h3>
                <p className="text-gray-600">Your test results have been saved successfully.</p>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Unsaved Changes Modal */}
       <AlertDialog open={showConfirm}>
      <AlertDialogContent className="max-w-sm rounded-2xl shadow-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-semibold">
            Unsaved Changes
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            You have unsaved changes. Do you want to stay or continue leaving this page?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex justify-end gap-3 mt-6">
          <AlertDialogCancel
            onClick={cancelNavigation}
            className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Stay
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmNavigation}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  );
}
