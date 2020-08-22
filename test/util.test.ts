import { expect } from 'chai';
import { parseDate, getISODate, parseTableName } from '../lib/util';

describe("parseDate()", () => {
  it("returns null when string can't be parsed", () => {
    expect(parseDate("BLARG")).to.be.null;
  });

  it("returns Date when string can be parsed", () => {
    const date = parseDate("January     3, 2015");
    expect(date && date.toDateString()).to.eql('Sat Jan 03 2015');
  });
});

describe("getISODate()", () => {
  it('works', () => {
    expect(getISODate(new Date(2016, 0, 5))).to.eql('2016-01-05');
  });
});

describe("parseTableName()", () => {
  it('works', () => {
    expect(parseTableName('foo.bar')).to.deep.equal({schema: 'foo', table: 'bar'});
    expect(() => parseTableName('foo.bar.baz')).to.throw(/cannot parse table/i);
    expect(parseTableName('blah')).to.deep.equal({table: 'blah'});
  });
});
