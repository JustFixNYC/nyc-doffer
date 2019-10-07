import { S3Client, PutObjectCommand, GetObjectCommand, S3 } from "@aws-sdk/client-s3-node";
import { Cache, CacheGetter } from "./cache";
import { collectStream } from "./download";

class S3Cache implements Cache<Buffer> {
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
    throw new Error("TODO IMPLEMENT THIS");
  }
}
