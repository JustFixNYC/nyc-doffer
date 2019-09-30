import { BBL, Borough, isPaddedBBL } from "../lib/bbl";

describe("BBL", () => {
  it("has padded BBL as string representation", () => {
    const bbl = new BBL(Borough.MANHATTAN, 1373, 1);

    expect(bbl.toString()).toEqual('1013730001');
  });

  it("converts from padded representation", () => {
    const bbl = BBL.from('1013730001');
    expect(bbl.borough).toEqual(Borough.MANHATTAN);
    expect(bbl.block).toEqual(1373);
    expect(bbl.lot).toEqual(1);
  });
});

describe("isPaddedBBL()", () => {
  it("returns true when string is a padded BBL", () => {
    expect(isPaddedBBL('1013730001')).toBe(true);
  });

  it("returns false when string has an invalid borough number", () => {
    expect(isPaddedBBL('9013730001')).toBe(false);
  });

  it("returns false when string is not long enough", () => {
    expect(isPaddedBBL('101373000')).toBe(false);
  });

  it("returns false when string is too long", () => {
    expect(isPaddedBBL('10137300011')).toBe(false);
  });
});
