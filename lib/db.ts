import pgPromise from 'pg-promise';

class DbSingleton {
  private db: pgPromise.IDatabase<{}>|null = null;

  constructor(readonly envVar: string) {
  }

  get() {
    if (!this.db) {
      const url = process.env[this.envVar];

      if (!url) {
        throw new Error(`Please define ${this.envVar} in your environment!`);
      }

      const pgp = pgPromise({});
      this.db = pgp(url);
    }

    return this.db;
  }
}

export const database = new DbSingleton('DATABASE_URL');

export const nycdb = new DbSingleton('NYCDB_URL');
