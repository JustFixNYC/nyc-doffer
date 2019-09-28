import fs from 'fs';
import path from 'path';

export type CacheGetter<T = Buffer> = (key: string) => Promise<T>;

export interface Cache<T = Buffer> {
  get(key: string, lazyGetter: CacheGetter<T>): Promise<T>;
  set(key: string, value: T): Promise<void>;
}

export interface CacheConverter<T> {
  fromBuffer(value: Buffer): T;
  toBuffer(value: T): Buffer;
}

export class ConvertibleCache<T> implements Cache<T> {
  constructor(readonly cache: Cache, readonly converter: CacheConverter<T>) {
  }

  async get(key: string, lazyGetter: CacheGetter<T>): Promise<T> {
    const buf = await this.cache.get(key, async () => {
      return this.converter.toBuffer(await lazyGetter(key));
    });
    return this.converter.fromBuffer(buf);
  }

  async set(key: string, value: T): Promise<void> {
    return this.cache.set(key, this.converter.toBuffer(value));
  }
}

export class TextCacheConverter implements CacheConverter<string> {
  constructor(readonly encoding?: BufferEncoding) {
  }

  fromBuffer(value: Buffer): string {
    return value.toString(this.encoding);
  }

  toBuffer(value: string): Buffer {
    return Buffer.from(value, this.encoding);
  }
}

export function asTextCache(cache: Cache, encoding?: BufferEncoding): Cache<string> {
  return new ConvertibleCache(cache, new TextCacheConverter(encoding));
}

export class JSONCacheConverter<T> implements CacheConverter<T> {
  constructor(readonly encoding?: BufferEncoding) {
  }

  fromBuffer(value: Buffer): T {
    return JSON.parse(value.toString(this.encoding));
  }

  toBuffer(value: T): Buffer {
    return Buffer.from(JSON.stringify(value, null, 2), this.encoding);
  }
}

export function asJSONCache<T>(cache: Cache, encoding?: BufferEncoding): Cache<T> {
  return new ConvertibleCache(cache, new JSONCacheConverter<T>(encoding));
}

export class FileSystemCache implements Cache {
  constructor(readonly rootDir: string) {
  }

  private pathForKey(key: string): string {
    return path.join(this.rootDir, ...key.split('/'));
  }

  async get(key: string, lazyGetter: CacheGetter): Promise<Buffer> {
    const keyPath = this.pathForKey(key);
    if (!fs.existsSync(keyPath)) {
      const value = await lazyGetter(key);
      await this.set(key, value);
    }
    return fs.readFileSync(keyPath);
  }

  async set(key: string, value: Buffer): Promise<void> {
    const keyPath = this.pathForKey(key);
    const dirname = path.dirname(keyPath);
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, {recursive: true});
    }
    fs.writeFileSync(keyPath, value);
  }
}
