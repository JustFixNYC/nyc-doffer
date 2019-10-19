import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import { FileSystemCache, CacheGetter, asBrotliCache, ICache } from '../lib/cache';

class MemoryCache implements ICache {
  constructor(readonly contents: Map<string, Buffer> = new Map()) {
  }

  async get(key: string, lazyGetter: CacheGetter): Promise<Buffer> {
    let value = this.contents.get(key);
    if (value === undefined) {
      value = await lazyGetter(key);
      this.contents.set(key, value);
    }
    return value;
  }

  async set(key: string, value: Buffer): Promise<void> {
    this.contents.set(key, value);
  }
}

// https://gist.github.com/tkihira/2367067
var recursiveRmdirSync = function(dir: string) {
	var list = fs.readdirSync(dir);
	for(var i = 0; i < list.length; i++) {
		var filename = path.join(dir, list[i]);
		var stat = fs.statSync(filename);
		
		if(filename == "." || filename == "..") {
			// pass these files
		} else if(stat.isDirectory()) {
			// rmdir recursively
			recursiveRmdirSync(filename);
		} else {
			// rm fiilename
			fs.unlinkSync(filename);
		}
	}
	fs.rmdirSync(dir);
};

const neverCall: CacheGetter = () => Promise.reject(new Error('this should not be called!'));

describe('FileSystemCache', () => {
  it('works', async () => {
    const tempDir = fs.mkdtempSync('doffer-fscache-test');
    try {
      const cache = new FileSystemCache(tempDir);

      const value = await cache.get('foo/bar/123', async (key: string) => {
        expect(key).to.equal('foo/bar/123');
        return Buffer.from('boop', 'utf-8');
      });
      expect(value.toString()).to.equal('boop');

      const precachedValue = await cache.get('foo/bar/123', neverCall);
      expect(precachedValue.toString()).to.equal('boop');
    } finally {
      recursiveRmdirSync(tempDir);
    }
  });
});

describe("BrotliCache", () => {
  it('works', async () => {
    const cache = asBrotliCache(new MemoryCache(), 'text');
    const buf = Buffer.from('halloo\u2026', 'utf8');
    await cache.set('boop', buf);
    const outBuf = await cache.get('boop', neverCall);
    expect(outBuf.toString('utf8')).to.equal('halloo\u2026');
  });
});
