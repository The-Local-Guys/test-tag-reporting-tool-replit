import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useLocation, useSearch } from 'wouter';
import type { InsertTestResult } from '@shared/schema';

const classificationOptions = [
  { value: 'class1', label: 'Class 1' },
  { value: 'class2', label: 'Class 2' },
  { value: 'epod', label: 'EPOD' },
  { value: 'rcd', label: 'RCD' },
];

export default function TestDetails() {
  const [selectedClass, setSelectedClass] = useState('class1');
  const [currentItem, setCurrentItem] = useState<{name: string, type: string} | null>(null);
  const { currentLocation, addResult, isAddingResult } = useSession();
  const [, setLocation] = useLocation();
  const search = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const item = params.get('item');
    const type = params.get('type');
    if (item && type) {
      setCurrentItem({ name: decodeURIComponent(item), type });
    }
  }, [search]);

  const form = useForm({
    defaultValues: {
      location: currentLocation,
    },
  });

  const handleTestResult = (result: 'pass' | 'fail') => {
    if (!currentItem) return;

    const testData: Omit<InsertTestResult, 'sessionId'> = {
      itemName: currentItem.name,
      itemType: currentItem.type,
      location: form.getValues('location') || currentLocation,
      classification: selectedClass,
      result,
      failureReason: null,
      actionTaken: null,
      notes: null,
    };

    if (result === 'pass') {
      addResult(testData);
      setLocation('/items');
    } else {
      // Store test data in session storage for failure details page
      sessionStorage.setItem('pendingTestResult', JSON.stringify(testData));
      setLocation('/failure');
    }
  };

  if (!currentItem) {
    return (
      <div className="mobile-container flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-gray-500">Loading test details...</div>
        </div>
      </div>
    );
  }

  const getItemIcon = (type: string) => {
    const icons: Record<string, string> = {
      'iec-lead': '🔌',
      'computer': '💻',
      'power-board': '🔌',
      'phone-charger': '📱',
      'laptop-charger': '🔋',
      'ac-adaptor': '🔌',
      'extension-cord': '🔗',
      'double-adaptor': '🔌',
      'custom': '⚡',
    };
    return icons[type] || '⚡';
  };

  return (
    <div className="mobile-container">
      {/* Header */}
      <div className="bg-primary text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setLocation('/items')}
            className="text-white hover:text-blue-200 p-1 rounded-lg hover:bg-primary-dark transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-xl font-semibold">Test Details</h1>
            <div className="text-blue-100 text-sm">{currentItem.name}</div>
          </div>
          <div className="w-8"></div>
        </div>
      </div>

      {/* Item Preview */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          <div className="text-4xl">{getItemIcon(currentItem.type)}</div>
          <div>
            <div className="font-semibold text-lg">{currentItem.name}</div>
            <div className="text-gray-500 text-sm">Equipment Testing</div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-4 space-y-6 pb-24">
        {/* Location Input */}
        <div className="space-y-2">
          <Label htmlFor="location" className="flex items-center text-sm font-medium text-gray-700">
            📍 Location
          </Label>
          <Input
            id="location"
            placeholder="Enter location (e.g., Office - Ground Floor)"
            {...form.register('location')}
            className="text-base"
          />
          <div className="text-xs text-gray-500">
            This will be remembered for the next item
          </div>
        </div>

        {/* Classification */}
        <div className="space-y-3">
          <Label className="flex items-center text-sm font-medium text-gray-700">
            🏷️ Classification
          </Label>
          <div className="grid grid-cols-2 gap-3">
            {classificationOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedClass(option.value)}
                className={`p-3 border-2 rounded-lg font-medium transition-all touch-button ${
                  selectedClass === option.value
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Test Result */}
        <div className="space-y-3">
          <Label className="flex items-center text-sm font-medium text-gray-700">
            ✅ Test Result
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <Button
              type="button"
              onClick={() => handleTestResult('pass')}
              className="bg-success text-white p-6 h-auto text-lg font-semibold flex flex-col items-center justify-center hover:bg-green-600 touch-button"
              disabled={isAddingResult}
            >
              <CheckCircle className="h-8 w-8 mb-2" />
              PASS
            </Button>
            <Button
              type="button"
              onClick={() => handleTestResult('fail')}
              className="bg-error text-white p-6 h-auto text-lg font-semibold flex flex-col items-center justify-center hover:bg-red-600 touch-button"
              disabled={isAddingResult}
            >
              <XCircle className="h-8 w-8 mb-2" />
              FAIL
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
