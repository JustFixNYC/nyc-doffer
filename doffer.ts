import path from 'path';
import puppeteer from 'puppeteer';

import { BBL_654_PARK_PLACE } from "./test-dof-site";
import { FileSystemCache, Cache } from './lib/cache';
import { BBL } from './lib/bbl';
import { searchForBBL, gotoSidebarLink, SidebarLinkName } from './lib/dof';
import { getPageHTML } from './lib/page-util';

const CACHE_DIR = path.join(__dirname, '.dof-cache');

const CACHE_HTML_ENCODING = 'utf-8';

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
    return new Buffer(await getPageHTML(this.page), CACHE_HTML_ENCODING);
  }

  async getCachedPageHTML(bbl: BBL, linkName: SidebarLinkName, cache: Cache, cacheSubkey: string): Promise<string> {
    const buf = await cache.get(
      `html/${bbl}_${cacheSubkey}.html`,
      () => this.getPage(bbl, linkName)
    );
    return buf.toString(CACHE_HTML_ENCODING);
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
    console.log(`Found ${html.length} characters of HTML for "${page}" page.`);
    // TODO: Find PDF links in HTML page and download them.
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
