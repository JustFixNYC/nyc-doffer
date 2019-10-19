import dotenv from 'dotenv';
import { expect } from 'chai';
import { S3Cache } from './lib/cache-s3';
import { S3Client } from '@aws-sdk/client-s3-node';

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Please define ${name} in your environment or .env file.`);
  }
  return value;
}

async function main() {
  const bucket = getRequiredEnv('S3_BUCKET');
  const cache = new S3Cache(new S3Client({}), bucket);
  const key = `s3-cache-test-${Date.now()}`;
  const content = `here are some test contents ${key}\u2026`;
  const buf = Buffer.from(content, 'utf8');

  console.log(`Creating ${key}...`);
  await cache.set(key, buf);

  try {
    console.log(`Retrieving ${key}...`);
    const lazyGetter = () => Promise.reject(new Error(`${key} should already be in S3!`));
    const gotBuf = await cache.get(key, lazyGetter);
    expect(gotBuf.toString('utf8')).to.equal(content);
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
