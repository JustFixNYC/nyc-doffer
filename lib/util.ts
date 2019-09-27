/**
 * Attempt to parse the given string into a Date,
 * returning `null` if unsuccessful.
 */
export function parseDate(text: string): Date|null {
  const ms = Date.parse(text);
  if (isNaN(ms)) return null;
  return new Date(ms);
}
