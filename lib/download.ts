import https from 'https';

/**
 * Download the given URL and return its contents.
 * 
 * This function is pretty primitive and doesn't support timeouts, redirects,
 * or other fancy things.
 */
export async function download(url: string): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    const req = https.get(url, res => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Got HTTP ${res.statusCode} from ${url}`));
      }
      res.on('error', reject);
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.end();
  });
}
