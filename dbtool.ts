import dotenv from 'dotenv';
import docopt from 'docopt';
import ProgressBar from 'progress';
import { databaseConnector, nycdbConnector } from './lib/db';
import { PageGetter, getCacheFromEnvironment, getPropertyInfoForBBLWithPageGetter, linkFilter } from './doffer';
import { BBL } from './lib/bbl';
import { asJSONCache } from './lib/cache';

dotenv.config();

const VERSION = '0.0.1';

const DOC = `
Database tool for bulk scraping the NYC DOF website.

Usage:
  dbtool.js test_connection
  dbtool.js test_nycdb_connection
  dbtool.js build_bbl_table <table_name> <source_nycdb_table_name>
  dbtool.js scrape <table_name> [--only-year=<year>] [--only-soa] [--only-nopv]
    [--parallelism=<n>]
  dbtool.js clear_scraping_errors <table_name>
  dbtool.js scrape_status <table_name>
  dbtool.js -h | --help

Options:
  -h, --help          Show this screen.
  --parallelism=<n>  Maximum number of BBLs to process at once [default: 1].
`;

type CommandOptions = {
  test_connection: boolean;
  test_nycdb_connection: boolean;
  build_bbl_table: boolean;
  clear_scraping_errors: boolean;
  scrape: boolean;
  scrape_status: boolean;
  '--only-year': string|null;
  '--only-nopv': boolean;
  '--only-soa': boolean;
  '--parallelism': string;
  '<source_nycdb_table_name>': string|null;
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

function getPositiveInt(value: string): number {
  const num = parseInt(value);
  if (isNaN(num) || num <= 0) {
    throw new Error(`'${value}' must be a positive integer!`);
  }
  return num;
}

async function main() {
  const options: CommandOptions = docopt.docopt(DOC, {version: VERSION});
  const parallelism = getPositiveInt(options["--parallelism"]);

  if (options.test_connection) {
    await testConnection();
  } else if (options.test_nycdb_connection) {
    await testNycdbConnection();
  } else if (options.build_bbl_table) {
    const tableName = assertNotNull(options['<table_name>']);
    const sourceNycdbTable = assertNotNull(options['<source_nycdb_table_name>']);
    await buildBblTable(tableName, sourceNycdbTable);
  } else if (options.scrape) {
    await scrapeBBLsInTable(assertNotNull(options['<table_name>']), {
      onlyYear: assertNullOrInt(options['--only-year']),
      onlyNOPV: options['--only-nopv'],
      onlySOA: options['--only-soa'],
      parallelism
    });
  } else if (options.scrape_status) {
    await scrapeStatus(assertNotNull(options['<table_name>']));
  } else if (options.clear_scraping_errors) {
    const tableName = assertNotNull(options['<table_name>']);
    await clearScrapingErrors(tableName);
  }
}

async function clearScrapingErrors(table: string) {
  const db = databaseConnector.get();
  await db.none(
    `update ${table} set success = NULL, errormessage = NULL, info = NULL` +
    `  where success = false and errormessage not like 'DOF property page for BBL % does not exist';`
  );
}

async function testNycdbConnection() {
  const nycdb = nycdbConnector.get();
  const table = 'hpd_registrations';
  const bbls: {count: number} = await nycdb.one(`SELECT COUNT(DISTINCT bbl) FROM ${table};`);

  console.log(`Found ${Intl.NumberFormat().format(bbls.count)} unique BBLs in ${table} table.`);
  console.log(`Your NYCDB connection seems to be working!`);

  await nycdb.$pool.end();
}

async function buildBblTable(table: string, nycdbTable: string, pageSize: number = 10_000) {
  let createdTable = false;
  const createSQL = `
    CREATE TABLE ${table} (
      bbl char(10) PRIMARY KEY,
      success boolean,
      errorMessage text,
      info jsonb
    );
  `;
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
    if (!createdTable) {
      console.log(`Creating table '${table}'.`);
      await db.none(createSQL);
      createdTable = true;
    }
    await db.none(insertSQL);
    bar.tick();
  }

  await nycdb.$pool.end();
  await db.$pool.end();
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

type ScrapeOptions = {
  onlyYear: number|null,
  onlySOA: boolean,
  onlyNOPV: boolean,
  parallelism: number
};

async function scrapeBBLsInTable(table: string, options: ScrapeOptions) {
  const {onlyYear, onlySOA, onlyNOPV, parallelism} = options;
  const db = databaseConnector.get();
  const pageGetters: PageGetter[] = [];
  for (let i = 0; i < parallelism; i++) {
    pageGetters.push(new PageGetter());
  }
  const cache = getCacheFromEnvironment();
  const filter: linkFilter = (link) => {
    if (onlyYear && !link.date.startsWith(onlyYear.toString())) return false;
    if (onlySOA && link.kind !== 'soa') return false;
    if (onlyNOPV && link.kind !== 'nopv') return false;
    return true;
  };
  const statusKey = statusKeyForScrape(table)
  console.log(`Using cache ${cache.description}.`);
  while (true) {
    const rows: {bbl: string}[] = await db.manyOrNone(`SELECT bbl FROM ${table} WHERE success IS NULL LIMIT ${parallelism};`);
    if (rows.length === 0) break;

    await Promise.all(rows.map(async (row, i) => {
      const pageGetter = pageGetters[i];
      let success = false;
      let errorMessage = null;
      let info = null;
      try {
        info = await getPropertyInfoForBBLWithPageGetter(BBL.from(row.bbl), cache, pageGetter, filter);
        success = true;
      } catch (e) {
        console.error(e);
        errorMessage = e.message;
      }
      await db.none(`UPDATE ${table} SET success = $1, errorMessage = $2, info = $3 WHERE bbl = $4`, [
        success,
        errorMessage,
        info,
        row.bbl
      ]);
    }));

    const status = await getScrapeStatus(table);
    console.log(`${status.successful} ok / ${status.unsuccessful} failed / ${status.remaining} remain`);
    console.log(`Updating ${cache.urlForKey(statusKey)}.`);
    await asJSONCache(cache).set(statusKey, status);
  }

  console.log('Done.');

  for (let i = 0; i < pageGetters.length; i++) {
    await pageGetters[i].shutdown();
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
