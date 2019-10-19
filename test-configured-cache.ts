import readline from 'readline';
import dotenv from 'dotenv';
import { expect } from 'chai';
import { getCacheFromEnvironment } from './doffer';

dotenv.config();

async function question(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve, reject) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const cache = getCacheFromEnvironment();
  const key = `cache-test-${Date.now()}.txt`;
  const content = `here are some test contents ${key}\u2026`;
  const buf = Buffer.from(content, 'utf8');

  console.log(`Using cache ${cache.description}.`);
  console.log(`Creating ${key}...`);
  await cache.set(key, buf);

  try {
    console.log(`Retrieving ${key}...`);
    const lazyGetter = () => Promise.reject(new Error(`${key} should already be in the cache!`));
    const gotBuf = await cache.lazyGet(key, lazyGetter);
    expect(gotBuf.toString('utf8')).to.equal(content);
    console.log(`Looks good!`);
    const url = cache.urlForKey(key);
    if (url) {
      console.log(`You can view the cached file at ${url}.`);
    }
    await question('Press enter to delete the cached file.');
  } finally {
    console.log(`Deleting ${key}...`);
    await cache.delete(key);
  }
  console.log(`Success!`);
}

if (module.parent === null) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
