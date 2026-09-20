import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { normalizeCatalog, normalizeText, enrichEntry, filterCatalog, sortCatalog, getRelated, deriveFacets } from '../js/catalog.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const payload = JSON.parse(read('data/drinks.json'));
const food = JSON.parse(read('data/food.json'));
const entries = normalizeCatalog(payload);
const base = { query: '', family: 'All', category: 'All', confidence: 'All', scope: 'all', favorites: new Set(), recent: [], dish: '', flavor: '', menu: '' };
const find = (id) => entries.find((entry) => entry.id === id);

test('catalog copies match and duplicate keeps a legacy route', () => {
  assert.equal(read('data/drinks.json'), read('drinks.json'));
  assert.equal(payload.entries.length, 359);
  assert.equal(entries.length, 358);
  assert.equal(new Set(payload.entries.map((entry) => entry.id)).size, 359);
  const duplicate = payload.entries.find((entry) => entry.duplicateOf);
  assert.ok(find(duplicate.duplicateOf).legacyIds.includes(duplicate.id));
  assert.ok(!find(duplicate.id));
});

test('every record has scoped evidence, a review date and a strength qualification', () => {
  for (const entry of payload.entries) {
    assert.ok(['2026-09-06', '2026-09-07', '2026-09-18'].includes(entry.research.reviewedAt), entry.id);
    assert.ok(entry.research.tastingBasis, entry.id);
    assert.ok(entry.research.sources.length, entry.id);
    assert.ok(entry.strength.confirmation, entry.id);
    assert.ok(['listed', 'not-found'].includes(entry.menu.status), entry.id);
    for (const source of entry.research.sources) {
      assert.equal(new URL(source.url).protocol, 'https:', entry.id);
      for (const field of ['title', 'supports', 'type', 'accessed']) assert.ok(source[field], `${entry.id}: ${field}`);
    }
  }
});

test('pairings resolve to real menu records and uncertain identities stay unpaired', () => {
  const dishes = new Map(food.dishes.map((dish) => [dish.id, dish]));
  assert.equal(dishes.size, 44);
  assert.equal(food.dishes.filter((dish) => dish.status === 'listed').length, 41);
  let count = 0;
  for (const entry of entries) {
    assert.ok(entry.pairingReview.basis.includes('not restaurant endorsements'), entry.id);
    const pairs = entry.pairings.restaurant;
    if (!pairs.length) assert.ok(entry.pairingReview.note, entry.id);
    for (const pair of pairs) {
      assert.equal(pair.name, dishes.get(pair.dishId)?.name, entry.id);
      assert.equal(dishes.get(pair.dishId)?.status, 'listed', entry.id);
      assert.ok(pair.reason.length > 20, entry.id);
      assert.equal(pair.sourceUrl, food.sourceUrl, entry.id);
      count++;
    }
  }
  assert.equal(count, 696);
  assert.equal(entries.filter((entry) => !entry._hasPairings).length, 11);
});

test('flavor inference does not turn pineapple into pine or disclaimer text into smoke', () => {
  const tropical = enrichEntry({ tasting: { aroma: ['pineapple'], flavor: ['butterscotch'], finish: 'No smoke claim is made.' } });
  assert.ok(tropical._flavors.includes('Fruit'));
  assert.ok(!tropical._flavors.includes('Herbal'));
  assert.ok(!tropical._flavors.includes('Creamy'));
  assert.ok(!tropical._flavors.includes('Smoke'));
  assert.ok(!find('voodoo-child')._flavors.includes('Smoke'));
});

test('ingredient-led drinks and unspecified wine vintages do not invent numeric ABV', () => {
  for (const entry of entries.filter((item) => ['Cocktail', 'Wine'].includes(item.family))) {
    assert.equal(entry.strength.abv, undefined, entry.id);
    assert.equal(entry.strength.proof, undefined, entry.id);
  }
  assert.equal(find('heaven-hill-heritage-collection-20-year-bourbon').subtype, 'Kentucky straight corn whiskey');
  assert.equal(find('buffalo-trace-rye-expression').strength.confirmation, 'label-required');
});

test('accent and punctuation search, dish filters and combined flavor filters work', () => {
  assert.equal(normalizeText('Crème & Blanton’s'), 'creme and blantons');
  assert.ok(filterCatalog(entries, { ...base, query: 'creme de menthe' }).some((entry) => entry.id === 'grasshopper'));
  for (const dish of food.dishes.filter((dish) => dish.status === 'listed')) {
    const matches = filterCatalog(entries, { ...base, dish: dish.id });
    assert.ok(matches.length, dish.id);
    assert.ok(matches.every((entry) => entry.pairings.restaurant.some((pair) => pair.dishId === dish.id)));
  }
  const citrus = filterCatalog(entries, { ...base, family: 'Cocktail', flavor: 'Citrus', menu: 'listed' });
  assert.ok(citrus.length > 0);
  assert.ok(citrus.every((entry) => entry.family === 'Cocktail' && entry._flavors.includes('Citrus') && entry.menu.status === 'listed'));
});

