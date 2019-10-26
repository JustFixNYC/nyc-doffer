import dotenv from 'dotenv';
import docopt from 'docopt';
import { databaseConnector, nycdbConnector } from './lib/db';

dotenv.config();

const VERSION = '0.0.1';

const DOC = `
Usage:
  dbtool.js test_connection
  dbtool.js test_nycdb_connection
  dbtool.js -h | --help
`;

type CommandOptions = {
  test_connection: boolean;
  test_nycdb_connection: boolean;
};

async function main() {
  const options: CommandOptions = docopt.docopt(DOC, {version: VERSION});

  if (options.test_connection) {
    await testConnection();
  } else if (options.test_nycdb_connection) {
    await testNycdbConnection();
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
