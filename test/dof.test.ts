import path from 'path';
import fs from 'fs';

import { parseNOPVLinks, parseSOALinks } from '../lib/dof';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getHTML(filename: string): string {
  return fs.readFileSync(path.join(__dirname, 'html', filename), 'utf-8');
}

function ensureEqualJSON(object: any, filename: string) {
  const actual = JSON.parse(JSON.stringify(object));
  const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'json', filename), 'utf-8'));
  expect(actual).toEqual(expected);
}

describe("parseNOPVLinks()", () => {
  it("works", () => {
    ensureEqualJSON(parseNOPVLinks(getHTML('example_nopv.html')), 'example_nopv.json');
  });
});

describe("parseSOALinks()", () => {
  it("works", () => {
    ensureEqualJSON(parseSOALinks(getHTML('example_soa.html')), 'example_soa.json');
  });
});
