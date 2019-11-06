import { Readable } from 'stream';
import request from 'request-promise-native';

const TIMEOUT_MS = 10_000;

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
 * An error is raised if the HTTP status code isn't 2xx.
 */
export async function download(url: string): Promise<Buffer> {
  return request(url, {
    simple: true,   // Any response other than 2xx will be rejected.
    timeout: TIMEOUT_MS,
    encoding: null  // Ensures the result will be a Buffer, not a string.
  }).then(value => {
    if (!(value instanceof Buffer)) {
      throw new Error(`Expected value to be a Buffer but it is ${typeof(value)}!`);
    }
    return value;
  });
}
