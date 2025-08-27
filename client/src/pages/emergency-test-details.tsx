import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle, XCircle, Camera, Save } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { emergencyClassifications, emergencyFailureReasons, emergencyFrequencies, maintenanceTypes, globeTypes } from '@shared/schema';

// Emergency Exit Light Test Schema following AS 2293.2:2019
const emergencyTestSchema = z.object({
  location: z.string().min(1, 'Location is required'),
  classification: z.string().optional(),
  result: z.enum(['pass', 'fail']),
  frequency: z.enum(['sixmonthly', 'annually']),
  manufacturerInfo: z.string().optional(),
  installationDate: z.string().optional(),
  maintenanceType: z.enum(['maintained', 'non_maintained']).optional(),
  globeType: z.enum(['led', 'fluorescent']).optional(),
  visualInspection: z.boolean().default(true),
  dischargeTest: z.boolean().default(false),
  switchingTest: z.boolean().default(false),
  chargingTest: z.boolean().default(false),
  luxValue: z.number().min(0, 'Lux value must be positive').optional(),
  failureReason: z.enum(['physical_damage', 'battery_failure', 'lamp_failure', 'wiring_fault', 'charging_fault', 'insufficient_illumination', 'mounting_issue', 'other']).optional(),
  notes: z.string().optional(),
});

type EmergencyTestForm = z.infer<typeof emergencyTestSchema>;

/**
 * Emergency exit light testing interface for AS 2293.2:2019 compliance
 * Handles emergency-specific test parameters, maintenance types, and globe classifications
 * Features comprehensive test recording with photo documentation for failures
 */
