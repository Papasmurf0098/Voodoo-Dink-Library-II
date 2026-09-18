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
