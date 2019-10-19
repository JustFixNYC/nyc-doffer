import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { pathToFileURL } from 'url';

export const DOF_CACHE_TEXT_ENCODING: BufferEncoding = 'utf8';

export type DOFCacheGetter<T = Buffer> = (key: string) => Promise<T>;

export class DOFCache<T = Buffer> {
  constructor(readonly backend: DOFCacheBackend<T>) {
  }

  urlForKey(key: string): string|undefined {
    if (this.backend.urlForKey) {
      return this.backend.urlForKey(key);
    }
  }

  async lazyGet(key: string, lazyGetter: DOFCacheGetter<T>): Promise<T> {
    let value = await this.get(key);
    if (value === undefined) {
      value = await lazyGetter(key);
      await this.set(key, value);
    }
    return value;
  }

  get(key: string): Promise<T|undefined> {
    return this.backend.get(key);
  }

  set(key: string, value: T): Promise<void> {
    return this.backend.set(key, value);
  }

  delete(key: string): Promise<void> {
    return this.backend.delete(key);
  }
}

export interface DOFCacheBackend<T = Buffer> {
  urlForKey?: (key: string) => string;
  get(key: string): Promise<T|undefined>;
  set(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface DOFCacheConverter<T> {
  decode(value: Buffer): T;
  encode(value: T): Buffer;
}

export class DOFConvertibleCacheBackend<T> implements DOFCacheBackend<T> {
  constructor(readonly backend: DOFCacheBackend, readonly converter: DOFCacheConverter<T>) {
  }

  async get(key: string): Promise<T|undefined> {
    const buf = await this.backend.get(key);
    if (!buf) return undefined;
    return this.converter.decode(buf);
  }

  async set(key: string, value: T): Promise<void> {
    return this.backend.set(key, this.converter.encode(value));
  }

  async delete(key: string): Promise<void> {
    return this.backend.delete(key);
  }
}

export class TextCacheConverter implements DOFCacheConverter<string> {
  constructor() {
  }

  decode(value: Buffer): string {
    return value.toString(DOF_CACHE_TEXT_ENCODING);
  }

  encode(value: string): Buffer {
    return Buffer.from(value, DOF_CACHE_TEXT_ENCODING);
  }
}

export function asTextCache(cache: DOFCache): DOFCache<string> {
  return new DOFCache(new DOFConvertibleCacheBackend(cache.backend, new TextCacheConverter()));
}

export class JSONCacheConverter<T> implements DOFCacheConverter<T> {
  constructor() {
  }

  decode(value: Buffer): T {
    return JSON.parse(value.toString(DOF_CACHE_TEXT_ENCODING));
  }

  encode(value: T): Buffer {
    return Buffer.from(JSON.stringify(value, null, 2), DOF_CACHE_TEXT_ENCODING);
  }
}

export function asJSONCache<T>(cache: DOFCache, encoding?: BufferEncoding): DOFCache<T> {
  return new DOFCache(new DOFConvertibleCacheBackend(cache.backend, new JSONCacheConverter<T>()));
}

export type BrotliDataType = 'text'|'generic';

function brotliModeForDataType(type: BrotliDataType): number {
  switch (type) {
    case 'text': return zlib.constants.BROTLI_MODE_TEXT;
    case 'generic': return zlib.constants.BROTLI_MODE_GENERIC;
  }
}

export class BrotliCacheConverter implements DOFCacheConverter<Buffer> {
  constructor(readonly dataType: BrotliDataType, readonly quality: number) {
  }

  decode(value: Buffer): Buffer {
    return zlib.brotliDecompressSync(value);
  }

  encode(value: Buffer): Buffer {
    return zlib.brotliCompressSync(value, {
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: brotliModeForDataType(this.dataType),
        [zlib.constants.BROTLI_PARAM_QUALITY]: this.quality,
      }
    });
  }
}

export function asBrotliCache(cache: DOFCache, dataType: BrotliDataType = 'generic', quality: number = 11): DOFCache {
  return new DOFCache(new DOFConvertibleCacheBackend(cache.backend, new BrotliCacheConverter(dataType, quality)));
}

export class FileSystemCacheBackend implements DOFCacheBackend {
  constructor(readonly rootDir: string) {
  }

  private pathForKey(key: string): string {
    return path.join(this.rootDir, ...key.split('/'));
  }

  urlForKey(key: string): string {
    return pathToFileURL(this.pathForKey(key)).toString();
  }

  async get(key: string): Promise<Buffer|undefined> {
    const keyPath = this.pathForKey(key);
    if (!fs.existsSync(keyPath)) {
      return undefined;
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

  async delete(key: string): Promise<void> {
    const keyPath = this.pathForKey(key);
    if (fs.existsSync(keyPath) && !fs.statSync(keyPath).isDirectory) {
      fs.unlinkSync(keyPath);
    }
  }
}
