import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFavorites, saveFavorites, loadRecent, pushRecent, loadPreferences } from '../js/storage.js';

test('local preferences tolerate malformed and unavailable storage', () => {
  const data = new Map();
  globalThis.localStorage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  saveFavorites(new Set(['one', 'two']));
  assert.deepEqual([...loadFavorites()], ['one', 'two']);
  data.set('nightcap:v2:preferences', 'null');
  assert.deepEqual(loadPreferences(), { sort: 'name', density: 'comfortable' });
  data.set('nightcap:v2:preferences', '{broken');
  assert.equal(loadPreferences().sort, 'name');
  data.set('nightcap:v2:preferences', '{"sort":"unknown","density":"compact"}');
  assert.deepEqual(loadPreferences(), { sort: 'name', density: 'compact' });
  const recent = pushRecent(Array.from({ length: 30 }, (_, i) => String(i)), '4');
  assert.equal(recent[0], '4');
  assert.equal(recent.length, 24);
  assert.equal(new Set(recent).size, recent.length);
  assert.deepEqual(loadRecent(), recent);
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(loadFavorites().size, 0);
  assert.doesNotThrow(() => saveFavorites(new Set(['one'])));
});

test('saved backups validate format, merge canonical IDs and report unavailable profiles', async () => {
  const { createSavedBackup, readSavedBackup, cleanIds, saveRecent } = await import('../js/storage.js');
  const entries = [{ id: 'one', legacyIds: ['old-one'] }, { id: 'two', legacyIds: [] }];
  const backup = createSavedBackup(new Set(['old-one', 'one', 'missing']), new Date('2026-09-18T00:00:00Z'));
  assert.deepEqual(readSavedBackup(backup, entries), { ids: ['one'], unavailable: 1 });
  assert.deepEqual(cleanIds([null, 3, '', 'one', 'one', {}, 'two']), ['one', 'two']);
  for (const text of ['null', '{bad', '{}', JSON.stringify({ format: 'voodoo-saved-profiles', version: 9, favorites: [] }), JSON.stringify({ format: 'voodoo-saved-profiles', version: 1, favorites: [null] }), 'x'.repeat(262145)]) {
    assert.throws(() => readSavedBackup(text, entries));
  }
  assert.equal(saveRecent(['one']), false);
  assert.equal(saveFavorites(new Set(['one'])), false);
});
