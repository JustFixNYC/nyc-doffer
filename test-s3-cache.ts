import readline from 'readline';
import dotenv from 'dotenv';
import { expect } from 'chai';
import { S3CacheBackend } from './lib/cache-s3';
import { S3Client } from '@aws-sdk/client-s3-node';
import { DOFCache } from './lib/cache';

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

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Please define ${name} in your environment or .env file.`);
  }
  return value;
}

async function main() {
  const bucket = getRequiredEnv('S3_BUCKET');
  const backend = new S3CacheBackend(new S3Client({}), bucket);
  const cache = new DOFCache(backend);
  const key = `s3-cache-test-${Date.now()}.txt`;
  const content = `here are some test contents ${key}\u2026`;
  const buf = Buffer.from(content, 'utf8');

  console.log(`Creating ${key}...`);
  await cache.set(key, buf);

  try {
    console.log(`Retrieving ${key}...`);
    const lazyGetter = () => Promise.reject(new Error(`${key} should already be in S3!`));
    const gotBuf = await cache.lazyGet(key, lazyGetter);
    expect(gotBuf.toString('utf8')).to.equal(content);
    console.log(`Looks good! You can view the cached file at ${backend.urlForKey(key)}.`);
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
