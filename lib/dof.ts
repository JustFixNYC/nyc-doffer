import puppeteer from 'puppeteer';
import cheerio from 'cheerio';

import { BBL } from './bbl';
import { clickAndWaitForNavigation } from './page-util';
import { parseDate } from './util';

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

export enum SidebarLinkName {
  noticesOfPropertyValue = 'Notices of Property Value',
  propertyTaxBills = 'Property Tax Bills'
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
  name: SidebarLinkName,
  href: string
};

/**
 * Return information about the sidebar links on a DOF property page.
 */
export async function getSidebarLinks(page: puppeteer.Page): Promise<SidebarLink[]> {
  return page.$$eval(SIDEBAR_LINKS, elements => {
    return elements.map(el => {
      const name = (el.textContent || '').trim() as SidebarLinkName;
      const href = (el as HTMLAnchorElement).href;
      return { name, href };
    });
  });
}

/**
 * Go to the DOF property page sidebar link with the given name.
 */
export async function gotoSidebarLink(page: puppeteer.Page, name: SidebarLinkName): Promise<void> {
  const links = await getSidebarLinks(page);
  const link = links.filter(l => l.name === name)[0];
  if (!link) {
    throw new Error(`Sidebar link not found: ${name}`);
  }
  await page.goto(link.href);
}

/** Represents a link to a Notice of Property Value PDF. */
export type NOPVLink = {
  /** The period, e.g. "Revised 2015 - 2016". */
  period: string,
  /** The statement date. */
  date: Date,
  /** The URL to the PDF of the statement. */
  url: string
};

/**
 * Attempt to scrape Notice of Property Value (NOPV) links from the NOPV page
 * on the NYC DOF site.
 */
export function parseNOPVLinks(html: string): NOPVLink[] {
  const links: NOPVLink[] = [];
  const $ = cheerio.load(html);

  $('table[id="Notices of Property Value"] tr').each((i, el) => {
    const cells = $('td', el);
    if (cells.length < 2) return;
    const period = $(cells[0]).text().trim();
    if (!period) return;
    const link = $('a', cells[1])[0];
    if (!link) return;
    const date = parseDate($(link).text().trim());
    const url = link.attribs['href'];
    if (!date || !url) return;
    links.push({period, date, url});
  });

  return links;
}
