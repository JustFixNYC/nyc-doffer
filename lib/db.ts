import pgPromise from 'pg-promise';

let db: pgPromise.IDatabase<{}>|null = null;

export function getDatabase() {
  if (!db) {
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
      throw new Error('Please define DATABASE_URL in your environment!');
    }

    const pgp = pgPromise({});

    db = pgp(DATABASE_URL);
  }

  return db;
}
