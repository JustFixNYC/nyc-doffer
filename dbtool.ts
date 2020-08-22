import fs from 'fs';
import dotenv from 'dotenv';
import docopt from 'docopt';
import ProgressBar from 'progress';
import QueryStream from "pg-query-stream";
import { Transform } from "stream";
import { databaseConnector, nycdbConnector } from './lib/db';
import { PageGetter, getCacheFromEnvironment, getPropertyInfoForBBLWithPageGetter, linkFilter, BasicPropertyInfo, getCachedSoaPdfUrl } from './doffer';
import { BBL } from './lib/bbl';
import { DOFCache, asJSONCache } from './lib/cache';
import { defaultLog } from './lib/log';
import { BatchedPgInserter, streamingProgressBar } from './lib/stream-util';

dotenv.config();

const VERSION = '0.0.1';

const DOC = `
Database tool for bulk scraping the NYC DOF website.

Usage:
  dbtool.js test_connection
  dbtool.js test_nycdb_connection
  dbtool.js build_bbl_table <table_name> <source_nycdb_table_name>
  dbtool.js merge_bbl_tables <source_table_name> <dest_table_name>
  dbtool.js scrape <table_name> [--only-year=<year>] [--only-soa] [--only-nopv]
    [--concurrency=<n>] [--no-browser]
  dbtool.js clear_scraping_errors <table_name>
  dbtool.js scrape_status <table_name>
  dbtool.js output_soa_csv <table_name> <year>
  dbtool.js -h | --help

Options:
  -h, --help         Show this screen.
  --concurrency=<n>  Maximum number of BBLs to process at once [default: 1].
`;