test('saved/recent scopes and sorting preserve the input catalog', () => {
  const id = entries[0].id;
  assert.equal(filterCatalog(entries, { ...base, scope: 'favorites', favorites: new Set([id]) })[0].id, id);
  assert.equal(filterCatalog(entries, { ...base, scope: 'recent', recent: [id] }).length, 1);
  const before = entries.map((entry) => entry.id);
  const sorted = sortCatalog(entries, 'name');
  assert.notEqual(sorted, entries);
  assert.deepEqual(entries.map((entry) => entry.id), before);
  assert.equal(deriveFacets(entries).familyCounts.All, 358);
  const related = getRelated(entries, entries[0]);
  assert.ok(related.length > 0 && related.length <= 6);
  assert.ok(related.every((entry) => entry.id !== id));
});

test('static app assets, accessible modal hooks and ingredient rendering are present', () => {
  for (const path of ['assets/whiskey-rocks.jpg', 'assets/citrus-cocktail.jpg', 'assets/wine-service.jpg', 'ASSET_CREDITS.md']) assert.ok(existsSync(new URL(path, root)), path);
  const app = read('js/app.js');
  assert.ok(app.includes("noteGroup('Menu ingredients', entry.ingredients)"));
  assert.ok(app.includes('role="dialog" aria-modal="true"'));
  assert.ok(app.includes('elements.profileLayer.inert = false'));
  assert.ok(app.includes("event.key === 'Tab'"));
  assert.ok(!app.includes('<blockquote>'));
  assert.ok(!/ChatGPT|Nightcap/.test(read('index.html') + app));
  assert.ok(read('styles.css').includes('prefers-reduced-motion'));
});

test('refreshed recipes are distinct, searchable and paired with current dishes', () => {
  const tea = find('bourbon-peach-tea');
  assert.ok(tea.ingredients.includes('peach tea syrup'));
  assert.ok(!tea.ingredients.some((ingredient) => /pineapple|Horse Soldier/i.test(ingredient)));
  assert.equal(find('depeache-mode').menu.status, 'not-found');
  assert.equal(find('blanche-devereaux-vol-2').menu.status, 'not-found');
  assert.ok(find('blanche-devereaux-vol-3').ingredients.includes('Luxardo Amaretto'));
  assert.ok(!find('blanche-devereaux-vol-3').ingredients.includes('St-Germain'));
  for (const id of ['bourbon-peach-tea', 'verdita', 'gris-gris-rita', 'jameoretto-sour', 'blanche-devereaux-vol-3', 'espresso-old-fashioned']) {
    assert.equal(find(id).menu.status, 'listed');
    assert.equal(find(id).strength.abv, undefined);
  }
  assert.ok(filterCatalog(entries, { ...base, query: 'peach tea', menu: 'listed' }).some((entry) => entry.id === tea.id));
  assert.ok(filterCatalog(entries, { ...base, query: 'ceviche' }).some((entry) => entry.id === 'verdita'));
  for (const id of ['membership-flight', 'private-barrel-flight', 'pappy-flight']) {
    assert.equal(find(id).menu.status, 'listed');
    assert.equal(find(id)._hasPairings, false);
  }
  const privateBarrel = find('blantons-private-barrel-old-fashioned');
  assert.equal(privateBarrel.name, 'Voodoo Private Barrel Old Fashioned');
  assert.ok(privateBarrel.ingredients[0].includes(' or '));
  for (const dish of food.dishes.filter((dish) => dish.replacedBy)) assert.equal(food.dishes.find((next) => next.id === dish.replacedBy)?.status, 'listed');
  for (const entry of entries) for (const pair of entry.pairings.restaurant) if (pair.dishId === 'cornbread') assert.ok(!/molasses/i.test(pair.reason));
});

test('install manifest icons exist at the declared sizes and stay within the app scope', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.id, './');
  assert.equal(manifest.scope, './');
  for (const icon of manifest.icons) {
    const bytes = readFileSync(new URL(icon.src, root));
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
  }
  assert.ok(read('index.html').includes('rel="apple-touch-icon"'));
});

test('ABV sorting is numeric, preserves zero, and puts unknown strengths last both ways', () => {
  const drinks = [
    { name: 'Whiskey', strength: { abv: 40 } },
    { name: 'Beer', strength: { abv: 9 } },
    { name: 'Zero', strength: { abv: 0 } },
    { name: 'Ale', strength: { abv: 9 } },
    { name: 'Unknown', strength: { abvDisplay: '12–15% ABV' } },
    ...[null, '', '40', NaN, Infinity, -1, 101, undefined].map((abv, i) => ({ name: `Missing ${i}`, strength: { abv } })),
  ];
  const original = [...drinks];
  for (const [sort, expected] of [['abv-asc', ['Zero', 'Ale', 'Beer', 'Whiskey']], ['abv-desc', ['Whiskey', 'Ale', 'Beer', 'Zero']]]) {
    const sorted = sortCatalog(drinks, sort);
    assert.deepEqual(sorted.slice(0, 4).map(({ name }) => name), expected);
    assert.deepEqual(sorted.slice(4).map(({ name }) => name), [...drinks.slice(4)].map(({ name }) => name).sort());
  }
  assert.deepEqual(drinks, original);
});
