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
import { Clipboard, ArrowRight, AlertCircle } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useAuth } from '@/hooks/useAuth';
import { useSpaNavigation } from '@/hooks/useSpaNavigation';
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
  const { navigate } = useSpaNavigation();
  
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
    
    createSession({
      ...data,
      serviceType: selectedService as 'electrical' | 'emergency_exit_light' | 'fire_testing',
      country: data.country,
      // Fire testing specific fields
      ...(selectedService === 'fire_testing' && {
        technicianLicensed: data.technicianLicensed,
        complianceStandard: data.country === 'australia' ? 'AS_1851_AU' : 'NZS_4503_NZ'
      })
    });
    navigate('/items');
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
              {(() => {
                const service = sessionStorage.getItem('selectedService');
                if (service === 'emergency_exit_light') return 'Emergency Exit Light Testing';
                if (service === 'fire_testing') return 'Fire Equipment Testing';
                return 'Electrical Test & Tag';
              })()}
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

          {/* Country Selection */}
          <div className="space-y-3">
            <Label>Country</Label>
            <RadioGroup
              defaultValue="australia"
              onValueChange={(value) => form.setValue('country', value as 'australia' | 'newzealand')}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="australia" id="australia" />
                <Label htmlFor="australia">Australia (AS 1851)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="newzealand" id="newzealand" />
                <Label htmlFor="newzealand">New Zealand (NZS 4503:2005)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Fire Testing Licensing Checkbox */}
          {sessionStorage.getItem('selectedService') === 'fire_testing' && (
            <div className="space-y-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="technicianLicensed"
                  checked={form.watch('technicianLicensed') || false}
                  onCheckedChange={(checked) => form.setValue('technicianLicensed', checked === true)}
                  required
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
                <p className="text-sm text-error">{form.formState.errors.technicianLicensed.message}</p>
              )}
            </div>
          )}

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


    </div>
  );
}
