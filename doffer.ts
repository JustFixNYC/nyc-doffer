import path from 'path';
import puppeteer from 'puppeteer';

import { FileSystemCache, Cache } from './lib/cache';
import { BBL } from './lib/bbl';
import { searchForBBL, gotoSidebarLink, SidebarLinkName, parseNOPVLinks, NOPVLink } from './lib/dof';
import { getPageHTML } from './lib/page-util';
import { download } from './lib/download';
import { getISODate } from './lib/util';
import { convertPDFToText } from './lib/pdf-to-text';
import { extractNetOperatingIncome } from './lib/extract-noi';
import { getFirstGeoSearchResult, GeoSearchProperties } from './lib/geosearch';

const CACHE_DIR = path.join(__dirname, '.dof-cache');

const CACHE_HTML_ENCODING = 'utf-8';

const CACHE_TEXT_ENCODING = 'utf-8';

class PageGetter {
  private browser: puppeteer.Browser|null = null;
  private page: puppeteer.Page|null = null;
  private bbl: BBL|null = null;

  async getPage(bbl: BBL, linkName: SidebarLinkName): Promise<Buffer> {
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
    return Buffer.from(await getPageHTML(this.page), CACHE_HTML_ENCODING);
  }

  async getCachedPageHTML(bbl: BBL, linkName: SidebarLinkName, cache: Cache, cacheSubkey: string): Promise<string> {
    const buf = await cache.get(
      `html/${bbl}_${cacheSubkey}.html`,
      () => this.getPage(bbl, linkName)
    );
    return buf.toString(CACHE_HTML_ENCODING);
  }

  async downloadPDFToCache(bbl: BBL, url: string, cache: Cache, cacheSubkey: string): Promise<Buffer> {
    return cache.get(`pdf/${bbl}_${cacheSubkey}.pdf`, () => {
      console.log(`Downloading ${url}...`);
      return download(url);
    });
  }

  async convertAndCachePDFToText(bbl: BBL, pdfData: Buffer, cache: Cache, cacheSubkey: string): Promise<string> {
    const convert = async () => {
      console.log(`Converting PDF to text...`);
      return Buffer.from(await convertPDFToText(pdfData), CACHE_TEXT_ENCODING);
    };
    const buf = await cache.get(`txt/${bbl}_${cacheSubkey}.txt`, convert);
    return buf.toString(CACHE_TEXT_ENCODING);
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
async function geoSearchAndCache(text: string, cache: Cache): Promise<GeoSearchProperties|null> {
  const simpleText = text.replace(/[^a-z0-9\- ]/g, '');
  const cacheKey = `geosearch/${simpleText.replace(/ /g, '_')}.json`;
  const result = await cache.get(cacheKey, async () => {
    console.log(`Geocoding "${simpleText}"...`);
    const info = await getFirstGeoSearchResult(simpleText);
    return Buffer.from(JSON.stringify(info, null, 2), 'utf-8');
  });
  return JSON.parse(result.toString('utf-8'));
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
  const html = await pageGetter.getCachedPageHTML(bbl, page, cache, 'nopv');
  const links = parseNOPVLinks(html);

  for (let link of links) {
    const date = getISODate(link.date);
    const subkey = `nopv-${date}`;
    const pdfData = await pageGetter.downloadPDFToCache(bbl, link.url, cache, subkey);
    const text = await pageGetter.convertAndCachePDFToText(bbl, pdfData, cache, subkey);
    const noi = extractNetOperatingIncome(text);
    results.push({...link, noi});
  }

  return results;
}

/** Performs the main CLI program on the given BBL. */
async function mainForBBL(bbl: BBL, cache: Cache) {
  const pageGetter = new PageGetter();

  try {
    const nopvInfo = await getNOPVInfo(pageGetter, bbl, cache);

    for (let {period, noi} of nopvInfo) {
      if (noi) {
        console.log(`The net operating income for ${period} is ${noi}.`);
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
  const geo = await geoSearchAndCache(searchText, cache);
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
