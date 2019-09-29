import puppeteer from 'puppeteer';

export function launchBrowser(): Promise<puppeteer.Browser> {
  return puppeteer.launch({
    args: process.env.DISABLE_CHROMIUM_SANDBOX === '1' ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
  });
}
