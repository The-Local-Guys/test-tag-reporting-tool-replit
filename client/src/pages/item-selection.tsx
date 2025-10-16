import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Edit2, FileText, CheckCircle, Plus, RotateCcw, Trash2, Search } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { deleteResource } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";
import nationalClientItems from '@/data/national-client-items';

// Custom SVG component for fire hose reel icon - matches the provided design
function HoseReelIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      aria-label="Fire hose reel" 
      role="img" 
      className={className}
    >
      {/* Left mounting bracket */}
      <rect x="2" y="4" width="2" height="14" fill="#6B7280" stroke="#374151" strokeWidth="0.5" rx="1"/>
      {/* Right mounting bracket */}
      <rect x="20" y="4" width="2" height="14" fill="#6B7280" stroke="#374151" strokeWidth="0.5" rx="1"/>
      
      {/* Coiled red hose - multiple loops */}
      <ellipse cx="12" cy="8" rx="7" ry="1.5" fill="#DC2626" stroke="#B91C1C" strokeWidth="0.5"/>
      <ellipse cx="12" cy="10" rx="7" ry="1.5" fill="#DC2626" stroke="#B91C1C" strokeWidth="0.5"/>
      <ellipse cx="12" cy="12" rx="7" ry="1.5" fill="#DC2626" stroke="#B91C1C" strokeWidth="0.5"/>
      <ellipse cx="12" cy="14" rx="7" ry="1.5" fill="#DC2626" stroke="#B91C1C" strokeWidth="0.5"/>
      <ellipse cx="12" cy="16" rx="7" ry="1.5" fill="#DC2626" stroke="#B91C1C" strokeWidth="0.5"/>
      
      {/* Nozzle at bottom */}
      <rect x="11" y="18" width="2" height="3" fill="#374151" stroke="#1F2937" strokeWidth="0.5" rx="0.5"/>
      <rect x="10.5" y="21" width="3" height="1.5" fill="#374151" stroke="#1F2937" strokeWidth="0.5" rx="0.3"/>
    </svg>
  );
}

type Item = {
  type: string;
  name: string;
  icon: string | React.ReactNode;
  description: string;
};

const electricalItems: Item[] = [
  { type: 'iec-lead', name: 'IEC Lead', icon: '🔌', description: 'Power Cord' },
  { type: 'computer', name: 'Computer', icon: '💻', description: 'Desktop/Laptop' },
  { type: 'monitor', name: 'Monitor', icon: '🖥️', description: 'Display Screen' },
  { type: 'power-board', name: 'Power Board', icon: '▬', description: 'Multi Outlet' },
  { type: 'phone-charger', name: 'Phone Charger', icon: '🔋', description: 'Mobile Charger' },
  { type: 'laptop-charger', name: 'Laptop Charger', icon: '💻', description: 'AC Adapter' },
  { type: 'ac-adaptor', name: 'AC Adaptor', icon: '🔌', description: 'Power Supply' },
  { type: 'extension-cord', name: 'Extension Cord', icon: '➖', description: 'Power Extension' },
  { type: 'double-adaptor', name: 'Double Adaptor', icon: '⚡', description: 'Dual Outlet' },
  { type: 'power-pack', name: 'Power Pack', icon: '⬛', description: 'Portable Power' },
];

const emergencyItems: Item[] = [
  { type: 'emergency-exit-sign', name: 'Emergency Exit Sign', icon: '🚪', description: 'Emergency Exit Sign' },
  { type: 'emergency-light-downlight', name: 'Emergency Light/Downlight (Spitfire)', icon: '🔦', description: 'Emergency Downlight Spitfire Type' },
  { type: 'combination-unit', name: 'Combination Unit (Sign with Two Side Lights)', icon: '🔸', description: 'Exit Sign with Side Lights' },
  { type: 'emergency-spotlight', name: 'Emergency Spotlight', icon: '💡', description: 'Emergency Spotlight' },
  { type: 'floor-path-light', name: 'Floor Path Light', icon: '🟦', description: 'Floor Path Lighting' },
  { type: 'emergency-bulkhead', name: 'Emergency Bulkhead', icon: '⬛', description: 'Emergency Bulkhead Light' },
];

