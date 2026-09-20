import { loadCatalog, loadFood } from './data.js';
import { pairingGuidance, profileGuidance, PAIRING_PRINCIPLES } from './pairing-guidance.js';
import { FILTER_DEFAULTS, readRoute, routeUrl, profileUrl } from './route.js';
import {
  FAMILY_ORDER,
  FLAVOR_FILTERS,
  catalogStats,
  deriveFacets,
  filterCatalog,
  getCategories,
  getRelated,
  sortCatalog,
} from './catalog.js';
import {
  STORAGE_KEYS, storageWritable, canonicalIds, createSavedBackup, readSavedBackup, saveRecent,
  loadFavorites,
  loadPreferences,
  loadRecent,
  pushRecent,
  saveFavorites,
  savePreferences,
} from './storage.js';

const app = document.querySelector('#app');
const PAGE_STEP = 42;

const state = {
  entries: [],
  query: '',
  family: 'All',
  category: 'All',
  confidence: 'All',
  pairingsOnly: false,
  caveatsOnly: false,
  scope: 'all',
  sort: 'name',
  density: 'comfortable',
  visible: PAGE_STEP,
  selectedId: null,
  dish: '',
  flavor: '',
  menu: '',
  food: [],
  foodUnavailable: false,
  foodLoading: false,
  pendingDish: '',
  favorites: loadFavorites(),
  recent: loadRecent(),
  scrollY: 0,
};

const preferences = loadPreferences();
state.sort = preferences.sort;
state.density = preferences.density;

let facets = null;
let elements = {};
let returnFocus = null;
let returnId = null;
let closingProfile = false;
let searchTimer;
let undoAction = null;
let restoringBackup = false;

boot();

async function boot() {
  try {
    const [catalog, food] = await Promise.allSettled([loadCatalog(), loadFood()]);
    if (catalog.status === 'rejected') throw catalog.reason;
    state.entries = catalog.value;
    state.food = food.status === 'fulfilled' ? food.value : [];
    state.foodUnavailable = food.status === 'rejected';
    state.favorites = new Set(canonicalIds([...state.favorites], state.entries));
    state.recent = canonicalIds(state.recent, state.entries);
    facets = deriveFacets(state.entries);
    hydrateFromUrl({ initial: true });
    syncUrl();
    renderShell();
    bindEvents();
    renderAll();
    registerServiceWorker();
    updateConnectionStatus();
    updateStorageStatus();
    if (state.missingDrink) showToast('That profile is unavailable. Browse the library below.');
  } catch (error) {
    console.error(error);
    app.innerHTML = `
      <section class="fatal-state">
        <span class="fatal-state__mark">V</span>
        <h1>Library unavailable</h1>
        <p>The drink library could not be loaded. Check your connection and try again.</p>
        <button class="button button--primary" onclick="location.reload()">Try again</button>
      </section>`;
  }
}

