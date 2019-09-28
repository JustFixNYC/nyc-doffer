const REGEX = /(?:Housing-Rent Stabilization|Rent Stabilization Fee- Chg)\s+(\d+)/i;

export function extractRentStabilizedUnits(text: string): number|null {
  const match = text.match(REGEX);
  if (!match) return null;
  return parseInt(match[1]);
}
