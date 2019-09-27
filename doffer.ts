import path from 'path';
import puppeteer from 'puppeteer';

import { BBL_654_PARK_PLACE } from "./test-dof-site";
import { FileSystemCache, Cache } from './lib/cache';
import { BBL } from './lib/bbl';
import { searchForBBL, gotoSidebarLink, SidebarLinkName, parseNOPVLinks } from './lib/dof';
import { getPageHTML } from './lib/page-util';
import { download } from './lib/download';
import { getISODate } from './lib/util';
import { convertPDFToText } from './lib/pdf-to-text';
import { extractNetOperatingIncome } from './lib/extract-noi';

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

async function main(bbl: BBL) {
  const pageGetter = new PageGetter();
  const cache = new FileSystemCache(CACHE_DIR);

  try {
    const page = SidebarLinkName.noticesOfPropertyValue;
    const html = await pageGetter.getCachedPageHTML(bbl, page, cache, 'nopv');
    const links = parseNOPVLinks(html);
    for (let link of links) {
      const date = getISODate(link.date);
      const subkey = `nopv-${date}`;
      const pdfData = await pageGetter.downloadPDFToCache(bbl, link.url, cache, subkey);
      const text = await pageGetter.convertAndCachePDFToText(bbl, pdfData, cache, subkey);
      const noi = extractNetOperatingIncome(text);
      if (noi) {
        console.log(`The net operating income for ${link.period} is ${noi}.`);
      }
    }
    console.log("Done.");
  } finally {
    await pageGetter.shutdown();
  }
}

if (module.parent === null) {
  main(BBL_654_PARK_PLACE).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
