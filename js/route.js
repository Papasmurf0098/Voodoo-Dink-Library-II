import { FAMILY_ORDER, FLAVOR_FILTERS, getCategories } from './catalog.js';

export const FILTER_DEFAULTS = Object.freeze({
  query: '', family: 'All', category: 'All', confidence: 'All',
  pairingsOnly: false, caveatsOnly: false, dish: '', flavor: '', menu: '',
});
const SORTS = ['name', 'name-desc', 'family', 'confidence', 'original'];

export function readRoute(search, entries, food, defaultSort = 'name') {
  const params = new URLSearchParams(search);
  const family = FAMILY_ORDER.includes(params.get('family')) ? params.get('family') : 'All';
  const category = getCategories(entries, family).some(({ name }) => name === params.get('category')) ? params.get('category') : 'All';
  const drink = params.get('drink');
  const selectedId = entries.find((entry) => entry.id === drink || entry.legacyIds.includes(drink))?.id || null;
  return {
    ...FILTER_DEFAULTS, family, category, selectedId,
    query: params.get('q') || '',
    confidence: ['High', 'Medium', 'Low'].includes(params.get('confidence')) ? params.get('confidence') : 'All',
    scope: ['favorites', 'recent'].includes(params.get('scope')) ? params.get('scope') : 'all',
    sort: SORTS.includes(params.get('sort')) ? params.get('sort') : defaultSort,
    pairingsOnly: params.get('pairings') === '1',
    caveatsOnly: params.get('caveats') === '1',
    dish: food.find((dish) => dish.id === params.get('dish') || dish.legacyIds?.includes(params.get('dish')))?.id || '',
    flavor: Object.hasOwn(FLAVOR_FILTERS, params.get('flavor')) ? params.get('flavor') : '',
    menu: ['listed', 'not-found'].includes(params.get('menu')) ? params.get('menu') : '',
    missingDrink: Boolean(drink && !selectedId),
  };
}

export function routeUrl(pathname, state) {
  const params = new URLSearchParams();
  const fields = { query: 'q', family: 'family', category: 'category', confidence: 'confidence', scope: 'scope', sort: 'sort', selectedId: 'drink', dish: 'dish', flavor: 'flavor', menu: 'menu' };
  const defaults = { ...FILTER_DEFAULTS, scope: 'all', sort: 'name', selectedId: null };
  for (const [key, param] of Object.entries(fields)) {
    if (state[key] && state[key] !== defaults[key]) params.set(param, state[key]);
  }
  if (state.pairingsOnly) params.set('pairings', '1');
  if (state.caveatsOnly) params.set('caveats', '1');
  return `${pathname}${params.size ? `?${params}` : ''}`;
}

export function profileUrl(href, id) {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('drink', id);
  return url.href;
}
