import child_process from 'child_process';
import fs from 'fs';
import tmp from 'tmp';

/**
 * The pdftotext version our program requires.
 * 
 * NOTE: If you ever change this, make sure to update README.md too!
 */
export const EXPECTED_PDFTOTEXT_VERSION = '4.05';

const VERSION_REGEX = /pdftotext version ([\d.]+)/;

let isExecutableValidated = false;

/**
 * Flags to pass to the pdftotext executable:
 * 
 *     -layout              : maintain original physical layout
 *     -table               : similar to -layout, but optimized for tables
 */
export type PDFToTextFlags = '-layout'|'-table';

/** Find the pdftotext executable and make sure it's the version we need. */
export function findAndValidatePDFToTextExecutable(): string {
  const exePath = process.env.PDFTOTEXT || 'pdftotext';
  if (!isExecutableValidated) {
    const result = child_process.spawnSync(exePath, ['-v'], {stdio: 'pipe'});
    const output = [result.stderr.toString('utf-8'), result.stdout.toString('utf-8')].join('\n');
    const match = output.match(VERSION_REGEX);
    if (!match) {
      throw new Error(`Unable to determine version of "${exePath}"`);
    }
    const version = match[1];
    if (version !== EXPECTED_PDFTOTEXT_VERSION) {
      throw new Error(`"${exePath}" is version ${version} but we need ${EXPECTED_PDFTOTEXT_VERSION}`);
    }
    isExecutableValidated = true;
  }
  return exePath;
}

/** Convert the given PDF data to text via pdftotext. */
export async function convertPDFToText(pdfData: Buffer, extraFlags?: PDFToTextFlags[]): Promise<string> {
  const file = tmp.fileSync();
  try {
    fs.writeSync(file.fd, pdfData);
    const textBuffer = child_process.spawnSync(findAndValidatePDFToTextExecutable(), [
      ...(extraFlags || []),
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
