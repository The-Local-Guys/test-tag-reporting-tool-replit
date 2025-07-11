import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, AlertCircle, Save, XCircle, Camera, X } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useLocation } from 'wouter';
import type { InsertTestResult } from '@shared/schema';

const failureReasons = [
  { value: 'vision', label: 'Visual Inspection', icon: '👁️' },
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
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [testData, setTestData] = useState<Omit<InsertTestResult, 'sessionId'> | null>(null);
  const { addResult, isAddingResult } = useSession();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Prevent navigation during critical operations
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isAddingResult) {
        e.preventDefault();
        e.returnValue = 'Test result is being saved. Are you sure you want to leave?';
        return 'Test result is being saved. Are you sure you want to leave?';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAddingResult]);

  useEffect(() => {
    const stored = sessionStorage.getItem('pendingTestResult');
    if (stored) {
      setTestData(JSON.parse(stored));
    } else {
      setLocation('/items');
    }
  }, [setLocation]);

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Create a canvas to compress the image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Set max dimensions for compression
        const maxWidth = 800;
        const maxHeight = 600;
        
        let { width, height } = img;
        
        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        
        console.log('Photo compressed from', file.size, 'to approximately', Math.round(compressedDataUrl.length * 0.75), 'bytes');
        setCapturedPhoto(compressedDataUrl);
      };
      
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setCapturedPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveFailure = () => {
    if (!testData || !selectedReason || !selectedAction) return;

    const completeTestData: Omit<InsertTestResult, 'sessionId'> = {
      ...testData,
      failureReason: selectedReason,
      actionTaken: selectedAction,
      notes: notes.trim() || null,
      photoData: capturedPhoto,
    };

    console.log('Saving failure with photo data:', {
      ...completeTestData,
      photoData: capturedPhoto ? `Photo included (${Math.round(capturedPhoto.length / 1024)}KB)` : 'No photo'
    });

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
            {failureReasons.map((reason) => (
              <button
                key={reason.value}
                type="button"
                onClick={() => setSelectedReason(reason.value)}
                className={`w-full p-3 border-2 rounded-lg font-medium text-left transition-all touch-button ${
                  selectedReason === reason.value
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{reason.icon}</span>
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

        {/* Additional Comments */}
        <div className="space-y-3">
          <Label className="flex items-center text-sm font-medium text-gray-700">
            📝 Additional Comments (Optional)
          </Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional details about the failure, observations, or specific issues found..."
            className="min-h-[100px] text-base"
          />
          <p className="text-xs text-gray-500">
            These comments will appear in the final report for this failed item.
          </p>
        </div>

        {/* Photo Documentation */}
        <div className="space-y-3">
          <Label className="flex items-center text-sm font-medium text-gray-700">
            📷 Photo Documentation (Optional)
          </Label>
          
          {!capturedPhoto ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Camera className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 mb-4">
                Capture a photo of the failed item for documentation
              </p>
              <Button
                type="button"
                onClick={handleCameraClick}
                className="bg-blue-600 hover:bg-blue-700 text-white touch-button"
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />
            </div>
          ) : (
            <div className="relative border rounded-lg overflow-hidden">
              <img
                src={capturedPhoto}
                alt="Failed item documentation"
                className="w-full h-48 object-cover"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
                Failed Item Photo
              </div>
            </div>
          )}
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
