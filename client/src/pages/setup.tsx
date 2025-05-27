import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertTestSessionSchema } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Clipboard, ArrowRight, LogOut } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import type { InsertTestSession } from '@shared/schema';
import logoPath from '@assets/The Local Guys - with plug wide boarder - png seek.png';

export default function Setup() {
  const { createSession, isCreatingSession, clearSession } = useSession();
  const { logout, isLoggingOut } = useAuth();
  const [, setLocation] = useLocation();
  
  const form = useForm<InsertTestSession>({
    resolver: zodResolver(insertTestSessionSchema),
    defaultValues: {
      testDate: new Date().toISOString().split('T')[0],
      technicianName: '',
      clientName: '',
      siteContact: '',
      address: '',
      country: 'australia',
    },
  });

  const onSubmit = (data: InsertTestSession) => {
    // Clear any existing session data first
    clearSession();
    
    createSession({
      ...data,
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
            <h1 className="text-xl font-semibold">New Test Session</h1>
            <div className="text-blue-100 text-sm mt-1">Step 1 of 3: Client Setup</div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => {
                form.reset();
                setSelectedCountry('australia');
                // Clear any cached session data
                localStorage.removeItem('currentSession');
                window.location.reload();
              }}
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              New Report
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </Button>
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
    </div>
  );
}
