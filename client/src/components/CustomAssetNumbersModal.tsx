import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_STARTING_NUMBERS, CustomStartingNumbers } from '@/hooks/use-session';

interface CustomAssetNumbersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCustomNumbers: Partial<CustomStartingNumbers>;
  onSave: (numbers: Partial<CustomStartingNumbers>) => void;
  onReset: () => void;
}

interface FrequencyConfig {
  key: keyof CustomStartingNumbers;
  label: string;
  default: number;
}

const FREQUENCIES: FrequencyConfig[] = [
  { key: 'twelvemonthly', label: '12 Monthly', default: DEFAULT_STARTING_NUMBERS.twelvemonthly },
  { key: 'sixmonthly', label: '6 Monthly', default: DEFAULT_STARTING_NUMBERS.sixmonthly },
  { key: 'fiveyearly', label: '5 Yearly', default: DEFAULT_STARTING_NUMBERS.fiveyearly },
  { key: 'twentyfourmonthly', label: '24 Monthly', default: DEFAULT_STARTING_NUMBERS.twentyfourmonthly },
  { key: 'threemonthly', label: '3 Monthly', default: DEFAULT_STARTING_NUMBERS.threemonthly },
  { key: 'monthly', label: 'Monthly', default: DEFAULT_STARTING_NUMBERS.monthly },
];

export function CustomAssetNumbersModal({
  isOpen,
  onClose,
  currentCustomNumbers,
  onSave,
  onReset,
}: CustomAssetNumbersModalProps) {
  const [formValues, setFormValues] = useState<Partial<CustomStartingNumbers>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof CustomStartingNumbers, string>>>({});

  // Initialize form values when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialValues: Partial<CustomStartingNumbers> = {};
      FREQUENCIES.forEach(({ key, default: defaultValue }) => {
        initialValues[key] = currentCustomNumbers[key] ?? defaultValue;
      });
      setFormValues(initialValues);
      setErrors({});
    }
  }, [isOpen, currentCustomNumbers]);

  const handleChange = (key: keyof CustomStartingNumbers, value: string) => {
    const numValue = parseInt(value);
    
    setFormValues((prev) => ({
      ...prev,
      [key]: numValue,
    }));

    // Validate
    if (!value || isNaN(numValue) || numValue < 1) {
      setErrors((prev) => ({
        ...prev,
        [key]: 'Must be a positive number',
      }));
    } else {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const handleSave = () => {
    // Check if there are any errors
    if (Object.keys(errors).length > 0) {
      return;
    }

    // Check if all values are valid
    const hasInvalidValues = FREQUENCIES.some(({ key }) => {
      const value = formValues[key];
      return value === undefined || value < 1;
    });

    if (hasInvalidValues) {
      return;
    }

    onSave(formValues);
    onClose();
  };

  const handleReset = () => {
    const defaultValues: Partial<CustomStartingNumbers> = {};
    FREQUENCIES.forEach(({ key, default: defaultValue }) => {
      defaultValues[key] = defaultValue;
    });
    setFormValues(defaultValues);
    setErrors({});
    onReset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Custom Asset Numbers
          </DialogTitle>
          <p className="text-sm text-gray-500">
            Set custom starting asset numbers for each test frequency. These settings apply to this report only.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {FREQUENCIES.map(({ key, label, default: defaultValue }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key} className="text-sm font-medium">
                {label}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id={key}
                  type="number"
                  min="1"
                  value={formValues[key] || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className={errors[key] ? 'border-red-500' : ''}
                  data-testid={`input-${key}`}
                />
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  (Default: {defaultValue.toLocaleString()})
                </span>
              </div>
              {errors[key] && (
                <p className="text-xs text-red-500">{errors[key]}</p>
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            data-testid="button-reset"
          >
            Reset to Defaults
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={Object.keys(errors).length > 0}
            data-testid="button-save"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
