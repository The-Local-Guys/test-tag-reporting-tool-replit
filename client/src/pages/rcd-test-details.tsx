import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import type { InsertTestResult } from '@shared/schema';

// RCD Test Schema
const rcdTestSchema = z.object({
  location: z.string().min(1, 'Location is required'),
  assetNumber: z.string().optional(), // Auto-generated
  equipmentType: z.enum(['fixed-rcd', 'portable-rcd']),
  distributionBoardNumber: z.string().optional(), // Only for Fixed RCD
  pushButtonTest: z.boolean().default(true),
  injectionTimedTest: z.boolean().default(true),
  tripTime: z.preprocess(
    // Convert empty string to undefined, otherwise coerce to number
    (val) => val === '' || val == null ? undefined : Number(val),
    z.number().int().positive().optional()
  ), // Trip time in milliseconds (must be positive integer)
  result: z.enum(['pass', 'fail']),
  notes: z.string().optional(),
}).refine((data) => {
  // Require tripTime when injectionTimedTest is checked
  if (data.injectionTimedTest && data.tripTime == null) {
    return false;
  }
  return true;
}, {
  message: 'Trip time must be a positive whole number (integer) in milliseconds when Injection/Timed Test is selected',
  path: ['tripTime'],
});

type RCDTestForm = z.infer<typeof rcdTestSchema>;

/**
 * RCD testing interface for Residual Current Device compliance testing
 * Handles both Fixed and Portable RCD testing with push button and injection/timed tests
 */
