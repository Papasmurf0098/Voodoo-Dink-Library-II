// A dated, idempotent migration. No network lookups or claims of automatic source verification.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { pairingGuidance } from '../js/pairing-guidance.js';

const root = new URL('../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const catalog = read('data/drinks.json');
const food = read('data/food.json');
const date = '2026-09-18';
const previousReport = existsSync(new URL('data/flavor-audit.json', root)) ? read('data/flavor-audit.json') : null;
const changed = new Map((previousReport?.profiles || []).map((entry) => [entry.id, entry.corrections]));
const byId = new Map(catalog.entries.map((entry) => [entry.id, entry]));
const get = (id) => { assert.ok(byId.has(id), id); return byId.get(id); };
const record = (id, reason) => changed.set(id, [...new Set([...(changed.get(id) || []), reason])]);
function source(entry, url, title, supports, type = 'producer') {
  const previous = entry.research.sources.find((item) => item.url === url);
  const value = { url, title, supports, type, accessed: date };
  if (previous) Object.assign(previous, value); else entry.research.sources.push(value);
  entry.research.sourceTypesConsulted = [...new Set(entry.research.sources.map((item) => item.type))];
  entry.research.reviewedAt = date;
}
function correct(id, patch, reason) {
  const entry = get(id);
  Object.assign(entry.tasting, patch);
  entry.tags = [entry.family, entry.category, ...entry.tasting.flavor];
  entry.signatureTraits = [entry.tasting.flavor.slice(0, 3).join(' · ')];
  record(id, reason);
  return entry;
}

const angel = correct('angels-envy-kentucky-straight-bourbon-finished-in-port-wine-barrels', {
  aroma: ['vanilla', 'dried grape', 'maple', 'toasted nuts'],
  flavor: ['vanilla', 'ripe fruit', 'maple', 'toast', 'bitter chocolate'],
  finish: 'Lingering sweet impression with a fading wine-like accent; this is a sensory description, not a sugar measurement.',
}, 'Producer describes a lingering sweet impression, not the dry finish previously asserted by the chocolate pairing.');
source(angel, angel.research.sources[0].url, angel.research.sources[0].title, 'Reference bourbon aroma, palate and finish; venue bottle not inspected');

const balcones = correct('balcones-texas-pot-still-bourbon', {
  aroma: ['roasted chestnut', 'root beer', 'molasses', 'dark caramel'],
  flavor: ['pecan', 'cream soda', 'molasses', 'gingerbread'],
  finish: 'Malt and chocolate impressions develop into toasted wood and a smoky accent.',
}, 'Restored the published review’s distinction between nose, palate and finish; one reviewed sample is not every venue pour.');
source(balcones, balcones.research.sources[0].url, balcones.research.sources[0].title, 'Reviewer impressions of a 92-proof sample; not venue or batch verification', 'published tasting reference');

const chopin = correct('chopin-potato-vodka', { flavor: ['earthy', 'creamy'] }, 'Removed unsupported grain note from the Potato reference. Venue expression remains unidentified.');
source(chopin, chopin.research.sources[0].url, chopin.research.sources[0].title, 'Potato-expression tasting notes only; venue may stock another Chopin expression');

const verdita = correct('verdita', {
  aroma: ['mint', 'cilantro', 'pear', 'lime', 'juniper'],
  flavor: ['pear', 'fresh herbs', 'lime tartness', 'vanilla', 'bittersweet botanicals'],
  finish: 'Herbs and citrus may linger alongside vanilla and the bitter botanical contribution of Cocchi; proportions are unknown.',
}, 'Added gin and aromatized-wine contributions as ingredient-led expectations, without inventing their intensity.');
source(verdita, 'https://breckenridgedistillery.com/spirits/breckenridge-gin/', 'Breckenridge Gin', 'Juniper-led base spirit; does not establish finished cocktail balance');
source(verdita, 'https://www.cocchi.it/en/wines/americano/', 'Cocchi Americano', 'Bitter botanical aromatized wine; does not establish cocktail proportions');
for (const id of ['gris-gris-rita', 'jameoretto-sour']) {
  const entry = get(id);
  correct(id, { flavor: [...new Set([...entry.tasting.flavor, 'botanical citrus and spice'])] }, 'Included Munyon’s botanical contribution as an expectation; strength and bitterness remain recipe-dependent.');
  source(entry, 'https://munyonspawpaw.com/our-recipe/', 'Munyon’s Paw-Paw ingredients', 'Citrus and spice ingredients in the aperitif; finished drink balance is inferred');
}
for (const entry of [verdita, get('gris-gris-rita'), get('jameoretto-sour')]) {
  source(entry, food.sourceUrl, 'Voodoo Bayou location-linked menu', 'Named cocktail ingredients only; measures, dilution and current service unconfirmed', 'venue');
}

const replacements = new Map([
  ['The whiskey’s cocoa or roast notes echo the chocolate and coffee; its drier finish contrasts with the dessert’s sweetness.', 'The reference whiskey’s chocolate or roasted notes offer an aromatic link to chocolate and coffee. This does not establish a sweet or dry finish, or guarantee balance with dessert.'],
  ['A conventional whiskey Old Fashioned connects with honey butter and honey butter; confirm the house recipe first.', 'If made with whiskey, sugar and bitters, the drink can echo the cornbread’s honey butter; confirm the house recipe first.'],
  ['The wine’s fruit character supports rich salmon; its lighter tannin profile is useful with fish.', 'The reference wine’s fruit offers contrast to rich salmon and tangy Creole mustard. Tannin and body vary by bottling; do not assume every Pinot Noir is light.'],
  ['Red fruit contrasts with the mushrooms, while earthy or spice notes connect with the herbs and aged cheese.', 'The wine’s fruit offers contrast to savory mushrooms and aged cheese. The dish’s herbs need not imply an earthy or spicy note in every wine.'],
]);
for (const entry of catalog.entries) {
  for (const pair of entry.pairings.restaurant) {
    if (replacements.has(pair.reason)) { pair.reason = replacements.get(pair.reason); record(entry.id, 'Removed an unsupported or repetitive pairing assertion.'); }
  }
}
function pairing(id, dishId, reason) {
  const entry = get(id);
  const pair = entry.pairings.restaurant.find((item) => item.dishId === dishId);
  assert.ok(pair, `${id}: ${dishId}`);
  pair.reason = reason;
  record(id, 'Revised pairing rationale to use retained reference characteristics.');
}
pairing('los-vecinos-del-campo-espadin', 'wood-oysters', 'Roasted agave offers a link to the wood-fired preparation, while butter provides a rich counterpoint. Smoke is not established by the retained tasting reference.');
pairing('los-vecinos-del-campo-espadin', 'tomato', 'Roasted fruit and green-pepper notes offer contrast to pork belly and pimento cheese; tomato jam provides a fruity link. This does not assume smoky mezcal.');
pairing('funky-buddha-hop-gun', 'corn-ribs', 'Caramel malt connects with browned corn and smoked pork, while citrus-hop character contrasts with cheddar and crema. Chipotle makes this a heat-sensitive match.');
for (const id of ['meiomi', 'belle-glos-clark-telephone']) {
  const entry = get(id);
  const pair = entry.pairings.restaurant.find((item) => ['salmon', 'roast-chicken'].includes(item.dishId));
  const dish = food.dishes.find((item) => item.id === 'roast-chicken');
  Object.assign(pair, { dishId: dish.id, name: dish.name, reason: 'The richer reference Pinot profile suits roasted chicken and bourbon jus; barrel-spice notes offer an aromatic link to the browned skin.' });
  record(id, 'Replaced a generic light-Pinot/fish assumption with a richer dish matching the retained body description.');
}

const freshIds = new Set([angel.id, balcones.id, chopin.id, verdita.id, 'gris-gris-rita', 'jameoretto-sour']);
for (const entry of catalog.entries) {
  entry.research.flavorCheck = {
    checkedAt: date,
    status: freshIds.has(entry.id) ? 'targeted-source-check' : 'inherited-evidence-not-reverified',
    summary: freshIds.has(entry.id)
      ? '2026-09-18: targeted tasting or ingredient sources rechecked; not a firsthand tasting or venue bottle verification.'
      : '2026-09-18: structural and pairing-rule sweep only. Earlier tasting references were retained, not independently reverified in this pass.',
  };
  entry.pairingReview.rulesCheckedAt = date;
}

const dishes = new Map(food.dishes.map((dish) => [dish.id, dish]));
const unique = catalog.entries.filter((entry) => !entry.duplicateOf);
const profiles = catalog.entries.map((entry) => {
  assert.ok(entry.research.tastingBasis && entry.research.sources.length, entry.id);
  for (const field of ['aroma', 'flavor']) assert.ok(Array.isArray(entry.tasting[field]), `${entry.id}: ${field}`);
  const seen = new Set();
  for (const pair of entry.pairings.restaurant) {
    const dish = dishes.get(pair.dishId);
    assert.ok(dish && dish.status === 'listed' && dish.name === pair.name, `${entry.id}: ${pair.dishId}`);
    assert.ok(!seen.has(pair.dishId), `${entry.id}: duplicate pairing`);
    seen.add(pair.dishId);
  }
  const gaps = [];
  if (!freshIds.has(entry.id)) gaps.push('Independent re-verification of the retained tasting evidence is outstanding.');
  if (entry.research.confidence === 'Low') gaps.push(entry.research.ambiguityStatus);
  if (entry.family === 'Wine') gaps.push('Confirm cuvée and vintage; sweetness, body and tannin can vary.');
  if (['Cocktail', 'Mocktail'].includes(entry.family)) gaps.push('Recipe quantities, dilution and finished-drink balance are unmeasured.');
  if (entry.menu.status === 'not-found') gaps.push('Reference drink was not found on the previously retrieved menu; current availability needs confirmation.');
  return {
    id: entry.id, duplicateOf: entry.duplicateOf || null,
    flavorEvidence: entry.research.flavorCheck.status,
    evidenceBasis: entry.research.profileLevel,
    corrections: changed.get(entry.id) || [],
    pairingCount: entry.pairings.restaurant.length,
    pairingCautionCount: entry.pairings.restaurant.reduce((sum, pair) => sum + pairingGuidance(entry, pair).length, 0),
    openQuestions: gaps,
  };
});
const report = {
  checkedAt: date,
  scope: 'Full structural and editorial-rule sweep, targeted fresh source checks. Not exhaustive independent verification of all tasting claims.',
  venueScope: 'The menu linked from Palm Beach Gardens was re-read. Online listings are not inventory confirmation. Food source dates remain those of the prior item-level audit.',
  counts: {
    records: catalog.entries.length, distinctProfiles: unique.length,
    pairings: unique.reduce((sum, entry) => sum + entry.pairings.restaurant.length, 0),
    unpaired: unique.filter((entry) => !entry.pairings.restaurant.length).length,
    freshlyCheckedProfiles: freshIds.size,
    retainedEvidenceProfiles: catalog.entries.length - freshIds.size,
    lowConfidenceProfiles: unique.filter((entry) => entry.research.confidence === 'Low').length,
  },
  profiles,
};
catalog.audit.flavorSweep = { checkedAt: date, scope: report.scope, report: 'data/flavor-audit.json' };
const outputs = { 'data/drinks.json': catalog, 'drinks.json': catalog, 'data/flavor-audit.json': report };
for (const [path, value] of Object.entries(outputs)) {
  const text = JSON.stringify(value, null, 2) + '\n';
  if (process.argv.includes('--write')) writeFileSync(new URL(path, root), text);
  else assert.equal(readFileSync(new URL(path, root), 'utf8'), text, `${path} is stale; review before running --write`);
}
console.log(JSON.stringify(report.counts, null, 2));
