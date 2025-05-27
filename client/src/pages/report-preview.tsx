import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { ArrowLeft, Download, Mail, Share, Plus, Edit2, FileText, RefreshCw } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useLocation } from 'wouter';
import { downloadPDF } from '@/lib/pdf-generator';
import { downloadExcel } from '@/lib/excel-generator';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertTestResultSchema, type TestResult, type InsertTestResult } from '@shared/schema';

export default function ReportPreview() {
  const { sessionData, updateResult, clearSession } = useSession();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editingResult, setEditingResult] = useState<TestResult | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const editForm = useForm({
    resolver: zodResolver(insertTestResultSchema.omit({ sessionId: true, assetNumber: true })),
    defaultValues: {
      itemName: '',
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

  const { session, results, summary } = sessionData;

  const handleExportPDF = async () => {
    try {
      await downloadPDF(sessionData, `test-report-${session.clientName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
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
      downloadExcel(sessionData, `test-report-${session.clientName.replace(/\s+/g, '-').toLowerCase()}.xlsx`);
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

  const handleEmailReport = () => {
    // This would integrate with email service
    toast({
      title: "Email Feature",
      description: "Email integration would be implemented here.",
    });
  };

  const handleNewReport = () => {
    // Clear current session data
    clearSession();
    // Clear any cached session data
    localStorage.removeItem('currentSession');
    // Navigate to setup page to start a new report
    setLocation('/setup');
    toast({
      title: "Starting new report",
      description: "Ready to create a new test session.",
    });
  };

  const handleNewJob = () => {
    // Navigate to setup page to start a new job
    setLocation('/');
    toast({
      title: "New Job Started",
      description: "Ready to begin a fresh test session.",
    });
  };

  const handleEditResult = (result: TestResult) => {
    setEditingResult(result);
    editForm.reset({
      itemName: result.itemName,
      location: result.location,
      classification: result.classification,
      result: result.result,
      frequency: result.frequency,
      failureReason: result.failureReason,
      actionTaken: result.actionTaken,
      notes: result.notes,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (data: any) => {
    if (!editingResult) return;
    
    try {
      console.log('Saving edit with data:', data);
      console.log('Editing result ID:', editingResult.id);
      
      await updateResult({ id: editingResult.id, data });
      setIsEditModalOpen(false);
      setEditingResult(null);
      toast({
        title: "Item Updated",
        description: "Test result has been successfully updated.",
      });
    } catch (error) {
      console.error('Error saving edit:', error);
      toast({
        title: "Update Failed",
        description: "There was an error updating the test result.",
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
            <button 
              onClick={handleEmailReport}
              className="text-white hover:text-green-200 p-2 rounded-lg hover:bg-green-700 transition-colors"
              title="Email Report"
            >
              <Mail className="h-5 w-5" />
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
          <div className="font-semibold">{session.clientName}</div>
          <div className="text-gray-600">{session.address}</div>
          <div className="text-gray-600">Contact: {session.siteContact}</div>
          <div className="text-gray-600">Technician: {session.technicianName}</div>
          <div className="text-gray-600">Date: {formatDate(session.testDate)}</div>
          <div className="text-gray-600">
            Country: {session.country === 'australia' ? 'Australia' : 'New Zealand'}
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
                    #{result.assetNumber} - {result.itemName}
                  </div>
                  <div className="text-sm text-gray-500">
                    {result.location} • {result.classification.toUpperCase()}
                  </div>
                  {result.result === 'fail' && result.failureReason && (
                    <div className="text-xs text-red-600 mt-1">
                      {result.failureReason}
                      {result.actionTaken && ` • ${result.actionTaken === 'given' ? 'Given to Site Contact' : 'Removed from Site'}`}
                      {result.notes && ` • ${result.notes}`}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    result.result === 'pass' 
                      ? 'bg-success text-white' 
                      : 'bg-error text-white'
                  }`}>
                    {result.result.toUpperCase()}
                  </div>
                  <button
                    onClick={() => handleEditResult(result)}
                    className="p-1 text-gray-400 hover:text-primary transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
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
          <Button 
            variant="outline"
            onClick={handleEmailReport}
            className="py-3 font-medium touch-button"
          >
            <Mail className="mr-1 h-4 w-4" />
            Email
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
        <form onSubmit={editForm.handleSubmit(handleSaveEdit)} className="space-y-4">
          <div>
            <Label htmlFor="edit-itemName">Item Name</Label>
            <Input
              id="edit-itemName"
              {...editForm.register('itemName')}
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
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Fixed Bottom Export Options */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 p-4 space-y-3">
        <div className="text-center">
          <div className="text-sm font-medium text-gray-700">Export Report</div>
          <div className="text-xs text-gray-500">Choose your preferred format</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Button 
            onClick={handleExportPDF}
            className="bg-red-600 hover:bg-red-700 text-white py-3 text-sm font-medium touch-button"
          >
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button 
            onClick={handleExportExcel}
            className="bg-green-600 hover:bg-green-700 text-white py-3 text-sm font-medium touch-button"
          >
            📊 Excel
          </Button>
          <Button 
            onClick={handleEmailReport}
            className="bg-blue-600 hover:bg-blue-700 text-white py-3 text-sm font-medium touch-button"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
        </div>
        <Button 
          onClick={handleNewReport}
          className="w-full bg-primary hover:bg-primary/90 text-white py-3 text-sm font-medium touch-button"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          New Report
        </Button>
      </div>
    </div>
  );
}
