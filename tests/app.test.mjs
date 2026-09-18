import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
let instance = 0;
const pause = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await pause(); }
  assert.fail('UI did not reach the expected state');
}
async function mount(search = '', options = {}) {
  const dom = new JSDOM(html, { url: `https://example.com/library/${search}`, pretendToBeVisual: true });
  const win = dom.window;
  win.scrollTo = ({ top }) => Object.defineProperty(win, 'scrollY', { value: top, configurable: true });
  for (const key of ['window', 'document', 'location', 'history', 'localStorage', 'navigator']) {
    Object.defineProperty(globalThis, key, { value: key === 'window' ? win : win[key], configurable: true });
  }
  globalThis.requestAnimationFrame = win.requestAnimationFrame.bind(win);
  globalThis.fetch = options.fetch || (async (path) => new Response(readFileSync(new URL(path, root), 'utf8')));
  for (const [key, value] of Object.entries(options.storage || {})) win.localStorage.setItem(key, JSON.stringify(value));
  await import(`../js/app.js?test=${++instance}`);
  await until(() => win.document.querySelector('#catalogDeck, .fatal-state'));
  const $ = (selector) => win.document.querySelector(selector);
  const click = (selector) => { const node = $(selector); assert.ok(node, selector); node.focus(); node.click(); return node; };
  return { dom, win, $, click, close: () => dom.window.close() };
}

test('profile navigation closes to its originating collection and supports Back/Forward', async () => {
  const ui = await mount('?family=Whiskey');
  try {
    ui.click('[data-action="load-more"]');
    const count = ui.$('#catalogDeck').children.length;
    ui.win.scrollTo({ top: 1200 });
    const trigger = ui.click('.card-open');
    const first = new URL(ui.win.location.href).searchParams.get('drink');
    await pause();
    assert.equal(ui.$('#profileLayer').getAttribute('aria-hidden'), 'false');
    ui.click('.related-card');
    const second = new URL(ui.win.location.href).searchParams.get('drink');
    assert.notEqual(first, second);
    ui.win.history.back();
    await until(() => ui.$('#profileTitle')?.textContent === trigger.textContent);
    ui.win.history.forward();
    await until(() => new URL(ui.win.location.href).searchParams.get('drink') === second);
    ui.click('.profile-back');
    await until(() => !ui.$('#profileLayer').classList.contains('is-open'));
    await pause();
    assert.equal(ui.win.location.search, '?family=Whiskey');
    assert.equal(ui.$('#catalogDeck').children.length, count);
    assert.equal(ui.win.scrollY, 1200);
    assert.equal(ui.win.document.activeElement.dataset.drinkId, first);
  } finally { ui.close(); }
});

test('bookmarking preserves the open profile DOM, focus, reading position and sources', async () => {
  const ui = await mount('?drink=bourbon-peach-tea');
  try {
    await pause();
    const scroll = ui.$('.profile-scroll');
    scroll.scrollTop = 340;
    ui.$('.research-panel').open = true;
    const button = ui.click('#profilePanel [data-favorite-id]');
    assert.equal(ui.$('.profile-scroll'), scroll);
    assert.equal(scroll.scrollTop, 340);
    assert.equal(ui.$('.research-panel').open, true);
    assert.equal(ui.win.document.activeElement, button);
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(ui.$('#favoriteCount').textContent, '1');
    ui.click('.profile-back');
    assert.equal(ui.win.location.search, '');
    assert.equal(ui.$('#profileLayer').getAttribute('aria-hidden'), 'true');
  } finally { ui.close(); }
});

test('modified shortcuts do not open profiles, plain R does', async () => {
  const ui = await mount();
  try {
    ui.win.document.dispatchEvent(new ui.win.KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true }));
    assert.equal(ui.$('#profileLayer').getAttribute('aria-hidden'), 'true');
    ui.win.document.dispatchEvent(new ui.win.KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    assert.equal(ui.$('#profileLayer').getAttribute('aria-hidden'), 'false');
  } finally { ui.close(); }
});

