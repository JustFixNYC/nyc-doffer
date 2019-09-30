import { extractNetOperatingIncome } from "../lib/extract-noi";

describe('extractNetOperatingIncome()', () => {
  const textAndNOIs: [string, string|null][] = [
    ['net operating income of $5.', '$5'],
    ['net operating\r\nincome of $5.', '$5'],
    ['net operating   income of $5.', '$5'],
    ['Net operating income of $5.', '$5'],
    ['blahh net operating income of $5.blahh', '$5'],
    ['blahh', null],
  ];

  textAndNOIs.forEach(([text, noi]) => {
    it(`should return ${JSON.stringify(noi)} for ${JSON.stringify(text)}`, () => {
      expect(extractNetOperatingIncome(text)).toEqual(noi);
    });
  });
});
