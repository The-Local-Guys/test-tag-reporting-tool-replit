import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  EARTH_CONTINUITY_QUICK_VALUE,
  INSULATION_OPERATORS,
  POLARITY_OPTIONS,
  type ElectricalReadingErrors,
  type ElectricalReadings,
} from '@/lib/electrical-readings';

interface ElectricalReadingsFieldsProps {
  readings: ElectricalReadings;
  onChange: (readings: ElectricalReadings) => void;
  errors?: ElectricalReadingErrors;
  idPrefix?: string;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-600">{message}</p>;
}

/**
 * Earth continuity, insulation resistance, polarity and (optional) leakage current inputs
 * for electrical test & tag items. Shared by the test screen and the edit modal.
 */
export function ElectricalReadingsFields({
  readings,
  onChange,
  errors = {},
  idPrefix = 'reading',
}: ElectricalReadingsFieldsProps) {
  const update = (patch: Partial<ElectricalReadings>) => onChange({ ...readings, ...patch });

  return (
    <div className="space-y-4">
      {/* Earth Continuity */}
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-earth`} className="text-sm font-medium text-gray-700">
          Earth Continuity (Ω) *
        </Label>
        <div className="flex gap-2">
          <Input
            id={`${idPrefix}-earth`}
            inputMode="decimal"
            placeholder="e.g. 0.05"
            value={readings.earthContinuity}
            onChange={(e) => update({ earthContinuity: e.target.value })}
            className={cn('text-base', errors.earthContinuity && 'border-red-500')}
          />
          <Button
            type="button"
            variant={readings.earthContinuity === EARTH_CONTINUITY_QUICK_VALUE ? 'default' : 'outline'}
            onClick={() => update({ earthContinuity: EARTH_CONTINUITY_QUICK_VALUE })}
            className="shrink-0"
          >
            {EARTH_CONTINUITY_QUICK_VALUE}
          </Button>
        </div>
        <FieldError message={errors.earthContinuity} />
      </div>

      {/* Insulation Resistance */}
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-insulation`} className="text-sm font-medium text-gray-700">
          Insulation Resistance (MΩ) *
        </Label>
        <div className="flex gap-2">
          <Select
            value={readings.insulationOperator}
            onValueChange={(value) => update({ insulationOperator: value })}
          >
            <SelectTrigger className="w-20 shrink-0 text-base" aria-label="Insulation resistance operator">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSULATION_OPERATORS.map((op) => (
                <SelectItem key={op} value={op}>{op}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id={`${idPrefix}-insulation`}
            inputMode="decimal"
            placeholder="e.g. 99.99"
            value={readings.insulationResistance}
            onChange={(e) => update({ insulationResistance: e.target.value })}
            className={cn('text-base', errors.insulationResistance && 'border-red-500')}
          />
        </div>
        <FieldError message={errors.insulationResistance} />
      </div>

      {/* Polarity */}
      <div className="space-y-1">
        <Label className="text-sm font-medium text-gray-700">Polarity *</Label>
        <div className="grid grid-cols-3 gap-2">
          {POLARITY_OPTIONS.map((option) => {
            const selected = readings.polarity === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                variant={selected ? 'default' : 'outline'}
                onClick={() => update({ polarity: option.value })}
                className={cn(
                  selected && option.value === 'pass' && 'bg-success hover:bg-green-600',
                  selected && option.value === 'fail' && 'bg-error hover:bg-red-600',
                )}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
        <FieldError message={errors.polarity} />
      </div>

      {/* Leakage Current (optional, always last) */}
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-leakage`} className="text-sm font-medium text-gray-700">
          Leakage Current (mA) <span className="font-normal text-gray-400">Optional</span>
        </Label>
        <Input
          id={`${idPrefix}-leakage`}
          inputMode="decimal"
          placeholder="Actual reading"
          value={readings.leakageCurrent}
          onChange={(e) => update({ leakageCurrent: e.target.value })}
          className={cn('text-base', errors.leakageCurrent && 'border-red-500')}
        />
        <FieldError message={errors.leakageCurrent} />
      </div>
    </div>
  );
}
