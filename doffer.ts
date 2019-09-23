import puppeteer from 'puppeteer';

const BBL_SEARCH_URL = 'https://a836-pts-access.nyc.gov/care/search/commonsearch.aspx?mode=persprop';

const AGREE_BTN = '[name="btAgree"]';

const BOROUGH_INPUT = '#inpParid';

const BLOCK_INPUT = '#inpTag';

const LOT_INPUT = '#inpStat';

const SEARCH_BTN = '#btSearch';

const SEARCH_RESULTS = '.SearchResults';

const SEARCH_SUCCESS = '#datalet_header_row';

const ERROR_TEXT = 'p[style^="color: red"]';

enum Borough {
  MANHATTAN = 1,
  BRONX = 2,
  BROOKLYN = 3,
  QUEENS = 4,
  STATEN_ISLAND = 5
}

class BBL {
  constructor(readonly borough: Borough, readonly block: number, readonly lot: number) {
  }

  toString(): string {
    const borough = this.borough.toString();
    const block = this.block.toString().padStart(5, '0');
    const lot = this.lot.toString().padStart(4, '0');
    return `${borough}${block}${lot}`;
  }
}

async function clickAndWaitForNavigation(page: puppeteer.Page, selector: string): Promise<void> {
  await Promise.all([page.waitForNavigation(), page.click(selector)]);
}

/**
 * Search for the given BBL on the NYC DOF site using the given Puppeteer page.
 * 
 * If multiple searhc results exist for the BBL (e.g., if the BBL has multiple
 * easements on it), only the first is used.
 * 
 * Returns true if the search was successful and tax bills exist for the BBL.
 * 
 * Returns false if no tax bills exist for the BBL.
 */
async function searchForBBL(page: puppeteer.Page, bbl: BBL): Promise<boolean> {
  console.log('Visiting DOF site...');
  await page.goto(BBL_SEARCH_URL);
  if (await page.$(AGREE_BTN)) {
    console.log('Agreeing to disclaimer...');
    await clickAndWaitForNavigation(page, AGREE_BTN);
  }
  console.log('Filling out BBL search form...');
  await page.select(BOROUGH_INPUT, bbl.borough.toString());
  await page.type(BLOCK_INPUT, bbl.block.toString());
  await page.type(LOT_INPUT, bbl.lot.toString());
  await clickAndWaitForNavigation(page, SEARCH_BTN);
  const searchResults = await page.$$(SEARCH_RESULTS);
  if (searchResults.length) {
    await Promise.all([page.waitForNavigation(), searchResults[0].click()]);
  }
  if (await page.$(SEARCH_SUCCESS)) {
    return true;
  } else if (await page.$(ERROR_TEXT)) {
    const errorText = await page.$eval(ERROR_TEXT, el => el.textContent);
    if (/.*your search did not find any records*/i.test(errorText || '')) {
      return false;
    }
  }

  throw new Error('Unexpected failure to search for BBL');
}

async function main(bbls: BBL[]) {
  console.log('Launching browser...');
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    for (let i = 0; i < bbls.length; i++) {
      const bbl = bbls[i];
      const found = await searchForBBL(page, bbl);
      if (found) {
        console.log(`Found tax bill for BBL ${bbl}.`);
      } else {
        console.log(`Tax bill for BBL ${bbl} does not exist.`);
      }
      const path = `screenshot_${bbl}.png`;
      await page.screenshot({ path });
      console.log(`Wrote ${path}.`);
    }
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}

// A BBL with property tax bills and no easements.
const BBL_654_PARK_PLACE = new BBL(Borough.BROOKLYN, 1238, 16);

// A BBL with property tax bill and an easement.
const BBL_40_RIVER_ROAD = new BBL(Borough.MANHATTAN, 1373, 1);

// A nonexistent BBL.
const BBL_NONEXISTENT = new BBL(Borough.MANHATTAN, 1373, 999);

main([BBL_654_PARK_PLACE, BBL_40_RIVER_ROAD, BBL_NONEXISTENT]).catch(e => {
  console.error(e);
  process.exit(1);
});
