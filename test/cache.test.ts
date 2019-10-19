import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import { FileSystemCacheBackend, DOFCacheGetter, asBrotliCache, DOFCacheBackend, DOFCache, getBrotliDataType } from '../lib/cache';

class MemoryCacheBackend implements DOFCacheBackend {
  constructor(readonly contents: Map<string, Buffer> = new Map()) {
  }

  async get(key: string): Promise<Buffer|undefined> {
    return this.contents.get(key);
  }

  async set(key: string, value: Buffer): Promise<void> {
    this.contents.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.contents.delete(key);
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

const neverCall: DOFCacheGetter = () => Promise.reject(new Error('this should not be called!'));

describe('FileSystemCache', () => {
  it('works', async () => {
    const tempDir = fs.mkdtempSync('doffer-fscache-test');
    try {
      const cache = new DOFCache(new FileSystemCacheBackend(tempDir));

      const value = await cache.lazyGet('foo/bar/123', async (key: string) => {
        expect(key).to.equal('foo/bar/123');
        return Buffer.from('boop', 'utf-8');
      });
      expect(value.toString()).to.equal('boop');

      const precachedValue = await cache.lazyGet('foo/bar/123', neverCall);
      expect(precachedValue.toString()).to.equal('boop');
    } finally {
      recursiveRmdirSync(tempDir);
    }
  });

  it('generates file URLs', () => {
    const backend = new FileSystemCacheBackend('blah');
    expect(backend.urlForKey('boop')).to.match(/^file:\/\/\/.*blah\/boop$/);
  });
});

describe("BrotliCache", () => {
  it('works', async () => {
    const backend = new MemoryCacheBackend();
    const cache = asBrotliCache(new DOFCache(backend));
    const buf = Buffer.from('halloo\u2026', 'utf8');
    await cache.set('boop.txt', buf);
    const outBuf = await cache.lazyGet('boop.txt', neverCall);
    expect(outBuf.toString('utf8')).to.equal('halloo\u2026');
    expect(await backend.get('boop.txt.br')).to.not.be.undefined;
  });
});

describe("getBrotliDataType", () => {
  it("returns generic for unknown types", () => {
    expect(getBrotliDataType('blah')).to.equal('generic');
    expect(getBrotliDataType('blah.zoof')).to.equal('generic');
    expect(getBrotliDataType('blahhh.pdf')).to.equal('generic');
  });

  it("returns text for text types", () => {
    expect(getBrotliDataType('blah.txt')).to.equal('text');
    expect(getBrotliDataType('blah.json')).to.equal('text');
    expect(getBrotliDataType('blah.html')).to.equal('text');
  });
});
