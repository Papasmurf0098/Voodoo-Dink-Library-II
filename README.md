# Voodoo Drink Library II

A drink reference for Voodoo Bayou, Palm Beach Gardens: tasting profiles, qualified strength references, and pairings with named dishes from the location-linked menu.

## September 2026 revision

- 359 stored records, 358 distinct profiles after one duplicate is mapped to its canonical entry.
- Every record has a dated research review, scoped source links, and strength qualifications.
- 21 records added across the September 6–7 reviews, including Bourbon Peach Tea, Verdita, Gris-Gris Rita, Jameo’retto Sour, Blanche Devereaux Vol. 3 and Espresso Old Fashioned. Additions to this catalog do not establish the restaurant's launch dates.
- 696 pairing suggestions across 347 visible profiles and 41 currently listed dishes. Eleven unresolved bottles/flights remain unpaired. Three superseded food records are retained for old links, with updated dish destinations.
- Dish-first discovery, ingredient and accent-insensitive search, flavor filters, and menu-status filters.
- Dark velvet-purple surfaces, higher-contrast glass filing tabs, gold and emerald accents, real illustrative photography, and front-to-back profile motion.
- Saved profiles, recent history, deep links, sharing, random discovery, and compact/comfortable views.

Read [the research audit](RESEARCH_AUDIT.md) for verification limits and corrections. Read [photo credits](ASSET_CREDITS.md) for sources and licenses. The photography does not depict the restaurant or certify individual drinks.

## Internal release iterations · September 18, 2026

- Predictable profile Back/Forward and close behavior, including restored collection and reading positions.
- Bookmarking preserves focus and expanded sources. Saved/Recent empty states distinguish missing items from filtered results.
- Removable filters, scoped discovery, stable pagination, and share-link fallback.
- Saved-profile JSON backup and merge-only restore, cross-tab synchronization, storage-failure feedback, and undo for recent-history clearing and collection bookmark removal.
- Validated, time-bounded data loading; food-menu retry; offline fallback for transient server failures.
- Native profile buttons, skip navigation, explicit toggle states, mobile safe areas, and app icons.
- Automated validation on pull requests, with a Node 22/24 matrix.

See [release notes and outstanding device checks](RELEASE_NOTES.md). Drink research and menu dates remain September 6–7; these iterations do not claim a new menu audit.

## Run and validate

No package installation or build is required. Serve the repository root over HTTP; opening `index.html` directly with `file://` will not support the data fetches.

```sh
python -m http.server 4173
```

For the full test suite, use Node.js 22.22.2+, 24.15.0+, or 26+:

```sh
npm ci --ignore-scripts
npm run check
git diff --check
```

`npm run check` syntax-checks every runtime module and runs all regression tests. The only application-testing dependency, jsdom, is development-only; serving and deploying the app still requires no build or runtime packages. GitHub Actions runs the same gate on Node 22 and 24 for pull requests and pushes to `main`.

Tests exercise catalog invariants, route validation, DOM interactions, history navigation, storage, backup/restore, data-failure recovery, and simulated service-worker behavior. DOM tests do not perform visual layout or real browser engine checks. Mobile Safari, VoiceOver, touch, and installed-PWA verification remain manual release checks; the available cloud browser could not access this run's local preview.

## Files

- `data/drinks.json`: active catalog and archived prior values under `sourceRecord`.
- `drinks.json`: compatibility copy; keep byte-identical to `data/drinks.json`.
- `data/food.json`: named dishes, menu components, service labels, and source scope.
- `js/catalog.js`: duplicate normalization, search, filters, sorting, and related profiles.
- `js/app.js`: rendering, interaction handling, profile modal, and food discovery.
- `js/route.js`: validated URLs, canonical links, and filter defaults.
- `js/data.js`: catalog/menu validation and time-bounded requests.
- `js/storage.js`: device-local favorites, recent history, and preferences. Existing `nightcap:v2:*` keys are intentionally retained to preserve user data.
- `styles.css`: responsive theme, filing-tab motion, and reduced-motion support.
- `sw.js`: network-first app assets with offline fallback; cache cleanup is limited to this app's registration scope.
- `tests/`: core regression tests and jsdom interaction tests.
- `.github/workflows/validate.yml`: repeatable release validation.
- `assets/icons/`: SVG, PWA, and Apple touch icons; regenerate PNGs with `python scripts/generate-icons.py` (Pillow required only for generation).

The old DOCX and parser are preserved as historical inputs. **Do not regenerate the current catalog with the legacy parser**: doing so would overwrite the reviewed profiles and pairings. Previous narrative values are provenance, not current evidence, and are not displayed as active tasting notes.

`scripts/sync-menu-2026-09-07.mjs` records the repeatable September 7 menu corrections. It preserves historical cocktail IDs, adds distinct new recipes, migrates affected food pairings, and records source scope. Garden District Ceviche and seven other missing dishes are included; selecting a dish shows its menu components. The food roster remains selected pairings, not a complete reproduction of every side or children's item.

## Deployment

GitHub Pages can serve the repository root without a build step. Relative asset paths support the project subdirectory. This revision is delivered on a review branch; creating a pull request does not merge or deploy it.

Keyboard: `/` focuses search, `R` opens a random profile, and `Escape` closes an open profile. The modal traps keyboard focus and makes the background inert. Reduced-motion preferences disable animated transitions.

## Saved profiles

Open **Saved → Back up saved** to download all saved profiles, including entries hidden by filters. **Restore saved** accepts that JSON file and adds known profiles to the current collection. It never replaces or clears existing saves. Legacy IDs map to canonical profiles; unknown IDs are counted as unavailable. Files over 256 KB, malformed files, and unsupported backup versions are rejected before any saved data changes.

Favorites, recent history, and density/sort preferences remain local to the browser. Backup files contain saved profile IDs and the export date, not recent history or research data. If the browser blocks storage, the current session stays usable and shows a persistent notice. Share links contain only the selected profile, not your Saved/Recent scope or search filters.
