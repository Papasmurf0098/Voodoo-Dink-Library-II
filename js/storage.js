export const STORAGE_KEYS = Object.freeze({
  favorites: 'nightcap:v2:favorites',
  recent: 'nightcap:v2:recent',
  preferences: 'nightcap:v2:preferences',
});
export let storageWritable = true;

export function cleanIds(value) {
  return Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === 'string' && id.trim().length > 0))] : [];
}

export function loadFavorites() { return new Set(cleanIds(read(STORAGE_KEYS.favorites, []))); }
export function saveFavorites(set) { return write(STORAGE_KEYS.favorites, cleanIds([...set])); }
export function loadRecent() { return cleanIds(read(STORAGE_KEYS.recent, [])).slice(0, 24); }
export function saveRecent(list) { return write(STORAGE_KEYS.recent, cleanIds(list).slice(0, 24)); }
export function pushRecent(list, id) {
  const next = cleanIds([id, ...list]).slice(0, 24);
  saveRecent(next);
  return next;
}
export function loadPreferences() {
  const raw = read(STORAGE_KEYS.preferences, {});
  return {
    sort: ['name', 'name-desc', 'abv-asc', 'abv-desc', 'family', 'confidence', 'original'].includes(raw?.sort) ? raw.sort : 'name',
    density: raw?.density === 'compact' ? 'compact' : 'comfortable',
  };
}
export function savePreferences(preferences) { return write(STORAGE_KEYS.preferences, preferences); }

export function canonicalIds(ids, entries) {
  const index = new Map();
  for (const entry of entries) {
    index.set(entry.id, entry.id);
    for (const id of entry.legacyIds || []) index.set(id, entry.id);
  }
  return [...new Set(cleanIds(ids).map((id) => index.get(id)).filter(Boolean))];
}

export function createSavedBackup(favorites, now = new Date()) {
  return JSON.stringify({ format: 'voodoo-saved-profiles', version: 1, exportedAt: now.toISOString(), favorites: cleanIds([...favorites]) }, null, 2);
}

export function readSavedBackup(text, entries) {
  if (typeof text !== 'string' || text.length > 262144) throw new Error('Choose a saved-profile backup smaller than 256 KB.');
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error('This file is not a valid saved-profile backup.'); }
  if (payload?.format !== 'voodoo-saved-profiles' || payload.version !== 1 || !Array.isArray(payload.favorites)
    || payload.favorites.length > 4096 || payload.favorites.some((id) => typeof id !== 'string' || !id.trim() || id.length > 200)) {
    throw new Error('Choose a Voodoo saved-profile backup (version 1).');
  }
  const ids = canonicalIds(payload.favorites, entries);
  const known = new Set(entries.flatMap((entry) => [entry.id, ...(entry.legacyIds || [])]));
  return { ids, unavailable: cleanIds(payload.favorites).filter((id) => !known.has(id)).length };
}

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    // Invalid JSON is recoverable data corruption, not a storage permission failure.
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  } catch {
    storageWritable = false;
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    storageWritable = true;
    return true;
  } catch {
    storageWritable = false;
    return false;
  }
}
