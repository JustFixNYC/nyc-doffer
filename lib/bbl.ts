export enum Borough {
  MANHATTAN = 1,
  BRONX = 2,
  BROOKLYN = 3,
  QUEENS = 4,
  STATEN_ISLAND = 5
}

const BLOCK_MAX_DIGITS = 5;

const LOT_MAX_DIGITS = 4;

export class BBL {
  constructor(readonly borough: Borough, readonly block: number, readonly lot: number) {
  }

  private zeroPaddedParts(): [string, string, string] {
    const borough = this.borough.toString();
    const block = this.block.toString().padStart(BLOCK_MAX_DIGITS, '0');
    const lot = this.lot.toString().padStart(LOT_MAX_DIGITS, '0');
    return [borough, block, lot];
  }

  asPath(): string {
    return this.zeroPaddedParts().join('/');
  }

  toString(): string {
    return this.zeroPaddedParts().join('');
  }

  static from(bbl: string): BBL {
    if (!isPaddedBBL(bbl)) {
      throw new Error(`"${bbl}" is not a padded BBL`);
    }
    
    const borough = parseInt(bbl[0]) as Borough;
    const block = parseInt(bbl.slice(1, 6));
    const lot = parseInt(bbl.slice(6));
    return new BBL(borough, block, lot);
  }
}

export function isPaddedBBL(text: string): boolean {
  return /^[12345]\d\d\d\d\d\d\d\d\d$/.test(text);
}
