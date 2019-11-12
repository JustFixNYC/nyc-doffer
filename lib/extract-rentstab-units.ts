const REGEX = /(?:Housing-Rent\s+Stabilization|Rent\s+Stabilization\s+Fee-\s+Chg)\s+(\d+)/i;

export function extractRentStabilizedUnits(text: string): number|null {
  let total = 0;
  for (let line of text.split('\n')) {
    const match = line.match(REGEX);
    if (match) {
      total += parseInt(match[1]);
    }
  }
  return total === 0 ? null : total;
}
