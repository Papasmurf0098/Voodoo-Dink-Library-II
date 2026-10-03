// Apply human-reviewed category patches; this script does not verify sources.
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { pairingGuidance } from '../js/pairing-guidance.js';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const catalog = read('data/drinks.json');
const files = ['bourbon', 'whiskey', 'spirits', 'wine', 'cocktails', 'other'];
const byId = new Map(catalog.entries.map(entry => [entry.id, entry]));
const seen = new Set();
const reviewRows = new Map();
for (const name of files) {
  const review = read(`audits/2026-10-03/${name}-review.json`);
  for (const row of Array.isArray(review) ? review : review.entries || review.records || review.profiles) {
    assert.ok(!reviewRows.has(row.id), `Overlapping evidence report: ${row.id}`);
    reviewRows.set(row.id, row);
  }
  const patch = read(`audits/2026-10-03/${name}.json`);
  for (const row of Array.isArray(patch) ? patch : patch.entries) {
    assert.ok(byId.has(row.id), `Unknown profile: ${row.id}`);
    assert.ok(!seen.has(row.id), `Overlapping patch: ${row.id}`);
    seen.add(row.id);
    const entry = byId.get(row.id);
    for (const [key, value] of Object.entries(row)) {
      if (key === 'id') continue;
      assert.ok(['tasting', 'research', 'signatureTraits', 'tags', 'pairings', 'pairingReview', 'origin', 'ingredients'].includes(key), `Unexpected field: ${key}`);
      if (value && typeof value === 'object' && !Array.isArray(value)) entry[key] = { ...entry[key], ...value };
      else entry[key] = value;
    }
    entry.tags = [...new Set([entry.family, entry.category, ...entry.tasting.flavor])];
    const prefix = /expectation/i.test(entry.research.profileLevel) ? 'Expected: ' : '';
    entry.signatureTraits = entry.tasting.flavor.length ? [prefix + entry.tasting.flavor.slice(0, 3).join(' · ')] : [];
    if (!entry.pairingReview.basis.includes('not restaurant endorsements')) {
      entry.pairingReview.basis += ' These are not restaurant endorsements or tested guarantees.';
    }
  }
}
assert.equal(seen.size, catalog.entries.length, 'Every stored record must have a category review before publishing');
assert.equal(reviewRows.size, catalog.entries.length, 'Every stored record must have an evidence report');
for (const entry of catalog.entries) {
  assert.equal(entry.research.flavorCheck?.checkedAt, '2026-10-03', `Missing latest review: ${entry.id}`);
  assert.ok(entry.research.flavorCheck.status && entry.research.flavorCheck.summary, `Unscoped review: ${entry.id}`);
}
const food = read('data/food.json');
const corn = food.dishes.find(dish => dish.id === 'corn-ribs');
if (corn.checkedAt !== '2026-10-03') {
  corn.menuHistory = [...(corn.menuHistory || []), { replacedAt: '2026-10-03', components: corn.components, checkedAt: corn.checkedAt }];
}
corn.components = 'Cane vinegar aioli, Parmesan and blackening';
corn.checkedAt = '2026-10-03';
corn.note = 'Menu rechecked October 3, 2026; prior cheddar, crema and pork topping is historical. Blackening seasoning composition and heat level are unspecified.';
const cornReasons = {
  'funky-buddha-hop-gun': 'The reference IPA’s malt and citrus-hop character can contrast with the Parmesan and aioli. Cane vinegar adds a tangy element; the blackening seasoning and personal preference determine the final match.',
  'gris-gris-rita': 'Recipe-led lime tartness offers contrast to Parmesan and aioli; the pepper and pineapple ingredients offer a possible aromatic link to corn. Neither this suggestion nor the menu establishes the blackening blend or heat level.',
};
for (const entry of catalog.entries) for (const pair of entry.pairings.restaurant) {
  if (pair.dishId === 'corn-ribs') {
    assert.ok(cornReasons[entry.id], `Unreviewed corn pairing: ${entry.id}`);
    pair.reason = cornReasons[entry.id];
    entry.pairingReview.rulesCheckedAt = '2026-10-03';
  }
}
const unique = catalog.entries.filter(entry => !entry.duplicateOf);
const statuses = {};
const profiles = catalog.entries.map(entry => {
  const status = entry.research.flavorCheck?.status || 'inherited-evidence-not-reverified';
  statuses[status] = (statuses[status] || 0) + 1;
  const openQuestions = [];
  const review = reviewRows.get(entry.id);
  for (const question of [review.remainingUncertainty, ...(review.openQuestions || [])]) {
    if (typeof question === 'string' && question) openQuestions.push(question);
  }
  if (/inherited|unverified|unresolved|inaccessible|blocked|not-reverified/.test(status)) openQuestions.push('Independent re-verification of the retained tasting evidence is outstanding.');
  if (entry.research.confidence === 'Low') openQuestions.push(entry.research.ambiguityStatus);
  if (entry.family === 'Wine') openQuestions.push('Confirm venue cuvée and vintage; reference vintages are not bottle verification.');
  if (['Cocktail', 'Mocktail'].includes(entry.family)) openQuestions.push('Recipe evidence does not establish measured finished-drink balance or current service.');
  return { id: entry.id, duplicateOf: entry.duplicateOf || null, flavorEvidence: status,
    evidenceBasis: entry.research.profileLevel,
    corrections: [review.corrections || review.removedOrQualified || (review.decision ? [review.decision] : [])].flat(),
    pairingCount: entry.pairings.restaurant.length,
    pairingCautionCount: entry.pairings.restaurant.reduce((n, pair) => n + pairingGuidance(entry, pair).length, 0), openQuestions };
});
const report = { checkedAt: '2026-10-03',
  scope: 'Every record evaluated in category reviews. Source accessibility, reference release and recipe evidence vary; this is not a firsthand tasting or venue inventory verification. See audits/2026-10-03 for per-record evidence and limitations.',
  venueScope: 'Drink source checks do not certify inventory. Corn Ribs components freshly corrected; other food item evidence dates are preserved.',
  counts: { records: catalog.entries.length, distinctProfiles: unique.length,
    pairings: unique.reduce((n, entry) => n + entry.pairings.restaurant.length, 0),
    unpaired: unique.filter(entry => !entry.pairings.restaurant.length).length,
    lowConfidenceProfiles: unique.filter(entry => entry.research.confidence === 'Low').length,
    evaluatedRecords: seen.size, evidenceStatuses: statuses }, profiles };
catalog.audit.flavorSweep = { checkedAt: report.checkedAt, scope: report.scope, report: 'data/flavor-audit.json' };
for (const [path, data] of Object.entries({ 'data/drinks.json': catalog, 'drinks.json': catalog, 'data/food.json': food, 'data/flavor-audit.json': report })) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}
console.log(JSON.stringify(report.counts, null, 2));
