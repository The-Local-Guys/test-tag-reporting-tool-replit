import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Zap, ShieldAlert, ArrowRight, FileText, Plus, Flame } from "lucide-react";
import { useSpaNavigation } from "@/hooks/useSpaNavigation";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";

export default function ServiceSelection() {
  const { navigate } = useSpaNavigation();
  const [showUnfinishedDialog, setShowUnfinishedDialog] = useState(false);
  const [unfinishedSessionId, setUnfinishedSessionId] = useState<string | null>(null);
  const [unfinishedResults, setUnfinishedResults] = useState<any[]>([]);
  const [isCheckingUnfinished, setIsCheckingUnfinished] = useState(true);

  // Check for unfinished reports when component mounts
  useEffect(() => {
    const checkUnfinishedReport = () => {
      console.log('Checking for unfinished reports on service selection page...');
      console.log('All localStorage keys:', Object.keys(localStorage));
      
      // Check for multiple possible key variations
      const isUnfinished = localStorage.getItem('unfinished');
      const storedSessionId = localStorage.getItem('unfinishedSessionId');
      const unfinishedId = localStorage.getItem('unfinishedId');
      const currentSessionId = localStorage.getItem('currentSessionId');
      
      // Also check for any batched results that might exist
      let foundBatchedResults = null;
      let batchSessionId = null;
      
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('batchedResults_')) {
          const sessionId = key.replace('batchedResults_', '');
          const results = localStorage.getItem(key);
          if (results) {
            try {
              const parsed = JSON.parse(results);
              if (parsed.length > 0) {
                console.log(`Found batched results for session ${sessionId}:`, parsed);
                foundBatchedResults = parsed;
                batchSessionId = sessionId;
              }
            } catch (error) {
              console.warn('Error parsing batched results:', error);
            }
          }
        }
      });
      
      console.log('Unfinished check:', { isUnfinished, storedSessionId, unfinishedId, currentSessionId, foundBatchedResults, batchSessionId });
      
      // Determine target session ID
      let targetSessionId = storedSessionId || unfinishedId || currentSessionId || batchSessionId;
      
      // If we found any unfinished data, show the dialog
      if ((isUnfinished === 'true' || foundBatchedResults) && targetSessionId) {
        console.log('Found unfinished report, showing dialog for session:', targetSessionId);
        setUnfinishedSessionId(targetSessionId);
        setUnfinishedResults(foundBatchedResults || []);
        setShowUnfinishedDialog(true);
      } else {
        // Clean up any invalid unfinished flags
        if (isUnfinished || storedSessionId || unfinishedId) {
          console.log('Cleaning up invalid unfinished flags');
          localStorage.removeItem('unfinished');
          localStorage.removeItem('unfinishedSessionId');
          localStorage.removeItem('unfinishedId');
        }
      }
      
      setIsCheckingUnfinished(false);
    };

    checkUnfinishedReport();
  }, []);

  const handleContinueReport = () => {
    if (unfinishedSessionId) {
      console.log('Continuing report with session ID:', unfinishedSessionId);
      // Set the current session ID to the unfinished one
      localStorage.setItem('currentSessionId', unfinishedSessionId);
      navigate('/items');
    }
    setShowUnfinishedDialog(false);
  };

  const handleStartNew = () => {
    console.log('Starting new report, clearing unfinished data for session:', unfinishedSessionId);
    // Clear the unfinished report data
    if (unfinishedSessionId) {
      localStorage.removeItem(`batchedResults_${unfinishedSessionId}`);
      localStorage.removeItem(`monthlyCounter_${unfinishedSessionId}`);
      localStorage.removeItem(`fiveYearlyCounter_${unfinishedSessionId}`);
    }
    // Clear all possible unfinished key variations
    localStorage.removeItem('unfinished');
    localStorage.removeItem('unfinishedSessionId');
    localStorage.removeItem('unfinishedId');
    localStorage.removeItem('currentSessionId');
    setShowUnfinishedDialog(false);
  };

  const selectService = (serviceType: 'electrical' | 'emergency_exit_light' | 'fire_testing') => {
    // Store the selected service type
    sessionStorage.setItem('selectedService', serviceType);
    // Navigate to setup page
    navigate('/setup');
  };

  // Show loading while checking for unfinished reports
  if (isCheckingUnfinished) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking for unfinished reports...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Unfinished Report Dialog */}
      <Dialog open={showUnfinishedDialog} onOpenChange={setShowUnfinishedDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Unfinished Report Found
            </DialogTitle>
            <DialogDescription>
              You have an unfinished report with {unfinishedResults.length} test items. 
              Would you like to continue where you left off or start a new report?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button onClick={handleContinueReport} className="w-full" size="lg">
              <FileText className="w-4 h-4 mr-2" />
              Continue Report ({unfinishedResults.length} items)
            </Button>
            <Button 
              onClick={handleStartNew} 
              variant="outline" 
              className="w-full" 
              size="lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Start New Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="max-w-4xl mx-auto p-6">
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

      <div className="grid md:grid-cols-3 gap-6">
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
                <br />
                <span className="text-orange-600 font-medium">(Under Build Stage, Do Not Use)</span>
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