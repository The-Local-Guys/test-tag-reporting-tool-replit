/** Keep New Zealand consistent across web, mobile, and copied reports. */
export function normalizeCountry(country: string): string {
  return country.toLowerCase().replace(/[\s_-]/g, '') === 'newzealand'
    ? 'newzealand'
    : country;
}
