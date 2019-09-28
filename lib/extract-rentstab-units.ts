const REGEX = /TODO PUT SOMETHING HERE/i;

export function extractRentStabilizedUnits(text: string): number|null {
  const match = text.match(REGEX);
  if (!match) return null;
  return parseInt(match[1]);
}