type CommandOptions = {
  test_connection: boolean;
  test_nycdb_connection: boolean;
  build_bbl_table: boolean;
  merge_bbl_tables: boolean;
  output_soa_csv: boolean;
  clear_scraping_errors: boolean;
  scrape: boolean;
  scrape_status: boolean;
  '--only-year': string|null;
  '--only-nopv': boolean;
  '--only-soa': boolean;
  '--no-browser': boolean;
  '--concurrency': string;
  '<source_table_name>': string|null;
  '<dest_table_name>': string|null;
  '<source_nycdb_table_name>': string|null;
  '<table_name>': string|null;
  '<year>': string|null;
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
  const concurrency = getPositiveInt(options["--concurrency"]);

  if (options.test_connection) {
    await testConnection();
  } else if (options.test_nycdb_connection) {
    await testNycdbConnection();
  } else if (options.build_bbl_table) {
    const tableName = assertNotNull(options['<table_name>']);
    const sourceNycdbTable = assertNotNull(options['<source_nycdb_table_name>']);
    await buildBblTable(tableName, sourceNycdbTable);
  } else if (options.merge_bbl_tables) {
    const sourceTableName = assertNotNull(options['<source_table_name>']);
    const destTableName = assertNotNull(options['<dest_table_name>']);
    await mergeBblTables(sourceTableName, destTableName);
  } else if (options.scrape) {
    await scrapeBBLsInTable(assertNotNull(options['<table_name>']), {
      onlyYear: assertNullOrInt(options['--only-year']),
      onlyNOPV: options['--only-nopv'],
      onlySOA: options['--only-soa'],
      noBrowser: options['--no-browser'],
      concurrency
    });
  } else if (options.scrape_status) {
    await scrapeStatus(assertNotNull(options['<table_name>']));
  } else if (options.clear_scraping_errors) {
    const tableName = assertNotNull(options['<table_name>']);
    await clearScrapingErrors(tableName);
  } else if (options.output_soa_csv) {
    const tableName = assertNotNull(options['<table_name>']);
    const year = assertNotNull(options['<year>']);
    await outputSoaCsvFromScrape(tableName, year);
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

async function mergeBblTables(sourceTable: string, destTable: string) {
  const db = databaseConnector.get();

  // We want this to be as non-destructive as possible, e.g. we don't want to accidentally
  // delete a bunch of scraping information if the user forgets the order of arguments
  // or something, hence some of the precautions taken in this SQL.

  console.log(`Dropping all unscraped BBLs from ${destTable} that are in ${sourceTable}.`);
  await db.none(
    `DELETE FROM ${destTable} ` +
    `WHERE bbl IN (SELECT bbl FROM ${sourceTable}) AND success IS NULL;`
  );

  console.log(`Inserting all rows from ${sourceTable} into ${destTable}, ignoring conflicts.`);
  await db.none(
    `INSERT INTO ${destTable} ` +
    `SELECT * FROM ${sourceTable} ` +
    `ON CONFLICT DO NOTHING;`
  );

  console.log(`Done.`);

  await db.$pool.end();
}

async function buildBblTable(table: string, nycdbTable: string) {
  type Row = {
    bbl: string;
  };
  const createSQL = `
    DROP TABLE IF EXISTS ${table};
    CREATE TABLE ${table} (
      bbl char(10) PRIMARY KEY,
      success boolean,
      errorMessage text,
      info jsonb
    );
  `;
  const nycdb = nycdbConnector.get();
  const db = databaseConnector.get();
  const total = parseInt((await nycdb.one(`SELECT COUNT(DISTINCT bbl) FROM ${nycdbTable};`)).count);

  console.log(`Found ${Intl.NumberFormat().format(total)} unique BBLs in ${nycdbTable} table.`);

  console.log(`Creating table '${table}'.`);
  await db.none(createSQL);

  const highWaterMark = 5_000;
  const bar = new ProgressBar(':bar :percent', { total });
  const query = new QueryStream(`SELECT DISTINCT bbl FROM ${nycdbTable}`, undefined, {
    highWaterMark,
  });
  const inserter = new BatchedPgInserter<Row>({
    db,
    helpers: databaseConnector.pgp.helpers,
    columns: {
      bbl: '',
    },
    table,
    highWaterMark,
  });
  await nycdb.stream(query, s => {
    s.pipe(streamingProgressBar(bar)).pipe(inserter);
  });

  await inserter.ended;
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
  noBrowser: boolean,
  concurrency: number
};

type MinimalScrapeRow = {
  bbl: string,
  info: BasicPropertyInfo|null,
  success: boolean|null,
};

type SoaRow = {
  bbl: string,
  success: boolean|null,
  rentStabilizedUnits: number|null,
  soaURL: string|null,
};

function scrapeRowToSoaRow(
  cache: DOFCache,
  row: MinimalScrapeRow,
  year: string
): SoaRow {
  const {bbl, success} = row;
  let soaURL: string|null = null;
  let rentStabilizedUnits: number|null = null;
  if (success && row.info) {
    const soa = row.info.soa.filter(soa => soa.date.slice(0, 4) === year)[0];
    if (soa) {
      soaURL = getCachedSoaPdfUrl(cache, row.bbl, soa.date) || null;
      rentStabilizedUnits = soa.rentStabilizedUnits;
    }
  }
  return {bbl, success, soaURL, rentStabilizedUnits};
}

async function outputSoaCsvFromScrape(table: string, year: string) {
  const cache = getCacheFromEnvironment();
  const db = databaseConnector.get();
  const total = parseInt((await db.one(`SELECT COUNT(*) FROM ${table};`)).count);
  const csvFilename = `${table}.csv`;
  console.log(`Writing ${Intl.NumberFormat().format(total)} rows to ${csvFilename}.`);
  const bar = new ProgressBar(':bar :percent', { total });
  let wroteHeader = false;
  const query = new QueryStream(
    `SELECT bbl, success, info FROM ${table};`, undefined, {
      highWaterMark: 5_000,
    });
  const toCsv = new Transform({
    objectMode: true,
    transform(row: MinimalScrapeRow, enc, callback) {
      if (!wroteHeader) {
        this.push(`bbl,success,rent_stabilized_units,soa_url\n`);
        wroteHeader = true;
      }
      const soa = scrapeRowToSoaRow(cache, row, year);
      this.push([
        soa.bbl,
        soa.success ? "t" : "f",
        soa.rentStabilizedUnits || '',
        soa.soaURL || '',
      ].join(','));
      this.push('\n');
      bar.tick();
      callback();
    }
  });
  const outfile = fs.createWriteStream(csvFilename);

  await db.stream(query, s => {
    s.pipe(toCsv).pipe(outfile);
  });

  await db.$pool.end();
}

async function scrapeBBLsInTable(table: string, options: ScrapeOptions) {
  const {onlyYear, onlySOA, onlyNOPV, concurrency} = options;
  const db = databaseConnector.get();
  const pageGetters: PageGetter[] = [];
  for (let i = 0; i < concurrency; i++) {
    pageGetters.push(new PageGetter(defaultLog, !options.noBrowser));
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
    const rows: {bbl: string}[] = await db.manyOrNone(`SELECT bbl FROM ${table} WHERE success IS NULL LIMIT ${concurrency};`);
    if (rows.length === 0) break;

    await Promise.all(rows.map(async (row, i) => {
      const pageGetter = pageGetters[i];
      let success = false;
      let errorMessage: string|null = null;
      let info: BasicPropertyInfo|null = null;
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
