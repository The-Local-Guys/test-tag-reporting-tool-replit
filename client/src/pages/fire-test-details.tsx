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

// Fire Equipment Test Schema following AS 1851 (AU) / NZS 4503:2005 (NZ)
const fireTestSchema = z.object({
  location: z.string().min(1, 'Location is required'),
  equipmentType: z.enum(['fire_extinguisher', 'fire_blanket', 'fire_hose_reel']),
  result: z.enum(['pass', 'fail']),
  frequency: z.enum(['sixmonthly', 'annually']),
  manufacturerInfo: z.string().optional(),
  installationDate: z.string().optional(),
  size: z.string().optional(),
  weight: z.string().optional(),
  visionInspection: z.boolean().default(true),
  operationalTest: z.boolean().default(false),
  pressureTest: z.boolean().default(false),
  accessibilityCheck: z.boolean().default(false),
  signageCheck: z.boolean().default(false),
  failureReason: z.enum(['physical_damage', 'pressure_loss', 'corrosion', 'blocked_nozzle', 'damaged_seal', 'expired', 'mounting_issue', 'other']).optional(),
  notes: z.string().optional(),
});

type FireTestForm = z.infer<typeof fireTestSchema>;

/**
 * Fire equipment testing interface for AS 1851 (AU) / NZS 4503:2005 (NZ) compliance
 * Handles fire equipment specific test parameters and safety requirements
 * Features comprehensive test recording with photo documentation for failures
 */
