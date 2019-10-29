import dotenv from 'dotenv';
import docopt from 'docopt';
import ProgressBar from 'progress';
import { databaseConnector, nycdbConnector } from './lib/db';
import { PageGetter, getCacheFromEnvironment, getPropertyInfoForBBLWithPageGetter, linkFilter, defaultLinkFilter } from './doffer';
import { BBL } from './lib/bbl';
import { asJSONCache } from './lib/cache';

dotenv.config();

const VERSION = '0.0.1';

// How frequently we publish the scrape statistics during the scrape. If
// this is N, we will re-publish the stats every N BBLs we scrape.
const PUBLISH_SCRAPE_STATUS_MOD = 2;

const DOC = `
Usage:
  dbtool.js test_connection
  dbtool.js test_nycdb_connection
  dbtool.js build_bbl_table <table_name>
  dbtool.js scrape <table_name> [--only-year=<year>]
  dbtool.js clear_scraping_errors <table_name>
  dbtool.js scrape_status <table_name>
  dbtool.js -h | --help
`;

type CommandOptions = {
  test_connection: boolean;
  test_nycdb_connection: boolean;
  build_bbl_table: boolean;
  clear_scraping_errors: boolean;
  scrape: boolean;
  scrape_status: boolean;
  '--only-year': string|null;
  '<table_name>': string|null
};

function assertNullOrInt(value: string|null): number|null {
  if (value === null) return null;
  const num = parseInt(value);
  if (isNaN(num)) {
    throw new Error(`${value} is not a number!`);
  }
  return num;
}

function assertNotNull<T>(value: T|null): T {
  if (value === null) {
    throw new Error(`Assertion failure!`);
  }
  return value;
}

async function main() {
  const options: CommandOptions = docopt.docopt(DOC, {version: VERSION});

  if (options.test_connection) {
    await testConnection();
  } else if (options.test_nycdb_connection) {
    await testNycdbConnection();
  } else if (options.build_bbl_table) {
    await buildBblTable(assertNotNull(options['<table_name>']));
  } else if (options.scrape) {
    const tableName = assertNotNull(options['<table_name>']);
    const year = assertNullOrInt(options['--only-year']);
    await scrapeBBLsInTable(tableName, year);
  } else if (options.scrape_status) {
    await scrapeStatus(assertNotNull(options['<table_name>']));
  } else if (options.clear_scraping_errors) {
    const tableName = assertNotNull(options['<table_name>']);
    await clearScrapingErrors(tableName);
  }
}

async function clearScrapingErrors(table: string) {
  const db = databaseConnector.get();
  await db.none(`update ${table} set success = NULL, errormessage = NULL where success = false;`);
}

async function testNycdbConnection() {
  const nycdb = nycdbConnector.get();
  const table = 'hpd_registrations';
  const bbls: {count: number} = await nycdb.one(`SELECT COUNT(DISTINCT bbl) FROM ${table};`);

  console.log(`Found ${Intl.NumberFormat().format(bbls.count)} unique BBLs in ${table} table.`);
  console.log(`Your NYCDB connection seems to be working!`);

  await nycdb.$pool.end();
}

async function buildBblTable(table: string) {
  console.log(`Creating table '${table}'.`);
  const createTableSQL = `
    CREATE TABLE ${table} (
      bbl char(10) PRIMARY KEY,
      success boolean,
      errorMessage text
    );
  `;
  const db = databaseConnector.get();
  await db.none(createTableSQL);

  await exportNycdbBblsToTable('hpd_registrations', table);

  await db.$pool.end();
}

async function exportNycdbBblsToTable(nycdbTable: string, table: string, pageSize: number = 10_000) {
  const nycdb = nycdbConnector.get();
  const db = databaseConnector.get();
  const {count}: {count: number} = await nycdb.one(`SELECT COUNT(DISTINCT bbl) FROM ${nycdbTable};`);

  console.log(`Found ${Intl.NumberFormat().format(count)} unique BBLs in ${nycdbTable} table.`);

  const pages = Math.ceil(count / pageSize);
  const bar = new ProgressBar(':bar :percent', { total: pages });
  const columnSet = new databaseConnector.pgp.helpers.ColumnSet(['bbl'], {table});
  for (let i = 0; i < pages; i++) {
    const nycdbRows: { bbl: string }[] = await nycdb.many(
      `SELECT DISTINCT bbl FROM ${nycdbTable} ORDER BY bbl LIMIT ${pageSize} OFFSET ${i * pageSize};`);
    const insertRows = nycdbRows.map(row => ({bbl: row.bbl}));
    const insertSQL = databaseConnector.pgp.helpers.insert(insertRows, columnSet);
    await db.none(insertSQL);
    bar.tick();
  }

  await nycdb.$pool.end();
}

async function getScrapeStatus(table: string) {
  const db = databaseConnector.get();
  let successful = 0;
  let unsuccessful = 0;
  let remaining = 0;
  const kinds: {count: string, success: boolean|null}[] = await db.many(
    `SELECT COUNT(*), success FROM ${table} GROUP BY success;`
  );
  kinds.forEach(kind => {
    const count = parseInt(kind.count);
    if (kind.success === true) {
      successful = count;
    } else if (kind.success === false) {
      unsuccessful = count;
    } else {
      remaining = count;
    }
  });
  return {table, successful, unsuccessful, remaining};
}

async function scrapeStatus(table: string) {
  const stats = await getScrapeStatus(table);
  const cache = getCacheFromEnvironment();
  console.log(stats);
  console.log(`You should also be able to see this information at:`);
  console.log(cache.urlForKey(statusKeyForScrape(table)));
  await databaseConnector.get().$pool.end();
}

function statusKeyForScrape(table: string) {
  return `status-${table}.json`;
}

async function scrapeBBLsInTable(table: string, onlyYear: number|null) {
  const db = databaseConnector.get();
  const pageGetter = new PageGetter();
  const cache = getCacheFromEnvironment();
  const filter: linkFilter = onlyYear ? (link) => link.date.startsWith(onlyYear.toString()) : defaultLinkFilter;
  const statusKey = statusKeyForScrape(table)
  let i = 0;
  while (true) {
    const row: {bbl: string}|null = await db.oneOrNone(`SELECT bbl FROM ${table} WHERE success IS NULL LIMIT 1;`);
    if (row === null) break;
    let success = false;
    let errorMessage = null;
    try {
      await getPropertyInfoForBBLWithPageGetter(BBL.from(row.bbl), cache, pageGetter, filter);
      success = true;
    } catch (e) {
      console.error(e);
      errorMessage = e.message;
    }
    await db.none(`UPDATE ${table} SET success = $1, errorMessage = $2 WHERE bbl = $3`, [success, errorMessage, row.bbl]);
    if (i % PUBLISH_SCRAPE_STATUS_MOD === 0) {
      console.log(`Updating ${cache.urlForKey(statusKey)}.`);
      const status = await getScrapeStatus(table);
      await asJSONCache(cache).set(statusKey, status);
    }
    i++;
  }

  await db.$pool.end();
}

async function testConnection() {
  const db = databaseConnector.get();

  const tables = await db.any('SELECT * FROM pg_tables;');

  console.log(`Found ${tables.length} entries in pg_tables.`);
  console.log('Your connection seems to be working!');

  await db.$pool.end();
}

if (module.parent === null) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
