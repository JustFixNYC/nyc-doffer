import path from 'path';
import puppeteer from 'puppeteer';

import { FileSystemCache, Cache, asTextCache, asJSONCache } from './lib/cache';
import { BBL } from './lib/bbl';
import { searchForBBL, gotoSidebarLink, SidebarLinkName, parseNOPVLinks, NOPVLink, SOALink, parseSOALinks } from './lib/dof';
import { getPageHTML } from './lib/page-util';
import { download } from './lib/download';
import { getISODate } from './lib/util';
import { convertPDFToText } from './lib/pdf-to-text';
import { extractNetOperatingIncome } from './lib/extract-noi';
import { getFirstGeoSearchResult, GeoSearchProperties } from './lib/geosearch';
import { extractRentStabilizedUnits } from './lib/extract-rentstab-units';

const CACHE_DIR = path.join(__dirname, '.dof-cache');

const CACHE_HTML_ENCODING = 'utf-8';

const CACHE_TEXT_ENCODING = 'utf-8';

class PageGetter {
  private browser: puppeteer.Browser|null = null;
  private page: puppeteer.Page|null = null;
  private bbl: BBL|null = null;

  async getPage(bbl: BBL, linkName: SidebarLinkName): Promise<string> {
    if (!this.browser) {
      this.browser = await puppeteer.launch();
    }
    if (!this.page) {
      this.page = await this.browser.newPage();
    }
    if (!this.bbl || this.bbl.toString() !== bbl.toString()) {
      this.bbl = bbl;
      if (!await searchForBBL(this.page, this.bbl)) {
        throw new Error(`DOF property page for BBL ${this.bbl} does not exist`);
      }
    }
    await gotoSidebarLink(this.page, linkName);
    return getPageHTML(this.page);
  }

  async cachedGetPageHTML(bbl: BBL, linkName: SidebarLinkName, cache: Cache, cacheSubkey: string): Promise<string> {
    return asTextCache(cache, CACHE_HTML_ENCODING).get(
      `html/${bbl}_${cacheSubkey}.html`,
      () => this.getPage(bbl, linkName)
    );
  }

  async cachedDownloadPDF(bbl: BBL, url: string, cache: Cache, cacheSubkey: string): Promise<Buffer> {
    return cache.get(`pdf/${bbl}_${cacheSubkey}.pdf`, () => {
      console.log(`Downloading ${url}...`);
      return download(url);
    });
  }

  async cachedConvertPDFToText(bbl: BBL, pdfData: Buffer, cache: Cache, cacheSubkey: string): Promise<string> {
    return asTextCache(cache, CACHE_TEXT_ENCODING).get(`txt/${bbl}_${cacheSubkey}.txt`, () => {
      console.log(`Converting PDF to text...`);
      return convertPDFToText(pdfData);
    });
  }

  async cachedDownloadAndConvertPDFToText(bbl: BBL, url: string, cache: Cache, cacheSubkey: string): Promise<string> {
    const pdfData = await this.cachedDownloadPDF(bbl, url, cache, cacheSubkey);
    return this.cachedConvertPDFToText(bbl, pdfData, cache, cacheSubkey);
  }

  async shutdown() {
    this.bbl = null;
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/**
 * Attempt to geolocate the given search text and return the result, using
 * a cached value if possible.
 */
async function cachedGeoSearch(text: string, cache: Cache): Promise<GeoSearchProperties|null> {
  const simpleText = text.replace(/[^a-z0-9\- ]/g, '');
  const cacheKey = `geosearch/${simpleText.replace(/ /g, '_')}.json`;
  return asJSONCache<GeoSearchProperties|null>(cache).get(cacheKey, () => {
    console.log(`Geocoding "${simpleText}"...`);
    return getFirstGeoSearchResult(simpleText);
  });
}

/** Information about a BBL's Notice of Property Value (NOPV) for a particular period. */
type NOPVInfo = NOPVLink & {
  /** The BBL's Net Operating Income (NOI) for the period. */
  noi: string|null
};

/** Retrieves and extracts all information related to a BBL's Notices of Property Value. */
async function getNOPVInfo(pageGetter: PageGetter, bbl: BBL, cache: Cache): Promise<NOPVInfo[]>  {
  const results: NOPVInfo[] = [];

  const page = SidebarLinkName.noticesOfPropertyValue;
  const html = await pageGetter.cachedGetPageHTML(bbl, page, cache, 'nopv');
  const links = parseNOPVLinks(html);

  // Gather data.
  for (let link of links) {
    const date = getISODate(link.date);
    const text = await pageGetter.cachedDownloadAndConvertPDFToText(bbl, link.url, cache, `nopv-${date}`);
    const noi = extractNetOperatingIncome(text);
    results.push({...link, noi});
  }

  return results;
}

type SOAInfo = SOALink & {
  rentStabilizedUnits: number|null,
};

async function getSOAInfo(pageGetter: PageGetter, bbl: BBL, cache: Cache): Promise<SOAInfo[]> {
  const results: SOAInfo[] = [];

  const page = SidebarLinkName.propertyTaxBills;
  const html = await pageGetter.cachedGetPageHTML(bbl, page, cache, 'soa');
  const links = parseSOALinks(html);

  for (let link of links) {
    if (link.quarter !== 1) continue;

    const date = getISODate(link.date);
    const text = await pageGetter.cachedDownloadAndConvertPDFToText(bbl, link.url, cache, `soa-${date}`);
    const rentStabilizedUnits = extractRentStabilizedUnits(text);

    results.push({...link, rentStabilizedUnits});
  }

  return results;
}

/** Performs the main CLI program on the given BBL. */
async function mainForBBL(bbl: BBL, cache: Cache) {
  const pageGetter = new PageGetter();

  try {
    const nopvInfo = await getNOPVInfo(pageGetter, bbl, cache);
    const soaInfo = await getSOAInfo(pageGetter, bbl, cache);

    for (let {period, noi} of nopvInfo) {
      if (noi) {
        console.log(`The net operating income for ${period} is ${noi}.`);
      }
    }

    for (let {period, rentStabilizedUnits} of soaInfo) {
      if (rentStabilizedUnits) {
        console.log(`During ${period}, the property had ${rentStabilizedUnits} rent stabilized units.`);
      }
    }

    console.log("Done.");
  } finally {
    await pageGetter.shutdown();
  }
}

/** The main CLI program. */
async function main(argv: string[]) {
  const searchText = argv[2];

  if (!searchText) {
    throw new GracefulError(`Usage: doffer.js <search text>`);
  }

  const cache = new FileSystemCache(CACHE_DIR);
  const geo = await cachedGeoSearch(searchText, cache);
  if (!geo) {
    throw new GracefulError("The search text is invalid.");
  }
  const bbl = BBL.from(geo.pad_bbl);
  console.log(`Searching NYC DOF website for BBL ${bbl} (${geo.name}, ${geo.borough}).`);

  return mainForBBL(bbl, cache);
}

/** Error subclass that represents a graceful failure of the CLI. */
class GracefulError extends Error {
}

if (module.parent === null) {
  main(process.argv).catch(e => {
    if (e instanceof GracefulError) {
      e.message && console.log(e.message);
    } else {
      console.error(e);
    }
    process.exit(1);
  });
}
