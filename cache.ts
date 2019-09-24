import fs from 'fs';
import path from 'path';

export type CacheGetter = (key: string) => Promise<Buffer>;

export interface Cache {
  get(key: string, lazyGetter: CacheGetter): Promise<Buffer>;
  set(key: string, value: Buffer): Promise<void>;
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
