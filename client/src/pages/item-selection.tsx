import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Edit2, FileText, CheckCircle, Plus, RotateCcw, LogOut } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

const predefinedItems = [
  { type: 'iec-lead', name: 'IEC Lead', icon: '🔌', description: 'Power Cord' },
  { type: 'computer', name: 'Computer', icon: '💻', description: 'Desktop/Laptop' },
  { type: 'power-board', name: 'Power Board', icon: '▬', description: 'Multi Outlet' },
  { type: 'phone-charger', name: 'Phone Charger', icon: '🔋', description: 'Mobile Charger' },
  { type: 'laptop-charger', name: 'Laptop Charger', icon: '💻', description: 'AC Adapter' },
  { type: 'ac-adaptor', name: 'AC Adaptor', icon: '🔌', description: 'Power Supply' },
  { type: 'extension-cord', name: 'Extension Cord', icon: '➖', description: 'Power Extension' },
  { type: 'double-adaptor', name: 'Double Adaptor', icon: '⚡', description: 'Dual Outlet' },
  { type: 'power-pack', name: 'Power Pack', icon: '⬛', description: 'Portable Power' },
];

export default function ItemSelection() {
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const { sessionData, currentLocation, setCurrentLocation } = useSession();
  const { logout, isLoggingOut } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleItemSelect = (itemType: string, itemName: string) => {
    setLocation(`/test?item=${encodeURIComponent(itemName)}&type=${itemType}`);
  };

  const handleCustomItemAdd = () => {
    if (customItemName.trim()) {
      handleItemSelect('custom', customItemName.trim());
      setCustomItemName('');
      setIsCustomModalOpen(false);
    }
  };

  const handleNewJob = () => {
    // Navigate to setup page to start a new job
    setLocation('/');
    toast({
      title: "New Job Started",
      description: "Ready to begin a fresh test session.",
    });
  };

  const summary = sessionData?.summary || {
    totalItems: 0,
    passedItems: 0,
    failedItems: 0,
    passRate: 0,
  };

  return (
    <div className="mobile-container">
      {/* Header */}
      <div className="bg-primary text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Select Item to Test</h1>
            <div className="text-blue-100 text-sm">
              {sessionData?.session?.clientName || 'Loading...'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-blue-100 text-xs">Items Tested</div>
            <div className="text-2xl font-bold">{summary.totalItems}</div>
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

      {/* Item Selection Grid */}
      <div className="p-4 pb-24">
        <div className="grid grid-cols-2 gap-3">
          {predefinedItems.map((item) => (
            <button
              key={item.type}
              onClick={() => handleItemSelect(item.type, item.name)}
              className="bg-white border-2 border-gray-200 rounded-xl p-4 text-center hover:border-primary hover:bg-blue-50 transition-all touch-button"
            >
              <div className="text-3xl mb-2">{item.icon}</div>
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

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 p-4 space-y-3">
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1 py-3" 
            onClick={() => setLocation('/report')}
          >
            <FileText className="mr-2 h-4 w-4" />
            View Report
          </Button>
          <Button 
            className="flex-1 bg-success py-3 hover:bg-green-600" 
            onClick={() => setLocation('/report')}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Complete
          </Button>
        </div>
        <Button 
          onClick={handleNewJob}
          variant="outline"
          className="w-full py-3 font-medium border-2 border-primary text-primary hover:bg-primary hover:text-white"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Start New Job
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
    </div>
  );
}
