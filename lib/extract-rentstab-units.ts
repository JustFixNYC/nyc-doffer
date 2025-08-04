export function extractRentStabilizedUnits(text: string): number | null {
  // Sometimes the same fee will appear multiple times in a document (eg. when
  // there is a "previous year" section) which previously led to double
  // counting. So now we use the unique 8-digit "fee identifier" that appears on
  // each RS fee line to avoid counting duplicates.
  const re =
    /(?:Housing-Rent\s+Stabilization|Rent\s+Stabilization(?:\s+Fee)?-\s+Chg)\s+(\d+).*?(\d{8})/gi;
  let total = 0;
  let match: RegExpExecArray | null = null;
  let feeIds: string[] = [];

  do {
    match = re.exec(text);
    if (match && !feeIds.includes(match[2])) {
      total += parseInt(match[1]);
      feeIds.push(match[2]);
    }
  } while (match);

  return total === 0 ? null : total;
}
