import dotenv from 'dotenv';
import docopt from 'docopt';
import ProgressBar from 'progress';
import { databaseConnector, nycdbConnector } from './lib/db';

dotenv.config();

const VERSION = '0.0.1';

const DOC = `
Usage:
  dbtool.js test_connection
  dbtool.js test_nycdb_connection
  dbtool.js build_bbl_table <table_name>
  dbtool.js -h | --help
`;

type CommandOptions = {
  test_connection: boolean;
  test_nycdb_connection: boolean;
  build_bbl_table: boolean;
  '<table_name>': string|null
};

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
  }
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
      success boolean
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
  const columnSet = new databaseConnector.pgp.helpers.ColumnSet(['bbl', 'success'], {table});
  for (let i = 0; i < pages; i++) {
    const nycdbRows: { bbl: string }[] = await nycdb.many(
      `SELECT DISTINCT bbl FROM ${nycdbTable} ORDER BY bbl LIMIT ${pageSize} OFFSET ${i * pageSize};`);
    const insertRows = nycdbRows.map(row => ({
      bbl: row.bbl,
      success: null
    }));
    const insertSQL = databaseConnector.pgp.helpers.insert(insertRows, columnSet);
    await db.none(insertSQL);
    bar.tick();
  }

  await nycdb.$pool.end();
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
