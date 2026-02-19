import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Edit2, FileText, Plus, RotateCcw, Search } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { WorkflowProgressBar, type ServiceType } from '@/components/workflow-progress-bar';
import { SaveStatusIndicator } from '@/components/save-status-indicator';
import type { Environment } from '@shared/schema';
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";

// Type for custom form items parsed from CSV
type CustomFormItem = {
  code: string;
  itemName: string;
};
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

const rcdItems: Item[] = [
  { type: 'fixed-rcd', name: 'Fixed RCD', icon: '⚡', description: 'Fixed Residual Current Device' },
  { type: 'portable-rcd', name: 'Portable RCD', icon: '🔌', description: 'Portable Residual Current Device' },
];

const microwaveItems: Item[] = [
  { type: 'microwave-oven', name: 'Microwave Oven', icon: '📡', description: 'Commercial/Workplace Microwave Oven' },
];

const microwaveBrands = [
  'Samsung',
  'LG',
  'Panasonic',
  'Sharp',
  'Whirlpool',
  'GE',
  'Kenmore',
  'Bosch',
  'Electrolux',
  'Hitachi',
  'Toshiba',
  'Siemens',
  'Miele',
  'KitchenAid',
  'Frigidaire',
  'Other',
];

export default function ItemSelection() {
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { sessionData, currentLocation, setCurrentLocation, clearSession, sessionId, isLoading: isLoadingSession, submitBatch, isSubmittingBatch } = useSession();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Type guard for user object
  const typedUser = user as { fullName?: string; role?: string } | undefined;
  const userRole = typedUser?.role;

  // Initialize environment selection from sessionStorage (global, like frequency)
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>(() => {
    return sessionStorage.getItem('lastSelectedEnvironment') || 'default';
  });

  // Initialize microwave brand selection from sessionStorage
  const [selectedMicrowaveBrand, setSelectedMicrowaveBrand] = useState<string>(() => {
    return sessionStorage.getItem('selectedMicrowaveBrand') || '';
  });

  // State for custom microwave brand input (when "Other" is selected)
  const [customMicrowaveBrand, setCustomMicrowaveBrand] = useState('');

  // Set initial loading to false after a brief delay to ensure smooth transition
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 800); // Slightly longer than admin dashboard delay
    
    return () => clearTimeout(timer);
  }, []);

  // Save selected environment to sessionStorage whenever it changes (global persistence)
  useEffect(() => {
    if (selectedEnvironmentId) {
      sessionStorage.setItem('lastSelectedEnvironment', selectedEnvironmentId);
    }
  }, [selectedEnvironmentId]);

  // Save selected microwave brand to sessionStorage whenever it changes
  useEffect(() => {
    if (selectedMicrowaveBrand) {
      sessionStorage.setItem('selectedMicrowaveBrand', selectedMicrowaveBrand);
    }
  }, [selectedMicrowaveBrand]);

  // Get the selected service type and country
  const selectedService = sessionData?.session?.serviceType || sessionStorage.getItem('selectedService') || 'electrical';
  const country = sessionData?.session?.country;
  const isNationalClient = country === 'national_client';
  
  // Check if country is a custom form type (format: "custom_123")
  const isCustomFormType = country?.startsWith('custom_');
  const customFormTypeId = isCustomFormType && country ? parseInt(country.replace('custom_', '')) : null;
  
  // Fetch custom form items if custom form type is selected
  const { data: customFormItems } = useQuery<CustomFormItem[]>({
    queryKey: ['/api/custom-forms', customFormTypeId, 'items'],
    queryFn: async () => {
      if (!customFormTypeId) return [];
      const response = await fetch(`/api/custom-forms/${customFormTypeId}/items`);
      if (!response.ok) throw new Error('Failed to fetch custom form items');
      return response.json();
    },
    enabled: !!customFormTypeId,
  });
  
  // Fetch environments for the current user filtered by service type
  const { data: environments } = useQuery<Environment[]>({
    queryKey: ["/api/environments"],
    select: (data) => data.filter(env => env.serviceType === selectedService),
  });

  // Get items based on selected environment or default predefined items
  const defaultPredefinedItems = selectedService === 'emergency_exit_light' ? emergencyItems : 
                                  selectedService === 'fire_testing' ? fireItems :
                                  selectedService === 'rcd_reporting' ? rcdItems :
                                  selectedService === 'microwave_leakage' ? microwaveItems : electricalItems;
  
  const selectedEnvironment = environments?.find(env => env.id.toString() === selectedEnvironmentId);
  const predefinedItems = selectedEnvironment && Array.isArray(selectedEnvironment.items) && selectedEnvironment.items.length > 0
    ? selectedEnvironment.items
    : defaultPredefinedItems;

  // Filter ARA Compliance items based on search query
  const filteredNationalItems = nationalClientItems.filter(item => {
    const query = searchQuery.toLowerCase();
    return item.code.toLowerCase().includes(query) || 
           item.name.toLowerCase().includes(query);
  });
  
  // Filter custom form items based on search query
  const filteredCustomFormItems = customFormItems?.filter(item => {
    const query = searchQuery.toLowerCase();
    return item.code.toLowerCase().includes(query) || 
           item.itemName.toLowerCase().includes(query);
  }) || [];

  const handleItemSelect = (itemType: string, itemName: string, classification?: string) => {
    // Route to different test pages based on service type
    const testRoute = selectedService === 'emergency_exit_light' ? '/emergency-test' :
                     selectedService === 'fire_testing' ? '/fire-test' :
                     selectedService === 'rcd_reporting' ? '/rcd-test' :
                     selectedService === 'microwave_leakage' ? '/microwave-test' : '/test';

    const classParam = classification ? `&classification=${encodeURIComponent(classification)}` : '';
    setLocation(`${testRoute}?item=${encodeURIComponent(itemName)}&type=${itemType}${classParam}`);
  };

  const handleCustomItemAdd = () => {
    if (customItemName.trim()) {
      // Format custom items for ARA Compliance and custom forms as "532 Other (custom_item_name)"
      const itemName = (isNationalClient || isCustomFormType)
        ? `532 Other (${customItemName.trim()})`
        : customItemName.trim();
      
      handleItemSelect('custom', itemName);
      setCustomItemName('');
      setIsCustomModalOpen(false);
    }
  };

  const handleViewReport = () => {
    // Navigate to report preview without submitting batch
    // This allows users to preview the report, download PDF, and return to add more results
    // Batch submission only happens when clicking "Finish Job" on the report preview page
    setLocation('/report');
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
               selectedService === 'fire_testing' ? 'Fire Equipment Selection' :
               selectedService === 'microwave_leakage' ? 'Microwave Equipment Selection' : 'Select Item to Test'}
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

      {/* Workflow Progress Bar */}
      <WorkflowProgressBar
        serviceType={selectedService as ServiceType}
        currentStep="items"
      />
      <div className="flex justify-center py-1">
        <SaveStatusIndicator />
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

      {/* Environment Selection - Only for Electrical Testing and Technician Role */}
      {!isNationalClient && !isCustomFormType && selectedService === 'electrical' && userRole === 'technician' && (
        <div className="bg-blue-50 border-b border-blue-100 p-4">
          <div className="space-y-2">
            <div className="text-sm text-gray-600 text-center">Select Environment:</div>
            <Select
              value={selectedEnvironmentId}
              onValueChange={setSelectedEnvironmentId}
            >
              <SelectTrigger className="bg-white" data-testid="select-environment">
                <SelectValue placeholder="Default Items" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default" data-testid="option-default-environment">
                  Default Items
                </SelectItem>
                {environments && environments.length > 0 && environments.map((env) => (
                  <SelectItem key={env.id} value={env.id.toString()} data-testid={`option-environment-${env.id}`}>
                    {env.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-500 text-center">
              {selectedEnvironmentId === 'default' 
                ? 'Using default item list' 
                : `Using "${selectedEnvironment?.name}" items`}
            </div>
          </div>
        </div>
      )}

      {/* Item Selection - ARA Compliance/Custom Form Search or Regular Grid */}
      {isNationalClient || isCustomFormType ? (
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
          <div className="space-y-2 max-h-[40vh] overflow-y-auto mb-4">
            {isNationalClient && filteredNationalItems.length > 0 ? (
              filteredNationalItems.slice(0, 50).map((item) => (
                <button
                  key={item.code}
                  onClick={() => handleItemSelect(item.item_type, `${item.code} - ${item.name}`)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-3 text-left hover:border-primary hover:bg-blue-50 transition-all"
                  data-testid={`button-national-item-${item.code}`}
                >
                  <div className="font-medium text-gray-800">
                    {item.code} - {item.name}
                  </div>
                </button>
              ))
            ) : isCustomFormType && filteredCustomFormItems.length > 0 ? (
              filteredCustomFormItems.map((item) => {
                // Convert item name to lowercase and replace spaces with dashes for itemType
                const itemType = item.itemName.toLowerCase().replace(/\s+/g, '-');
                return (
                  <button
                    key={`${item.code}-${item.itemName}`}
                    onClick={() => handleItemSelect(itemType, `${item.code} - ${item.itemName}`)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-left hover:border-primary hover:bg-blue-50 transition-all"
                    data-testid={`button-custom-form-item-${item.code}`}
                  >
                    <div className="font-medium text-gray-800">
                      {item.code} - {item.itemName}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No items found' : 'Start typing to search...'}
              </div>
            )}
          </div>

          {/* Custom Item Button for ARA Compliance and Custom Forms */}
          <button
            onClick={() => setIsCustomModalOpen(true)}
            className="w-full bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-dashed border-gray-400 rounded-lg p-4 text-center hover:from-blue-50 hover:to-blue-100 hover:border-primary transition-all"
            data-testid="button-custom-item-national"
          >
            <div className="flex items-center justify-center gap-2">
              <Plus className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-800">Other - Custom Item</span>
            </div>
          </button>
        </div>
      ) : selectedService === 'microwave_leakage' ? (
        <div className="p-4 pb-24">
          <div className="mb-6 text-center">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Select Microwave Brand</h2>
            <p className="text-sm text-gray-600">Choose the brand to test</p>
          </div>
          
          <div className="space-y-4 max-w-md mx-auto">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Microwave Brand</label>
              <Select
                value={selectedMicrowaveBrand}
                onValueChange={(value) => {
                  setSelectedMicrowaveBrand(value);
                  // Clear custom brand input when switching away from "Other"
                  if (value !== 'Other') {
                    setCustomMicrowaveBrand('');
                  }
                }}
              >
                <SelectTrigger className="bg-white" data-testid="select-microwave-brand">
                  <SelectValue placeholder="Select a brand..." />
                </SelectTrigger>
                <SelectContent>
                  {microwaveBrands.map((brand) => (
                    <SelectItem key={brand} value={brand} data-testid={`option-brand-${brand.toLowerCase().replace(/\s+/g, '-')}`}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500">
                {selectedMicrowaveBrand 
                  ? `Selected: ${selectedMicrowaveBrand}` 
                  : 'Please select a microwave brand'}
              </div>
            </div>

            {/* Custom brand input field when "Other" is selected */}
            {selectedMicrowaveBrand === 'Other' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Enter Brand Name</label>
                <Input
                  value={customMicrowaveBrand}
                  onChange={(e) => setCustomMicrowaveBrand(e.target.value)}
                  placeholder="Enter microwave brand name..."
                  className="bg-white"
                  data-testid="input-custom-microwave-brand"
                />
              </div>
            )}

            {/* Warning message when Panasonic is selected or typed in custom field */}
            {(selectedMicrowaveBrand === 'Panasonic' || 
              (selectedMicrowaveBrand === 'Other' && customMicrowaveBrand.toLowerCase().includes('panasonic'))) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4" data-testid="warning-panasonic">
                <div className="flex items-start gap-2">
                  <span className="text-red-600 text-xl">⚠️</span>
                  <div>
                    <p className="text-sm font-medium text-red-800">Cannot Test Panasonic</p>
                    <p className="text-xs text-red-600 mt-1">We are unable to perform testing on Panasonic microwave ovens. Please select a different brand.</p>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={() => {
                const brandName = selectedMicrowaveBrand === 'Other' 
                  ? customMicrowaveBrand 
                  : selectedMicrowaveBrand;
                handleItemSelect('microwave-oven', `${brandName} Microwave`);
              }}
              disabled={
                !selectedMicrowaveBrand || 
                selectedMicrowaveBrand === 'Panasonic' ||
                (selectedMicrowaveBrand === 'Other' && !customMicrowaveBrand.trim()) ||
                (selectedMicrowaveBrand === 'Other' && customMicrowaveBrand.toLowerCase().includes('panasonic'))
              }
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed py-6 text-lg"
              data-testid="button-start-microwave-testing"
            >
              Start Testing
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 pb-24">
          <div className="grid grid-cols-2 gap-3">
            {predefinedItems.map((item, index) => (
              <button
                key={`${item.type}-${index}`}
                onClick={() => handleItemSelect(item.type, item.name, (item as any).classification)}
                className="bg-white border-2 border-gray-200 rounded-xl p-4 text-center hover:border-primary hover:bg-blue-50 transition-all touch-button"
                data-testid={`button-item-${item.type}`}
              >
                <div className="flex justify-center items-center mb-2 h-12" data-testid={`icon-item-${item.type}`}>
                  {typeof item.icon === 'string' ? (
                    item.icon?.startsWith('data:image/') ? (
                      <img 
                        src={item.icon} 
                        alt={item.name} 
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <span className="text-3xl">{item.icon || "📦"}</span>
                    )
                  ) : (
                    item.icon
                  )}
                </div>
                <div className="font-medium text-gray-800">{item.name}</div>
              </button>
            ))}

            {/* Hide "Other" button for RCD Reporting */}
            {selectedService !== 'rcd_reporting' && (
              <button
                onClick={() => setIsCustomModalOpen(true)}
                className="bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-dashed border-gray-400 rounded-xl p-4 text-center hover:from-blue-50 hover:to-blue-100 hover:border-primary transition-all touch-button"
              >
                <div className="text-3xl mb-2">
                  <Plus className="h-8 w-8 mx-auto text-gray-600" />
                </div>
                <div className="font-medium text-gray-800">Other</div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 p-4 space-y-3">
        <div className="flex gap-3">
          <Button 
            className="flex-1 bg-success py-3 hover:bg-green-600" 
            onClick={handleViewReport}
          >
            <FileText className="mr-2 h-4 w-4" />
            View Report
          </Button>
        </div>
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
    </div>
  );
}
