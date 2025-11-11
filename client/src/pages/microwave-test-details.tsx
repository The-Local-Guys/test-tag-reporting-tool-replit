import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useSession } from '@/hooks/use-session';
import { useLocation, useSearch } from 'wouter';
import { nanoid } from 'nanoid';

const microwaveTestSchema = z.object({
  location: z.string().min(1, "Location is required"),
  assetNumber: z.string().min(1, "Asset number is required"),
  leakageReading: z.string().min(1, "Leakage reading is required"),
  additionalComments: z.string().optional(),
});

export default function MicrowaveTestDetails() {
  const [currentItem, setCurrentItem] = useState<{name: string, type: string} | null>(null);
  const { sessionId, currentLocation, addToBatch, microwaveCounter } = useSession();
  const [, setLocation] = useLocation();
  const search = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const item = params.get('item');
    const type = params.get('type');
    if (item && type) {
      setCurrentItem({ 
        name: decodeURIComponent(item), 
        type
      });
    }
  }, [search]);

  const form = useForm<{
    location: string, 
    assetNumber: string, 
    leakageReading: string, 
    additionalComments: string
  }>({
    resolver: zodResolver(microwaveTestSchema),
    defaultValues: {
      location: currentLocation,
      assetNumber: '1',
      leakageReading: '',
      additionalComments: '',
    },
  });

  useEffect(() => {
    if (currentLocation) {
      form.setValue('location', currentLocation);
    }
  }, [currentLocation, form]);

  useEffect(() => {
    if (microwaveCounter !== undefined) {
      const nextAssetNumber = microwaveCounter + 1;
      form.setValue('assetNumber', nextAssetNumber.toString());
    }
  }, [microwaveCounter, form]);

  const onSubmit = async (data: z.infer<typeof microwaveTestSchema>) => {
    if (!sessionId || !currentItem) return;

    const result = {
      id: nanoid(),
      itemName: currentItem.name,
      itemType: currentItem.type,
      location: data.location,
      classification: 'microwave',
      result: 'pass' as const,
      frequency: 'single',
      notes: data.additionalComments,
      visionInspection: false,
      electricalTest: false,
      timestamp: new Date().toISOString(),
      assetNumber: data.assetNumber,
      leakageReading: data.leakageReading,
    };

    addToBatch(result);
    setLocation('/items');
  };

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="mobile-container">
      {/* Header */}
      <div className="bg-green-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => setLocation('/items')}
              className="text-white hover:bg-green-700 p-2 rounded-lg transition-colors mr-3"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold" data-testid="text-page-title">Microwave Leakage Testing</h1>
              <div className="text-green-100 text-sm mt-1">AS/NZS 60335.2.25 Compliance</div>
            </div>
          </div>
        </div>
      </div>

      {/* Item Info */}
      <div className="bg-green-50 border-b border-green-100 p-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-800" data-testid="text-item-name">
            {currentItem?.name || 'Loading...'}
          </h2>
          <p className="text-sm text-gray-600">Radiation Leakage Testing</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6 pb-24">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                {...form.register('location')}
                placeholder="Enter location"
                className="bg-white"
                data-testid="input-location"
              />
              {form.formState.errors.location && (
                <p className="text-sm text-red-500">{form.formState.errors.location.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assetNumber">Asset Number</Label>
              <Input
                id="assetNumber"
                {...form.register('assetNumber')}
                placeholder="Asset number"
                className="bg-white"
                data-testid="input-asset-number"
              />
              {form.formState.errors.assetNumber && (
                <p className="text-sm text-red-500">{form.formState.errors.assetNumber.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="leakageReading">Leakage Reading</Label>
              <Input
                id="leakageReading"
                {...form.register('leakageReading')}
                placeholder="Enter leakage reading (e.g., 0.5 mW/cm²)"
                className="bg-white"
                data-testid="input-leakage-reading"
              />
              {form.formState.errors.leakageReading && (
                <p className="text-sm text-red-500">{form.formState.errors.leakageReading.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="additionalComments">Additional Comments</Label>
              <Textarea
                id="additionalComments"
                {...form.register('additionalComments')}
                placeholder="Enter any additional comments (optional)"
                className="bg-white min-h-[100px]"
                data-testid="textarea-additional-comments"
              />
            </div>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation('/items')}
            className="flex-1"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-green-600 hover:bg-green-700"
            data-testid="button-save-test"
          >
            Save Test
          </Button>
        </div>
      </form>
    </div>
  );
}
