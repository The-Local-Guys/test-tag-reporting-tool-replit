import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Download, Mail, Share, Plus, Edit2, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { useSession, type BatchedTestResult } from '@/hooks/use-session';
import { useLocation } from 'wouter';
import { downloadPDF } from '@/lib/pdf-generator';
import { downloadExcel } from '@/lib/excel-generator';
import { useToast } from '@/hooks/use-toast';
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

  const editForm = useForm({
    resolver: zodResolver(insertTestResultSchema.omit({ sessionId: true, assetNumber: true })),
    defaultValues: {
      itemName: '',
      itemType: '',
      location: '',
      classification: 'class1' as const,
      result: 'pass' as const,
      frequency: 'twelvemonthly' as const,
      failureReason: null,
      actionTaken: null,
      notes: null,
    },
  });

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
        updatedAt: new Date(result.timestamp),
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

      await downloadPDF(previewData, `test-report-${session.clientName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      toast({
        title: "PDF Generated",
        description: "Your test report has been downloaded successfully.",
      });
    } catch (error) {
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
        updatedAt: new Date(result.timestamp),
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

      downloadExcel(previewData, `test-report-${session.clientName.replace(/\s+/g, '-').toLowerCase()}.xlsx`);
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
    setShowNewReportConfirm(true);
  };

  const confirmNewReport = () => {
    // Clear current session data
    clearSession();
    // Clear any cached session data
    localStorage.removeItem('currentSession');
    // Navigate to setup page to start a new report
    setLocation('/');
    toast({
      title: "Report Cancelled",
      description: "The report has been discarded. Ready to start fresh.",
    });
    setShowNewReportConfirm(false);
  };

  const handleNewJob = () => {
    // Navigate to setup page to start a new job
    setLocation('/');
    toast({
      title: "New Job Started",
      description: "Ready to begin a fresh test session.",
    });
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
    editForm.reset({
      itemName: result.itemName,
      itemType: result.itemType,
      location: result.location,
      classification: result.classification as any,
      result: result.result as any,
      frequency: result.frequency as any,
      failureReason: result.failureReason || null,
      actionTaken: result.actionTaken || null,
      notes: result.notes || null,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (data: any) => {
    if (!editingResult) {
      console.error('No editing result available');
      return;
    }

    try {
      console.log('=== Starting handleSaveEdit ===');
      console.log('Form data to save:', data);
      console.log('Editing result:', editingResult);
      console.log('Original batched ID:', (editingResult as any).originalBatchedId);

      // Check if frequency changed and requires asset number update
      const originalResult = batchedResults.find(r => r.id === (editingResult as any).originalBatchedId);
      if (originalResult) {
        const originalFrequency = originalResult.frequency;
        const newFrequency = data.frequency;

        const originalIsFiveYearly = originalFrequency === 'fiveyearly';
        const newIsFiveYearly = newFrequency === 'fiveyearly';

        // If frequency category changed, update asset number and renumber all items
        if (originalIsFiveYearly !== newIsFiveYearly) {
          console.log('Frequency category changed, renumbering all items...');
          
          const newAssetNumber = renumberAssets(originalResult.id, newFrequency);
          
          console.log(`Asset number updated: ${originalResult.assetNumber} -> ${newAssetNumber}`);
          data.assetNumber = newAssetNumber;

          toast({
            title: "Items Renumbered",
            description: `All items have been renumbered. Asset #${originalResult.assetNumber} is now #${newAssetNumber}.`,
          });
        }
      }

      // Use the original batched ID for updating local storage
      const batchedId = (editingResult as any).originalBatchedId || `temp_${editingResult.id}`;
      console.log('Using batched ID for update:', batchedId);

      console.log('Calling updateBatchedResult...');
      updateBatchedResult(batchedId, data);
      console.log('updateBatchedResult completed');

      setIsEditModalOpen(false);
      setEditingResult(null);

      toast({
        title: "Item Updated",
        description: "Test result has been successfully updated.",
      });

      console.log('=== handleSaveEdit completed successfully ===');
    } catch (error) {
      console.error('=== Error in handleSaveEdit ===');
      console.error('Error details:', error);
      console.error('Error stack:', (error as Error).stack);

      toast({
        title: "Update Failed",
        description: `Error updating test result: ${(error as Error).message}`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteResult = (result: BatchedTestResult) => {
    // Store the original batched result for deletion
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

    // Store the original batched result ID for deletion
    setDeletingResult({ ...testResult, originalBatchedId: result.id } as any);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deletingResult) return;

    try {
      // Use the original batched ID for deletion from local storage
      const batchedId = (deletingResult as any).originalBatchedId || `temp_${deletingResult.id}`;
      await removeBatchedResult(batchedId);
      setShowDeleteConfirm(false);
      setDeletingResult(null);
      toast({
        title: "Item Deleted",
        description: "Test result has been successfully deleted.",
      });
    } catch (error) {
      console.error('Error deleting result:', error);
      toast({
        title: "Delete Failed",
        description: "There was an error deleting the test result.",
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
          className="w-full bg-success text-white py-3 font-medium touch-button"
        >
          <Plus className="mr-2 h-4 w-4" />
          Finish Job
        </Button>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Test Result"
      >
        <form onSubmit={(e) => {
          console.log('=== FORM ONSUBMIT TRIGGERED ===');
          console.log('Event:', e);

          editForm.handleSubmit(
            (data) => {
              console.log('=== FORM VALIDATION PASSED ===');
              console.log('Form submitted with data:', data);
              handleSaveEdit(data);
            },
            (errors) => {
              console.log('=== FORM VALIDATION FAILED ===');
              console.log('Form validation errors:', errors);
              toast({
                title: "Validation Error",
                description: "Please check all required fields.",
                variant: "destructive",
              });
            }
          )(e);
        }} className="space-y-4">
          <div>
            <Label htmlFor="edit-itemName">Item Name</Label>
            <Input
              id="edit-itemName"
              {...editForm.register('itemName')}
              className="text-base"
            />
          </div>

          <div>
            <Label htmlFor="edit-itemType">Item Type</Label>
            <Input
              id="edit-itemType"
              {...editForm.register('itemType')}
              className="text-base"
            />
          </div>

          <div>
            <Label htmlFor="edit-location">Location</Label>
            <Input
              id="edit-location"
              {...editForm.register('location')}
              className="text-base"
            />
          </div>

          <div>
            <Label htmlFor="edit-classification">Classification</Label>
            <Select 
              value={editForm.watch('classification')} 
              onValueChange={(value) => editForm.setValue('classification', value as any)}
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
              value={editForm.watch('result')} 
              onValueChange={(value) => editForm.setValue('result', value as any)}
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
              value={editForm.watch('frequency')} 
              onValueChange={(value) => editForm.setValue('frequency', value as any)}
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

          {editForm.watch('result') === 'fail' && (
            <>
              <div>
                <Label htmlFor="edit-failureReason">Failure Reason</Label>
                <Select 
                  value={editForm.watch('failureReason') || ''} 
                  onValueChange={(value) => editForm.setValue('failureReason', value || null)}
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
                  value={editForm.watch('actionTaken') || ''} 
                  onValueChange={(value) => editForm.setValue('actionTaken', value || null)}
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
                  {...editForm.register('notes')}
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
              type="submit" 
              className="flex-1 bg-primary"
              onClick={(e) => {
                console.log('=== SAVE BUTTON CLICKED ===');
                console.log('Button event:', e);
                console.log('Form state:', editForm.formState);
                console.log('Form values:', editForm.getValues());
                console.log('Form errors:', editForm.formState.errors);
              }}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Fixed Bottom Export Options */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 p-4 space-y-3">
        {/* Submit Results Button - Only show if there are batched results */}
        {batchedResults.length > 0 && (
          <Button 
            onClick={async () => {
              await submitBatch();
              // After successful submission, redirect to service selection
              setLocation('/');
              toast({
                title: "Report Submitted Successfully",
                description: "Ready to start a new test session.",
              });
            }}
            disabled={isSubmittingBatch}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-sm font-medium touch-button"
          >
            {isSubmittingBatch ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Submitting Report...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Submit Report ({batchedResults.length} items)
              </>
            )}
          </Button>
        )}

        <div className="text-center">
          <div className="text-sm font-medium text-gray-700">Export Report</div>
          <div className="text-xs text-gray-500">Choose your preferred format</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button 
            onClick={handleExportPDF}
            className="bg-red-600 hover:bg-red-700 text-white py-3 text-sm font-medium touch-button"
          >
            <Download className="h-4 w-4 mr-2" />
            PDF Preview
          </Button>
          <Button 
            onClick={handleExportExcel}
            className="bg-blue-600 hover:bg-blue-700 text-white py-3 text-sm font-medium touch-button"
          >
            📊 Excel Preview
          </Button>
        </div>
        <Button 
          onClick={handleNewReport}
          variant="outline"
          className="w-full py-3 text-sm font-medium touch-button border-red-300 text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Cancel Report
        </Button>
      </div>

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
    </div>
  );
}