export const FAMILY_ORDER = ['All', 'Whiskey', 'Wine', 'Spirit', 'Cocktail', 'Beer', 'RTD', 'Mocktail', 'Soft Drink', 'Water'];
export const FLAVOR_FILTERS = {
  Citrus: /citrus|lemon|lime|orange|grapefruit|yuzu|bergamot|tangerine/,
  Fruit: /fruit|berry|berries|cherry|cherries|apple|pear|plum|peach|apricot|pineapple|mango|banana|guava|raisin|grape|melon|cassis/,
  Herbal: /herb|mint|basil|rosemary|thyme|sage|juniper|\bpine\b|fennel|anise|licorice|\bbay\b|\bfir\b/,
  Smoke: /smok|peat|bonfire/,
  Spice: /spice|pepper|cinnamon|clove|ginger|nutmeg|cardamom|chile/,
  Roast: /cocoa|chocolate|coffee|espresso|mocha|toast/,
  Creamy: /cream|milkshake|silky|velvety|\bbutter\b/,
};

const CONFIDENCE_RANK = { High: 0, Medium: 1, Low: 2 };

export function normalizeCatalog(payload) {
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  const duplicates = entries.filter((entry) => entry.duplicateOf);
  return entries.filter((entry) => !entry.duplicateOf).map((entry, index) => enrichEntry({
    ...entry,
    legacyIds: duplicates.filter((old) => old.duplicateOf === entry.id).map((old) => old.id),
    aliases: [...(entry.aliases || []), ...duplicates.filter((old) => old.duplicateOf === entry.id).map((old) => old.name)],
  }, index));
}

export function enrichEntry(entry, index = 0) {
  const tastingTerms = [
    ...(entry.tasting?.aroma || []),
    ...(entry.tasting?.flavor || []),
    entry.tasting?.body,
    entry.tasting?.finish,
  ];

  const pairings = entry.pairings?.restaurant || [];
  const pairingTerms = pairings.flatMap((pairing) => [pairing.name, pairing.reason]);

  const searchable = [
    entry.name,
    ...(entry.aliases || []),
    entry.menu?.displayName,
    entry.family,
    entry.category,
    entry.subtype,
    entry.varietal,
    entry.producer,
    ...(entry.ingredients || []),
    entry.origin?.country,
    entry.origin?.region,
    entry.origin?.display,
    ...(entry.tags || []),
    ...(entry.whiskey?.displayTags || []),
    ...(entry.whiskey?.styleTerms || []),
    ...(entry.research?.caveats || []),
    ...(entry.signatureTraits || []),
    ...tastingTerms,
    ...pairingTerms,
  ].filter(Boolean).join(' ');

  const preview = entry.tasting?.aroma?.slice(0, 3).join(' · ')
    || entry.tasting?.flavor?.slice(0, 3).join(' · ')
    || entry.signatureTraits?.[0]
    || 'Tasting profile available';

  return {
    ...entry,
    _index: index,
    _search: normalizeText(searchable),
    _preview: preview,
    _hasPairings: pairingTerms.length > 0,
    _flavors: Object.entries(FLAVOR_FILTERS).filter(([, pattern]) => pattern.test(normalizeText([...(entry.tasting?.aroma || []), ...(entry.tasting?.flavor || [])].join(' ')))).map(([name]) => name),
    _hasCaveat: Boolean(entry.research?.caveats?.length || (entry.research?.ambiguityStatus && entry.research.ambiguityStatus !== 'Clear')),
  };
}

export function deriveFacets(entries) {
  const familyCounts = { All: entries.length };
  const categoryCounts = new Map();
  const producers = new Set();

  for (const entry of entries) {
    familyCounts[entry.family] = (familyCounts[entry.family] || 0) + 1;
    const key = `${entry.family}::${entry.category}`;
    categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
    if (entry.producer) producers.add(entry.producer);
  }

  return { familyCounts, categoryCounts, producerCount: producers.size };
}

export function getCategories(entries, family = 'All') {
  const counts = new Map();
  for (const entry of entries) {
    if (family !== 'All' && entry.family !== family) continue;
    counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, count }));
}

