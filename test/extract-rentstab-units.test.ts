import { expect } from 'chai';
import { extractRentStabilizedUnits } from '../lib/extract-rentstab-units';

// Taken from the 240 1ST AVE. (BBL 1009720001) SOA from June 5, 2019.
const MULTI_RENTSTAB_TEXT = `
Rent Stabilization Fee- Chg      96             01/01/2020  50350000            $960.00

Rent Stabilization Fee- Chg      95             01/01/2020  50350100            $950.00
                                      Statement Details                                                               June 1, 2019

                                                                                                             Bpp st Owner LLC

                                                                                                                      240 1st Ave.

                                                                                                             1-00972-0001

                                                                                                                      Page  5

Tax Year Charges Remaining        Activity Date                 Due Date                                              Amount

Rent  Stabilization  Fee-  Chg    105                           01/01/2020  50350200                         $1,050.00

Rent  Stabilization  Fee-  Chg    105                           01/01/2020  50350300                         $1,050.00
`;

const MULTI_RENTSTAB_TOTAL = 96 + 95 + 105 + 105;

describe('()', () => {
  const textAndUnits: [string, number|null][] = [
    ['Rent Stabilization Fee- Chg      103            01/01/2020  50347300            $1,030.00', 103],
    ['Housing-Rent Stabilization       15', 15],
    ['blahh', null],
  ];

  textAndUnits.forEach(([text, units]) => {
    it(`should return ${JSON.stringify(units)} for ${JSON.stringify(text)}`, () => {
      expect(extractRentStabilizedUnits(text)).to.eq(units);
    });
  });

  it(`should combine multiple rent stab charges into a single unit count`, () => {
    expect(extractRentStabilizedUnits(MULTI_RENTSTAB_TEXT)).to.eq(MULTI_RENTSTAB_TOTAL);
  });
});
