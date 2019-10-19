import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { pathToFileURL } from 'url';
import mime from 'mime';

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

  get description(): string {
    return this.backend.description;
  }
}

export interface DOFCacheBackend<T = Buffer> {
  urlForKey?: (key: string) => string;
  description: string;
  get(key: string): Promise<T|undefined>;
  set(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface DOFCacheConverter<T> {
  extension?: string;
  decode(value: Buffer, key: string): T;
  encode(value: T, key: string): Buffer;
}

export class DOFConvertibleCacheBackend<T> implements DOFCacheBackend<T> {
  urlForKey?: (key: string) => string;

  constructor(readonly backend: DOFCacheBackend, readonly converter: DOFCacheConverter<T>) {
    const {urlForKey} = backend;
    if (urlForKey) {
      this.urlForKey = (key) => urlForKey.call(backend, this.transformKey(key));
    }
  }

  private transformKey(key: string): string {
    const {extension} = this.converter;
    if (extension) {
      return `${key}${extension}`;
    }
    return key;
  }

  get description(): string {
    return `${this.converter.constructor.name}(${this.backend.description})`;
  }

  async get(key: string): Promise<T|undefined> {
    const buf = await this.backend.get(this.transformKey(key));
    if (!buf) return undefined;
    return this.converter.decode(buf, key);
  }

  async set(key: string, value: T): Promise<void> {
    return this.backend.set(this.transformKey(key), this.converter.encode(value, key));
  }

  async delete(key: string): Promise<void> {
    return this.backend.delete(this.transformKey(key));
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

export function getBrotliDataType(key: string): BrotliDataType {
  const mimeType = mime.getType(key) || '';
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'text';
  return 'generic';
}

export class BrotliCacheConverter implements DOFCacheConverter<Buffer> {
  constructor(readonly quality: number) {
  }

  extension = '.br';

  decode(value: Buffer): Buffer {
    return zlib.brotliDecompressSync(value);
  }

  encode(value: Buffer, key: string): Buffer {
    const dataType = getBrotliDataType(key);
    return zlib.brotliCompressSync(value, {
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: brotliModeForDataType(dataType),
        [zlib.constants.BROTLI_PARAM_QUALITY]: this.quality,
      }
    });
  }
}

export function asBrotliCache(cache: DOFCache, quality: number = 11): DOFCache {
  return new DOFCache(new DOFConvertibleCacheBackend(cache.backend, new BrotliCacheConverter(quality)));
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

  get description(): string {
    return `${this.constructor.name}(rootDir=${this.rootDir})`;
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
