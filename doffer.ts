import path from 'path';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

import { FileSystemCacheBackend, asTextCache, asJSONCache, asBrotliCache, DOFCache, DOFCacheBackend } from './lib/cache';
import { BBL } from './lib/bbl';
import { searchForBBL, gotoSidebarLink, SidebarLinkName, parseNOPVLinks, NOPVLink, SOALink, parseSOALinks } from './lib/dof';
import { getPageHTML } from './lib/page-util';
import { download } from './lib/download';
import { convertPDFToText, PDFToTextFlags, EXPECTED_PDFTOTEXT_VERSION } from './lib/pdf-to-text';
import { extractNetOperatingIncome } from './lib/extract-noi';
import { getFirstGeoSearchResult, GeoSearchProperties } from './lib/geosearch';
import { extractRentStabilizedUnits } from './lib/extract-rentstab-units';
import { launchBrowser } from './lib/browser';
import { Log, defaultLog } from './lib/log';
import { S3CacheBackend } from './lib/cache-s3';
import { S3Client } from '@aws-sdk/client-s3-node';

dotenv.config();

export const CACHE_DIR = path.join(__dirname, '.dof-cache');
export const S3_BUCKET = process.env.S3_BUCKET || '';
export const DISABLE_BROTLI = !!process.env.DISABLE_BROTLI;

export function getCacheFromEnvironment(): DOFCache {
  let cacheBackend: DOFCacheBackend;

  if (S3_BUCKET) {
    cacheBackend = new S3CacheBackend(new S3Client({}), S3_BUCKET);
  } else {
    cacheBackend = new FileSystemCacheBackend(CACHE_DIR);
  }

  let cache = new DOFCache(cacheBackend);

  if (!DISABLE_BROTLI) {
    cache = asBrotliCache(cache);
  }

  return cache;
}

export class PageGetter {
  private browser: puppeteer.Browser|null = null;
  private page: puppeteer.Page|null = null;
  private bbl: BBL|null = null;

  constructor(readonly log: Log = defaultLog) {
  }

  async getPage(bbl: BBL, linkName: SidebarLinkName): Promise<string> {
    if (!this.browser) {
      this.browser = await launchBrowser();
    }
    if (!this.page) {
      this.page = await this.browser.newPage();
    }
    if (!this.bbl || this.bbl.toString() !== bbl.toString()) {
      this.bbl = bbl;
      if (!await searchForBBL(this.page, this.bbl, this.log)) {
        throw new Error(`DOF property page for BBL ${this.bbl} does not exist`);
      }
    }
    await gotoSidebarLink(this.page, linkName);
    return getPageHTML(this.page);
  }

  async cachedGetPageHTML(bbl: BBL, linkName: SidebarLinkName, cache: DOFCache, cacheSubkey: string): Promise<string> {
    return asTextCache(cache).lazyGet(
      `html/${bbl.asPath()}/${cacheSubkey}.html`,
      () => this.getPage(bbl, linkName)
    );
  }

  async cachedDownloadPDF(bbl: BBL, url: string, name: string, cache: DOFCache, cacheSubkey: string): Promise<Buffer> {
    return cache.lazyGet(`pdf/${bbl.asPath()}/${cacheSubkey}.pdf`, () => {
      this.log(`Downloading ${name} PDF...`);
      return download(url);
    });
  }

