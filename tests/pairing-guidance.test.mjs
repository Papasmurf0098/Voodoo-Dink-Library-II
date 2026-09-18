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
  assert.equal(report.counts.freshlyCheckedProfiles, 6);
  assert.equal(report.counts.retainedEvidenceProfiles, 353);
  for (const row of report.profiles) {
    const entry = get(row.id);
    assert.equal(row.flavorEvidence, entry.research.flavorCheck.status);
    assert.equal(row.pairingCount, entry.pairings.restaurant.length);
    assert.equal(row.pairingCautionCount, entry.pairings.restaurant.reduce((sum, pair) => sum + pairingGuidance(entry, pair).length, 0));
    if (row.flavorEvidence === 'inherited-evidence-not-reverified') assert.ok(row.openQuestions.some((gap) => /re-verification/.test(gap)));
  }
});

test('pairing guidance distinguishes alcohol, hop heat, dessert sweetness and delicate dishes', () => {
  const beer = get('funky-buddha-hop-gun');
  assert.match(pairingGuidance(beer, { dishId: 'corn-ribs' }).join(' '), /Hop bitterness/);
  const whiskey = get('balcones-texas-pot-still-bourbon');
  assert.match(pairingGuidance(whiskey, { dishId: 'chocolate' }).join(' '), /do not establish sugar/);
  assert.match(pairingGuidance(whiskey, { dishId: 'pear' }).join(' '), /overpower/);
  assert.match(pairingGuidance(get('chopin-potato-vodka'), { dishId: 'eggs', conditional: true }).join(' '), /Confirm the bottle/);
  for (const entry of entries.filter((entry) => ['Water', 'Mocktail', 'Soft Drink'].includes(entry.family))) {
    assert.equal(pairingGuidance(entry, { dishId: 'corn-ribs' }).length, 0);
  }
  assert.equal(profileGuidance({ pairings: { restaurant: [] } }), '');
});

test('corrected tasting and pairing claims do not regress', () => {
  assert.ok(!get('chopin-potato-vodka').tasting.flavor.includes('gentle grain'));
  assert.ok(get('verdita').tasting.aroma.includes('juniper'));
  for (const id of ['gris-gris-rita', 'jameoretto-sour']) assert.ok(get(id).tasting.flavor.includes('botanical citrus and spice'));
  for (const entry of entries) for (const pair of entry.pairings.restaurant) {
    assert.doesNotMatch(pair.reason, /honey butter and honey butter|its drier finish|its lighter tannin profile/);
  }
  for (const id of ['meiomi', 'belle-glos-clark-telephone']) assert.ok(get(id).pairings.restaurant.some((pair) => pair.dishId === 'roast-chicken'));
  assert.equal(entries.filter((entry) => !entry.duplicateOf && !entry.pairings.restaurant.length).length, 11);
});
