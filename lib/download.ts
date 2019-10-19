import https from 'https';
import { Readable } from 'stream';

export function collectStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    stream.on('error', reject);
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Download the given URL and return its contents.
 * 
 * This function is pretty primitive and doesn't support timeouts, redirects,
 * or other fancy things.
 * 
 * An error is raised if the HTTP status code isn't 200.
 */
export async function download(url: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const req = https.get(url, res => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Got HTTP ${res.statusCode} from ${url}`));
      }
      collectStream(res).then(resolve, reject);
    });
    req.on('error', reject);
    req.end();
  });
}
