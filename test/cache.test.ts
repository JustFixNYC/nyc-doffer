import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import { FileSystemCache, CacheGetter } from '../lib/cache';

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
        return new Buffer('boop');
      });
      expect(value.toString()).to.equal('boop');

      const precachedValue = await cache.get('foo/bar/123', neverCall);
      expect(precachedValue.toString()).to.equal('boop');
    } finally {
      recursiveRmdirSync(tempDir);
    }
  });
});