export { mount, pause, until };

test('Saved distinguishes empty collections from filters that hide saved profiles', async () => {
  const ui = await mount('?scope=favorites&family=Whiskey&q=zzzz', { storage: { 'nightcap:v2:favorites': ['bourbon-peach-tea'] } });
  try {
    assert.equal(ui.$('.empty-state h2').textContent, 'No matching profiles');
    assert.equal(ui.$('[data-action="random"]').disabled, true);
    ui.click('.empty-state [data-action="clear-filters"]');
    assert.equal(ui.$('.card-open').textContent, 'Bourbon Peach Tea');
    assert.equal(ui.win.location.search, '?scope=favorites');
    assert.equal(ui.$('[data-action="random"]').disabled, false);
    ui.click('.card-save');
    assert.equal(ui.$('.empty-state h2').textContent, 'Nothing saved yet');
    ui.click('.empty-state [data-action="reset"]');
    assert.equal(ui.$('#resultCount').textContent, '358 profiles');
  } finally { ui.close(); }
});

test('removing a single filter preserves other selections and updates controls and URL', async () => {
  const ui = await mount('?family=Cocktail&flavor=Citrus&menu=listed');
  try {
    ui.click('[data-filter="flavor"]');
    assert.equal(ui.$('#flavorSelect').value, '');
    assert.equal(ui.$('#menuSelect').value, 'listed');
    assert.equal(ui.win.location.search, '?family=Cocktail&menu=listed');
    assert.equal(ui.win.document.activeElement, ui.$('#resultCount'));
    const family = ui.click('.family-tab[data-family="Whiskey"]');
    assert.equal(ui.win.document.activeElement.dataset.family, family.dataset.family);
  } finally { ui.close(); }
});

test('loading more retains existing cards and focuses the first new profile', async () => {
  const ui = await mount();
  try {
    const first = ui.$('.catalog-card');
    ui.click('[data-action="load-more"]');
    assert.equal(ui.$('.catalog-card'), first);
    assert.equal(ui.$('#catalogDeck').children.length, 84);
    assert.equal(ui.win.document.activeElement, ui.$('#catalogDeck').children[42].querySelector('.card-open'));
  } finally { ui.close(); }
});

test('a direct link can explore related profiles and still close into the library', async () => {
  const ui = await mount('?drink=bourbon-peach-tea');
  try {
    ui.click('.related-card');
    ui.click('.profile-back');
    assert.equal(ui.$('#profileLayer').getAttribute('aria-hidden'), 'true');
    assert.equal(ui.win.location.search, '');
  } finally { ui.close(); }
});

test('sharing has a selectable canonical link when native sharing and clipboard are unavailable', async () => {
  const ui = await mount('?drink=bourbon-peach-tea&scope=favorites&q=tea');
  try {
    ui.click('[data-action="share-profile"]');
    await until(() => !ui.$('#shareLink').hidden);
    assert.equal(ui.$('#profileLink').value, 'https://example.com/library/?drink=bourbon-peach-tea');
    assert.equal(ui.win.document.activeElement, ui.$('#profileLink'));
  } finally { ui.close(); }
});

test('a failed food menu leaves drinks usable and can be retried without resetting search', async () => {
  let foodFails = true;
  const ui = await mount('?q=peach', { fetch: async (path) => path.includes('food') && foodFails
    ? new Response('', { status: 503 }) : new Response(readFileSync(new URL(path, root), 'utf8')) });
  try {
    assert.ok(ui.$('.card-open'));
    assert.equal(ui.$('#foodStatus').hidden, false);
    assert.equal(ui.$('#dishSelect').disabled, true);
    foodFails = false;
    ui.click('[data-action="retry-food"]');
    await until(() => ui.$('#foodStatus').hidden);
    assert.equal(ui.$('#dishSelect').options.length, 42);
    assert.equal(ui.$('#searchInput').value, 'peach');
  } finally { ui.close(); }
});

