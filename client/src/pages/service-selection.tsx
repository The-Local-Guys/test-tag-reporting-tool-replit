import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Zap, ShieldAlert, ArrowRight, FileText, Plus, Flame, Radio, Trash2, Clock } from "lucide-react";
import { useSpaNavigation } from "@/hooks/useSpaNavigation";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";

interface DraftSession {
  id: number;
  clientName: string;
  address: string;
  serviceType: string;
  testDate: string;
  totalItems: number;
  failedItems: number;
  lastActivityAt: string;
  createdAt: string;
}

export default function ServiceSelection() {
  const { navigate } = useSpaNavigation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDraftsDialog, setShowDraftsDialog] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<DraftSession | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  // Fetch draft sessions from server (database-first approach)
  const { data: draftSessions, isLoading: isCheckingDrafts } = useQuery<DraftSession[]>({
    queryKey: ['/api/sessions/drafts'],
    staleTime: 0, // Always refetch
  });

  // Show drafts dialog if there are any draft sessions with items
  useEffect(() => {
    if (draftSessions && draftSessions.length > 0) {
      // Only show dialog for drafts that have items (real work done)
      const draftsWithItems = draftSessions.filter(d => d.totalItems > 0);
      if (draftsWithItems.length > 0) {
        console.log(`Found ${draftsWithItems.length} draft sessions with items:`, draftsWithItems);
        setShowDraftsDialog(true);
      }
    }
  }, [draftSessions]);

  // Helper to format service type for display
  const getServiceTypeLabel = (serviceType: string) => {
    const labels: Record<string, string> = {
      'electrical': 'Electrical Test & Tag',
      'emergency_exit_light': 'Emergency Exit Light',
      'fire_testing': 'Fire Equipment',
      'rcd_reporting': 'RCD Reporting',
      'microwave_leakage': 'Microwave Leakage',
    };
    return labels[serviceType] || serviceType;
  };

  // Helper to format relative time
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const handleContinueDraft = (draft: DraftSession) => {
    console.log('Continuing draft session:', draft.id);
    // Set the current session ID
    localStorage.setItem('currentSessionId', draft.id.toString());
    // Store service type for the session
    localStorage.setItem(`session_${draft.id}_serviceType`, draft.serviceType);
    // Navigate directly to items page (skip setup since session already exists)
    navigate('/items');
    setShowDraftsDialog(false);
  };

  const handleDiscardDraft = async (draft: DraftSession) => {
    setIsDiscarding(true);
    try {
      console.log('Discarding draft session:', draft.id);
      await apiRequest('DELETE', `/api/sessions/${draft.id}`);

      // Clean up any localStorage data for this session
      localStorage.removeItem(`batchedResults_${draft.id}`);
      localStorage.removeItem(`session_${draft.id}_serviceType`);
      localStorage.removeItem(`twelvemonthlyCounter_${draft.id}`);
      localStorage.removeItem(`sixmonthlyCounter_${draft.id}`);
      localStorage.removeItem(`fiveyearlyCounter_${draft.id}`);
      localStorage.removeItem(`twentyfourmonthlyCounter_${draft.id}`);
      localStorage.removeItem(`threemonthlyCounter_${draft.id}`);
      localStorage.removeItem(`monthlyCounter_${draft.id}`);
      localStorage.removeItem(`customStartingNumbers_${draft.id}`);

      // Refresh draft sessions list
      queryClient.invalidateQueries({ queryKey: ['/api/sessions/drafts'] });

      toast({
        title: "Draft Discarded",
        description: `Report for ${draft.clientName} has been deleted.`,
      });

      // Close dialog if no more drafts with items
      const remainingDrafts = draftSessions?.filter(d => d.id !== draft.id && d.totalItems > 0) || [];
      if (remainingDrafts.length === 0) {
        setShowDraftsDialog(false);
      }
    } catch (error) {
      console.error('Error discarding draft:', error);
      toast({
        title: "Error",
        description: "Failed to discard the draft. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDiscarding(false);
    }
  };

  const handleStartNewReport = () => {
    // Clear any stale currentSessionId
    localStorage.removeItem('currentSessionId');
    localStorage.removeItem('unfinished');
    localStorage.removeItem('unfinishedSessionId');
    setShowDraftsDialog(false);
  };

  const selectService = (serviceType: 'electrical' | 'emergency_exit_light' | 'fire_testing' | 'rcd_reporting' | 'microwave_leakage') => {
    // Store the selected service type
    sessionStorage.setItem('selectedService', serviceType);
    // Navigate to setup page
    navigate('/setup');
  };

  // Show loading while checking for draft sessions
  if (isCheckingDrafts) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking for unfinished reports...</p>
        </div>
      </div>
    );
  }

  // Filter drafts with items for the dialog
  const draftsWithItems = draftSessions?.filter(d => d.totalItems > 0) || [];

  return (
    <>
      {/* Draft Sessions Dialog - Database-First Approach */}
      <Dialog open={showDraftsDialog} onOpenChange={setShowDraftsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Unfinished Report{draftsWithItems.length > 1 ? 's' : ''} Found
            </DialogTitle>
            <DialogDescription>
              You have {draftsWithItems.length} unfinished report{draftsWithItems.length > 1 ? 's' : ''}.
              Continue where you left off or start fresh.
            </DialogDescription>
          </DialogHeader>

          {/* List of draft sessions */}
          <div className="space-y-3 mt-4 max-h-[300px] overflow-y-auto">
            {draftsWithItems.map((draft) => (
              <div
                key={draft.id}
                className="border rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{draft.clientName}</div>
                    <div className="text-sm text-gray-600">{draft.address}</div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        {getServiceTypeLabel(draft.serviceType)}
                      </span>
                      <span className="font-medium">
                        {draft.totalItems} item{draft.totalItems !== 1 ? 's' : ''}
                      </span>
                      {draft.failedItems > 0 && (
                        <span className="text-red-600">
                          {draft.failedItems} failed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      Last activity: {getRelativeTime(draft.lastActivityAt || draft.createdAt)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleContinueDraft(draft)}
                      className="bg-primary"
                    >
                      Continue
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDiscardDraft(draft)}
                      disabled={isDiscarding}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Discard
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 mt-4">
            <Button
              onClick={handleStartNewReport}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Start New Report Instead
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="max-w-7xl mx-auto p-6">
      <div className="text-center mb-8">
        <img 
          src={logoPath} 
          alt="The Local Guys" 
          className="h-24 mx-auto mb-6"
        />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Select Testing Service
        </h1>
        <p className="text-lg text-gray-600">
          Choose the type of testing you want to perform today
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Electrical Test and Tag */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <Zap className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-xl">Electrical Test and Tag</CardTitle>
              <CardDescription className="text-base">
                Portable appliance testing for electrical equipment compliance with AS/NZS 3760
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li>• Visual inspection testing</li>
                <li>• Earth continuity testing</li>
                <li>• Insulation resistance testing</li>
                <li>• Polarity testing</li>
                <li>• Appliance leakage testing</li>
                <li>• Compliance tagging and reporting</li>
              </ul>
              <Button 
                onClick={() => selectService('electrical')}
                className="w-full"
                size="lg"
              >
                Select Electrical Testing
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Emergency Exit Light Testing */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-red-500">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-xl">Emergency Exit Light Testing</CardTitle>
              <CardDescription className="text-base">
                Emergency lighting and exit sign testing compliant with AS 2293.2:2019
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li>• 90-minute discharge testing</li>
                <li>• Physical inspection</li>
                <li>• Battery condition assessment</li>

                <li>• Switching mechanism testing</li>
                <li>• Compliance certification</li>
              </ul>
              <Button 
                onClick={() => selectService('emergency_exit_light')}
                className="w-full bg-red-600 hover:bg-red-700"
                size="lg"
              >
                Select Emergency Testing
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Fire Testing */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-orange-500">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
                <Flame className="w-8 h-8 text-orange-600" />
              </div>
              <CardTitle className="text-xl">Fire Equipment Testing</CardTitle>
              <CardDescription className="text-base">
                Fire safety equipment testing compliant with AS 1851 (AU) / NZS 4503:2005 (NZ)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li>• Fire extinguisher testing</li>
                <li>• Fire blanket inspection</li>
                <li>• Fire hose reel testing</li>
                <li>• 6-monthly and 12-monthly tests</li>
                <li>• Compliance documentation</li>
              </ul>
              <Button 
                onClick={() => selectService('fire_testing')}
                className="w-full bg-orange-600 hover:bg-orange-700"
                size="lg"
              >
                Select Fire Testing
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* RCD Reporting */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-purple-500">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                <Zap className="w-8 h-8 text-purple-600" />
              </div>
              <CardTitle className="text-xl">RCD Reporting</CardTitle>
              <CardDescription className="text-base">
                Residual Current Device testing for electrical safety compliance with AS/NZS 3760
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li>• Fixed RCD testing</li>
                <li>• Portable RCD testing</li>
                <li>• Push button test (6 monthly)</li>
                <li>• Injection/Timed test (12 monthly)</li>
                <li>• Distribution board tracking</li>
                <li>• Compliance certification</li>
              </ul>
              <Button 
                onClick={() => selectService('rcd_reporting')}
                className="w-full bg-purple-600 hover:bg-purple-700"
                size="lg"
              >
                Select RCD Reporting
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Microwave Leakage Testing */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-green-500">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <Radio className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-xl">Microwave Leakage Testing</CardTitle>
              <CardDescription className="text-base">
                Microwave oven radiation leakage testing for workplace safety compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li>• Radiation leakage measurement</li>
                <li>• Door seal inspection</li>
                <li>• Safety interlock testing</li>
                <li>• Visual condition assessment</li>
                <li>• AS/NZS 60335.2.25 compliance</li>
                <li>• Compliance certification</li>
              </ul>
              <Button 
                onClick={() => selectService('microwave_leakage')}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                Select Microwave Testing
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          Need help choosing? Contact support for guidance on which service is right for your needs.
        </p>
      </div>
    </div>
    </>
  );
}