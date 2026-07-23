function toPositiveNumber(value: unknown): number | null {
  const candidate =
    value && typeof value === "object" && "value" in value
      ? (value as { value: unknown }).value
      : value;
  const numberValue = Number(candidate);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function normalizeArray(values: unknown[]): number[] {
  return values
    .map(toPositiveNumber)
    .filter((value): value is number => value !== null);
}

export function parseRcdTripTimesInput(value: string): number[] {
  return normalizeArray(value.split(",").map((part) => part.trim()));
}

/**
 * Normalizes RCD trip times across ORM responses, raw SQL responses, edit-form
 * field objects, and legacy storage formats.
 */
export function resolveRcdTripTimes(result: unknown): number[] {
  const source =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  const stored = source.tripTimes ?? source.trip_times;

  if (Array.isArray(stored)) {
    const normalized = normalizeArray(stored);
    if (normalized.length > 0) return normalized;
  }

  if (typeof stored === "string") {
    const normalized = parseRcdTripTimesInput(
      stored.replace(/^[{[]|[}\]]$/g, ""),
    );
    if (normalized.length > 0) return normalized;
  }

  const notes = typeof source.notes === "string" ? source.notes : "";
  const notesMatch = notes.match(/\[TRIP_TIMES:\[([^\]]*)\]\]/);
  if (notesMatch?.[1]) {
    const normalized = parseRcdTripTimesInput(notesMatch[1]);
    if (normalized.length > 0) return normalized;
  }

  const legacyValue = source.tripTime ?? source.trip_time;
  const normalizedLegacyValue = toPositiveNumber(legacyValue);
  return normalizedLegacyValue === null ? [] : [normalizedLegacyValue];
}
