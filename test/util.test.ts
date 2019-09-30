import { parseDate, getISODate } from '../lib/util';

describe("parseDate()", () => {
  it("returns null when string can't be parsed", () => {
    expect(parseDate("BLARG")).toBe(null);
  });

  it("returns Date when string can be parsed", () => {
    const date = parseDate("January     3, 2015");
    expect(date && date.toDateString()).toBe('Sat Jan 03 2015');
  });
});

describe("getISODate()", () => {
  it('works', () => {
    expect(getISODate(new Date(2016, 0, 5))).toBe('2016-01-05');
  });
});
