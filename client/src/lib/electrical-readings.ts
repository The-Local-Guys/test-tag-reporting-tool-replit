// Electrical test & tag readings (earth continuity, insulation resistance, polarity, leakage current).
// Values are kept as strings so readings like "<0.10" are stored exactly as entered.

export type PolarityValue = 'pass' | 'fail' | 'na';

export interface ElectricalReadings {
  earthContinuity: string;
  insulationOperator: string;
  insulationResistance: string;
  polarity: PolarityValue | '';
  leakageCurrent: string;
}

export type ElectricalReadingErrors = Partial<Record<keyof ElectricalReadings, string>>;

export const EARTH_CONTINUITY_QUICK_VALUE = '<0.10';
export const INSULATION_OPERATORS = ['>', '<', '='] as const;

export const POLARITY_OPTIONS: { value: PolarityValue; label: string }[] = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'na', label: 'N/A' },
];

export function getDefaultElectricalReadings(): ElectricalReadings {
  return {
    earthContinuity: '',
    insulationOperator: '>',
    insulationResistance: '99.99',
    polarity: 'pass',
    leakageCurrent: '',
  };
}

function isNumeric(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value.trim()));
}

export function validateElectricalReadings(readings: ElectricalReadings): ElectricalReadingErrors {
  const errors: ElectricalReadingErrors = {};
  const earth = readings.earthContinuity.trim();

  if (!earth) {
    errors.earthContinuity = 'Earth continuity is required';
  } else if (earth !== EARTH_CONTINUITY_QUICK_VALUE && !isNumeric(earth)) {
    errors.earthContinuity = 'Enter a number or select <0.10';
  }

  if (!readings.insulationResistance.trim()) {
    errors.insulationResistance = 'Insulation resistance is required';
  } else if (!isNumeric(readings.insulationResistance)) {
    errors.insulationResistance = 'Enter a number';
  }

  if (!readings.polarity) {
    errors.polarity = 'Polarity is required';
  }

  if (readings.leakageCurrent.trim() && !isNumeric(readings.leakageCurrent)) {
    errors.leakageCurrent = 'Enter a number';
  }

  return errors;
}

// Converts the form readings into the nullable fields saved with a test result.
export function toElectricalReadingFields(readings: ElectricalReadings) {
  return {
    earthContinuity: readings.earthContinuity.trim() || null,
    insulationOperator: readings.insulationResistance.trim() ? readings.insulationOperator : null,
    insulationResistance: readings.insulationResistance.trim() || null,
    polarity: readings.polarity || null,
    leakageCurrent: readings.leakageCurrent.trim() || null,
  };
}

// Converts a saved test result back into form readings (blank where nothing was recorded).
export function fromElectricalReadingFields(result: any): ElectricalReadings {
  return {
    earthContinuity: result?.earthContinuity ?? result?.earth_continuity ?? '',
    insulationOperator: result?.insulationOperator ?? result?.insulation_operator ?? '>',
    insulationResistance: result?.insulationResistance ?? result?.insulation_resistance ?? '',
    polarity: result?.polarity ?? '',
    leakageCurrent: result?.leakageCurrent ?? result?.leakage_current ?? '',
  };
}

export function hasElectricalReadings(result: any): boolean {
  const r = fromElectricalReadingFields(result);
  return !!(r.earthContinuity || r.insulationResistance || r.polarity || r.leakageCurrent);
}

// Display helpers for PDF / Excel ('-' when nothing was recorded, matching other report cells)
export const READING_BLANK = '-';

export function formatEarthContinuity(result: any): string {
  return fromElectricalReadingFields(result).earthContinuity || READING_BLANK;
}

export function formatInsulationResistance(result: any): string {
  const { insulationOperator, insulationResistance } = fromElectricalReadingFields(result);
  if (!insulationResistance) return READING_BLANK;
  return insulationOperator === '=' ? insulationResistance : `${insulationOperator}${insulationResistance}`;
}

export function formatPolarity(result: any): string {
  const polarity = fromElectricalReadingFields(result).polarity;
  return POLARITY_OPTIONS.find((o) => o.value === polarity)?.label ?? READING_BLANK;
}

export function formatLeakageCurrent(result: any): string {
  return fromElectricalReadingFields(result).leakageCurrent || READING_BLANK;
}
