import { expect } from 'chai';
import { BBL, Borough } from "../bbl";

describe("BBL", () => {
  it("has padded BBL as string representation", () => {
    const bbl = new BBL(Borough.MANHATTAN, 1373, 1);

    expect(bbl.toString()).to.equal('1013730001');
  });
});
