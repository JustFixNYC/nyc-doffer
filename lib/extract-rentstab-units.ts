export function extractRentStabilizedUnits(text: string): number|null {
  const re = /(?:Housing-Rent\s+Stabilization|Rent\s+Stabilization(?:\s+Fee)?-\s+Chg)\s+(\d+)/ig;
  let total = 0;
  let match: RegExpExecArray|null = null;

  do {
    match = re.exec(text);
    if (match) {
      total += parseInt(match[1]);
    }
  } while (match);

  return total === 0 ? null : total;
  /*  TODO: potential solutions to double counting
   *  1. return 9999 if there's more than 1 match for manual flagging
        Q: are there examples of rent stab units showing up partially to form a total sum? 
   *  2. execute do while loop just once 
   * 
   *  test on regex101.com
   * (?:Housing-Rent\s+Stabilization|Rent\s+Stabilization(?:\s+Fee)?-\s+Chg)\s+(\d+)
   */
}
