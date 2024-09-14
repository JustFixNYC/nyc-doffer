export function extractRentStabilizedUnits(text: string): number | null {
  const re =
    /(?:Housing-Rent\s+Stabilization|Rent\s+Stabilization(?:\s+Fee)?-\s+Chg)\s+(\d+)/gi;
  let total = 0;
  let match: RegExpExecArray | null = null;

  do {
    match = re.exec(text);
    if (match) {
      total += parseInt(match[1]);
    }
  } while (match);

  return total === 0 ? null : total;
}
