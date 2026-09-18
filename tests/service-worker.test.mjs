import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('service worker refreshes online, resolves offline deep links and leaves other apps alone', async () => {
  const scope = 'https://example.com/Voodoo-Dink-Library-II/';
  const listeners = {};
  const stored = new Map();
  const deleted = [];
  const prefix = `voodoo-library:${scope}:`;
  let activeCache;
  const cache = {
    put: async (key, response) => stored.set(key, response),
    match: async (key) => stored.get(key)?.clone(),
    addAll: async () => {},
  };
  let offline = false;
  let status = 200;
  const context = vm.createContext({
    self: { registration: { scope }, location: { origin: 'https://example.com' }, clients: { claim: async () => {} }, skipWaiting: async () => {}, addEventListener: (name, handler) => { listeners[name] = handler; } },
    caches: { open: async () => cache, keys: async () => [`${prefix}old`, activeCache, 'another-app'], delete: async (key) => deleted.push(key) },
    fetch: async () => { if (offline) throw new Error('offline'); return new Response('fresh', { status }); },
    URL, Response, Set, AbortController, setTimeout, clearTimeout,
  });
  vm.runInContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), context);
  activeCache = vm.runInContext('CACHE', context);
  let activation;
  listeners.activate({ waitUntil: (promise) => { activation = promise; } });
  await activation;
  assert.deepEqual(deleted, [`${prefix}old`]);
  async function request(url, method = 'GET') {
    let result;
    listeners.fetch({ request: { url, method }, respondWith: (promise) => { result = promise; } });
    return result;
  }
  const online = await request(`${scope}?drink=voodoo-child`);
  assert.equal(await online.text(), 'fresh');
  assert.ok(stored.has(scope));
  status = 503;
  const fallback = await request(`${scope}?drink=anything`);
  assert.equal(fallback.status, 200);
  assert.equal(await fallback.text(), 'fresh');
  status = 200;
  offline = true;
  assert.equal(await (await request(`${scope}?dish=gumbo`)).text(), 'fresh');
  assert.equal((await request(`${scope}data/food.json`)).status, 503);
  assert.equal(await request('https://example.com/another-app/data.json'), undefined);
  assert.equal(await request('https://external.example/data.json'), undefined);
  assert.equal(await request(scope, 'POST'), undefined);
});

test('offline installation covers runtime modules and tolerates optional asset failures', async () => {
  const scope = 'https://example.com/library/';
  const listeners = {};
  let required;
  let skipped = false;
  const context = vm.createContext({
    self: { registration: { scope }, location: { origin: 'https://example.com' }, addEventListener: (name, handler) => { listeners[name] = handler; }, skipWaiting: async () => { skipped = true; } },
    caches: { open: async () => ({ addAll: async (paths) => { required = paths; }, add: async () => { throw new Error('optional resource failed'); } }) },
    URL, Set,
  });
  vm.runInContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), context);
  let install;
  listeners.install({ waitUntil: (promise) => { install = promise; } });
  await install;
  const imports = [...readFileSync(new URL('../js/app.js', import.meta.url), 'utf8').matchAll(/from '\.\/([^']+)'/g)].map((match) => `./js/${match[1]}`);
  for (const path of ['./js/app.js', ...imports, './data/drinks.json']) assert.ok(required.includes(path), path);
  assert.equal(skipped, true);
});
