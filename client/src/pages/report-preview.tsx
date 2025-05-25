import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Mail, Share, Plus } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useLocation } from 'wouter';
import { downloadPDF } from '@/lib/pdf-generator';
import { useToast } from '@/hooks/use-toast';

export default function ReportPreview() {
  const { sessionData } = useSession();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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

  const handleExportPDF = () => {
    try {
      downloadPDF(sessionData, `test-report-${session.clientName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
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

  const handleEmailReport = () => {
    // This would integrate with email service
    toast({
      title: "Email Feature",
      description: "Email integration would be implemented here.",
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="mobile-container">
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
          <button 
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: 'Test & Tag Report',
                  text: `Test report for ${session.clientName}`,
                });
              } else {
                handleEmailReport();
              }
            }}
            className="text-white hover:text-green-200 p-1 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Share className="h-6 w-6" />
          </button>
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
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  result.result === 'pass' 
                    ? 'bg-success text-white' 
                    : 'bg-error text-white'
                }`}>
                  {result.result.toUpperCase()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 p-4 space-y-3">
        <div className="flex gap-3">
          <Button 
            onClick={handleExportPDF}
            className="flex-1 bg-primary text-white py-3 font-medium touch-button"
          >
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button 
            variant="outline"
            onClick={handleEmailReport}
            className="flex-1 py-3 font-medium touch-button"
          >
            <Mail className="mr-2 h-4 w-4" />
            Email
          </Button>
        </div>
        <Button 
          onClick={handleNewJob}
          className="w-full bg-success text-white py-3 font-medium touch-button"
        >
          <Plus className="mr-2 h-4 w-4" />
          Start New Job
        </Button>
      </div>
    </div>
  );
}