export default function FireTestDetails() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { sessionData, addToBatch, assetProgress } = useSession();
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const itemName = urlParams.get('item') || 'Fire Equipment';
  const itemType = urlParams.get('type') || 'fire-equipment';

  // Determine equipment type from item type
  const getEquipmentType = (type: string) => {
    if (type.includes('extinguisher')) return 'fire_extinguisher';
    if (type.includes('blanket')) return 'fire_blanket';
    if (type.includes('hose')) return 'fire_hose_reel';
    return 'fire_extinguisher';
  };

  const form = useForm<FireTestForm>({
    resolver: zodResolver(fireTestSchema),
    defaultValues: {
      location: '',
      equipmentType: getEquipmentType(itemType),
      result: 'pass',
      frequency: 'sixmonthly',
      manufacturerInfo: '',
      installationDate: '',
      size: '',
      weight: '',
      visionInspection: true,
      operationalTest: true,
      pressureTest: false,
      accessibilityCheck: true,
      signageCheck: true,
      notes: '',
    },
  });

  const watchResult = form.watch('result');
  const watchEquipmentType = form.watch('equipmentType');

  const onSubmit = async (data: FireTestForm) => {
    if (!sessionData?.session?.id) {
      toast({
        title: 'Error',
        description: 'No active session found',
        variant: 'destructive',
      });
      return;
    }

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
      console.log('Submitting fire test result:', {
        assetNumber: 'Auto-generated',
        itemName: itemName,
        itemType: itemType,
        location: data.location,
        equipmentType: data.equipmentType,
        result: data.result,
        frequency: data.frequency,
        failureReason: data.failureReason || null,
        actionTaken: data.result === 'fail' ? 'removed' : null,
        notes: data.notes || null,
        photoData: data.result === 'fail' ? photoData : null,
        visionInspection: data.visionInspection,
        // Fire specific fields
        size: data.size || null,
        weight: data.weight || null,
        operationalTest: data.operationalTest,
        pressureTest: data.pressureTest,
        accessibilityCheck: data.accessibilityCheck,
        signageCheck: data.signageCheck,
        manufacturerInfo: data.manufacturerInfo || null,
        installationDate: data.installationDate || null,
      });

      // Compile additional test details into notes for now
      const additionalTestDetails = [
        data.notes,
        `Equipment Type: ${data.equipmentType}`,
        data.size ? `Size: ${data.size}` : '',
        data.weight ? `Weight: ${data.weight}` : '',
        `Visual Inspection: ${data.visionInspection ? 'Pass' : 'Fail'}`,
        `Operational Test: ${data.operationalTest ? 'Pass' : 'Fail'}`,
        data.equipmentType === 'fire_extinguisher' ? `Pressure Test: ${data.pressureTest ? 'Pass' : 'Fail'}` : '',
        `Accessibility Check: ${data.accessibilityCheck ? 'Pass' : 'Fail'}`,
        `Signage Check: ${data.signageCheck ? 'Pass' : 'Fail'}`,
      ].filter(Boolean).join(' | ');

      addToBatch({
        itemName: itemName,
        itemType: itemType,
        location: data.location,
        classification: data.equipmentType, // Using equipmentType as classification
        result: data.result,
        frequency: data.frequency,
        failureReason: data.failureReason || null,
        actionTaken: data.result === 'fail' ? 'removed' : null,
        notes: additionalTestDetails || null,
        photoData: data.result === 'fail' ? photoData : null,
        visionInspection: data.visionInspection,
        electricalTest: data.operationalTest, // Map operational test to electrical test field
        manufacturerInfo: data.manufacturerInfo || null,
        installationDate: data.installationDate || null,
      });

      toast({
        title: 'Test Recorded',
        description: `${itemName} test result saved successfully`,
      });

      setLocation('/items');
    } catch (error) {
      console.error('Error submitting fire test result:', error);
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

  // Get compliance standard based on session country
  const getComplianceStandard = () => {
    const country = sessionData?.session?.country;
    return country === 'newzealand' ? 'NZS 4503:2005' : 'AS 1851';
  };

  return (
    <div className="mobile-container">
      {/* Header */}
      <div className="bg-orange-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/items')}
              className="text-white hover:bg-orange-700 p-2 mr-3"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Fire Equipment Test</h1>
              <div className="text-orange-100 text-sm mt-1">{getComplianceStandard()} Compliance</div>
            </div>
          </div>
        </div>
      </div>

      {/* Item Info */}
      <div className="bg-orange-50 border-b border-orange-100 p-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-800">{itemName}</h2>
          <p className="text-sm text-gray-600">Fire Equipment Testing</p>
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
                placeholder="e.g., Main Entrance, Kitchen, Floor 2"
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
              <Label htmlFor="equipmentType">Equipment Type</Label>
              <Select 
                value={form.watch('equipmentType')} 
                onValueChange={(value) => form.setValue('equipmentType', value as 'fire_extinguisher' | 'fire_blanket' | 'fire_hose_reel')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select equipment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fire_extinguisher">Fire Extinguisher</SelectItem>
                  <SelectItem value="fire_blanket">Fire Blanket</SelectItem>
                  <SelectItem value="fire_hose_reel">Fire Hose Reel</SelectItem>
                </SelectContent>
              </Select>
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
              <Label htmlFor="installationDate">Installation/Last Service Date</Label>
              <Input
                id="installationDate"
                type="date"
                {...form.register('installationDate')}
                className="text-base"
              />
            </div>

            {watchEquipmentType === 'fire_extinguisher' && (
              <>
                <div>
                  <Label htmlFor="size">Size</Label>
                  <Input
                    id="size"
                    {...form.register('size')}
                    placeholder="e.g., 2.0kg, 9L"
                    className="text-base"
                  />
                </div>

                <div>
                  <Label htmlFor="weight">Weight</Label>
                  <Input
                    id="weight"
                    {...form.register('weight')}
                    placeholder="e.g., 2.5kg"
                    className="text-base"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Testing Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{getComplianceStandard()} Testing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="visionInspection"
                  checked={form.watch('visionInspection')}
                  onCheckedChange={(checked) => form.setValue('visionInspection', !!checked)}
                />
                <Label htmlFor="visionInspection" className="text-sm">
                  Visual Inspection (Physical condition, damage, corrosion)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="accessibilityCheck"
                  checked={form.watch('accessibilityCheck')}
                  onCheckedChange={(checked) => form.setValue('accessibilityCheck', !!checked)}
                />
                <Label htmlFor="accessibilityCheck" className="text-sm">
                  Accessibility Check (Clear access, not obstructed)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="signageCheck"
                  checked={form.watch('signageCheck')}
                  onCheckedChange={(checked) => form.setValue('signageCheck', !!checked)}
                />
                <Label htmlFor="signageCheck" className="text-sm">
                  Signage Check (Proper signage and instructions visible)
                </Label>
              </div>

              {watchEquipmentType === 'fire_extinguisher' && (
                <>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pressureTest"
                      checked={form.watch('pressureTest')}
                      onCheckedChange={(checked) => form.setValue('pressureTest', !!checked)}
                    />
                    <Label htmlFor="pressureTest" className="text-sm">
                      Pressure Gauge Check (Pressure within operating range)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="operationalTest"
                      checked={form.watch('operationalTest')}
                      onCheckedChange={(checked) => form.setValue('operationalTest', !!checked)}
                    />
                    <Label htmlFor="operationalTest" className="text-sm">
                      Operational Test (Trigger mechanism, hose, nozzle)
                    </Label>
                  </div>
                </>
              )}

              {watchEquipmentType === 'fire_hose_reel' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="operationalTest"
                    checked={form.watch('operationalTest')}
                    onCheckedChange={(checked) => form.setValue('operationalTest', !!checked)}
                  />
                  <Label htmlFor="operationalTest" className="text-sm">
                    Operational Test (Hose reel operation, water flow)
                  </Label>
                </div>
              )}

              {watchEquipmentType === 'fire_blanket' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="operationalTest"
                    checked={form.watch('operationalTest')}
                    onCheckedChange={(checked) => form.setValue('operationalTest', !!checked)}
                  />
                  <Label htmlFor="operationalTest" className="text-sm">
                    Operational Test (Easy removal, blanket condition)
                  </Label>
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
                onValueChange={(value) => form.setValue('frequency', value as 'sixmonthly' | 'annually')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sixmonthly">6 Monthly</SelectItem>
                  <SelectItem value="annually">Annual</SelectItem>
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
                      <SelectItem value="pressure_loss">Pressure Loss</SelectItem>
                      <SelectItem value="corrosion">Corrosion</SelectItem>
                      <SelectItem value="blocked_nozzle">Blocked Nozzle</SelectItem>
                      <SelectItem value="damaged_seal">Damaged Seal</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="mounting_issue">Mounting Issue</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded border">
                  <div className="flex items-center">
                    <Camera className="h-5 w-5 text-gray-500 mr-2" />
                    <span className="text-sm">Photo Documentation</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePhotoCapture}
                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                  >
                    {photoData ? 'Retake Photo' : 'Take Photo'}
                  </Button>
                </div>

                {photoData && (
                  <div className="text-center">
                    <img src={photoData} alt="Failed item" className="max-w-full h-32 mx-auto rounded border" />
                    <p className="text-xs text-gray-600 mt-1">Photo attached for failed item</p>
                  </div>
                )}
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

        {/* Submit Button */}
        <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 p-4">
          <Button 
            type="submit" 
            className="w-full bg-orange-600 hover:bg-orange-700 py-4 text-lg font-semibold"
          >
            <Save className="mr-2 h-5 w-5" />
            Save Test Result
          </Button>
        </div>
      </form>
    </div>
  );
}