function renderShell() {
  const stats = catalogStats(state.entries);
  app.innerHTML = `
    <a class="skip-link" href="#mainContent">Skip to profiles</a>
    <header class="masthead">
      <a class="brand" href="${escapeAttribute(window.location.pathname)}" data-action="reset" aria-label="Voodoo Drink Library home">
        <span class="brand__monogram">V</span>
        <span class="brand__type"><strong>Voodoo</strong><small>Drink Library II</small></span>
      </a>

      <label class="command-search" aria-label="Search the drink library">
        <span class="command-search__icon">${icon('search')}</span>
        <input id="searchInput" type="search" placeholder="Drink, flavor, or dish…" autocomplete="off" />
        <kbd>/</kbd>
      </label>

      <nav class="masthead__actions" aria-label="Library actions">
        <button class="icon-button hide-mobile" data-action="random" title="Open a random profile" aria-label="Open a random profile">${icon('shuffle')}</button>
        <button class="saved-button" data-scope="favorites" aria-pressed="false">
          ${icon('bookmark')}
          <span>Saved</span>
          <b id="favoriteCount">0</b>
        </button>
      </nav>
    </header>

    <div id="connectionStatus" class="connection-status" role="status" hidden>Offline · Browsing the saved library</div>
    <div id="storageStatus" class="connection-status" role="status" hidden>Changes are kept for this session. Device storage is unavailable. Back up your saved profiles before leaving.</div>
    <main class="workspace" id="mainContent" tabindex="-1">
      <section class="tray-hero" aria-labelledby="trayTitle">
        <div class="tray-hero__stars" aria-hidden="true"></div>
        <div class="tray-hero__copy">
          <p class="tray-eyebrow">Voodoo Bayou</p>
          <h2 id="trayTitle">The Drink<br> <em>Library.</em></h2>
          <p class="tray-hero__hint">Choose your glass.</p>
          <a class="tray-browse" href="#stageTitle">Explore the collection ${icon('arrow-right')}</a>
          <div class="tray-stats"><div><strong>${stats.total}</strong><span>Drink profiles</span></div><div><strong>${stats.families}</strong><span>Collections</span></div></div>
        </div>
        <div class="tray-hero__visual">
          <img src="./assets/drink-tray.webp" width="1536" height="1024" fetchpriority="high" alt="A silver tray holding red wine, a clear spirit shot, an old fashioned, and a golden cocktail." />
          <nav class="tray-hotspots" aria-label="Explore drinks by glass">
            ${[['Wine', 'Wine', 'wine'], ['Spirit', 'Spirits', 'shot'], ['Whiskey', 'Whiskey', 'rocks'], ['Cocktail', 'Cocktails', 'coupe']].map(([family, label, glass], index) => `
              <a class="tray-hotspot tray-hotspot--${glass}" href="${escapeAttribute(window.location.pathname)}?family=${family}#stageTitle" data-tray-family="${family}" aria-label="Browse ${label}"><span class="tray-hotspot__dot" aria-hidden="true">${index + 1}</span><span class="tray-hotspot__label">${label}</span></a>`).join('')}
          </nav>
        </div>
        <nav class="tray-mobile-key" aria-label="Drink tray categories">
          ${[['Wine', 'Wine'], ['Spirit', 'Spirits'], ['Whiskey', 'Whiskey'], ['Cocktail', 'Cocktails']].map(([family, label], index) => `<a href="${escapeAttribute(window.location.pathname)}?family=${family}#stageTitle" data-tray-family="${family}"><span>${index + 1}</span>${label}${icon('arrow-right')}</a>`).join('')}
        </nav>
      </section>
      <aside class="family-rack" aria-label="Drink families">
        <div class="family-rack__label">Library</div>
        <div id="familyTabs" class="family-rack__tabs"></div>
        <div class="family-rack__foot">
          <span>${stats.total}</span>
          <small>profiles</small>
        </div>
      </aside>

      <section class="library-stage">
        <header class="stage-header">
          <div>
            <p id="stageKicker" class="stage-kicker">Full collection</p>
            <h1 id="stageTitle" tabindex="-1">The Bar</h1>
            <p id="stageSummary" class="stage-summary"></p>
          </div>
          <div class="stage-header__tools">
            <button class="text-button" data-action="random">${icon('spark')} Discover</button>
            <button id="filterToggle" aria-controls="filterDrawer" class="text-button" data-action="toggle-filters" aria-expanded="false">${icon('sliders')} Refine</button>
          </div>
        </header>

        <nav class="category-browser" aria-label="Drink subcategories">
          <p id="categoryHeading" class="category-browser__heading">Browse categories</p>
          <div id="categoryTabs" class="category-tabs"></div>
        </nav>
        <div class="view-strip" role="navigation" aria-label="Library views">
          <button class="view-chip" data-scope="all">All</button>
          <button class="view-chip" data-scope="favorites">${icon('bookmark')} Saved <span id="savedChipCount">0</span></button>
          <button class="view-chip" data-scope="recent">${icon('clock')} Recent</button>
        </div>

        <div id="collectionTools" class="collection-tools" hidden>
          <button class="text-button" data-action="backup-saved">Back up saved</button>
          <button class="text-button" data-action="restore-saved">Restore saved</button>
          <button class="text-button" data-action="clear-recent">Clear history</button>
        </div>
        <input id="backupInput" type="file" accept=".json,application/json" hidden />
        <div id="foodStatus" class="inline-status" role="status" ${state.foodUnavailable ? '' : 'hidden'}>
          <span>Dish details are unavailable. Drink profiles are still available.</span>
          <button class="text-button" data-action="retry-food">Retry food menu</button>
        </div>
        <section class="pairing-finder" aria-label="Find a drink">
          <div><label for="dishSelect">Pair with</label><select id="dishSelect" ${state.foodUnavailable ? 'disabled' : ''} class="select-control"><option value="">Any dish</option>${state.food.map((dish) => `<option value="${escapeAttribute(dish.id)}">${escapeHtml(dish.name)}${dish.service === 'Brunch' ? ' · Brunch' : ''}</option>`).join('')}</select></div>
          <div><label for="flavorSelect">Flavor</label><select id="flavorSelect" class="select-control"><option value="">Any profile</option>${Object.keys(FLAVOR_FILTERS).map((flavor) => `<option>${flavor}</option>`).join('')}</select></div>
          <a class="menu-link" href="https://voodoobayou.com/menu/" target="_blank" rel="noopener noreferrer">Voodoo Bayou menu ↗</a>
          <div id="selectedDish" class="selected-dish" hidden></div>
        </section>

        <section id="filterDrawer" class="filter-drawer" aria-hidden="true" inert>
          <div class="filter-group">
            <label class="filter-label" for="confidenceSelect">Confidence</label>
            <select id="confidenceSelect" class="select-control">
              <option value="All">Any</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label" for="sortSelect">Sort</label>
            <select id="sortSelect" class="select-control">
              <option value="name">A–Z</option>
              <option value="name-desc">Z–A</option>
              <option value="family">Family</option>
              <option value="confidence">Confidence</option>
              <option value="original">Source order</option>
            </select>
          </div>
          <div class="filter-group filter-group--toggles">
            <label class="switch-row"><input id="pairingsOnly" type="checkbox" /> <span>Has pairings</span></label>
            <label class="switch-row"><input id="caveatsOnly" type="checkbox" /> <span>Has caveats</span></label>
          </div>
          <div class="filter-group"><label class="filter-label" for="menuSelect">Menu status</label><select id="menuSelect" class="select-control"><option value="">All records</option><option value="listed">Menu listed</option><option value="not-found">Not found on menu</option></select></div>
          <div class="filter-group filter-group--density">
            <span class="filter-label">Density</span>
            <div class="segmented-control">
              <button data-density="comfortable" title="Comfortable cards">Comfort</button>
              <button data-density="compact" title="Compact cards">Compact</button>
            </div>
          </div>
          <button class="clear-filter" data-action="clear-filters">Clear filters</button>
        </section>

        <div class="result-bar">
          <p id="resultCount" tabindex="-1" role="status" aria-live="polite"></p>
          <div id="activeFilters" class="active-filters"></div>
        </div>

        <section id="catalogDeck" class="catalog-deck" aria-label="Drink profiles"></section>
        <div id="loadMoreWrap" class="load-more-wrap"></div>
        <footer class="library-footer"><span>Location-linked menu checked September 7, 2026</span><a href="RESEARCH_AUDIT.md">Menu scope</a><a href="https://voodoobayou.com/palmbeachgardens/" target="_blank" rel="noopener noreferrer">Palm Beach Gardens ↗</a><a href="ASSET_CREDITS.md">Photo credits</a></footer>
      </section>
    </main>

    <div id="profileLayer" class="profile-layer" aria-hidden="true" inert>
      <button class="profile-scrim" data-action="close-profile" tabindex="-1" aria-label="Close profile"></button>
      <article id="profilePanel" class="profile-panel" role="dialog" aria-modal="true" aria-labelledby="profileTitle"></article>
    </div>

    <div id="toast" class="toast"><span id="toastMessage" role="status" aria-live="polite"></span><button data-action="undo" hidden>Undo</button></div>
  `;

  elements = {
    searchInput: document.querySelector('#searchInput'),
    dishSelect: document.querySelector('#dishSelect'),
    flavorSelect: document.querySelector('#flavorSelect'),
    menuSelect: document.querySelector('#menuSelect'),
    familyTabs: document.querySelector('#familyTabs'),
    categoryTabs: document.querySelector('#categoryTabs'),
    confidenceSelect: document.querySelector('#confidenceSelect'),
    sortSelect: document.querySelector('#sortSelect'),
    pairingsOnly: document.querySelector('#pairingsOnly'),
    caveatsOnly: document.querySelector('#caveatsOnly'),
    filterDrawer: document.querySelector('#filterDrawer'),
    filterToggle: document.querySelector('#filterToggle'),
    catalogDeck: document.querySelector('#catalogDeck'),
    loadMoreWrap: document.querySelector('#loadMoreWrap'),
    resultCount: document.querySelector('#resultCount'),
    activeFilters: document.querySelector('#activeFilters'),
    favoriteCount: document.querySelector('#favoriteCount'),
    savedChipCount: document.querySelector('#savedChipCount'),
    stageKicker: document.querySelector('#stageKicker'),
    stageTitle: document.querySelector('#stageTitle'),
    stageSummary: document.querySelector('#stageSummary'),
    profileLayer: document.querySelector('#profileLayer'),
    profilePanel: document.querySelector('#profilePanel'),
    toast: document.querySelector('#toast'),
  };
}

