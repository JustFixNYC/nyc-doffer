import child_process from 'child_process';
import fs from 'fs';
import tmp from 'tmp';

export async function convertPDFToText(pdfData: Buffer): Promise<string> {
  const file = tmp.fileSync();
  try {
    fs.writeSync(file.fd, pdfData);
    const textBuffer = child_process.spawnSync('pdftotext', [
      '-layout',
      '-enc', 'UTF-8',
      file.name,
      '-'
    ], {
      stdio: 'pipe',
    }).stdout;
    return textBuffer.toString('utf-8');
  } finally {
    file.removeCallback();
  }
}
