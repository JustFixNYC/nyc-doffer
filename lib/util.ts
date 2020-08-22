import { ITable } from "pg-promise";

/**
 * Attempt to parse the given string into a Date,
 * returning `null` if unsuccessful.
 */
export function parseDate(text: string): Date|null {
  const ms = Date.parse(text);
  if (isNaN(ms)) return null;
  return new Date(ms);
}

/**
 * Return just the date part of the given Date in ISO format,
 * e.g. 2016-01-02.
 */
export function getISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Parse a Postgres table name into an ITable. `foo.bar`
 * will be interpreted as the schema `foo` and table `bar`.
 */
export function parseTableName(name: string): ITable {
  const parts = name.split('.');
  if (parts.length > 2) {
    throw new Error(`Cannot parse table name ${name}!`);
  }
  if (parts.length === 2) {
    const [schema, table] = parts;
    return {schema, table};
  }
  return {table: parts[0]};
}
