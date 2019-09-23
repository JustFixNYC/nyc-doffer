import puppeteer from 'puppeteer';
import { BBL } from './bbl';

const BBL_SEARCH_URL = 'https://a836-pts-access.nyc.gov/care/search/commonsearch.aspx?mode=persprop';

const AGREE_BTN = '[name="btAgree"]';

const BOROUGH_INPUT = '#inpParid';

const BLOCK_INPUT = '#inpTag';

const LOT_INPUT = '#inpStat';

const SEARCH_BTN = '#btSearch';

const SEARCH_RESULTS = '.SearchResults';

const SEARCH_SUCCESS = '#datalet_header_row';

const ERROR_TEXT = 'p[style^="color: red"]';

const SIDEBAR_LINKS = '#sidemenu li a';

async function clickAndWaitForNavigation(page: puppeteer.Page, selector: string): Promise<void> {
  await Promise.all([page.waitForNavigation(), page.click(selector)]);
}

/**
 * Search for the given BBL on the NYC DOF site using the given Puppeteer page.
 * 
 * If multiple searhc results exist for the BBL (e.g., if the BBL has multiple
 * easements on it), only the first is used.
 * 
 * Returns true if the search was successful and tax bills exist for the BBL. The
 * page will now be at the DOF property page for the BBL.
 * 
 * Returns false if no tax bills exist for the BBL.
 */
export async function searchForBBL(page: puppeteer.Page, bbl: BBL): Promise<boolean> {
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

export type SidebarLink = {
  name: string,
  href: string
};

/**
 * Return information about the sidebar links on a DOF property page.
 */
export async function getSidebarLinks(page: puppeteer.Page): Promise<SidebarLink[]> {
  return page.$$eval(SIDEBAR_LINKS, elements => {
    return elements.map(el => {
      const name = (el.textContent || '').trim();
      const href = (el as HTMLAnchorElement).href;
      return { name, href };
    });
  });
}