export function filterCatalog(entries, state) {
  const terms = tokenize(state.query);
  return entries.filter((entry) => {
    if (state.scope === 'favorites' && !state.favorites.has(entry.id)) return false;
    if (state.scope === 'recent' && !state.recent.includes(entry.id)) return false;
    if (state.family !== 'All' && entry.family !== state.family) return false;
    if (state.category !== 'All' && entry.category !== state.category) return false;
    if (state.confidence !== 'All' && entry.research?.confidence !== state.confidence) return false;
    if (state.pairingsOnly && !entry._hasPairings) return false;
    if (state.caveatsOnly && !entry._hasCaveat) return false;
    if (state.dish && !entry.pairings?.restaurant?.some((pairing) => pairing.dishId === state.dish)) return false;
    if (state.flavor && !entry._flavors.includes(state.flavor)) return false;
    if (state.menu && entry.menu?.status !== state.menu) return false;
    if (terms.length && !terms.every((term) => entry._search.includes(term))) return false;
    return true;
  });
}

export function sortCatalog(entries, sort) {
  const result = [...entries];
  switch (sort) {
    case 'abv-asc':
    case 'abv-desc':
      return result.sort((a, b) => {
        const aAbv = a.strength?.abv;
        const bAbv = b.strength?.abv;
        const aKnown = Number.isFinite(aAbv) && aAbv >= 0 && aAbv <= 100;
        const bKnown = Number.isFinite(bAbv) && bAbv >= 0 && bAbv <= 100;
        // Unknown strength stays last in either direction; 0% is a known ABV.
        if (aKnown !== bKnown) return aKnown ? -1 : 1;
        const difference = aKnown && bKnown ? (aAbv - bAbv) * (sort === 'abv-desc' ? -1 : 1) : 0;
        return difference || a.name.localeCompare(b.name);
      });
    case 'name-desc':
      return result.sort((a, b) => b.name.localeCompare(a.name));
    case 'family':
      return result.sort((a, b) => {
        const familyDiff = FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family);
        return familyDiff || a.name.localeCompare(b.name);
      });
    case 'confidence':
      return result.sort((a, b) => {
        const confidenceDiff = (CONFIDENCE_RANK[a.research?.confidence] ?? 9) - (CONFIDENCE_RANK[b.research?.confidence] ?? 9);
        return confidenceDiff || a.name.localeCompare(b.name);
      });
    case 'original':
      return result.sort((a, b) => a._index - b._index);
    case 'name':
    default:
      return result.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export function getRelated(entries, entry, limit = 6) {
  if (!entry) return [];
  const scored = entries
    .filter((candidate) => candidate.id !== entry.id)
    .map((candidate) => ({ candidate, score: relatedScore(entry, candidate) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name));
  return scored.slice(0, limit).map((item) => item.candidate);
}

function relatedScore(a, b) {
  let score = 0;
  if (a.family === b.family) score += 6;
  if (a.category === b.category) score += 7;
  if (a.subtype && b.subtype && a.subtype.toLowerCase() === b.subtype.toLowerCase()) score += 4;
  if (a.producer && b.producer && a.producer === b.producer) score += 5;

  const aTerms = new Set([...(a.tags || []), ...(a.whiskey?.styleTerms || []), ...(a.tasting?.flavor || [])].map(lower));
  for (const term of [...(b.tags || []), ...(b.whiskey?.styleTerms || []), ...(b.tasting?.flavor || [])]) {
    if (aTerms.has(lower(term))) score += 1;
  }
  return score;
}

export function catalogStats(entries) {
  const families = new Set(entries.map((entry) => entry.family));
  const highConfidence = entries.filter((entry) => entry.research?.confidence === 'High').length;
  return {
    total: entries.length,
    families: families.size,
    highConfidencePct: entries.length ? Math.round((highConfidence / entries.length) * 100) : 0,
  };
}

function tokenize(value = '') {
  return normalizeText(value).trim().split(/\s+/).filter(Boolean);
}

export function normalizeText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[’‘'`]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

function lower(value) {
  return String(value || '').toLowerCase();
}
