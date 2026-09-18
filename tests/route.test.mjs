import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeCatalog } from '../js/catalog.js';
import { readRoute, routeUrl, profileUrl } from '../js/route.js';
const entries = normalizeCatalog(JSON.parse(readFileSync(new URL('../data/drinks.json', import.meta.url))));
const food = [{ id: 'new-dish', legacyIds: ['old-dish'] }];

test('route validation canonicalizes legacy IDs and rejects invalid filters', () => {
  const duplicate = entries.find((entry) => entry.legacyIds.length);
  const state = readRoute(`?drink=${duplicate.legacyIds[0]}&dish=old-dish&category=bad&family=Cocktail&sort=bad&flavor=bad`, entries, food);
  assert.equal(state.selectedId, duplicate.id);
  assert.equal(state.dish, 'new-dish');
  assert.equal(state.category, 'All');
  assert.equal(state.sort, 'name');
  assert.equal(state.flavor, '');
  const roundTrip = readRoute(new URL(routeUrl('/library/', state), 'https://example.com').search, entries, food);
  assert.deepEqual(roundTrip, state);
  assert.equal(readRoute('?drink=missing', entries, food).missingDrink, true);
});

test('shared profile URLs omit private collection scopes and unrelated filters', () => {
  assert.equal(profileUrl('https://example.com/library/?scope=favorites&q=smoke#old', 'bourbon-peach-tea'), 'https://example.com/library/?drink=bourbon-peach-tea');
  assert.equal(readRoute('', entries, food).sort, 'name');
  assert.equal(readRoute('', entries, food, 'family').sort, 'family');
});
