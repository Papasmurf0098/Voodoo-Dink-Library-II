import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { COCKTAIL_BUILD_SHEETS, getBuildSheet } from '../js/build-sheets.js';
const root = new URL('../', import.meta.url);
const entries = JSON.parse(readFileSync(new URL('data/drinks.json', root), 'utf8')).entries;

test('25 cocktail profiles map to distinct original PDF pages; other families are untouched', () => {
  assert.equal(Object.keys(COCKTAIL_BUILD_SHEETS).length, 25);
  assert.equal(new Set(Object.values(COCKTAIL_BUILD_SHEETS).map((sheet) => sheet.page)).size, 25);
  assert.equal(readdirSync(new URL('assets/build-sheets/', root)).filter((name) => name.endsWith('.pdf')).length, 25);
  for (const [id, sheet] of Object.entries(COCKTAIL_BUILD_SHEETS)) {
    assert.equal(entries.find((entry) => entry.id === id)?.family, 'Cocktail', id);
    assert.match(sheet.href, /^\.\/assets\/build-sheets\/[a-z0-9-]+\.pdf$/);
    assert.equal(readFileSync(new URL(sheet.href, root)).subarray(0, 5).toString(), '%PDF-');
  }
  for (const entry of entries.filter((entry) => entry.family !== 'Cocktail')) assert.equal(getBuildSheet(entry), null);
});

test('missing builds and recipe versions are not replaced by similar cocktails', () => {
  const missing = entries.filter((entry) => entry.family === 'Cocktail' && !getBuildSheet(entry)).map((entry) => entry.id).sort();
  assert.deepEqual(missing, ['aperol-spritz', 'bellini', 'blantons-private-barrel-old-fashioned', 'bottomless-mimosa', 'boujie-mimosa', 'endless-bloody-mary', 'happy-hour-margarita', 'house-old-fashioned'].sort());
  assert.equal(COCKTAIL_BUILD_SHEETS['blanche-devereaux-vol-2'].page, 29);
  assert.equal(COCKTAIL_BUILD_SHEETS['blanche-devereaux-vol-3'].page, 4);
  assert.equal(COCKTAIL_BUILD_SHEETS['gris-gris-rita'].page, 6);
  assert.equal(COCKTAIL_BUILD_SHEETS['the-mixtress'].page, 10);
  assert.match(COCKTAIL_BUILD_SHEETS['the-big-lebowski'].note, /coconut cream/);
});