export default function EmergencyTestDetails() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { sessionData, addToBatch, assetProgress } = useSession();
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const itemName = urlParams.get('item') || 'Emergency Equipment';
  const itemType = urlParams.get('type') || 'emergency-equipment';

  const form = useForm<EmergencyTestForm>({
    resolver: zodResolver(emergencyTestSchema),
    defaultValues: {
      location: '',
      classification: 'emergency_equipment',
      result: 'pass',
      frequency: 'sixmonthly',
      manufacturerInfo: '',
      installationDate: '',
      maintenanceType: 'maintained',
      globeType: 'led',
      visualInspection: true,
      dischargeTest: true,
      switchingTest: true,
      chargingTest: true,
      luxValue: undefined,
      notes: '',
    },
  });

  const watchResult = form.watch('result');

  // Asset numbers are now auto-generated on server side

  const onSubmit = async (data: EmergencyTestForm) => {
    if (!sessionData?.session?.id) {
      toast({
        title: 'Error',
        description: 'No active session found',
        variant: 'destructive',
      });
      return;
    }

    // No need to check for in-progress since using local storage

    // Validate required fields for failed items
    if (data.result === 'fail' && !data.failureReason) {
      toast({
        title: 'Missing Information',
        description: 'Please specify the failure reason for failed items',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('Submitting emergency test result:', {
        assetNumber: 'Auto-generated',
        itemName: itemName,
        itemType: itemType,
        location: data.location,
        classification: data.classification,
        result: data.result,
        frequency: data.frequency,
        failureReason: data.failureReason || null,
        actionTaken: data.result === 'fail' ? 'removed' : null,
        notes: data.notes || null,
        photoData: data.result === 'fail' ? photoData : null,
        visionInspection: data.visualInspection,
        electricalTest: data.dischargeTest,
        // Emergency specific fields
        maintenanceType: data.maintenanceType || null,
        globeType: data.globeType || null,
        dischargeTest: data.dischargeTest,
        switchingTest: data.switchingTest,
        chargingTest: data.chargingTest,
        luxValue: data.luxValue || null,
        manufacturerInfo: data.manufacturerInfo || null,
        installationDate: data.installationDate || null,
      });

      addToBatch({
        itemName: itemName,
        itemType: itemType,
        location: data.location,
        classification: data.classification,
        result: data.result,
        frequency: data.frequency,
        failureReason: data.failureReason || null,
        actionTaken: data.result === 'fail' ? 'removed' : null,
        notes: data.notes || null,
        photoData: data.result === 'fail' ? photoData : null,
        visionInspection: data.visualInspection,
        electricalTest: data.dischargeTest, // Using electricalTest field for discharge test 
        // Emergency specific fields for PDF generation
        maintenanceType: data.maintenanceType || null,
        globeType: data.globeType || null,
        dischargeTest: data.dischargeTest,
        switchingTest: data.switchingTest,
        chargingTest: data.chargingTest,
        luxValue: data.luxValue || null,
        manufacturerInfo: data.manufacturerInfo || null,
        installationDate: data.installationDate || null,
      });

      toast({
        title: 'Test Recorded',
        description: `${itemName} test result saved successfully`,
      });

      setLocation('/items');
    } catch (error) {
      console.error('Error submitting emergency test result:', error);
      toast({
        title: 'Error',
        description: `Failed to save test result: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handlePhotoCapture = () => {
    // Simulate photo capture - in a real app, this would use the camera API
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#333';
      ctx.font = '20px Arial';
      ctx.fillText('Photo captured for failed item', 50, 250);
      setPhotoData(canvas.toDataURL());
      setShowCamera(false);
    }
  };

  return (
    <div className="mobile-container">
      {/* Header */}
      <div className="bg-red-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/items')}
              className="text-white hover:bg-red-700 p-2 mr-3"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Emergency Exit Light Test</h1>
              <div className="text-red-100 text-sm mt-1">AS 2293.2:2019 Compliance</div>
            </div>
          </div>
        </div>
      </div>

      {/* Item Info */}
      <div className="bg-red-50 border-b border-red-100 p-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-800">{itemName}</h2>
          <p className="text-sm text-gray-600">Emergency Equipment Testing</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6 pb-24">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Equipment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                {...form.register('location')}
                placeholder="e.g., Main Entrance, Floor 2 Corridor"
                className="text-base"
              />
              {form.formState.errors.location && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.location.message}</p>
              )}
            </div>

            <div>
              <Label>Asset Number</Label>
              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <div className="text-sm text-green-800">
                  <div className="font-medium">Next asset number will be:</div>
                  <div className="text-green-600 mt-1 text-lg font-semibold">
                    {assetProgress ? (
                      form.watch('frequency') === 'annually' ? 
                        `#${assetProgress.nextFiveYearly}` : 
                        `#${assetProgress.nextMonthly}`
                    ) : (
                      'Loading...'
                    )}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {assetProgress ? (
                      form.watch('frequency') === 'annually' ? 
                        `Annual items: ${assetProgress.fiveYearlyCount} tested` : 
                        `6-monthly items: ${assetProgress.monthlyCount} tested`
                    ) : (
                      'Loading progress...'
                    )}
                  </div>
                </div>
              </div>
            </div>



            <div>
              <Label htmlFor="manufacturerInfo">Manufacturer & Model</Label>
              <Input
                id="manufacturerInfo"
                {...form.register('manufacturerInfo')}
                placeholder="e.g., Brand Model123"
                className="text-base"
              />
            </div>

            <div>
              <Label htmlFor="installationDate">Installation/Last Replacement Date</Label>
              <Input
                id="installationDate"
                type="date"
                {...form.register('installationDate')}
                className="text-base"
              />
            </div>
          </CardContent>
        </Card>

        {/* Testing Requirements (AS 2293.2:2019) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AS 2293.2:2019 Testing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="visualInspection"
                  checked={form.watch('visualInspection')}
                  onCheckedChange={(checked) => form.setValue('visualInspection', !!checked)}
                />
                <Label htmlFor="visualInspection" className="text-sm">
                  Visual Inspection (Physical condition, mounting, damage)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="switchingTest"
                  checked={form.watch('switchingTest')}
                  onCheckedChange={(checked) => form.setValue('switchingTest', !!checked)}
                />
                <Label htmlFor="switchingTest" className="text-sm">
                  Automatic Switching Test (Power failure simulation)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="chargingTest"
                  checked={form.watch('chargingTest')}
                  onCheckedChange={(checked) => form.setValue('chargingTest', !!checked)}
                />
                <Label htmlFor="chargingTest" className="text-sm">
                  Charging Circuit Test (Battery charging verification)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dischargeTest"
                  checked={form.watch('dischargeTest')}
                  onCheckedChange={(checked) => form.setValue('dischargeTest', !!checked)}
                />
                <Label htmlFor="dischargeTest" className="text-sm">
                  90-Minute Discharge Test (Battery backup duration)
                </Label>
              </div>
            </div>

            <div>
              <Label htmlFor="maintenanceType">Maintenance Type</Label>
              <Select 
                value={form.watch('maintenanceType') || ''} 
                onValueChange={(value) => form.setValue('maintenanceType', value as 'maintained' | 'non_maintained')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select maintenance type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maintained">Maintained</SelectItem>
                  <SelectItem value="non_maintained">Non-Maintained</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="globeType">Globe Type</Label>
              <Select 
                value={form.watch('globeType') || ''} 
                onValueChange={(value) => form.setValue('globeType', value as 'led' | 'fluorescent')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select globe type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="led">LED</SelectItem>
                  <SelectItem value="fluorescent">Fluorescent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lux Measurement */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lux Measurement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="luxValue">Illumination Level (lux)</Label>
              <Input
                id="luxValue"
                type="number"
                min="0"
                step="0.1"
                {...form.register('luxValue', { valueAsNumber: true })}
                placeholder="e.g., 1.5"
                className="text-base"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum required: 1 lux for escape routes, 0.2 lux for open areas
              </p>
              {form.formState.errors.luxValue && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.luxValue.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Test Result */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="result">Overall Result *</Label>
              <Select 
                value={form.watch('result')} 
                onValueChange={(value) => form.setValue('result', value as 'pass' | 'fail')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass">
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                      Pass
                    </div>
                  </SelectItem>
                  <SelectItem value="fail">
                    <div className="flex items-center">
                      <XCircle className="w-4 h-4 text-red-600 mr-2" />
                      Fail
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="frequency">Test Frequency *</Label>
              <Select 
                value={form.watch('frequency')} 
                onValueChange={(value) => form.setValue('frequency', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sixmonthly">6 Monthly (Standard)</SelectItem>
                  <SelectItem value="annually">Annually (Extended)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Failure Details */}
            {watchResult === 'fail' && (
              <div className="space-y-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <div>
                  <Label htmlFor="failureReason">Failure Reason *</Label>
                  <Select 
                    value={form.watch('failureReason') || ''} 
                    onValueChange={(value) => form.setValue('failureReason', value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select failure reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physical_damage">Physical Damage</SelectItem>
                      <SelectItem value="battery_failure">Battery Failure</SelectItem>
                      <SelectItem value="lamp_failure">Lamp/LED Failure</SelectItem>
                      <SelectItem value="wiring_fault">Wiring Fault</SelectItem>
                      <SelectItem value="charging_fault">Charging Fault</SelectItem>
                      <SelectItem value="insufficient_illumination">Insufficient Illumination</SelectItem>
                      <SelectItem value="mounting_issue">Mounting Issue</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCamera(true)}
                    className="w-full"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {photoData ? 'Retake Photo' : 'Take Photo of Issue'}
                  </Button>
                  {photoData && (
                    <p className="text-sm text-green-600 mt-2">Photo captured</p>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="notes">Additional Notes</Label>
              <Input
                id="notes"
                {...form.register('notes')}
                placeholder="Any additional observations or comments"
                className="text-base"
              />
            </div>
          </CardContent>
        </Card>

        {/* Camera Modal */}
        {showCamera && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-sm w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Capture Photo</h3>
              <div className="bg-gray-200 h-48 rounded-lg mb-4 flex items-center justify-center">
                <Camera className="w-12 h-12 text-gray-400" />
              </div>
              <div className="flex space-x-3">
                <Button onClick={() => setShowCamera(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handlePhotoCapture} className="flex-1">
                  Capture
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Fixed Save Button */}
        <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 p-4">
          <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 py-3 text-white font-semibold">
            <Save className="w-4 h-4 mr-2" />
            Save Test Result
          </Button>
        </div>
      </form>
    </div>
  );
}