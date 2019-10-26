import assert from 'assert';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, PutObjectInput } from "@aws-sdk/client-s3-node";
import mime from 'mime';
import { posix } from 'path';
import { DOFCacheBackend, DOF_CACHE_TEXT_ENCODING } from "./cache";
import { collectStream } from "./download";

export class S3CacheBackend implements DOFCacheBackend<Buffer> {
  constructor(readonly client: S3Client, readonly bucket: string) {
  }

  urlForKey(key: string): string {
    return `https://${this.bucket}.s3.amazonaws.com/${getFinalS3Key(key)}`;
  }

  get description(): string {
    return `${this.constructor.name}(bucket=${this.bucket})`;
  }

  async delete(key: string): Promise<void> {
    const deleteObjectCmd = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: getFinalS3Key(key)
    });
    await this.client.send(deleteObjectCmd);
  }

  async get(key: string): Promise<Buffer|undefined> {
    const getObjectCmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: getFinalS3Key(key)
    });
    try {
      const result = await this.client.send(getObjectCmd);
      if (result.Body) {
        return await collectStream(result.Body);
      }
    } catch (e) {
      if (e.name !== 'NoSuchKey') {
        throw e;
      }
    }
    return undefined;
  }

  async set(key: string, value: Buffer): Promise<void> {
    const putObjectCmd = new PutObjectCommand({
      Bucket: this.bucket,
      ACL: "public-read",
      Body: value,
      ContentLength: value.length,
      ...getS3PutObjectInputForKey(key),
    });
    await this.client.send(putObjectCmd);
  }
}

export function getFinalS3Key(key: string): string {
  const finalExt = posix.extname(key);

  if (finalExt === '.br') {
    let basename = posix.basename(key, finalExt);
    const penultimateExt = posix.extname(basename);
    basename = posix.basename(basename, penultimateExt);
    return `${basename}${finalExt}${penultimateExt}`;
  }

  return key;
}

export function getS3PutObjectInputForKey(key: string): Omit<PutObjectInput, 'Bucket'> {
  const input: Omit<PutObjectInput, 'Bucket'> = {Key: getFinalS3Key(key)};
  const finalExt = posix.extname(key);
  let currKey = key;

  if (finalExt === '.br') {
    input.ContentEncoding = 'br';
    currKey = posix.basename(key, finalExt);
  }

  let contentType = mime.getType(currKey);

  if (contentType === null) {
    throw new Error(`Unable to determine content type for ${key}!`);
  }

  if (contentType.startsWith('text/')) {
    assert.equal(DOF_CACHE_TEXT_ENCODING, 'utf8');
    contentType = `${contentType}; charset=utf-8`;
  }

  input.ContentType = contentType;

  return input;
}
