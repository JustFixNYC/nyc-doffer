import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3-node";
import mime from 'mime';
import { Cache, CacheGetter } from "./cache";
import { collectStream } from "./download";

export class S3Cache implements Cache<Buffer> {
  constructor(readonly client: S3Client, readonly bucket: string) {
  }

  async get(key: string, lazyGetter: CacheGetter<Buffer>): Promise<Buffer> {
    const getObjectCmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });
    const result = await this.client.send(getObjectCmd);
    if (result.Body) {
      return await collectStream(result.Body);
    }
    const buf = await lazyGetter(key);
    await this.set(key, buf);
    return buf;
  }

  async set(key: string, value: Buffer): Promise<void> {
    const putObjectCmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ACL: "public-read",
      Body: value,
      ContentLength: value.length,
      ContentType: mime.getType(key) || undefined,
    });
    await this.client.send(putObjectCmd);
  }
}