const fireItems: Item[] = [
  { type: 'fire-extinguisher', name: 'Fire Extinguisher', icon: '🧯', description: 'Fire Extinguisher' },
  { type: 'fire-blanket', name: 'Fire Blanket', icon: '🔥', description: 'Fire Blanket' },
  { type: 'fire-hose-reel', name: 'Fire Hose Reel', icon: <HoseReelIcon className="h-8 w-8 text-red-600 dark:text-red-400" />, description: 'Fire Hose Reel' },
];

export default function ItemSelection() {
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [showNewReportConfirm, setShowNewReportConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { sessionData, currentLocation, setCurrentLocation, clearSession, sessionId, isLoading: isLoadingSession } = useSession();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Set initial loading to false after a brief delay to ensure smooth transition
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 800); // Slightly longer than admin dashboard delay
    
    return () => clearTimeout(timer);
  }, []);

  // Get the selected service type and country
  const selectedService = sessionData?.session?.serviceType || sessionStorage.getItem('selectedService') || 'electrical';
  const country = sessionData?.session?.country;
  const isNationalClient = country === 'national_client';
  
  const predefinedItems = selectedService === 'emergency_exit_light' ? emergencyItems : 
                         selectedService === 'fire_testing' ? fireItems : electricalItems;

  // Filter national client items based on search query
  const filteredNationalItems = nationalClientItems.filter(item => {
    const query = searchQuery.toLowerCase();
    return item.code.toLowerCase().includes(query) || 
           item.name.toLowerCase().includes(query);
  });

  const handleItemSelect = (itemType: string, itemName: string, itemCode?: string) => {
    // Route to different test pages based on service type
    const testRoute = selectedService === 'emergency_exit_light' ? '/emergency-test' : 
                     selectedService === 'fire_testing' ? '/fire-test' : '/test';
    
    // Include item code in URL params for National Client items
    const codeParam = itemCode ? `&code=${encodeURIComponent(itemCode)}` : '';
    setLocation(`${testRoute}?item=${encodeURIComponent(itemName)}&type=${itemType}${codeParam}`);
  };

  const handleCustomItemAdd = () => {
    if (customItemName.trim()) {
      handleItemSelect('custom', customItemName.trim());
      setCustomItemName('');
      setIsCustomModalOpen(false);
    }
  };

  const handleNewJob = () => {
    setShowNewReportConfirm(true);
  };

  const confirmNewReport = async () => {
    setIsCancelling(true);
    
    // Try both sessionData.session.id and the sessionId from hook
    const currentSessionId = sessionData?.session?.id || sessionId;
    
    if (!currentSessionId) {
      // If no session ID, just clear local data
      clearSession();
      localStorage.removeItem('currentSession');
      
      // Show success feedback
      setIsCancelling(false);
      setShowCancelSuccess(true);
      setTimeout(() => {
        setLocation('/');
      }, 1000);
      
      setShowNewReportConfirm(false);
      return;
    }

    try {
      // Delete the session from the database
      await deleteResource(`/api/sessions/${currentSessionId}`, "report");
      
      // Clear current session data
      clearSession();
      localStorage.removeItem('currentSession');
      
      // Show success feedback for 1 second
      setIsCancelling(false);
      setShowCancelSuccess(true);
      
      setTimeout(() => {
        setLocation('/');
      }, 1000);
      
    } catch (error) {
      setIsCancelling(false);
      toast({
        title: "Delete Failed",
        description: "Failed to delete the report. Please try again.",
        variant: "destructive",
      });
    }
    
    setShowNewReportConfirm(false);
  };

  const summary = sessionData?.summary || {
    totalItems: 0,
    passedItems: 0,
    failedItems: 0,
    passRate: 0,
  };

  // Show loading screen during initial transition or when session is loading
  if (isInitialLoading || isLoadingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <img
              src={logoPath}
              alt="The Local Guys"
              className="h-24 w-auto object-contain"
            />
          </div>
          <div className="space-y-2">
            <LoadingSpinner />
            <p className="text-lg font-medium text-gray-700">
              Loading Report...
            </p>
            <p className="text-sm text-gray-500">
              Preparing item selection
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container">
      {/* Header */}
      <div className="bg-primary text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              {selectedService === 'emergency_exit_light' ? 'Emergency Equipment Selection' : 
               selectedService === 'fire_testing' ? 'Fire Equipment Selection' : 'Select Item to Test'}
            </h1>
            <div className="text-blue-100 text-sm">
              {sessionData?.session?.clientName || 'Loading...'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-blue-100 text-xs">Items Tested</div>
              <div className="text-2xl font-bold">{summary.totalItems}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-success">{summary.passedItems}</div>
            <div className="text-xs text-gray-500">Passed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-error">{summary.failedItems}</div>
            <div className="text-xs text-gray-500">Failed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-warning">{summary.passRate}%</div>
            <div className="text-xs text-gray-500">Pass Rate</div>
          </div>
        </div>
      </div>

      {/* Current Location Display */}
      <div className="bg-blue-50 border-b border-blue-100 p-4">
        <div className="text-center">
          <div className="text-sm text-gray-600">Current Location:</div>
          <div className="font-semibold text-gray-800">
            {currentLocation || 'Set when testing items'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Location is set in the test details for each item
          </div>
        </div>
      </div>

      {/* Item Selection - National Client Search or Regular Grid */}
      {isNationalClient ? (
        <div className="p-4 pb-24">
          {/* Search Input */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code or item name..."
                className="pl-10 text-base h-12"
                data-testid="input-national-client-search"
              />
            </div>
          </div>

          {/* Search Results */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {filteredNationalItems.length > 0 ? (
              filteredNationalItems.slice(0, 50).map((item) => (
                <button
                  key={item.code}
                  onClick={() => handleItemSelect(item.item_type, item.name, item.code)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-3 text-left hover:border-primary hover:bg-blue-50 transition-all"
                  data-testid={`button-national-item-${item.code}`}
                >
                  <div className="font-medium text-gray-800">
                    {item.code} - {item.name}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No items found' : 'Start typing to search...'}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 pb-24">
          <div className="grid grid-cols-2 gap-3">
            {predefinedItems.map((item) => (
              <button
                key={item.type}
                onClick={() => handleItemSelect(item.type, item.name)}
                className="bg-white border-2 border-gray-200 rounded-xl p-4 text-center hover:border-primary hover:bg-blue-50 transition-all touch-button"
                data-testid={`button-item-${item.type}`}
              >
                <div className="flex justify-center items-center mb-2 h-12" data-testid={`icon-item-${item.type}`}>
                  {typeof item.icon === 'string' ? (
                    <span className="text-3xl">{item.icon}</span>
                  ) : (
                    item.icon
                  )}
                </div>
                <div className="font-medium text-gray-800">{item.name}</div>
              </button>
            ))}

            <button
              onClick={() => setIsCustomModalOpen(true)}
              className="bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-dashed border-gray-400 rounded-xl p-4 text-center hover:from-blue-50 hover:to-blue-100 hover:border-primary transition-all touch-button"
            >
              <div className="text-3xl mb-2">
                <Plus className="h-8 w-8 mx-auto text-gray-600" />
              </div>
              <div className="font-medium text-gray-800">Other</div>
            </button>
          </div>
        </div>
      )}

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 p-4 space-y-3">
        <div className="flex gap-3">
          <Button 
            className="flex-1 bg-success py-3 hover:bg-green-600" 
            onClick={() => setLocation('/report')}
          >
            <FileText className="mr-2 h-4 w-4" />
            View Report
          </Button>
        </div>
        <Button 
          onClick={handleNewJob}
          variant="outline"
          className="w-full py-3 font-medium border-red-300 text-red-600 hover:bg-red-50"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Cancel Report
        </Button>
      </div>

      {/* Custom Item Modal */}
      <Modal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        title="Custom Item"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item Name
            </label>
            <Input
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
              placeholder="Enter item name"
              className="text-base"
              onKeyPress={(e) => e.key === 'Enter' && handleCustomItemAdd()}
            />
          </div>
          
          <Button 
            onClick={handleCustomItemAdd}
            className="w-full bg-primary py-3 font-semibold hover:bg-blue-600"
            disabled={!customItemName.trim()}
          >
            Add Item
          </Button>
        </div>
      </Modal>

      {/* Cancel Report Confirmation Dialog */}
      <AlertDialog open={showNewReportConfirm} onOpenChange={setShowNewReportConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Report?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the current report and all test results from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling || showCancelSuccess}>Keep Report</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmNewReport} 
              disabled={isCancelling || showCancelSuccess}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCancelling ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Deleting...
                </>
              ) : showCancelSuccess ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4 text-green-400" />
                  Report Cancelled
                </>
              ) : (
                "Yes, Cancel Report"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
