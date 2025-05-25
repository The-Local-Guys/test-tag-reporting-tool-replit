import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, AlertCircle, Save, XCircle } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useLocation } from 'wouter';
import type { InsertTestResult } from '@shared/schema';

const failureReasons = [
  { value: 'vision', label: 'Vision Inspection', icon: '👁️' },
  { value: 'earth', label: 'Earth Continuity', icon: '🔌' },
  { value: 'insulation', label: 'Insulation Resistance', icon: '🛡️' },
  { value: 'polarity', label: 'Polarity', icon: '🔄' },
  { value: 'other', label: 'Other', icon: '❓' },
];

const actionOptions = [
  { value: 'given', label: 'Given to Site Contact', icon: '👤' },
  { value: 'removed', label: 'Removed from Site', icon: '🗑️' },
];

export default function FailureDetails() {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [testData, setTestData] = useState<Omit<InsertTestResult, 'sessionId'> | null>(null);
  const { addResult, isAddingResult } = useSession();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const stored = sessionStorage.getItem('pendingTestResult');
    if (stored) {
      setTestData(JSON.parse(stored));
    } else {
      setLocation('/items');
    }
  }, [setLocation]);

  const handleSaveFailure = () => {
    if (!testData || !selectedReason || !selectedAction) return;

    const completeTestData: Omit<InsertTestResult, 'sessionId'> = {
      ...testData,
      failureReason: selectedReason,
      actionTaken: selectedAction,
      notes: notes.trim() || null,
    };

    addResult(completeTestData);
    sessionStorage.removeItem('pendingTestResult');
    setLocation('/items');
  };

  if (!testData) {
    return (
      <div className="mobile-container flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-gray-500">Loading failure details...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container">
      {/* Header */}
      <div className="bg-error text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setLocation(`/test?item=${encodeURIComponent(testData.itemName)}&type=${testData.itemType}`)}
            className="text-white hover:text-red-200 p-1 rounded-lg hover:bg-red-700 transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-xl font-semibold">Failure Details</h1>
            <div className="text-red-100 text-sm">Item Failed Testing</div>
          </div>
          <div className="w-8"></div>
        </div>
      </div>

      {/* Failed Item Preview */}
      <div className="bg-red-50 border-b border-red-100 p-4">
        <div className="flex items-center space-x-4">
          <div className="text-4xl">⚡</div>
          <div className="flex-1">
            <div className="font-semibold text-lg text-gray-800">{testData.itemName}</div>
            <div className="text-gray-600 text-sm">{testData.location}</div>
          </div>
          <div className="bg-error text-white px-3 py-1 rounded-full text-sm font-medium">
            <XCircle className="inline h-3 w-3 mr-1" />
            FAILED
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-4 space-y-6 pb-24">
        {/* Failure Reason */}
        <div className="space-y-3">
          <Label className="flex items-center text-sm font-medium text-gray-700">
            <AlertCircle className="mr-2 h-4 w-4" />
            Reason for Failure
          </Label>
          <div className="space-y-2">
            {failureReasons.map((reason, index) => (
              <button
                key={reason.value}
                type="button"
                onClick={() => setSelectedReason(reason.value)}
                className={`w-full p-3 border-2 rounded-lg font-medium text-left transition-all touch-button slide-up ${
                  selectedReason === reason.value
                    ? 'border-primary bg-primary text-white wiggle'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                style={{animationDelay: `${index * 0.1}s`}}
              >
                <span className="mr-2 float" style={{animationDelay: `${index * 0.15}s`}}>{reason.icon}</span>
                {reason.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Taken */}
        <div className="space-y-3">
          <Label className="flex items-center text-sm font-medium text-gray-700">
            📋 Action Taken
          </Label>
          <div className="space-y-2">
            {actionOptions.map((action) => (
              <button
                key={action.value}
                type="button"
                onClick={() => setSelectedAction(action.value)}
                className={`w-full p-3 border-2 rounded-lg font-medium text-left transition-all touch-button ${
                  selectedAction === action.value
                    ? 'border-warning bg-warning text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Additional Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="flex items-center text-sm font-medium text-gray-700">
            📝 Additional Notes (Optional)
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter any additional details about the failure..."
            rows={3}
            className="text-base resize-none"
          />
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 p-4">
        <Button 
          onClick={handleSaveFailure}
          className="w-full bg-primary text-white py-4 text-lg font-semibold touch-button"
          disabled={!selectedReason || !selectedAction || isAddingResult}
        >
          <Save className="mr-2 h-5 w-5" />
          {isAddingResult ? 'Saving...' : 'Save & Continue'}
        </Button>
      </div>
    </div>
  );
}
