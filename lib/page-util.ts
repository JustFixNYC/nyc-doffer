import puppeteer from 'puppeteer';

/** Click on the given selector and wait for the next page to load. */
export async function clickAndWaitForNavigation(page: puppeteer.Page, selector: string): Promise<void> {
  await Promise.all([page.waitForNavigation(), page.click(selector)]);
}

/** Return the HTML content of the page, not including its DOCTYPE. */
export function getPageHTML(page: puppeteer.Page): Promise<string> {
  return page.evaluate(() => document.documentElement.outerHTML);
}
