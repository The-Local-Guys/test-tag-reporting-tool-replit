import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertTestSessionSchema } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clipboard, ArrowRight, AlertCircle } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import type { InsertTestSession } from '@shared/schema';
import logoPath from '@assets/The Local Guys - with plug wide boarder - png seek.png';

/**
 * Initial setup page for creating new testing sessions
 * Collects client information, technician details, and service type selection
 * Creates the testing context for either electrical or emergency exit light testing
 */
export default function Setup() {
  const { createSession, isCreatingSession, clearSession, sessionId } = useSession();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showUnfinishedDialog, setShowUnfinishedDialog] = useState(false);
  const [unfinishedSessionId, setUnfinishedSessionId] = useState<string | null>(null);
  
  // Get current date in Australian Central Time
  const getAustralianDate = () => {
    const now = new Date();
    // Convert to Australian Central Time (Adelaide timezone)
    const australianTime = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Adelaide',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
    return australianTime; // Returns YYYY-MM-DD format
  };

  const form = useForm<InsertTestSession>({
    resolver: zodResolver(insertTestSessionSchema),
    defaultValues: {
      testDate: getAustralianDate(),
      technicianName: user?.fullName || '',
      clientName: '',
      siteContact: '',
      address: '',
      country: 'australia',
    },
  });

  // Check for unfinished reports when component mounts
  useEffect(() => {
    const checkUnfinishedReport = () => {
      // Debug: Log all localStorage keys that contain "unfinished"
      console.log('Checking localStorage for unfinished reports...');
      console.log('All localStorage keys:', Object.keys(localStorage));
      Object.keys(localStorage).forEach(key => {
        if (key.includes('unfinished') || key.includes('Unfinished') || key.includes('batchedResults') || key.includes('currentSessionId')) {
          console.log(`Found relevant localStorage key: ${key} = ${localStorage.getItem(key)}`);
        }
      });
      
      // Check for multiple possible key variations
      const isUnfinished = localStorage.getItem('unfinished');
      const storedSessionId = localStorage.getItem('unfinishedSessionId');
      const unfinishedId = localStorage.getItem('unfinishedId'); // Alternative key
      const currentSessionId = localStorage.getItem('currentSessionId');
      
      console.log('Unfinished check:', { isUnfinished, storedSessionId, unfinishedId, currentSessionId });
      
      // Try the new key structure first, then fallback to old
      let targetSessionId = storedSessionId || unfinishedId || currentSessionId;
      
      if ((isUnfinished === 'true' || unfinishedId) && targetSessionId) {
        // Check if there are actually batched results for this session
        const batchedResults = localStorage.getItem(`batchedResults_${targetSessionId}`);
        console.log(`Checking batchedResults_${targetSessionId}:`, batchedResults);
        
        if (batchedResults) {
          try {
            const results = JSON.parse(batchedResults);
            console.log('Parsed batched results:', results);
            if (results.length > 0) {
              console.log('Found unfinished report with results, showing dialog');
              setUnfinishedSessionId(targetSessionId);
              setShowUnfinishedDialog(true);
              return;
            }
          } catch (error) {
            console.warn('Error parsing batched results:', error);
          }
        }
        
        // Clean up invalid unfinished flags
        localStorage.removeItem('unfinished');
        localStorage.removeItem('unfinishedSessionId');
        localStorage.removeItem('unfinishedId');
      }
    };

    // Only check if we're not currently in an active session
    if (!sessionId) {
      checkUnfinishedReport();
    }
  }, [sessionId]);

  const handleContinueReport = () => {
    if (unfinishedSessionId) {
      console.log('Continuing report with session ID:', unfinishedSessionId);
      // Set the session back to the unfinished one
      localStorage.setItem('currentSessionId', unfinishedSessionId);
      setLocation('/items');
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
    setShowUnfinishedDialog(false);
    setUnfinishedSessionId(null);
  };

  const onSubmit = (data: InsertTestSession) => {
    // Don't clear session here - let createSession handle the setup
    // This preserves unfinished detection when users navigate back
    
    // Get the selected service type from session storage
    const selectedService = sessionStorage.getItem('selectedService') || 'electrical';
    
    createSession({
      ...data,
      serviceType: selectedService as 'electrical' | 'emergency_exit_light',
      country: 'australia', // Always default to Australia
    });
    setLocation('/items');
  };

  return (
    <div className="mobile-container">
      {/* Logo */}
      <div className="bg-white p-4 text-center border-b">
        <img 
          src={logoPath} 
          alt="The Local Guys Test & Tag" 
          className="h-16 mx-auto object-contain"
        />
      </div>

      {/* Header */}
      <div className="bg-primary text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              {sessionStorage.getItem('selectedService') === 'emergency_exit_light' 
                ? 'Emergency Exit Light Testing' 
                : 'Electrical Test & Tag'
              }
            </h1>
            <div className="text-blue-100 text-sm mt-1">Step 1 of 3: Client Setup</div>
          </div>
          <div className="flex items-center gap-3">
            <Clipboard className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">1</div>
          <div className="flex-1 h-1 bg-gray-200 mx-2">
            <div className="h-full bg-primary w-1/3"></div>
          </div>
          <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm">2</div>
          <div className="flex-1 h-1 bg-gray-200 mx-2"></div>
          <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm">3</div>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6 pb-24">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="testDate">Test Date</Label>
            <Input
              id="testDate"
              type="date"
              {...form.register('testDate')}
              className="text-base"
            />
            {form.formState.errors.testDate && (
              <p className="text-sm text-error">{form.formState.errors.testDate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="technicianName">Technician Name</Label>
            <Input
              id="technicianName"
              placeholder="Enter your name"
              {...form.register('technicianName')}
              className="text-base"
            />
            {form.formState.errors.technicianName && (
              <p className="text-sm text-error">{form.formState.errors.technicianName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientName">Client Business Name</Label>
            <Input
              id="clientName"
              placeholder="Enter business name"
              {...form.register('clientName')}
              className="text-base"
            />
            {form.formState.errors.clientName && (
              <p className="text-sm text-error">{form.formState.errors.clientName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="siteContact">Site Contact Name</Label>
            <Input
              id="siteContact"
              placeholder="Enter contact person"
              {...form.register('siteContact')}
              className="text-base"
            />
            {form.formState.errors.siteContact && (
              <p className="text-sm text-error">{form.formState.errors.siteContact.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              placeholder="Enter full address"
              rows={3}
              {...form.register('address')}
              className="text-base resize-none"
            />
            {form.formState.errors.address && (
              <p className="text-sm text-error">{form.formState.errors.address.message}</p>
            )}
          </div>


        </div>
      </form>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 p-4">
        <Button 
          type="submit" 
          onClick={form.handleSubmit(onSubmit)}
          className="w-full bg-primary text-white py-4 text-lg font-semibold touch-button"
          disabled={isCreatingSession}
        >
          {isCreatingSession ? 'Creating Session...' : 'Start Testing'}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

      {/* Unfinished Report Dialog */}
      <Dialog open={showUnfinishedDialog} onOpenChange={setShowUnfinishedDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Continue Previous Report?
            </DialogTitle>
            <DialogDescription>
              You have an unfinished report with test results that haven't been submitted yet. 
              Would you like to continue where you left off or start a new report?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleStartNew}
              className="w-full sm:w-auto"
            >
              Start New Report
            </Button>
            <Button
              onClick={handleContinueReport}
              className="w-full sm:w-auto"
            >
              Continue Previous Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
