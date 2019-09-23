import puppeteer from 'puppeteer';

import { BBL, Borough } from "./bbl";
import { searchForBBL, getSidebarLinks } from './doffer';

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
        const links = await getSidebarLinks(page);
        console.log(JSON.stringify(links, null, 2));
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
