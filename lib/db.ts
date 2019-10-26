import pgPromise from 'pg-promise';

class DbSingleton {
  private db: pgPromise.IDatabase<{}>|null = null;
  readonly pgp: pgPromise.IMain<{}>;

  constructor(readonly envVar: string) {
    this.pgp = pgPromise({capSQL: true});
  }

  get() {
    if (!this.db) {
      const url = process.env[this.envVar];

      if (!url) {
        throw new Error(`Please define ${this.envVar} in your environment!`);
      }

      this.db = this.pgp(url);
    }

    return this.db;
  }
}

export const databaseConnector = new DbSingleton('DATABASE_URL');

export const nycdbConnector = new DbSingleton('NYCDB_URL');
