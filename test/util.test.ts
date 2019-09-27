import { expect } from 'chai';
import { parseDate } from '../lib/util';

describe("parseDate()", () => {
  it("returns null when string can't be parsed", () => {
    expect(parseDate("BLARG")).to.be.null;
  });

  it("returns Date when string can be parsed", () => {
    const date = parseDate("January     3, 2015");
    expect(date && date.toDateString()).to.eql('Sat Jan 03 2015');
  });
});
