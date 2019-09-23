export enum Borough {
  MANHATTAN = 1,
  BRONX = 2,
  BROOKLYN = 3,
  QUEENS = 4,
  STATEN_ISLAND = 5
}

export class BBL {
  constructor(readonly borough: Borough, readonly block: number, readonly lot: number) {
  }

  toString(): string {
    const borough = this.borough.toString();
    const block = this.block.toString().padStart(5, '0');
    const lot = this.lot.toString().padStart(4, '0');
    return `${borough}${block}${lot}`;
  }
}