function bindEvents() {
  elements.searchInput.addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    state.query = event.target.value;
    searchTimer = setTimeout(() => {
      state.visible = PAGE_STEP;
      syncUrl();
      renderLibrary();
    }, 90);
  });

  document.addEventListener('click', handleClick);
  document.addEventListener('change', handleChange);
  document.addEventListener('keydown', handleKeydown);
  elements.profilePanel.addEventListener('scroll', rememberProfilePosition, true);
  elements.profilePanel.addEventListener('toggle', rememberProfilePosition, true);
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  window.addEventListener('storage', syncDeviceStorage);
  window.addEventListener('popstate', () => {
    clearTimeout(searchTimer);
    const wasOpen = Boolean(state.selectedId);
    closingProfile = false;
    hydrateFromUrl();
    renderAll({ fromHistory: true });
    if (wasOpen && !state.selectedId) hideProfile();
  });
}

function handleClick(event) {
  const trayTarget = event.target.closest('[data-tray-family]');
  if (trayTarget) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
    event.preventDefault();
    clearTimeout(searchTimer);
    Object.assign(state, FILTER_DEFAULTS, { family: trayTarget.dataset.trayFamily, scope: 'all', visible: PAGE_STEP, pendingDish: '' });
    syncUrl({ push: true, depth: 0 });
    renderAll();
    elements.stageTitle.focus({ preventScroll: true });
    elements.stageTitle.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    return;
  }
  const actionTarget = event.target.closest('[data-action]');
  const familyTarget = event.target.closest('.family-tab[data-family]');
  const categoryTarget = event.target.closest('[data-category]');
  const scopeTarget = event.target.closest('[data-scope]');
  const drinkTarget = event.target.closest('[data-drink-id]');
  const favoriteTarget = event.target.closest('[data-favorite-id]');
  const densityTarget = event.target.closest('.segmented-control [data-density]');

  if (favoriteTarget) {
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite(favoriteTarget.dataset.favoriteId);
    return;
  }

  if (drinkTarget) {
    openProfile(drinkTarget.dataset.drinkId, drinkTarget);
    return;
  }

  if (familyTarget) {
    setFamily(familyTarget.dataset.family);
    return;
  }

  if (categoryTarget) {
    state.category = categoryTarget.dataset.category;
    state.visible = PAGE_STEP;
    syncUrl();
    renderLibrary();
    return;
  }

  if (scopeTarget) {
    setScope(scopeTarget.dataset.scope);
    return;
  }

  if (densityTarget) {
    state.density = densityTarget.dataset.density;
    savePreferences({ sort: state.sort, density: state.density });
    updateStorageStatus();
    renderLibrary();
    return;
  }

  if (!actionTarget) return;
  const action = actionTarget.dataset.action;
  if (action === 'reset') {
    event.preventDefault();
    resetState();
  } else if (action === 'random') {
    openRandomProfile();
  } else if (action === 'toggle-filters') {
    const open = !elements.filterDrawer.classList.contains('is-open');
    elements.filterDrawer.classList.toggle('is-open', open);
    elements.filterDrawer.setAttribute('aria-hidden', String(!open));
    elements.filterDrawer.inert = !open;
    elements.filterToggle.setAttribute('aria-expanded', String(open));
  } else if (action === 'remove-filter') {
    const key = actionTarget.dataset.filter;
    if (Object.hasOwn(FILTER_DEFAULTS, key)) {
      if (key === 'dish') state.pendingDish = '';
      state[key] = FILTER_DEFAULTS[key];
      if (key === 'family') state.category = 'All';
      state.visible = PAGE_STEP; clearTimeout(searchTimer); syncUrl(); renderAll();
      elements.resultCount.focus({ preventScroll: true });
    }
  } else if (action === 'clear-filters') {
    clearFilters();
  } else if (action === 'load-more') {
    const nextIndex = state.visible;
    state.visible += PAGE_STEP;
    renderResults({ appendFrom: nextIndex });
    elements.catalogDeck.querySelectorAll('.card-open')[nextIndex]?.focus();
  } else if (action === 'close-profile') {
    closeProfile();
  } else if (action === 'backup-saved') {
    exportSaved();
  } else if (action === 'restore-saved') {
    document.querySelector('#backupInput').click();
  } else if (action === 'clear-recent') {
    const previous = [...state.recent];
    state.recent = []; saveRecent(state.recent); renderLibrary(); updateStorageStatus();
    showToast('Recent history cleared', () => { state.recent = previous; saveRecent(previous); renderLibrary(); updateStorageStatus(); });
  } else if (action === 'undo') {
    const undo = undoAction; undoAction = null; undo?.(); showToast('Restored');
    if (!state.selectedId) elements.resultCount.focus({ preventScroll: true });
  } else if (action === 'retry-food') {
    retryFood();
  } else if (action === 'share-profile') {
    shareCurrentProfile();
  } else if (action === 'pair-dish') {
    state.dish = actionTarget.dataset.dish;
    state.family = 'All'; state.category = 'All'; state.scope = 'all'; state.query = ''; state.flavor = ''; state.menu = ''; state.confidence = 'All'; state.pairingsOnly = false; state.caveatsOnly = false;
    state.selectedId = null; state.visible = PAGE_STEP; state.scrollY = 0; state.pendingDish = '';
    syncUrl({ push: true, depth: 0 }); renderAll();
    elements.dishSelect.focus(); window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

function handleChange(event) {
  if (event.target.id === 'backupInput') { restoreSaved(event.target); return; }
  if (event.target === elements.dishSelect) {
    state.dish = event.target.value; state.pendingDish = '';
  } else if (event.target === elements.flavorSelect) {
    state.flavor = event.target.value;
  } else if (event.target === elements.menuSelect) {
    state.menu = event.target.value;
  } else if (event.target === elements.confidenceSelect) {
    state.confidence = event.target.value;
  } else if (event.target === elements.sortSelect) {
    state.sort = event.target.value;
    savePreferences({ sort: state.sort, density: state.density });
    updateStorageStatus();
  } else if (event.target === elements.pairingsOnly) {
    state.pairingsOnly = event.target.checked;
  } else if (event.target === elements.caveatsOnly) {
    state.caveatsOnly = event.target.checked;
  } else {
    return;
  }
  state.visible = PAGE_STEP;
  syncUrl();
  renderLibrary();
}

function handleKeydown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
  if (state.selectedId && event.key === 'Tab') {
    const focusable = [...elements.profilePanel.querySelectorAll('button, a[href], summary, input, select, [tabindex="0"]')].filter((node) => node.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !elements.profilePanel.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !elements.profilePanel.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  }
  if (event.key === '/' && !isTypingTarget(event.target) && !state.selectedId) {
    event.preventDefault();
    elements.searchInput.focus();
    elements.searchInput.select();
  }
  if (event.key === 'Escape' && state.selectedId) {
    closeProfile();
  }
  if ((event.key === 'r' || event.key === 'R') && !isTypingTarget(event.target) && !state.selectedId) {
    openRandomProfile();
  }
}

function renderAll({ fromHistory = false } = {}) {
  elements.searchInput.value = state.query;
  elements.dishSelect.value = state.dish;
  elements.flavorSelect.value = state.flavor;
  elements.menuSelect.value = state.menu;
  elements.confidenceSelect.value = state.confidence;
  elements.sortSelect.value = state.sort;
  elements.pairingsOnly.checked = state.pairingsOnly;
  elements.caveatsOnly.checked = state.caveatsOnly;
  renderFamilyTabs();
  renderLibrary();
  updateFavoriteUI();

  if (state.selectedId) {
    renderProfile(state.selectedId, { fromHistory });
  } else {
    hideProfile({ restoreScroll: false });
  }
}

function renderLibrary() {
  const focused = document.activeElement;
  const focusKey = ['family', 'category', 'scope', 'density'].find((key) => focused?.dataset?.[key]);
  document.body.dataset.family = state.selectedId ? state.entries.find((entry) => entry.id === state.selectedId)?.family : state.family;
  document.body.dataset.density = state.density;
  const dish = state.food.find((item) => item.id === state.dish);
  const dishDetail = document.querySelector('#selectedDish');
  dishDetail.hidden = !dish;
  dishDetail.innerHTML = dish ? `<strong>${escapeHtml(dish.name)}</strong><p>${escapeHtml(dish.components)}</p><small>${escapeHtml(dish.service)} · Menu checked ${escapeHtml(dish.checkedAt)}</small>` : '';
  renderFamilyTabs();
  renderCategories();
  renderStageHeader();
  renderScopeTabs();
  renderCollectionTools();
  elements.sortSelect.disabled = state.scope === 'recent';
  elements.sortSelect.title = state.scope === 'recent' ? 'Newest viewed first' : '';
  renderActiveFilters();
  renderResults();
  renderDensityControl();
  updateFavoriteUI();
  const noResults = getFiltered().length === 0;
  document.querySelectorAll('[data-action="random"]').forEach((button) => { button.disabled = noResults; });
  if (focusKey && !focused.isConnected) {
    [...document.querySelectorAll(`[data-${focusKey}]`)].find((node) => node.dataset[focusKey] === focused.dataset[focusKey])?.focus({ preventScroll: true });
  }
}

function renderFamilyTabs() {
  elements.familyTabs.innerHTML = FAMILY_ORDER.map((family) => {
    const count = facets.familyCounts[family] || 0;
    const active = state.family === family;
    return `
      <button class="family-tab ${active ? 'is-active' : ''}" data-family="${escapeAttribute(family)}" aria-pressed="${active}">
        <span class="family-tab__index">${family === 'All' ? '00' : String(FAMILY_ORDER.indexOf(family)).padStart(2, '0')}</span>
        <span class="family-tab__name">${escapeHtml(family)}</span>
        <span class="family-tab__count">${count}</span>
      </button>`;
  }).join('');
}

function renderCategories() {
  const categories = getCategories(state.entries, state.family);
  const spiritOrder = ['Vodka', 'Gin', 'Rum', 'Aperitif', 'Tequila', 'Mezcal', 'Liqueur'];
  if (state.family === 'Spirit') categories.sort((a, b) => {
    const rank = (name) => spiritOrder.includes(name) ? spiritOrder.indexOf(name) : spiritOrder.length;
    return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
  });
  document.querySelector('#categoryHeading').textContent = state.family === 'Spirit' ? 'Spirits · Menu sections' : 'Browse categories';
  elements.categoryTabs.innerHTML = [
    `<button class="category-tab ${state.category === 'All' ? 'is-active' : ''}" data-category="All" aria-pressed="${state.category === 'All'}">All</button>`,
    ...categories.map(({ name, count }) => `
      <button class="category-tab ${state.category === name ? 'is-active' : ''}" data-category="${escapeAttribute(name)}" aria-pressed="${state.category === name}">
        ${escapeHtml(name === 'Aperitif' ? 'Aperitifs' : name === 'Liqueur' && state.family === 'Spirit' ? 'Other liqueurs' : name)} <span>${count}</span>
      </button>`),
  ].join('');
}

function renderStageHeader() {
  const filtered = getFiltered();
  const scopeLabels = { all: 'Full collection', favorites: 'Saved collection', recent: 'Recently viewed' };
  elements.stageKicker.textContent = scopeLabels[state.scope] || 'Collection';
  elements.stageTitle.textContent = state.family === 'All' ? 'The Bar' : state.family === 'Spirit' ? 'Spirits' : state.family === 'Cocktail' ? 'Cocktails' : state.family;

  const descriptors = [];
  if (state.category !== 'All') descriptors.push(state.category);
  if (state.query) descriptors.push(`“${state.query}”`);
  elements.stageSummary.textContent = descriptors.length
    ? `${filtered.length} matching profile${filtered.length === 1 ? '' : 's'} · ${descriptors.join(' · ')}`
    : 'Voodoo Bayou · Palm Beach Gardens';
}

function renderScopeTabs() {
  document.querySelectorAll('[data-scope]').forEach((button) => {
    const active = button.dataset.scope === state.scope;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderActiveFilters() {
  const filters = [];
  if (state.query) filters.push(['query', 'Search', state.query]);
  if (state.family !== 'All') filters.push(['family', 'Family', state.family]);
  if (state.category !== 'All') filters.push(['category', 'Category', state.category]);
  if (state.confidence !== 'All') filters.push(['confidence', 'Confidence', state.confidence]);
  if (state.pairingsOnly) filters.push(['pairingsOnly', 'Pairings', 'Required']);
  if (state.caveatsOnly) filters.push(['caveatsOnly', 'Caveats', 'Present']);
  if (state.dish || state.pendingDish) filters.push(['dish', 'Dish', state.food.find((dish) => dish.id === state.dish)?.name || 'Waiting for food menu']);
  if (state.flavor) filters.push(['flavor', 'Flavor', state.flavor]);
  if (state.menu) filters.push(['menu', 'Menu', state.menu === 'listed' ? 'Listed' : 'Not found']);
  elements.activeFilters.innerHTML = filters.map(([key, label, value]) => `
    <button class="active-filter" data-action="remove-filter" data-filter="${key}" aria-label="Remove ${escapeAttribute(label)} filter: ${escapeAttribute(value)}"><small>${label}</small><span>${escapeHtml(value)}</span>${icon('x')}</button>
  `).join('');
}

function renderResults({ appendFrom = 0 } = {}) {
  const results = getFiltered();
  const visible = results.slice(0, state.visible);
  elements.resultCount.textContent = `${results.length} ${results.length === 1 ? 'profile' : 'profiles'}`;
  if (!results.length) {
    elements.catalogDeck.innerHTML = emptyState();
    elements.loadMoreWrap.innerHTML = '';
    return;
  }
  if (appendFrom) elements.catalogDeck.insertAdjacentHTML('beforeend', visible.slice(appendFrom).map((entry, index) => cardMarkup(entry, index)).join(''));
  else elements.catalogDeck.innerHTML = visible.map((entry, index) => cardMarkup(entry, index)).join('');
  elements.loadMoreWrap.innerHTML = results.length > visible.length
    ? `<button class="load-more" data-action="load-more">Show ${Math.min(PAGE_STEP, results.length - visible.length)} more <span>${visible.length} / ${results.length}</span></button>`
    : `<div class="end-mark"><span>V</span><small>End of selection</small></div>`;
}

function cardMarkup(entry, index) {
  const strength = formatStrength(entry.strength);
  const tags = cardTags(entry).slice(0, 2);
  const saved = state.favorites.has(entry.id);
  const subtitle = [entry.subtype || entry.varietal, entry.producer].filter(Boolean).join(' · ');
  return `
    <article class="catalog-card" data-card-id="${escapeAttribute(entry.id)}" style="--card-order:${index % 8}">
      <div class="catalog-card__edge" aria-hidden="true"></div>
      <div class="catalog-card__topline">
        <span class="catalog-card__category">${escapeHtml(entry.category)}</span>
        <button class="card-save ${saved ? 'is-saved' : ''}" data-favorite-id="${escapeAttribute(entry.id)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from saved' : 'Save profile'}">${icon('bookmark')}</button>
      </div>
      <div class="catalog-card__body">
        <p class="catalog-card__family">${escapeHtml(entry.family)}</p>
        <h2><button class="card-open" data-drink-id="${escapeAttribute(entry.id)}" aria-label="Open ${escapeAttribute(entry.name)}">${escapeHtml(entry.name)}</button></h2>
        ${subtitle ? `<p class="catalog-card__meta">${escapeHtml(subtitle)}</p>` : ''}
        <p class="catalog-card__preview">${escapeHtml(entry._preview)}</p>
        ${entry.pairings?.restaurant?.length ? `<p class="catalog-card__pairing">With ${escapeHtml(entry.pairings.restaurant[0].name)}</p>` : ''}
      </div>
      <footer class="catalog-card__footer">
        <div class="micro-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
        ${strength ? `<strong>${escapeHtml(strength)}</strong>` : ''}
      </footer>
    </article>`;
}

function renderDensityControl() {
  document.querySelectorAll('[data-density]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.density === state.density);
    button.setAttribute('aria-pressed', String(button.dataset.density === state.density));
  });
}

function openProfile(id, trigger = document.activeElement) {
  if (closingProfile || state.selectedId === id || !state.entries.some((entry) => entry.id === id)) return;
  clearTimeout(searchTimer);
  if (!state.selectedId) {
    state.scrollY = window.scrollY;
    returnFocus = trigger;
    returnId = id;
    // Keep the complete collection position on the entry beneath the dialog.
    syncUrl();
  }
  const currentDepth = history.state?.voodoo?.depth || 0;
  const depth = state.selectedId ? (currentDepth ? currentDepth + 1 : 0) : 1;
  state.selectedId = id;
  syncUrl({ push: depth > 0, depth });
  renderProfile(id);
}

function renderProfile(id, { fromHistory = false } = {}) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) {
    state.selectedId = null;
    syncUrl();
    hideProfile({ restoreScroll: false });
    return;
  }

  if (!fromHistory) { state.recent = pushRecent(state.recent, id); updateStorageStatus(); }
  document.title = `${entry.name} · Voodoo`;
  const related = getRelated(state.entries, entry, 6);
  const saved = state.favorites.has(entry.id);
  const strength = formatStrength(entry.strength);
  const sourceFields = researchFields(entry);

  elements.profilePanel.innerHTML = `
    <header class="profile-toolbar">
      <button class="profile-back" data-action="close-profile">${icon('arrow-left')} Library</button>
      <div class="profile-toolbar__actions">
        <button class="icon-button ${saved ? 'is-saved' : ''}" data-favorite-id="${escapeAttribute(entry.id)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from saved' : 'Save profile'}" title="${saved ? 'Remove from saved' : 'Save profile'}">${icon('bookmark')}</button>
        <button class="icon-button" data-action="share-profile" aria-label="Share profile" title="Share profile">${icon('share')}</button>
        <button class="icon-button" data-action="close-profile" aria-label="Close profile" title="Close profile">${icon('x')}</button>
      </div>
    </header>

    <div class="share-link" id="shareLink" hidden>
      <label for="profileLink">Profile link</label>
      <input id="profileLink" type="url" readonly value="${escapeAttribute(profileUrl(location.href, entry.id))}" />
    </div>
    <div class="profile-scroll">
      <section class="profile-hero">
        <div class="profile-hero__index">${String(entry._index + 1).padStart(3, '0')}</div>
        <div class="profile-hero__copy">
          <p>${escapeHtml(entry.family)} <span>·</span> ${escapeHtml(entry.category)}</p>
          <h1 id="profileTitle">${escapeHtml(entry.name)}</h1>
          <div class="profile-badges">${profileBadges(entry).map((badge) => `<span>${escapeHtml(badge)}</span>`).join('')}</div>
        </div>
        <div class="profile-hero__strength">
          ${strength ? `<strong>${escapeHtml(strength)}</strong><small>Strength</small>` : '<strong>—</strong><small>Strength</small>'}
        </div>
      </section>

      <section class="profile-facts">
        ${factMarkup('Producer', entry.producer)}
        ${factMarkup('Origin', entry.origin?.display)}
        ${factMarkup(entry.varietal ? 'Varietal' : 'Style', entry.varietal || entry.subtype)}
        ${factMarkup('Proof', entry.strength?.proofDisplay || numberValue(entry.strength?.proof))}
      </section>

      <div class="profile-grid">
        <div class="profile-main">
          ${tastingMarkup(entry)}
          ${pairingsMarkup(entry)}
          ${relatedMarkup(related)}
        </div>

        <aside class="profile-aside">
          ${quickReadMarkup(entry)}
          <details class="research-panel">
            <summary><span>Accuracy & sources</span>${icon('chevron-down')}</summary>
            <div class="research-panel__body">
              <div class="research-status">${researchBadgeMarkup(entry)}</div>
              ${sourceFields.map(([label, value]) => `<div class="research-row"><small>${escapeHtml(label)}</small><p>${escapeHtml(value)}</p></div>`).join('')}
              <ul class="source-links">${(entry.research?.sources || []).filter((source) => safeUrl(source.url)).map((source) => `<li><a href="${escapeAttribute(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)} ↗</a><p>${escapeHtml(source.supports)}</p><small>${escapeHtml(source.type)} · ${escapeHtml(source.accessed)}</small></li>`).join('')}</ul>
            </div>
          </details>
        </aside>
      </div>
    </div>
  `;

  elements.profileLayer.classList.add('is-open');
  elements.profileLayer.setAttribute('aria-hidden', 'false');
  elements.profileLayer.inert = false;
  document.querySelector('.workspace').inert = true;
  document.querySelector('.masthead').inert = true;
  document.querySelector('.skip-link').inert = true;
  document.body.classList.add('profile-open');
  document.body.dataset.family = entry.family || state.family;
  const position = history.state?.voodoo;
  if (position?.selectedId === id) {
    elements.profilePanel.querySelector('.profile-scroll').scrollTop = position.profileScroll || 0;
    elements.profilePanel.querySelector('.research-panel').open = Boolean(position.researchOpen);
  }
  requestAnimationFrame(() => { if (state.selectedId === id) elements.profilePanel.querySelector('.profile-back')?.focus({ preventScroll: true }); });
  updateFavoriteUI();
}

function closeProfile() {
  if (!state.selectedId || closingProfile) return;
  const depth = history.state?.voodoo?.depth || 0;
  if (depth > 0) {
    closingProfile = true;
    history.go(-depth);
    return;
  }
  // A directly opened link has no in-app collection entry to go back to.
  state.selectedId = null;
  syncUrl();
  renderLibrary();
  hideProfile();
}

function hideProfile({ restoreScroll = true } = {}) {
  elements.profileLayer?.classList.remove('is-open');
  elements.profileLayer?.setAttribute('aria-hidden', 'true');
  if (elements.profileLayer) elements.profileLayer.inert = true;
  document.querySelector('.workspace').inert = false;
  document.querySelector('.masthead').inert = false;
  document.querySelector('.skip-link').inert = false;
  document.body.classList.remove('profile-open');
  document.title = 'Voodoo · Drink Library II';
  document.body.dataset.family = state.family;
  if (restoreScroll) requestAnimationFrame(() => { window.scrollTo({ top: state.scrollY, behavior: 'auto' }); const trigger = [...elements.catalogDeck.querySelectorAll('.card-open')].find((node) => node.dataset.drinkId === returnId); (returnFocus?.isConnected ? returnFocus : trigger || elements.searchInput)?.focus({ preventScroll: true }); });
}

function setFamily(family) {
  state.family = FAMILY_ORDER.includes(family) ? family : 'All';
  state.category = 'All';
  state.visible = PAGE_STEP;
  syncUrl();
  renderLibrary();
}

function setScope(scope) {
  state.scope = ['all', 'favorites', 'recent'].includes(scope) ? scope : 'all';
  state.visible = PAGE_STEP;
  syncUrl();
  renderLibrary();
}

function clearFilters() {
  clearTimeout(searchTimer);
  Object.assign(state, FILTER_DEFAULTS, { visible: PAGE_STEP, pendingDish: '' });
  syncUrl();
  renderAll();
}

function resetState() {
  clearTimeout(searchTimer);
  Object.assign(state, {
    query: '', family: 'All', category: 'All', confidence: 'All',
    pairingsOnly: false, caveatsOnly: false, scope: 'all', visible: PAGE_STEP, selectedId: null,
    dish: '', flavor: '', menu: '', pendingDish: '',
  });
  syncUrl();
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleFavorite(id) {
  if (!state.entries.some((entry) => entry.id === id)) return;
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
    showToast('Removed from saved', state.selectedId ? null : () => { state.favorites.add(id); saveFavorites(state.favorites); updateFavoriteUI(); renderLibrary(); updateStorageStatus(); });
  } else {
    state.favorites.add(id);
    showToast('Saved to your library');
  }
  const persisted = saveFavorites(state.favorites);
  updateStorageStatus();
  if (!persisted && state.favorites.has(id)) showToast('Saved for this session. Device storage is unavailable.');
  // Mutate only bookmark controls: preserve the reader's scroll, focus and details.
  updateFavoriteUI();
  if (state.scope === 'favorites') {
    const controls = [...elements.catalogDeck.querySelectorAll('[data-favorite-id]')];
    const index = controls.indexOf(document.activeElement);
    renderLibrary();
    if (index >= 0) (elements.catalogDeck.querySelectorAll('[data-favorite-id]')[Math.min(index, state.favorites.size - 1)] || elements.searchInput).focus({ preventScroll: true });
  }
}

function updateFavoriteUI() {
  if (!elements.favoriteCount) return;
  elements.favoriteCount.textContent = state.favorites.size;
  elements.savedChipCount.textContent = state.favorites.size;
  document.querySelectorAll('[data-favorite-id]').forEach((button) => {
    const saved = state.favorites.has(button.dataset.favoriteId);
    button.classList.toggle('is-saved', saved);
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save profile');
    button.title = saved ? 'Remove from saved' : 'Save profile';
  });
}

function openRandomProfile() {
  const pool = getFiltered();
  const entry = pool[Math.floor(Math.random() * pool.length)];
  if (entry) openProfile(entry.id);
}

function getFiltered() {
  const filtered = filterCatalog(state.entries, state);
  if (state.scope === 'recent') {
    const order = new Map(state.recent.map((id, index) => [id, index]));
    return filtered.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  }
  return sortCatalog(filtered, state.sort);
}

function rememberProfilePosition() {
  if (!state.selectedId || history.state?.voodoo?.selectedId !== state.selectedId) return;
  const scroll = elements.profilePanel.querySelector('.profile-scroll');
  const research = elements.profilePanel.querySelector('.research-panel');
  if (!scroll || !research) return;
  history.replaceState({ voodoo: { ...history.state.voodoo, profileScroll: scroll.scrollTop, researchOpen: research.open } }, '');
}

function hydrateFromUrl({ initial = false } = {}) {
  Object.assign(state, readRoute(location.search, state.entries, state.food, initial && !location.search ? preferences.sort : 'name'));
  state.pendingDish = state.foodUnavailable ? new URLSearchParams(location.search).get('dish') || '' : '';
  const snapshot = history.state?.voodoo;
  state.visible = Math.max(PAGE_STEP, Math.min(state.entries.length, Number(snapshot?.visible) || PAGE_STEP));
  state.scrollY = Math.max(0, Number(snapshot?.scrollY) || 0);
  returnId = snapshot?.returnId || returnId;
}

function syncUrl({ push = false, depth } = {}) {
  const url = routeUrl(location.pathname, { ...state, dish: state.pendingDish || state.dish });
  const previous = history.state?.voodoo;
  const snapshot = {
    depth: depth ?? (state.selectedId ? history.state?.voodoo?.depth || 0 : 0),
    visible: state.visible, scrollY: state.scrollY, returnId, selectedId: state.selectedId,
    profileScroll: previous?.selectedId === state.selectedId ? previous?.profileScroll || 0 : 0,
    researchOpen: previous?.selectedId === state.selectedId ? Boolean(previous?.researchOpen) : false,
  };
  history[push ? 'pushState' : 'replaceState']({ voodoo: snapshot }, '', url);
}

async function shareCurrentProfile() {
  const entry = state.entries.find((item) => item.id === state.selectedId);
  if (!entry) return;
  const url = profileUrl(window.location.href, entry.id);
  if (navigator.share) {
    try {
      await navigator.share({ title: entry.name, text: `${entry.name} — Voodoo Drink Library`, url });
      return;
    } catch (error) { if (error?.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Profile link copied');
  } catch {
    if (state.selectedId !== entry.id) return;
    const panel = elements.profilePanel.querySelector('#shareLink');
    panel.hidden = false;
    const input = panel.querySelector('input');
    input.focus(); input.select();
    showToast('Select and copy this profile link');
  }
}

function tastingMarkup(entry) {
  const aroma = entry.tasting?.aroma || [];
  const flavor = entry.tasting?.flavor || [];
  if (!aroma.length && !flavor.length && !entry.tasting?.body && !entry.tasting?.finish) return '';
  return `
    <section class="content-section tasting-section">
      <div class="section-heading"><span>01</span><h2>Tasting profile</h2></div>
      ${aroma.length ? noteGroup('Aroma', aroma) : ''}
      ${flavor.length ? noteGroup('Palate', flavor) : ''}
      <div class="tasting-prose">
        ${entry.tasting?.body ? `<div><small>Body</small><p>${escapeHtml(entry.tasting.body)}</p></div>` : ''}
        ${entry.tasting?.finish ? `<div><small>Finish</small><p>${escapeHtml(entry.tasting.finish)}</p></div>` : ''}
      </div>
    </section>`;
}

function noteGroup(label, notes) {
  return `<div class="note-group"><small>${label}</small><div>${notes.map((note) => `<span>${escapeHtml(note)}</span>`).join('')}</div></div>`;
}

function pairingsMarkup(entry) {
  const pairs = entry.pairings?.restaurant || [];
  return `
    <section class="content-section">
      <div class="section-heading"><span>02</span><h2>From the kitchen</h2></div>
      <p class="pairing-note">${pairs.length ? 'Suggested Voodoo Bayou pairings' : escapeHtml(entry.pairingReview?.note || 'Pairing pending bottle confirmation.')}${pairs.length && entry.pairingReview?.conditional ? ' · conditional on the reference bottle' : ''}</p>
      <div class="pairing-grid">${pairs.map((pair) => `
        <div class="pairing-group">
          <h3>${escapeHtml(pair.name)}</h3>
          <p>${escapeHtml(pair.reason)}</p>
          ${pairingGuidance(entry, pair).map((note) => `<p class="pairing-caution"><strong>Consider:</strong> ${escapeHtml(note)}</p>`).join('')}
          <button class="pairing-explore" ${state.foodUnavailable ? 'disabled' : ''} data-action="pair-dish" data-dish="${escapeAttribute(pair.dishId)}">Other drinks for this dish</button>
        </div>`).join('')}</div>
      <a class="menu-link" href="https://voodoobayou.com/menu/" target="_blank" rel="noopener noreferrer">Food menu ↗</a>
      ${pairs.length ? `<details class="pairing-method"><summary>How to use these pairings</summary><p>${escapeHtml(profileGuidance(entry))}</p><p>Background principles, not evidence that these specific combinations were tasted:</p><ul>${PAIRING_PRINCIPLES.map((source) => `<li><a href="${escapeAttribute(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join('')}</ul></details>` : ''}
    </section>`;
}

function relatedMarkup(related) {
  if (!related.length) return '';
  return `
    <section class="content-section related-section">
      <div class="section-heading"><span>03</span><h2>Continue tasting</h2></div>
      <div class="related-rail">${related.map((entry) => `
        <button class="related-card" data-drink-id="${escapeAttribute(entry.id)}">
          <small>${escapeHtml(entry.category)}</small>
          <strong>${escapeHtml(entry.name)}</strong>
          <span>${escapeHtml(entry._preview)}</span>
        </button>`).join('')}</div>
    </section>`;
}

function quickReadMarkup(entry) {
  const tags = entry._flavors;
  return `
    <section class="quick-read">
      <p class="aside-label">At a glance</p>
      ${tags.length ? `<div class="quick-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      <div class="caveat-note"><strong>${entry.menu?.status === 'listed' ? 'Menu listed' : 'Not found on menu'}</strong><p>${entry.menu?.status === 'listed' ? 'Availability and exact bottle remain subject to confirmation.' : 'Retained reference. Absence from the online menu does not establish discontinuation.'}</p></div>
      ${entry.strength?.note ? `<div class="caveat-note"><strong>Strength reference</strong><p>${escapeHtml(entry.strength.note)}</p></div>` : ''}
      ${entry.ingredients?.length ? noteGroup('Menu ingredients', entry.ingredients) : ''}
    </section>`;
}

function researchBadgeMarkup(entry) {
  const confidence = entry.research?.confidence || 'Unrated';
  return `
    <span class="research-badge research-badge--${escapeAttribute(confidence.toLowerCase())}">${escapeHtml(confidence)} confidence</span>`;
}

function researchFields(entry) {
  return [
    ['Profile level', entry.research?.profileLevel],
    ['Reviewed', entry.research?.reviewedAt],
    ['Tasting basis', entry.research?.tastingBasis],
    ['Latest source check', entry.research?.flavorCheck?.summary],
    ['Source types', cleanSources(entry.research?.sourceTypesConsulted)],
    ['Conflicts', entry.research?.conflictsFound],
    ['Resolution', entry.research?.resolution],
    ['Source record', entry.sourceRecord?.displayName],
    ['Normalized from', entry.sourceRecord?.normalizedFrom],
    ['Caveats', entry.research?.caveats?.join(' ')],
  ].filter(([, value]) => value);
}

function factMarkup(label, value) {
  if (!value) return '';
  return `<div class="profile-fact"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;
}

function profileBadges(entry) {
  const badges = [];
  if (entry.subtype) badges.push(entry.subtype);
  if (entry.varietal) badges.push(entry.varietal);
  badges.push(entry.research?.profileLevel || 'Reference profile');
  return [...new Set(badges)].slice(0, 5);
}

function cardTags(entry) {
  const tags = [];
  if (entry.menu?.status === 'not-found') tags.push('Not on retrieved menu');
  else if (entry.research?.confidence === 'Low') tags.push('Confirm expression');
  else tags.push('Reference profile');
  return tags;
}

function emptyState() {
  const isEmptyCollection = state.scope === 'favorites' ? state.favorites.size === 0 : state.scope === 'recent' ? state.recent.length === 0 : false;
  const copy = isEmptyCollection
    ? state.scope === 'favorites'
      ? ['Nothing saved yet', 'Bookmark a profile to keep it here.']
      : ['No recent profiles', 'Profiles you open will appear here.']
    : ['No matching profiles', `Try clearing filters${state.scope === 'all' ? '' : ' to see the rest of this collection'}.`];
  return `<div class="empty-state">
    <span>${icon(state.scope === 'favorites' ? 'bookmark' : 'search')}</span>
    <h2>${copy[0]}</h2><p>${copy[1]}</p>
    <button class="button" data-action="${isEmptyCollection ? 'reset' : 'clear-filters'}">${isEmptyCollection ? 'Browse all profiles' : 'Clear filters'}</button>
  </div>`;
}

function formatStrength(strength) {
  if (!strength) return '';
  return strength.abvDisplay || strength.display || (strength.abv != null ? `${strength.abv}% ABV` : '');
}

function numberValue(value) {
  return value == null ? '' : String(value);
}

function cleanSources(values) {
  if (!values?.length) return '';
  return values.map((value) => String(value).replace(/^\s*:\s*/, '')).join(', ');
}


function showToast(message, undo = null) {
  elements.toast.querySelector('#toastMessage').textContent = message;
  undoAction = undo;
  const button = elements.toast.querySelector('[data-action="undo"]');
  button.hidden = !undo;
  elements.toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    if (document.activeElement === button) return;
    elements.toast.classList.remove('is-visible');
    button.hidden = true;
    undoAction = null;
  }, undo ? 10000 : 4000);
}

function renderCollectionTools() {
  const panel = document.querySelector('#collectionTools');
  panel.hidden = state.scope === 'all';
  panel.querySelector('[data-action="backup-saved"]').hidden = state.scope !== 'favorites';
  panel.querySelector('[data-action="backup-saved"]').disabled = state.favorites.size === 0;
  panel.querySelector('[data-action="restore-saved"]').hidden = state.scope !== 'favorites';
  panel.querySelector('[data-action="clear-recent"]').hidden = state.scope !== 'recent';
  panel.querySelector('[data-action="clear-recent"]').disabled = state.recent.length === 0;
}

function updateStorageStatus() {
  const status = document.querySelector('#storageStatus');
  if (status) status.hidden = storageWritable;
}

function syncDeviceStorage(event) {
  if (event.storageArea && event.storageArea !== localStorage) return;
  if (event.key && !Object.values(STORAGE_KEYS).includes(event.key)) return;
  // Refresh only the changed domain; avoid resetting a route-selected sort on a save.
  if (!event.key || event.key === STORAGE_KEYS.favorites) state.favorites = new Set(canonicalIds([...loadFavorites()], state.entries));
  if (!event.key || event.key === STORAGE_KEYS.recent) state.recent = canonicalIds(loadRecent(), state.entries);
  if (!event.key || event.key === STORAGE_KEYS.preferences) {
    Object.assign(state, loadPreferences()); syncUrl();
    elements.sortSelect.value = state.sort;
  }
  renderLibrary(); updateFavoriteUI(); updateStorageStatus();
}

function exportSaved() {
  if (!state.favorites.size) return;
  let url;
  try {
    url = URL.createObjectURL(new Blob([createSavedBackup(state.favorites)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `voodoo-saved-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove();
    showToast('Saved-profile backup prepared');
  } catch { showToast('Backup could not be downloaded. Try another browser.'); }
  finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

async function restoreSaved(input) {
  if (restoringBackup) return;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  restoringBackup = true;
  try {
    if (file.size > 262144) throw new Error('Choose a saved-profile backup smaller than 256 KB.');
    const { ids, unavailable } = readSavedBackup(await file.text(), state.entries);
    const before = state.favorites.size;
    // Restore always merges. Existing saved profiles cannot be erased by a backup.
    for (const id of ids) state.favorites.add(id);
    saveFavorites(state.favorites); renderLibrary(); updateStorageStatus();
    const added = state.favorites.size - before;
    showToast(`${added} saved ${added === 1 ? 'profile' : 'profiles'} added${unavailable ? ` · ${unavailable} unavailable` : ''}${storageWritable ? '' : ' · this session only'}`);
  } catch (error) { showToast(error.message || 'This backup could not be restored.'); }
  finally { restoringBackup = false; }
}

function isTypingTarget(target) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
}

function updateConnectionStatus() {
  document.querySelector('#connectionStatus').hidden = navigator.onLine !== false;
}

async function retryFood() {
  if (state.foodLoading) return;
  state.foodLoading = true;
  const button = document.querySelector('[data-action="retry-food"]');
  button.disabled = true; button.textContent = 'Loading…';
  try {
    state.food = await loadFood();
    state.foodUnavailable = false;
    elements.dishSelect.innerHTML = '<option value="">Any dish</option>' + state.food.map((dish) => `<option value="${escapeAttribute(dish.id)}">${escapeHtml(dish.name)}${dish.service === 'Brunch' ? ' · Brunch' : ''}</option>`).join('');
    elements.dishSelect.disabled = false;
    document.querySelector('#foodStatus').hidden = true;
    if (state.pendingDish) {
      state.dish = state.food.find((dish) => dish.id === state.pendingDish || dish.legacyIds.includes(state.pendingDish))?.id || '';
      state.pendingDish = ''; syncUrl();
    }
    renderAll({ fromHistory: true });
    elements.dishSelect.focus();
    showToast('Food menu restored');
  } catch {
    showToast('Food menu is still unavailable. Try again when connected.');
  } finally {
    state.foodLoading = false;
    button.disabled = false; button.textContent = 'Retry food menu';
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function icon(name) {
  const icons = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.5h11v15L12 16l-5.5 3.5z"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3c4 0 6 10 10 10h3"/><path d="m17 14 3 3-3 3"/><path d="M4 17h3c1.8 0 3.2-2 4.5-4.1C13 10.3 14.5 7 17 7h3"/><path d="m17 4 3 3-3 3"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8z"/><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7z"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>',
    'arrow-left': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>',
    'arrow-right': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    'chevron-down': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>',
  };
  return icons[name] || '';
}
