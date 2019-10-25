import dotenv from 'dotenv';
import docopt from 'docopt';
import { database } from './lib/db';

dotenv.config();

const VERSION = '0.0.1';

const DOC = `
Usage:
  dbtool.js test_connection
  dbtool.js -h | --help
`;

type CommandOptions = {
  test_connection: boolean
};

async function main() {
  const options: CommandOptions = docopt.docopt(DOC, {version: VERSION});

  if (options.test_connection) {
    await testConnection();
  }
}

async function testConnection() {
  const db = database.get();

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
