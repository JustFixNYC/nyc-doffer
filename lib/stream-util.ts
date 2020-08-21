import { Transform, Writable } from "pg-query-stream";
import { ColumnSet, IDatabase, IHelpers } from "pg-promise";

/**
 * Trivial object mode transformer stream that just ticks
 * the bar on each chunk (object).
 */
export function streamingProgressBar(bar: ProgressBar) {
  return new Transform({
    objectMode: true,
    transform(chunk, enc, callback) {
      bar.tick();
      callback(null, chunk);
    }
  });
}

export type BatchedPgInserterOptions<T> = {
  /** The database to write to. */
  db: IDatabase<unknown, any>,

  /** Helpers used to create batch SQL insert statements. */
  helpers: IHelpers,

  /**
   * A sample row that is used to define the column names. Only
   * the keys of this object are used, the values don't matter.
   */
  columns: T,

  /** The table to insert rows into. */
  table: string,

  /**
   * Maximum number of rows to buffer internally before writing
   * them out to the database.
   */
  highWaterMark?: number,
};

/**
 * A writable stream used to insert rows into a Postgres database
 * in batches.
 */
export class BatchedPgInserter<T> extends Writable {
  readonly columnSet: ColumnSet<T>;

  /**
   * This promise will resolve when the stream has ended, and will
   * throw if the stream errors.
   */
  readonly ended: Promise<void>;

  constructor(readonly options: BatchedPgInserterOptions<T>) {
    super({
      objectMode: true,
      highWaterMark: options.highWaterMark,
    });
    const { helpers, columns, table } = options;
    this.columnSet = new helpers.ColumnSet(Object.keys(columns), {table});
    this.ended = endOfStream(this);
  }

  _batchedInsert(objects: T[], callback: (error?: Error | null) => void) {
    const sql = this.options.helpers.insert(objects, this.columnSet);
    this.options.db.none(sql).then(() => callback(null)).catch(callback);
  }

  _write(chunk: T, enc: unknown, callback: (error?: Error | null) => void) {
    this._batchedInsert([chunk], callback);
  }

  _writev(chunks: Array<{ chunk: T, encoding: string }>, callback: (error?: Error | null) => void) {
    this._batchedInsert(chunks.map(chunk => chunk.chunk), callback);
  }
}

/**
 * A promise that resolves when the given stream has ended.
 */
function endOfStream(stream: Writable): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}