  async cachedDownloadAndConvertPDFToText(bbl: BBL, url: string, name: string, cache: DOFCache, cacheSubkey: string, extraFlags?: PDFToTextFlags[]): Promise<string> {
    const pdfToTextKey = `pdftotext-${EXPECTED_PDFTOTEXT_VERSION}` + (extraFlags || []).join('');
    return asTextCache(cache).lazyGet(`txt/${bbl.asPath()}/${cacheSubkey}_${pdfToTextKey}.txt`, async () => {
      const pdfData = await this.cachedDownloadPDF(bbl, url, name, cache, cacheSubkey);
      this.log(`Converting ${name} PDF to text...`);
      return convertPDFToText(pdfData, extraFlags);
    });
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
async function cachedGeoSearch(text: string, cache: DOFCache, log: Log = defaultLog): Promise<GeoSearchProperties|null> {
  const simpleText = text.toLowerCase().replace(/[^a-z0-9\- ]/g, '');
  const cacheKey = `geosearch/${simpleText.replace(/ /g, '_')}.json`;
  return asJSONCache<GeoSearchProperties|null>(cache).lazyGet(cacheKey, () => {
    log(`Geocoding "${simpleText}"...`);
    return getFirstGeoSearchResult(simpleText);
  });
}

export type linkFilter = (link: {date: string}) => boolean;

export const defaultLinkFilter: linkFilter = () => true;

/** Information about a BBL's Notice of Property Value (NOPV) for a particular period. */
type NOPVInfo = NOPVLink & {
  /** The BBL's Net Operating Income (NOI) for the period. */
  noi: string|null
};

/** Retrieves and extracts all information related to a BBL's Notices of Property Value. */
async function getNOPVInfo(pageGetter: PageGetter, bbl: BBL, cache: DOFCache, filter: linkFilter = defaultLinkFilter): Promise<NOPVInfo[]>  {
  const results: NOPVInfo[] = [];

  const page = SidebarLinkName.noticesOfPropertyValue;
  const html = await pageGetter.cachedGetPageHTML(bbl, page, cache, 'nopv');
  const links = parseNOPVLinks(html).filter(filter);

  for (let link of links) {
    const name = `${link.date} NOPV for BBL ${bbl}`;
    const text = await pageGetter.cachedDownloadAndConvertPDFToText(bbl, link.url, name, cache, `nopv-${link.date}`, ['-layout']);
    const noi = extractNetOperatingIncome(text);
    results.push({...link, noi});
  }

  return results;
}

type SOAInfo = SOALink & {
  rentStabilizedUnits: number|null,
};

export type PropertyInfo = {
  name: string,
  borough: string,
  bbl: string,
  nopv: NOPVInfo[],
  soa: SOAInfo[]
};

async function getSOAInfo(pageGetter: PageGetter, bbl: BBL, cache: DOFCache, filter: linkFilter = defaultLinkFilter): Promise<SOAInfo[]> {
  const results: SOAInfo[] = [];

  const page = SidebarLinkName.propertyTaxBills;
  const html = await pageGetter.cachedGetPageHTML(bbl, page, cache, 'soa');
  const links = parseSOALinks(html).filter(filter);

  for (let link of links) {
    if (link.quarter !== 1) continue;

    const name = `${link.date} Q1 SOA for BBL ${bbl}`;
    const text = await pageGetter.cachedDownloadAndConvertPDFToText(bbl, link.url, name, cache, `soa-${link.date}`, ['-table']);
    const rentStabilizedUnits = extractRentStabilizedUnits(text);

    results.push({...link, rentStabilizedUnits});
  }

  return results;
}

export async function getPropertyInfoForBBLWithPageGetter(bbl: BBL, cache: DOFCache, pageGetter: PageGetter, filter: linkFilter = defaultLinkFilter): Promise<Omit<PropertyInfo, 'name'|'borough'>> {
  const nopv = await getNOPVInfo(pageGetter, bbl, cache, filter);
  const soa = await getSOAInfo(pageGetter, bbl, cache, filter);

  return {bbl: bbl.toString(), nopv, soa};
}

async function getPropertyInfoForBBL(bbl: BBL, name: string, borough: string, cache: DOFCache, log: Log = defaultLog): Promise<PropertyInfo> {
  const pageGetter = new PageGetter(log);

  try {
    return {...await getPropertyInfoForBBLWithPageGetter(bbl, cache, pageGetter), name, borough};
  } finally {
    await pageGetter.shutdown();
  }
}

export async function getPropertyInfoForAddress(address: string, cache: DOFCache, log: Log = defaultLog): Promise<PropertyInfo> {
  const geo = await cachedGeoSearch(address, cache, log);
  if (!geo) {
    throw new GracefulError("The search text is invalid.");
  }
  const bbl = BBL.from(geo.pad_bbl);

  log(`Searching NYC DOF website for BBL ${bbl} (${geo.name}, ${geo.borough}).`);

  return getPropertyInfoForBBL(bbl, geo.name, geo.borough, cache, log);
}

export async function mainWithSearchText(searchText: string, log: Log = defaultLog) {
  const cache = getCacheFromEnvironment();
  console.log(`Using cache ${cache.description}.`);
  const rtfl = new Intl.RelativeTimeFormat('en');
  const start = Date.now();
  const {nopv, soa} = await getPropertyInfoForAddress(searchText, cache, log);
  for (let {period, noi} of nopv) {
    if (noi) {
      log(`The net operating income for ${period} is ${noi}.`);
    }
  }

  for (let {period, rentStabilizedUnits} of soa) {
    if (rentStabilizedUnits) {
      log(`During ${period}, the property had ${rentStabilizedUnits} rent stabilized units.`);
    }
  }

  const relTime = rtfl.format((Date.now() - start) / 1000.0, 'second');
  log(`Done ${relTime}.`);
}

/** The main CLI program. */
async function main(argv: string[], log: Log = defaultLog) {
  const searchText = argv[2];

  if (!searchText) {
    throw new GracefulError(`Usage: doffer.js <search text>`);
  }

  return mainWithSearchText(searchText, log);
}

/** Error subclass that represents a graceful failure of the CLI. */
export class GracefulError extends Error {
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
