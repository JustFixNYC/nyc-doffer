const REGEX = /net[\s]+operating[\s]+income[\s]+of[\s]+(\$[\d,.]+)\./i;

export function extractNetOperatingIncome(text: string): string|null {
  const match = text.match(REGEX);
  if (!match) return null;
  return match[1];
}
