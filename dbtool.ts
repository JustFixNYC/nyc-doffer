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
  dbtool.js build_bbl_table
  dbtool.js -h | --help
`;

type CommandOptions = {
  test_connection: boolean;
  test_nycdb_connection: boolean;
  build_bbl_table: boolean;
};

async function main() {
  const options: CommandOptions = docopt.docopt(DOC, {version: VERSION});

  if (options.test_connection) {
    await testConnection();
  } else if (options.test_nycdb_connection) {
    await testNycdbConnection();
  } else if (options.build_bbl_table) {
    await buildBblTable();
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

async function buildBblTable() {
  // TODO: Create BBL table.
  await exportNycdbBblsToTable('hpd_registrations');
}

async function exportNycdbBblsToTable(table: string, pageSize: number = 10_000) {
  const nycdb = nycdbConnector.get();
  const {count}: {count: number} = await nycdb.one(`SELECT COUNT(DISTINCT bbl) FROM ${table};`);

  console.log(`Found ${Intl.NumberFormat().format(count)} unique BBLs in ${table} table.`);

  const pages = Math.ceil(count / pageSize);
  const bar = new ProgressBar(':bar :percent', { total: pages });
  for (let i = 0; i < pages; i++) {
    const bbls: { bbl: string }[] = await nycdb.many(
      `SELECT DISTINCT bbl FROM ${table} ORDER BY bbl LIMIT ${pageSize} OFFSET ${i * pageSize};`);
    bbls; // TODO: Replace this with inserting BBLs into table.
    bar.tick();
  }
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
