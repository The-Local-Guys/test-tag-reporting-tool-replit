const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Monthly",
  threemonthly: "3 Monthly",
  sixmonthly: "6 Monthly",
  twelvemonthly: "12 Monthly",
  annually: "12 Monthly",
  twentyfourmonthly: "24 Monthly",
  fiveyearly: "5 Yearly",
  customfrequency: "Custom",
};

const SERVICES_WITHOUT_FREQUENCY = new Set([
  "rcd_reporting",
  "microwave_leakage",
]);

export function formatFrequencyLabel(
  frequency?: string | null,
  serviceType?: string | null,
): string {
  if (serviceType && SERVICES_WITHOUT_FREQUENCY.has(serviceType)) {
    return "Not applicable";
  }

  if (!frequency) return "-";

  return (
    FREQUENCY_LABELS[frequency] ||
    frequency
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}
