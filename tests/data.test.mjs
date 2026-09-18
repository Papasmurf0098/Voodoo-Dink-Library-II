import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchJson, validateCatalog, validateFood } from '../js/data.js';
const read = (path) => JSON.parse(readFileSync(new URL(`../data/${path}.json`, import.meta.url)));

test('data boundaries accept the reviewed catalog and reject malformed data before rendering', () => {
  assert.equal(validateCatalog(read('drinks')).length, 358);
  assert.equal(validateFood(read('food')).length, 41);
  for (const payload of [null, {}, { entries: [] }, { entries: [null] }]) assert.throws(() => validateCatalog(payload));
  const data = read('drinks');
  data.entries[0].tasting.aroma = 'wrong shape';
  assert.throws(() => validateCatalog(data));
  assert.throws(() => validateFood({ dishes: [null] }));
});

test('request timeout covers both an unresponsive server and a stalled JSON body', async () => {
  for (const fetcher of [() => new Promise(() => {}), async () => ({ ok: true, json: () => new Promise(() => {}) })]) {
    await assert.rejects(fetchJson('/slow', { fetcher, timeoutMs: 10 }), /timed out/);
  }
  await assert.rejects(fetchJson('/failed', { fetcher: async () => new Response('', { status: 503 }) }), /503/);
  assert.deepEqual(await fetchJson('/ok', { fetcher: async () => new Response('{"ok":true}') }), { ok: true });
});
