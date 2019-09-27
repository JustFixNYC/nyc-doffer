/**
 * Attempt to parse the given string into a Date,
 * returning `null` if unsuccessful.
 */
export function parseDate(text: string): Date|null {
  const ms = Date.parse(text);
  if (isNaN(ms)) return null;
  return new Date(ms);
}

/**
 * Return just the date part of the given Date in ISO format,
 * e.g. 2016-01-02.
 */
export function getISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
