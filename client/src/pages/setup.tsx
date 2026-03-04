import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertTestSessionSchema } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clipboard, ArrowRight, AlertCircle, Settings } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { WorkflowProgressBar, type ServiceType } from '@/components/workflow-progress-bar';
import { useSession } from '@/hooks/use-session';
import { useAuth } from '@/hooks/useAuth';
import { useSpaNavigation } from '@/hooks/useSpaNavigation';
import { useQuery } from '@tanstack/react-query';
import type { InsertTestSession, CustomFormType } from '@shared/schema';
import logoPath from '@assets/The Local Guys - with plug wide boarder - png seek.png';
import { CustomAssetNumbersModal } from '@/components/CustomAssetNumbersModal';

/**
 * Initial setup page for creating new testing sessions
 * Collects client information, technician details, and service type selection
 * Creates the testing context for either electrical or emergency exit light testing
 */
export default function Setup() {
  const { createSession, isCreatingSession, clearSession, sessionId, customStartingNumbers, saveCustomStartingNumbers, resetCustomStartingNumbers, pendingCustomStartingNumbers } = useSession();
  const { user } = useAuth();
  const { navigate } = useSpaNavigation();
  const [isNavigating, setIsNavigating] = useState(false);
  const [isCustomAssetModalOpen, setIsCustomAssetModalOpen] = useState(false);
  const [rcdStartingNumber, setRcdStartingNumber] = useState<string>('');

  // Track the initial sessionId to distinguish between existing sessions and newly created ones
  const [initialSessionId] = useState(() => sessionId);
  const [sessionCreationStarted, setSessionCreationStarted] = useState(false);

  const [modalCustomNumbers, setModalCustomNumbers] = useState(() => {
    if (!sessionId && pendingCustomStartingNumbers) {
      return pendingCustomStartingNumbers;
    }
    return customStartingNumbers;
  });
  
  // Fetch custom form types (available for all service types)
  const { data: customFormTypes } = useQuery<CustomFormType[]>({
    queryKey: ['/api/custom-forms'],
  });
  
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
      technicianName: (user as any)?.fullName || '',
      clientName: '',
      siteContact: '',
      address: '',
      country: 'australia',
    },
  });

  // Setup page no longer handles unfinished report detection - moved to service selection

  const onSubmit = (data: InsertTestSession) => {
    // Don't clear session here - let createSession handle the setup
    // This preserves unfinished detection when users navigate back
    
    // Get the selected service type from session storage
    const selectedService = sessionStorage.getItem('selectedService') || 'electrical';
    
    // Validate fire testing checkbox
    if (selectedService === 'fire_testing' && !data.technicianLicensed) {
      form.setError('technicianLicensed', {
        type: 'manual',
        message: 'You must confirm that you are trained and licensed to perform fire testing'
      });
      return;
    }
    
    // Mark that we've started creating a session
    setSessionCreationStarted(true);
    
    createSession({
      ...data,
      serviceType: selectedService as 'electrical' | 'emergency_exit_light' | 'fire_testing' | 'rcd_reporting' | 'microwave_leakage',
      country: data.country,
      // Fire testing specific fields
      ...(selectedService === 'fire_testing' && {
        technicianLicensed: data.technicianLicensed,
        complianceStandard: data.country === 'newzealand' ? 'NZS_4503_NZ' : 'AS_1851_AU'
      }),
      // RCD custom starting asset number
      ...(selectedService === 'rcd_reporting' && rcdStartingNumber && {
        startingAssetNumber: parseInt(rcdStartingNumber, 10)
      })
    });
  };

  // Wait for session to be created, then navigate with delay to ensure data is loaded
  useEffect(() => {
    // Only navigate if:
    // 1. We have a sessionId
    // 2. Session creation finished (isCreatingSession === false)
    // 3. We haven't started navigating yet
    // 4. We explicitly started creating a session (sessionCreationStarted)
    // 5. The sessionId is different from the initial one (meaning a new session was created)
    if (sessionId && isCreatingSession === false && !isNavigating && sessionCreationStarted && sessionId !== initialSessionId) {
      setIsNavigating(true);
      
      // Add a delay to ensure session data is fully loaded before navigating
      setTimeout(() => {
        navigate('/items');
      }, 800); // 800ms delay to ensure session data is ready
    }
  }, [sessionId, isCreatingSession, navigate, isNavigating, sessionCreationStarted, initialSessionId]);



  // Show loading screen when creating session or navigating
  if (isCreatingSession || isNavigating) {
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
              Creating Session...
            </p>
            <p className="text-sm text-gray-500">
              Setting up your testing environment
            </p>
          </div>
        </div>
      </div>
    );
  }

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
              {(() => {
                const service = sessionStorage.getItem('selectedService');
                if (service === 'emergency_exit_light') return 'Emergency Exit Light Testing';
                if (service === 'fire_testing') return 'Fire Equipment Testing';
                if (service === 'rcd_reporting') return 'RCD Reporting';
                if (service === 'microwave_leakage') return 'Microwave Leakage Testing';
                return 'Electrical Test & Tag';
              })()}
            </h1>
            <div className="text-blue-100 text-sm mt-1">Client Setup</div>
          </div>
          <div className="flex items-center gap-3">
            <Clipboard className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Workflow Progress Bar */}
      <WorkflowProgressBar 
        serviceType={(sessionStorage.getItem('selectedService') || 'electrical') as ServiceType} 
        currentStep="setup" 
      />

      {/* Form Content */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6 pb-24">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="testDate">Test Date</Label>
              {/* Custom Asset Numbers Button - Only for Electrical Test & Tag */}
              {sessionStorage.getItem('selectedService') === 'electrical' && (
                <Button 
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCustomAssetModalOpen(true)}
                  className="text-xs"
                  data-testid="button-custom-asset-numbers"
                >
                  <Settings className="mr-1 h-3.5 w-3.5" />
                  Custom Asset Numbers
                </Button>
              )}
            </div>
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

          {/* Country Selection */}
          <div className="space-y-3">
            <Label>Country</Label>
            <RadioGroup
              defaultValue="australia"
              onValueChange={(value) => form.setValue('country', value as 'australia' | 'newzealand' | 'national_client' | 'reflections')}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="australia" id="australia" />
                <Label htmlFor="australia">
                  Australia ({sessionStorage.getItem('selectedService') === 'electrical' ? 'AS/NZS 3760' :
                             sessionStorage.getItem('selectedService') === 'rcd_reporting' ? 'AS/NZS 3760' : 
                             sessionStorage.getItem('selectedService') === 'microwave_leakage' ? 'AS/NZS 60335.2.25' : 'AS 1851'})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="newzealand" id="newzealand" />
                <Label htmlFor="newzealand">
                  New Zealand ({sessionStorage.getItem('selectedService') === 'electrical' ? 'AS/NZS 3760' :
                                sessionStorage.getItem('selectedService') === 'rcd_reporting' ? 'AS/NZS 3760' : 
                                sessionStorage.getItem('selectedService') === 'microwave_leakage' ? 'AS/NZS 60335.2.25' : 'NZS 4503:2005'})
                </Label>
              </div>
              
              {/* Show ARA Compliance only for Electrical Testing */}
              {sessionStorage.getItem('selectedService') === 'electrical' && (
                <>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="national_client" id="national_client" />
                    <Label htmlFor="national_client">ARA Compliance</Label>
                  </div>
                </>
              )}

              {/* Show Reflections only for Electrical Testing and RCD*/}
              {(sessionStorage.getItem('selectedService') === 'electrical' || sessionStorage.getItem('selectedService') === 'rcd_reporting') && (
                <>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="reflections" id="reflections" />
                    <Label htmlFor="reflections">Reflections</Label>
                  </div>
                </>
              )}

              {/* Show Custom Form Types only for Electrical Testing */}
              {sessionStorage.getItem('selectedService') === 'electrical' && (
                <>
                  {/* Custom Form Types */}
                  {customFormTypes && customFormTypes.map((formType) => (
                    <div key={formType.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={`custom_${formType.id}`} id={`custom_${formType.id}`} />
                      <Label htmlFor={`custom_${formType.id}`}>{formType.name}</Label>
                    </div>
                  ))}
                </>
              )}
            </RadioGroup>
          </div>

          {/* Fire Testing Licensing Checkbox */}
          {sessionStorage.getItem('selectedService') === 'fire_testing' && (
            <div className="space-y-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="technicianLicensed"
                  checked={form.watch('technicianLicensed') || false}
                  onCheckedChange={(checked) => {
                    form.setValue('technicianLicensed', checked === true);
                    if (checked) {
                      form.clearErrors('technicianLicensed');
                    }
                  }}
                  data-testid="checkbox-technician-licensed"
                />
                <div className="space-y-1">
                  <Label htmlFor="technicianLicensed" className="text-sm font-medium leading-tight">
                    I confirm that I will only perform testing for services I am trained and licensed to complete fire testing on
                  </Label>
                  <p className="text-xs text-orange-700">
                    This confirmation is required for compliance and will be recorded in the admin system
                  </p>
                </div>
              </div>
              {form.formState.errors.technicianLicensed && (
                <p className="text-sm text-red-600 font-medium">{form.formState.errors.technicianLicensed.message}</p>
              )}
            </div>
          )}

          {/* RCD Starting Asset Number */}
          {sessionStorage.getItem('selectedService') === 'rcd_reporting' && (
            <div className="space-y-2">
              <Label htmlFor="rcdStartingNumber">Starting Asset Number (Optional)</Label>
              <Input
                id="rcdStartingNumber"
                type="number"
                inputMode="numeric"
                min="1"
                value={rcdStartingNumber}
                onChange={(e) => setRcdStartingNumber(e.target.value)}
                placeholder="Default: 1"
                className="text-base"
                data-testid="input-rcd-starting-number"
              />
              <p className="text-xs text-gray-500">
                Set a custom starting number to avoid duplicate asset numbers across reports for the same client.
              </p>
            </div>
          )}

        </div>
      </form>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 p-4">
        {/* Start Testing Button */}
        <Button 
          type="submit" 
          onClick={form.handleSubmit(onSubmit)}
          className="w-full bg-primary text-white py-4 text-lg font-semibold touch-button"
          disabled={isCreatingSession}
          data-testid="button-start-testing"
        >
          {isCreatingSession ? 'Creating Session...' : 'Start Testing'}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

      {/* Custom Asset Numbers Modal */}
      <CustomAssetNumbersModal
        isOpen={isCustomAssetModalOpen}
        onClose={() => setIsCustomAssetModalOpen(false)}
        currentCustomNumbers={modalCustomNumbers}
        onSave={(numbers) => {
          setModalCustomNumbers(numbers);
          saveCustomStartingNumbers(numbers);
        }}
        onReset={() => {
          setModalCustomNumbers({});
          resetCustomStartingNumbers();
        }}
      />

    </div>
  );
}
