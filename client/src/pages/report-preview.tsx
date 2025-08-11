import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Download, Mail, Share, Plus, Edit2, FileText, RefreshCw, Trash2, Check } from 'lucide-react';
import { useSession, type BatchedTestResult } from '@/hooks/use-session';
import { useLocation } from 'wouter';
import { downloadPDF } from '@/lib/pdf-generator';
import { downloadExcel } from '@/lib/excel-generator';
import { useToast } from '@/hooks/use-toast';
import { deleteResource } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertTestResultSchema, type TestResult, type InsertTestResult } from '@shared/schema';

/**
 * Report preview and generation interface
 * Displays test session summary and provides PDF/Excel export functionality
 * Shows pass/fail statistics and enables report customization options
 */
export default function ReportPreview() {
  const { sessionData, batchedResults, submitBatch, isSubmittingBatch, updateBatchedResult, removeBatchedResult, clearSession, assetProgress, renumberAssets, sessionId } = useSession();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editingResult, setEditingResult] = useState<TestResult | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showNewReportConfirm, setShowNewReportConfirm] = useState(false);
  const [deletingResult, setDeletingResult] = useState<TestResult | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showPDFSuccess, setShowPDFSuccess] = useState(false);
  
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
  });
  const [assetNumberError, setAssetNumberError] = useState<string>("");
  
  // Track manually entered asset numbers to prevent auto-generation conflicts
  const [manuallyEnteredAssetNumbers, setManuallyEnteredAssetNumbers] = useState<Set<string>>(new Set());



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
   * Validate asset number for duplicates and range requirements
   * Now includes manually entered asset numbers to prevent conflicts
   */
  const validateAssetNumber = (assetNumber: string, frequency: string): string => {
    if (!assetNumber.trim()) {
      return "Asset number is required";
    }

    const assetNum = parseInt(assetNumber);
    if (isNaN(assetNum) || assetNum <= 0) {
      return "Asset number must be a positive number";
    }

    // Validate range based on frequency
    if (frequency === 'fiveyearly') {
      if (assetNum < 10000) {
        return "5-yearly items must have asset numbers starting from 10000";
      }
    } else {
      // Monthly frequencies should be 1-9999
      if (assetNum >= 10000) {
        return "Monthly frequency items must have asset numbers below 10000";
      }
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
   */
  const generateUniqueAssetNumber = (editingResultId: string, newFrequency: string): string => {
    // Guard against missing results
    if (!batchedResults.length && manuallyEnteredAssetNumbers.size === 0) {
      console.warn('generateUniqueAssetNumber: No existing results or manual numbers');
      return newFrequency === 'fiveyearly' ? '10001' : '1';
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

    // Find next available asset number for the new frequency
    const startNumber = newFrequency === 'fiveyearly' ? 10001 : 1;
    const nextAvailable = getNextAvailableAssetNumber(usedNumbers, startNumber);
    
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
        maintenanceType: null,
        dischargeTest: false,
        switchingTest: false,
        chargingTest: false,
        manufacturerInfo: null,
        installationDate: null,
        globeType: null,
      }));

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
        maintenanceType: null,
        dischargeTest: false,
        switchingTest: false,
        chargingTest: false,
        manufacturerInfo: null,
        installationDate: null,
        globeType: null,
      }));

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



  const handleNewReport = () => {
    console.log('=== CANCEL BUTTON CLICKED ===');
    alert('Cancel button was clicked!'); // Temporary alert for testing
    console.log('handleNewReport clicked - showing confirmation dialog');
    setShowNewReportConfirm(true);
  };

  const confirmNewReport = async () => {
    console.log('Attempting to cancel report. Session data:', sessionData);
    console.log('Session ID from sessionData:', sessionData?.session?.id);
    console.log('Session ID from hook:', sessionId);
    
    // Try both sessionData.session.id and the sessionId from hook
    const currentSessionId = sessionData?.session?.id || sessionId;
    console.log('Using session ID:', currentSessionId);
    
    if (!currentSessionId) {
      // If no session ID, just clear local data
      console.log('No session ID found, clearing local data only');
      clearSession();
      localStorage.removeItem('currentSession');
      setLocation('/');
      toast({
        title: "Report Cancelled",
        description: "The report has been discarded. Ready to start fresh.",
      });
      setShowNewReportConfirm(false);
      return;
    }

    try {
      console.log(`Deleting session ${currentSessionId} from database`);
      // Delete the session from the database
      const response = await deleteResource(`/api/sessions/${currentSessionId}`, "report");
      console.log('Delete response:', response);
      
      // Clear current session data
      clearSession();
      localStorage.removeItem('currentSession');
      
      // Navigate to setup page to start a new report
      setLocation('/');
      
      toast({
        title: "Report Deleted",
        description: "The report has been permanently deleted from the database.",
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete the report. Please try again.",
        variant: "destructive",
      });
    }
    
    setShowNewReportConfirm(false);
  };

  const handleNewJob = async () => {
    try {
      // Submit batched results to database before starting new job
      console.log('Submitting batch results before finishing job...');
      await submitBatch();
      
      // Navigate to setup page to start a new job
      setLocation('/');
      toast({
        title: "Job Completed",
        description: "Test results saved successfully. Ready for a new job.",
      });
    } catch (error) {
      console.error('Failed to submit results:', error);
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
      updatedAt: new Date(result.timestamp),
      maintenanceType: null,
      dischargeTest: false,
      switchingTest: false,
      chargingTest: false,
      manufacturerInfo: null,
      installationDate: null,
      globeType: null,
    };

    setDeletingResult(testResult);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (!deletingResult) return;

    try {
      // Find the batched result to remove
      const originalBatchedId = batchedResults.find(r => 
        parseInt(r.id.replace('temp_', '')) === deletingResult.id
      )?.id;

      if (originalBatchedId) {
        removeBatchedResult(originalBatchedId);
        toast({
          title: "Item Deleted",
          description: "Test result has been removed from the report.",
        });
      }

      setShowDeleteConfirm(false);
      setDeletingResult(null);
    } catch (error) {
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
   * Handle frequency changes - clear asset number when frequency changes category
   */
  const handleFrequencyChange = (newFrequency: string) => {
    const currentFrequency = editResultData.frequency;
    const currentIsFiveYearly = currentFrequency === 'fiveyearly';
    const newIsFiveYearly = newFrequency === 'fiveyearly';
    
    // If frequency category changed, clear asset number and show validation error
    if (currentIsFiveYearly !== newIsFiveYearly) {
      setEditResultData(prev => ({ 
        ...prev, 
        frequency: newFrequency,
        assetNumber: "" // Clear asset number when frequency category changes
      }));
      setAssetNumberError("Asset number is required"); // Show validation error for empty field
    } else {
      // If frequency didn't change category, keep existing asset number
      setEditResultData(prev => ({ 
        ...prev, 
        frequency: newFrequency
      }));
      // Re-validate current asset number with new frequency
      const error = validateAssetNumber(editResultData.assetNumber, newFrequency);
      setAssetNumberError(error);
    }
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
      updatedAt: new Date(result.timestamp),
      maintenanceType: null,
      dischargeTest: false,
      switchingTest: false,
      chargingTest: false,
      manufacturerInfo: null,
      installationDate: null,
      globeType: null,
    };

    // Store the original batched result for updating
    console.log('Setting editing result with batched ID:', result.id);
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
    });
    
    // Clear any previous asset number errors
    setAssetNumberError("");
    
    setIsEditModalOpen(true);
  };

  /**
   * Manual asset number update function - follows admin dashboard pattern
   * Validates for duplicates and provides real-time feedback
   */
  const handleUpdateResult = () => {
    if (!editingResult) return;

    // Validate asset number before proceeding
    const assetError = validateAssetNumber(editResultData.assetNumber, editResultData.frequency);
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
      console.log('Form data to save:', editResultData);
      console.log('Editing result:', editingResult);
      console.log('Original batched ID:', (editingResult as any).originalBatchedId);

      // Track manually entered asset number to prevent auto-generation conflicts
      if (editResultData.assetNumber) {
        setManuallyEnteredAssetNumbers(prev => new Set([...prev, editResultData.assetNumber]));
        
        // Save to localStorage so auto-generation logic can access it
        const sessionId = sessionData?.session?.id;
        if (sessionId) {
          const manuallyEnteredKey = `manuallyEnteredAssetNumbers_${sessionId}`;
          const currentManual = localStorage.getItem(manuallyEnteredKey);
          let manualNumbers: string[] = [];
          
          if (currentManual) {
            try {
              manualNumbers = JSON.parse(currentManual);
            } catch (error) {
              console.warn('Error parsing existing manual asset numbers:', error);
            }
          }
          
          if (!manualNumbers.includes(editResultData.assetNumber)) {
            manualNumbers.push(editResultData.assetNumber);
            localStorage.setItem(manuallyEnteredKey, JSON.stringify(manualNumbers));
            console.log(`Manually entered asset number tracked: ${editResultData.assetNumber}`);
          }
        }
      }

      // Use the original batched ID for updating local storage
      const batchedId = (editingResult as any).originalBatchedId || `temp_${editingResult.id}`;
      console.log('Using batched ID for update:', batchedId);

      console.log('Calling updateBatchedResult...');
      updateBatchedResult(batchedId, editResultData);
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
            onClick={() => setLocation('/items')}
            className="text-white hover:text-green-200 p-1 rounded-lg hover:bg-green-700 transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-xl font-semibold">Test Report</h1>
            <div className="text-green-100 text-sm">Ready for Export</div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={(e) => {
                console.log('Button clicked!', e);
                handleNewReport();
              }}
              className="text-white hover:text-green-200 p-2 rounded-lg hover:bg-green-700 transition-colors border-2 border-red-500"
              title="Cancel Report"
              type="button"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button 
              onClick={handleExportPDF}
              className="text-white hover:text-green-200 p-2 rounded-lg hover:bg-green-700 transition-colors"
              title="Download PDF"
            >
              <Download className="h-5 w-5" />
            </button>
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
            Country: {sessionData?.session?.country === 'australia' ? 'Australia' : 'New Zealand'}
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
                    #{result.assetNumber || 'TBD'} - {result.itemName}
                  </div>
                  <div className="text-sm text-gray-500">
                    {result.location} • {result.classification.toUpperCase()}
                  </div>
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
        <Button 
          onClick={handleNewJob}
          disabled={isSubmittingBatch}
          className="w-full bg-success text-white py-3 font-medium touch-button disabled:opacity-50"
        >
          {isSubmittingBatch ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving Results...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Finish Job
            </>
          )}
        </Button>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Test Result"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-itemName">Item Name</Label>
            <Input
              id="edit-itemName"
              value={editResultData.itemName}
              onChange={(e) => setEditResultData(prev => ({ ...prev, itemName: e.target.value }))}
              className="text-base"
            />
          </div>

          <div>
            <Label htmlFor="edit-itemType">Item Type</Label>
            <Input
              id="edit-itemType"
              value={editResultData.itemType}
              onChange={(e) => setEditResultData(prev => ({ ...prev, itemType: e.target.value }))}
              className="text-base"
            />
          </div>

          <div>
            <Label htmlFor="edit-location">Location</Label>
            <Input
              id="edit-location"
              value={editResultData.location}
              onChange={(e) => setEditResultData(prev => ({ ...prev, location: e.target.value }))}
              className="text-base"
            />
          </div>

          <div>
            <Label htmlFor="edit-assetNumber">Asset Number</Label>
            <Input
              id="edit-assetNumber"
              value={editResultData.assetNumber}
              onChange={(e) => handleAssetNumberChange(e.target.value)}
              className={`text-base ${assetNumberError ? 'border-red-500' : ''}`}
              placeholder="Enter asset number"
            />
            {assetNumberError && (
              <div className="text-red-500 text-sm mt-1">{assetNumberError}</div>
            )}
          </div>

          <div>
            <Label htmlFor="edit-classification">Classification</Label>
            <Select 
              value={editResultData.classification} 
              onValueChange={(value) => setEditResultData(prev => ({ ...prev, classification: value as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="class1">Class 1</SelectItem>
                <SelectItem value="class2">Class 2</SelectItem>
                <SelectItem value="epod">EPOD</SelectItem>
                <SelectItem value="rcd">RCD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-result">Test Result</Label>
            <Select 
              value={editResultData.result} 
              onValueChange={(value) => setEditResultData(prev => ({ ...prev, result: value as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pass">Pass</SelectItem>
                <SelectItem value="fail">Fail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-frequency">Test Frequency</Label>
            <Select 
              value={editResultData.frequency} 
              onValueChange={handleFrequencyChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="threemonthly">3 Monthly</SelectItem>
                <SelectItem value="sixmonthly">6 Monthly</SelectItem>
                <SelectItem value="twelvemonthly">12 Monthly</SelectItem>
                <SelectItem value="twentyfourmonthly">24 Monthly</SelectItem>
                <SelectItem value="fiveyearly">5 Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {editResultData.result === 'fail' && (
            <>
              <div>
                <Label htmlFor="edit-failureReason">Failure Reason</Label>
                <Select 
                  value={editResultData.failureReason || ''} 
                  onValueChange={(value) => setEditResultData(prev => ({ ...prev, failureReason: value || null }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vision">Vision</SelectItem>
                    <SelectItem value="earth">Earth</SelectItem>
                    <SelectItem value="insulation">Insulation</SelectItem>
                    <SelectItem value="polarity">Polarity</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-actionTaken">Action Taken</Label>
                <Select 
                  value={editResultData.actionTaken || ''} 
                  onValueChange={(value) => setEditResultData(prev => ({ ...prev, actionTaken: value || null }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="given">Given to Site Contact</SelectItem>
                    <SelectItem value="removed">Removed from Site</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editResultData.notes || ''}
                  onChange={(e) => setEditResultData(prev => ({ ...prev, notes: e.target.value || null }))}
                  placeholder="Additional notes..."
                  className="text-base"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsEditModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              className="flex-1 bg-primary"
              onClick={handleUpdateResult}
              disabled={!!assetNumberError || !editResultData.assetNumber.trim()}
            >
              Update Result
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Result Functions */}
      {/* Note: handleDeleteResult and confirmDelete functions should be added */}

      {/* Cancel Report Confirmation Dialog */}
      <AlertDialog open={showNewReportConfirm} onOpenChange={setShowNewReportConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Report?</AlertDialogTitle>
            <AlertDialogDescription>
              This will discard the current report and all test results without saving. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Report</AlertDialogCancel>
            <AlertDialogAction onClick={confirmNewReport} className="bg-red-600 hover:bg-red-700">
              Yes, Cancel Report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Item Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Test Item?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingResult && (
                <>
                  Are you sure you want to delete <strong>#{deletingResult.assetNumber} - {deletingResult.itemName}</strong>? 
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
    </div>
  );
}