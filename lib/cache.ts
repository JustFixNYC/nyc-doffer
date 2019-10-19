import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

export type CacheGetter<T = Buffer> = (key: string) => Promise<T>;

export interface ICache<T = Buffer> {
  get(key: string, lazyGetter: CacheGetter<T>): Promise<T>;
  set(key: string, value: T): Promise<void>;
}

export interface ICacheConverter<T> {
  fromBuffer(value: Buffer): T;
  toBuffer(value: T): Buffer;
}

export class ConvertibleCache<T> implements ICache<T> {
  constructor(readonly cache: ICache, readonly converter: ICacheConverter<T>) {
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

export class TextCacheConverter implements ICacheConverter<string> {
  constructor(readonly encoding?: BufferEncoding) {
  }

  fromBuffer(value: Buffer): string {
    return value.toString(this.encoding);
  }

  toBuffer(value: string): Buffer {
    return Buffer.from(value, this.encoding);
  }
}

export function asTextCache(cache: ICache, encoding?: BufferEncoding): ICache<string> {
  return new ConvertibleCache(cache, new TextCacheConverter(encoding));
}

export class JSONCacheConverter<T> implements ICacheConverter<T> {
  constructor(readonly encoding?: BufferEncoding) {
  }

  fromBuffer(value: Buffer): T {
    return JSON.parse(value.toString(this.encoding));
  }

  toBuffer(value: T): Buffer {
    return Buffer.from(JSON.stringify(value, null, 2), this.encoding);
  }
}

export function asJSONCache<T>(cache: ICache, encoding?: BufferEncoding): ICache<T> {
  return new ConvertibleCache(cache, new JSONCacheConverter<T>(encoding));
}

export type BrotliDataType = 'text'|'generic';

function brotliModeForDataType(type: BrotliDataType): number {
  switch (type) {
    case 'text': return zlib.constants.BROTLI_MODE_TEXT;
    case 'generic': return zlib.constants.BROTLI_MODE_GENERIC;
  }
}

export class BrotliCacheConverter implements ICacheConverter<Buffer> {
  constructor(readonly dataType: BrotliDataType, readonly quality: number) {
  }

  fromBuffer(value: Buffer): Buffer {
    return zlib.brotliDecompressSync(value);
  }

  toBuffer(value: Buffer): Buffer {
    return zlib.brotliCompressSync(value, {
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: brotliModeForDataType(this.dataType),
        [zlib.constants.BROTLI_PARAM_QUALITY]: this.quality,
      }
    });
  }
}

export function asBrotliCache(cache: ICache, dataType: BrotliDataType = 'generic', quality: number = 11): ICache {
  return new ConvertibleCache(cache, new BrotliCacheConverter(dataType, quality));
}

export class FileSystemCache implements ICache {
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