test('a malformed catalog presents a recoverable error instead of an empty collection', async () => {
  const ui = await mount('', { fetch: async (path) => new Response(path.includes('drinks') ? '{"entries":[]}' : readFileSync(new URL(path, root), 'utf8')) });
  try {
    assert.equal(ui.$('.fatal-state h1').textContent, 'Library unavailable');
    assert.equal(ui.$('.fatal-state button').textContent, 'Try again');
  } finally { ui.close(); }
});

test('storage failures preserve session bookmarks and display a persistent notice', async () => {
  const ui = await mount();
  try {
    Object.defineProperty(globalThis, 'localStorage', { value: { setItem() { throw new Error('quota'); }, getItem() { return null; } }, configurable: true });
    const button = ui.click('.card-save');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(ui.$('#storageStatus').hidden, false);
    assert.match(ui.$('#toastMessage').textContent, /this session/);
    ui.click('.view-chip[data-scope="favorites"]');
    assert.equal(ui.$('#catalogDeck').children.length, 1);
  } finally { ui.close(); }
});

test('cross-tab saves update the collection without replacing an open profile', async () => {
  const ui = await mount('?drink=bourbon-peach-tea');
  try {
    const scroll = ui.$('.profile-scroll');
    ui.win.localStorage.setItem('nightcap:v2:favorites', '["bourbon-peach-tea"]');
    ui.win.dispatchEvent(new ui.win.StorageEvent('storage', { key: 'nightcap:v2:favorites', storageArea: ui.win.localStorage }));
    assert.equal(ui.$('#profilePanel [data-favorite-id]').getAttribute('aria-pressed'), 'true');
    assert.equal(ui.$('.profile-scroll'), scroll);
  } finally { ui.close(); }
});

test('restoring a backup merges profiles and malformed files leave saved data intact', async () => {
  const ui = await mount('?scope=favorites', { storage: { 'nightcap:v2:favorites': ['bourbon-peach-tea'] } });
  try {
    const input = ui.$('#backupInput');
    const restore = async (text) => {
      Object.defineProperty(input, 'files', { configurable: true, value: [{ size: text.length, text: async () => text }] });
      input.dispatchEvent(new ui.win.Event('change', { bubbles: true }));
      await pause();
    };
    await restore(JSON.stringify({ format: 'voodoo-saved-profiles', version: 1, favorites: ['verdita', 'missing'] }));
    assert.equal(ui.$('#favoriteCount').textContent, '2');
    assert.match(ui.$('#toastMessage').textContent, /1 saved profile added · 1 unavailable/);
    await restore('{bad');
    assert.equal(ui.$('#favoriteCount').textContent, '2');
    assert.match(ui.$('#toastMessage').textContent, /not a valid/);
    assert.deepEqual(JSON.parse(ui.win.localStorage.getItem('nightcap:v2:favorites')), ['bourbon-peach-tea', 'verdita']);
  } finally { ui.close(); }
});

test('recent-history clearing and bookmark removal can be undone', async () => {
  const ui = await mount('?scope=recent', { storage: { 'nightcap:v2:recent': ['verdita'], 'nightcap:v2:favorites': ['verdita'] } });
  try {
    ui.click('[data-action="clear-recent"]');
    assert.equal(ui.$('.empty-state h2').textContent, 'No recent profiles');
    ui.click('[data-action="undo"]');
    assert.equal(ui.$('.card-open').textContent, 'Verdita');
    ui.click('.view-chip[data-scope="favorites"]');
    ui.click('.card-save');
    assert.equal(ui.$('.empty-state h2').textContent, 'Nothing saved yet');
    ui.click('[data-action="undo"]');
    assert.equal(ui.$('.card-open').textContent, 'Verdita');
  } finally { ui.close(); }
});
