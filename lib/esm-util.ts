import path from 'path';
import { fileURLToPath } from 'url';

export function myDirname(importMeta: ImportMeta): string {
  return path.dirname(fileURLToPath(importMeta.url));
}

export function amIBeingRunAsAScript(importMeta: ImportMeta): boolean {
  const myPath = path.normalize(fileURLToPath(importMeta.url));
  const currentScript = path.normalize(process.argv[1]);
  return myPath === currentScript;
}