export default function RCDTestDetails() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { sessionData, addToBatch, currentLocation, rcdAssetCounter, currentDistributionBoardNumber } = useSession();

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const initialItemType = urlParams.get('type') || 'fixed-rcd';

  // Determine equipment type from item type
  const getEquipmentType = (type: string): 'fixed-rcd' | 'portable-rcd' => {
    if (type.includes('portable')) return 'portable-rcd';
    return 'fixed-rcd';
  };

  // Helper to get item name from equipment type
  const getItemNameFromType = (equipmentType: 'fixed-rcd' | 'portable-rcd'): string => {
    return equipmentType === 'fixed-rcd' ? 'Fixed RCD' : 'Portable RCD';
  };

  // State to track current item name and type (will update when equipment type changes)
  const [currentItemName, setCurrentItemName] = useState(getItemNameFromType(getEquipmentType(initialItemType)));
  const [currentItemType, setCurrentItemType] = useState(getEquipmentType(initialItemType));

  const nextAssetNumber = rcdAssetCounter + 1;

  const form = useForm<RCDTestForm>({
    resolver: zodResolver(rcdTestSchema),
    defaultValues: {
      location: currentLocation,
      assetNumber: nextAssetNumber.toString(),
      equipmentType: getEquipmentType(initialItemType),
      distributionBoardNumber: getEquipmentType(initialItemType) === 'fixed-rcd' ? currentDistributionBoardNumber : '',
      pushButtonTest: false,
      injectionTimedTest: false,
      tripTime: '',
      result: 'pass',
      notes: '',
    },
  });

  const watchResult = form.watch('result');
  const watchEquipmentType = form.watch('equipmentType');
  const watchInjectionTimedTest = form.watch('injectionTimedTest');

  // Update location field when currentLocation changes
  useEffect(() => {
    if (currentLocation) {
      form.setValue('location', currentLocation);
    }
  }, [currentLocation, form]);

  // Update distribution board number field when currentDistributionBoardNumber changes or equipment type changes
  useEffect(() => {
    if (watchEquipmentType === 'fixed-rcd') {
      // Set to remembered value for Fixed RCD
      if (currentDistributionBoardNumber) {
        form.setValue('distributionBoardNumber', currentDistributionBoardNumber);
      }
    } else {
      // Clear for Portable RCD
      form.setValue('distributionBoardNumber', '');
    }
  }, [currentDistributionBoardNumber, watchEquipmentType, form]);

  // Update item name and type when equipment type changes
  useEffect(() => {
    const newItemName = getItemNameFromType(watchEquipmentType);
    const newItemType = watchEquipmentType;
    setCurrentItemName(newItemName);
    setCurrentItemType(newItemType);
  }, [watchEquipmentType]);

  const onSubmit = async (data: RCDTestForm) => {
    if (!sessionData?.session?.id) {
      toast({
        title: 'Error',
        description: 'No active session found',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Zod coerces tripTime to number already - use directly
      const tripTimeMs = data.tripTime ?? null;
      
      console.log('Submitting RCD test result:', {
        assetNumber: data.assetNumber,
        itemName: currentItemName,
        itemType: currentItemType,
        location: data.location,
        equipmentType: data.equipmentType,
        result: data.result,
        notes: data.notes || null,
        pushButtonTest: data.pushButtonTest,
        injectionTimedTest: data.injectionTimedTest,
        tripTimeMs: tripTimeMs,
      });

      // If failed, navigate to failure details page
      if (data.result === 'fail') {
        const pendingTestData: Omit<InsertTestResult, 'sessionId'> = {
          itemName: currentItemName,
          itemType: currentItemType,
          location: data.location,
          assetNumber: data.assetNumber,
          classification: data.equipmentType,
          result: data.result,
          frequency: 'annually',
          pushButtonTest: data.pushButtonTest,
          injectionTimedTest: data.injectionTimedTest,
          tripTime: tripTimeMs,
          distributionBoardNumber: data.distributionBoardNumber || null,
          notes: data.notes || null,
          visionInspection: false,
          electricalTest: false,
        } as any;

        sessionStorage.setItem('pendingTestResult', JSON.stringify(pendingTestData));
        setLocation('/failure-details');
        return;
      }

      // If passed, add directly to batch
      addToBatch({
        itemName: currentItemName,
        itemType: currentItemType,
        location: data.location,
        assetNumber: data.assetNumber,
        classification: data.equipmentType, // Use equipment type as classification
        result: data.result,
        frequency: 'annually', // Default frequency for RCD testing
        pushButtonTest: data.pushButtonTest,
        injectionTimedTest: data.injectionTimedTest,
        tripTime: tripTimeMs,
        distributionBoardNumber: data.distributionBoardNumber || null,
        notes: data.notes || null,
        // RCD testing doesn't require vision/electrical test flags
        visionInspection: false,
        electricalTest: false,
      } as any);

      toast({
        title: 'RCD Test Recorded',
        description: `${currentItemName} has been added to the report`,
      });

      // Navigate back to items page
      setLocation('/items');
    } catch (error) {
      console.error('Error recording RCD test:', error);
      toast({
        title: 'Error',
        description: 'Failed to record test. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Get compliance standard based on session country
  const getComplianceStandard = () => {
    const country = sessionData?.session?.country;
    return country === 'newzealand' ? 'AS/NZS 3760' : 'AS/NZS 3760';
  };

  return (
    <div className="mobile-container">
      {/* Header */}
      <div className="bg-purple-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/items')}
              className="text-white hover:bg-purple-700 p-2 mr-3"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">RCD Test</h1>
              <div className="text-purple-100 text-sm mt-1">{getComplianceStandard()} Compliance</div>
            </div>
          </div>
        </div>
      </div>

      {/* Item Info */}
      <div className="bg-purple-50 border-b border-purple-100 p-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-800">{currentItemName}</h2>
          <p className="text-sm text-gray-600">RCD Testing</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6 pb-24">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Device Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                {...form.register('location')}
                placeholder="e.g., Workshop, Kitchen, Reception Area"
                className="text-base"
                data-testid="input-location"
              />
              {form.formState.errors.location && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.location.message}</p>
              )}
            </div>

            <div>
              <Label className="flex items-center text-sm font-medium text-gray-700">
                🏷️ Asset Number
              </Label>
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                <div className="text-sm text-purple-800">
                  <div className="font-medium">Next asset number will be:</div>
                  <div className="text-purple-600 mt-1 text-lg font-semibold">
                    #{nextAssetNumber}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="equipmentType">Equipment Type *</Label>
              <Select
                value={form.watch('equipmentType')}
                onValueChange={(value) => form.setValue('equipmentType', value as 'fixed-rcd' | 'portable-rcd')}
              >
                <SelectTrigger className="text-base" data-testid="select-equipment-type">
                  <SelectValue placeholder="Select equipment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed-rcd">
                    <div>
                      <div className="font-medium">Fixed RCD</div>
                      <div className="text-xs text-gray-500">Permanent installation residual current device</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="portable-rcd">
                    <div>
                      <div className="font-medium">Portable RCD</div>
                      <div className="text-xs text-gray-500">Portable residual current device</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.equipmentType && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.equipmentType.message}</p>
              )}
            </div>

            {/* Distribution Board Number - Only for Fixed RCD */}
            {watchEquipmentType === 'fixed-rcd' && (
              <div>
                <Label htmlFor="distributionBoardNumber">Distribution Board Number</Label>
                <Input
                  id="distributionBoardNumber"
                  {...form.register('distributionBoardNumber')}
                  placeholder="e.g., DB-1, Main Board"
                  className="text-base"
                  data-testid="input-distribution-board-number"
                />
                {form.formState.errors.distributionBoardNumber && (
                  <p className="text-red-500 text-sm mt-1">{form.formState.errors.distributionBoardNumber.message}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Completed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Completed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pushButtonTest"
                  checked={form.watch('pushButtonTest')}
                  onCheckedChange={(checked) => form.setValue('pushButtonTest', !!checked)}
                  data-testid="checkbox-push-button-test"
                />
                <Label htmlFor="pushButtonTest" className="text-sm">
                  Push Button Test
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="injectionTimedTest"
                  checked={form.watch('injectionTimedTest')}
                  onCheckedChange={(checked) => form.setValue('injectionTimedTest', !!checked)}
                  data-testid="checkbox-injection-timed-test"
                />
                <Label htmlFor="injectionTimedTest" className="text-sm">
                  Injection/Timed Test
                </Label>
              </div>

              {/* Trip Time - Only show when Injection/Timed Test is checked */}
              {watchInjectionTimedTest && (
                <div className="mt-3">
                  <Label htmlFor="tripTime" className="text-sm">Trip Time (ms) *</Label>
                  <Input
                    id="tripTime"
                    {...form.register('tripTime')}
                    placeholder="e.g., 30"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    className="text-base mt-1"
                    data-testid="input-trip-time"
                  />
                  {form.formState.errors.tripTime && (
                    <p className="text-red-500 text-sm mt-1">{form.formState.errors.tripTime.message}</p>
                  )}
                </div>
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
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                {...form.register('notes')}
                placeholder="Add any additional notes about the test..."
                className="text-base min-h-[100px]"
                data-testid="textarea-notes"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                type="button"
                onClick={() => {
                  form.setValue('result', 'pass');
                  form.handleSubmit(onSubmit)();
                }}
                className="bg-success hover:bg-green-600 text-white p-6 h-auto text-lg font-semibold flex flex-col items-center justify-center touch-button"
                data-testid="button-pass"
              >
                <CheckCircle className="h-8 w-8 mb-2" />
                PASS
              </Button>

              <Button
                type="button"
                onClick={() => {
                  form.setValue('result', 'fail');
                  form.handleSubmit(onSubmit)();
                }}
                className="bg-error text-white p-6 h-auto text-lg font-semibold flex flex-col items-center justify-center hover:bg-red-600 touch-button"
                data-testid="button-fail"
              >
                <XCircle className="h-8 w-8 mb-2" />
                FAIL
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
