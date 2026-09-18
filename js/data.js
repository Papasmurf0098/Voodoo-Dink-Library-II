import { normalizeCatalog, FAMILY_ORDER } from './catalog.js';

// Include parsing in the deadline: a response whose body stalls must not hang boot.
export async function fetchJson(path, { timeoutMs = 10000, fetcher = fetch } = {}) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('The request timed out. Reconnect and try again.'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(async () => {
        const response = await fetcher(path, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed (${response.status}).`);
        return response.json();
      }),
      deadline,
    ]);
  } finally { clearTimeout(timer); }
}

function strings(value) { return value == null || (Array.isArray(value) && value.every((item) => typeof item === 'string')); }
function object(value) { return value == null || (typeof value === 'object' && !Array.isArray(value)); }

export function validateCatalog(payload) {
  if (!Array.isArray(payload?.entries) || !payload.entries.length) throw new Error('The drink catalog is empty or invalid.');
  const ids = new Set();
  for (const entry of payload.entries) {
    if (!entry || !['id', 'name', 'family', 'category'].every((key) => typeof entry[key] === 'string' && entry[key].trim())
      || !FAMILY_ORDER.slice(1).includes(entry.family) || ids.has(entry.id)) throw new Error('The drink catalog contains invalid profiles.');
    ids.add(entry.id);
    for (const field of ['tasting', 'pairings', 'research', 'whiskey', 'origin', 'strength', 'menu', 'sourceRecord', 'pairingReview']) {
      if (!object(entry[field])) throw new Error(`Invalid ${field} for ${entry.name}.`);
    }
    for (const value of [entry.aliases, entry.ingredients, entry.tags, entry.signatureTraits, entry.tasting?.aroma, entry.tasting?.flavor, entry.whiskey?.displayTags, entry.whiskey?.styleTerms, entry.research?.caveats, entry.research?.sourceTypesConsulted]) {
      if (!strings(value)) throw new Error(`Invalid profile notes for ${entry.name}.`);
    }
    for (const field of ['producer', 'subtype', 'varietal', 'duplicateOf']) {
      if (entry[field] != null && typeof entry[field] !== 'string') throw new Error(`Invalid ${field} for ${entry.name}.`);
    }
    for (const value of [entry.pairings?.restaurant, entry.research?.sources]) {
      if (value != null && (!Array.isArray(value) || value.some((item) => !item || !object(item)))) throw new Error(`Invalid references for ${entry.name}.`);
    }
  }
  for (const entry of payload.entries.filter((item) => item.duplicateOf)) {
    if (!payload.entries.some((canonical) => canonical.id === entry.duplicateOf && !canonical.duplicateOf)) throw new Error('The catalog contains an invalid profile redirect.');
  }
  return normalizeCatalog(payload);
}

export function validateFood(payload) {
  const dishes = payload?.dishes;
  if (!Array.isArray(dishes) || !dishes.length) throw new Error('The food menu is empty or invalid.');
  const ids = new Set();
  for (const dish of dishes) {
    if (!dish || typeof dish.id !== 'string' || !dish.id || typeof dish.name !== 'string' || !dish.name || ids.has(dish.id)) throw new Error('The food menu contains invalid dishes.');
    ids.add(dish.id);
  }
  return dishes.filter((dish) => dish.status !== 'not-found').map((dish) => ({
    ...dish, legacyIds: dishes.filter((old) => old.replacedBy === dish.id).map((old) => old.id),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadCatalog(options) { return validateCatalog(await fetchJson('./data/drinks.json', options)); }
export async function loadFood(options) { return validateFood(await fetchJson('./data/food.json', options)); }
