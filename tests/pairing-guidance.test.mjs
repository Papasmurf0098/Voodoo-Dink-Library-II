import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pairingGuidance, profileGuidance } from '../js/pairing-guidance.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const { entries } = read('../data/drinks.json');
const report = read('../data/flavor-audit.json');
const get = (id) => entries.find((entry) => entry.id === id);

test('audit accounts for every record without claiming fresh verification of inherited evidence', () => {
  assert.equal(report.profiles.length, entries.length);
  assert.equal(new Set(report.profiles.map((entry) => entry.id)).size, entries.length);
  assert.equal(report.counts.evaluatedRecords, entries.length);
  assert.equal(Object.values(report.counts.evidenceStatuses).reduce((sum, count) => sum + count, 0), entries.length);
  assert.ok(Object.keys(report.counts.evidenceStatuses).length > 1, 'source evidence and unresolved cases remain distinguished');
  for (const row of report.profiles) {
    const entry = get(row.id);
    assert.equal(entry.research.flavorCheck.checkedAt, '2026-10-03');
    assert.equal(row.flavorEvidence, entry.research.flavorCheck.status);
    assert.equal(row.pairingCount, entry.pairings.restaurant.length);
    assert.equal(row.pairingCautionCount, entry.pairings.restaurant.reduce((sum, pair) => sum + pairingGuidance(entry, pair).length, 0));
    if (row.flavorEvidence === 'inherited-evidence-not-reverified') assert.ok(row.openQuestions.some((gap) => /re-verification/.test(gap)));
  }
});

test('category evidence covers each record once and recipe corrections stay explicit', () => {
  const categories = ['bourbon', 'whiskey', 'spirits', 'wine', 'cocktails', 'other'];
  const reviewed = categories.flatMap(category => {
    const evidence = read(`../audits/2026-10-03/${category}-review.json`);
    return Array.isArray(evidence) ? evidence : evidence.entries || evidence.records || evidence.profiles;
  });
  assert.equal(reviewed.length, entries.length);
  assert.deepEqual(new Set(reviewed.map(row => row.id)), new Set(entries.map(entry => entry.id)));
  assert.ok(!get('lavender-love').ingredients.includes('edible rose'));
  assert.ok(get('pimp-chalice').ingredients.some(ingredient => /yuzu/i.test(ingredient)));
  assert.ok(!get('pimp-chalice').ingredients.some(ingredient => /bergamot/i.test(ingredient)));
  const food = read('../data/food.json');
  const corn = food.dishes.find(dish => dish.id === 'corn-ribs');
  assert.match(corn.components, /vinegar.*Parmesan/);
  assert.ok(corn.menuHistory.some(row => /cheddar/.test(row.components)));
  for (const entry of entries) for (const pair of entry.pairings.restaurant) {
    if (pair.dishId === 'corn-ribs') assert.doesNotMatch(pair.reason, /cheddar|crema|pork|chipotle/i);
  }
});

test('pairing guidance distinguishes alcohol, hop heat, dessert sweetness and delicate dishes', () => {
  const beer = get('funky-buddha-hop-gun');
  assert.match(pairingGuidance(beer, { dishId: 'wings' }).join(' '), /Hop bitterness/);
  assert.doesNotMatch(pairingGuidance(beer, { dishId: 'corn-ribs' }).join(' '), /chile/);
  const whiskey = get('balcones-texas-pot-still-bourbon');
  assert.match(pairingGuidance(whiskey, { dishId: 'chocolate' }).join(' '), /do not establish sugar/);
  assert.match(pairingGuidance(whiskey, { dishId: 'pear' }).join(' '), /overpower/);
  assert.match(pairingGuidance(get('chopin-potato-vodka'), { dishId: 'eggs', conditional: true }).join(' '), /Confirm the bottle/);
  for (const entry of entries.filter((entry) => ['Water', 'Mocktail', 'Soft Drink'].includes(entry.family))) {
    assert.doesNotMatch(pairingGuidance(entry, { dishId: 'corn-ribs' }).join(' '), /Alcohol may|Hop bitterness/);
  }
  assert.equal(profileGuidance({ pairings: { restaurant: [] } }), '');
});

test('corrected tasting and pairing claims do not regress', () => {
  assert.ok(!get('chopin-potato-vodka').tasting.flavor.includes('gentle grain'));
  assert.match(get('verdita').tasting.aroma.join(' '), /juniper|gin botanicals/i);
  for (const id of ['gris-gris-rita', 'jameoretto-sour']) assert.ok(get(id).tasting.flavor.includes('botanical citrus and spice'));
  for (const entry of entries) for (const pair of entry.pairings.restaurant) {
    assert.doesNotMatch(pair.reason, /honey butter and honey butter|its drier finish|its lighter tannin profile/);
  }
  for (const id of ['meiomi', 'belle-glos-clark-telephone']) assert.ok(get(id).pairings.restaurant.some((pair) => pair.dishId === 'roast-chicken'));
  assert.equal(entries.filter((entry) => !entry.duplicateOf && !entry.pairings.restaurant.length).length, 11);
});
