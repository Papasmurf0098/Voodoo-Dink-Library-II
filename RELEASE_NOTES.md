# Internal release iterations — September 18, 2026

## Cocktail-specific build-sheet links

- Added individual PDF links below the cocktail profile title for all 25 existing cocktails with recipe pages in the user-supplied `25 Update lates 9-18.pdf`. Each PDF preserves its complete original page, including photograph, ingredient quantities, preparation, ice, glassware/garnish and highlighted annotations where present. No inferred measures or substitute classic recipes were added.
- Eight existing cocktail profiles have no individual recipe sheet in this source: Voodoo Private Barrel Old Fashioned, Bellini, Aperol Spritz, Mimosa, Boujie Mimosa, Endless Bloody Mary, Happy Hour Margarita and Old Fashioned. Each explicitly displays “Build sheet not supplied” instead of a misleading link.
- The source also includes two mocktails, a brunch price overview, and Witches Brew (not an existing profile). These were not added or published because this change is limited to matching existing cocktails. Historical Pimp Chalice, Voodoo Child, Blanche Vol. 2 and DePeache Mode remain historical; Vol. 2 and Vol. 3 use different source pages.
- Ingredient data, flavor profiles, pairings, menu status and all other drink families are unchanged. Notes identify the Big Lebowski cream conflict, Breakfast Old Fashioned sugar conflict, unspecified frozen-drink batch quantities, missing Borghetti unit and selected batched-pour ambiguities. The source details caution that a complete source page is not necessarily a complete upstream syrup/infusion/batch recipe.
- Recipe mapping: `js/build-sheets.js`. Source SHA-256: `319da5fbec8567b37b3e514f5c412cc1ded7e60ee5dddc0bd36d04f1331b690c`. Reproduce using `python scripts/extract-build-sheets.py /path/to/source.pdf` with pypdf. Verify with `python scripts/verify-build-sheets.py /path/to/source.pdf` using Poppler and Pillow.
- PDFs load only when opened, not on application startup. Successful full responses are cached on demand for offline reuse; first access requires connectivity. The new runtime module is part of required offline installation. No third-party document hosting is used.
- Validation: 47 automated tests; all extracted pages checked against original text and page bounds, rendered for review, and pixel-compared to their corresponding source page. Original PDF syntax warnings do not change the rendered pages. Real-browser PDF-viewer and mobile visual QA remain outstanding.

## September 20 — menu subcategories and app-wide obsidian surfaces

- Moved category navigation out of the collapsed Refine drawer into its own always-accessible section above the collection views. Spirits use the order in the [venue menu](https://voodoobayou.com/menu/), checked September 20: Vodka, Gin, Rum, Aperitifs, Tequila, Mezcal. The additional retained sloe-gin reference remains under Other liqueurs. These counts describe library records, not confirmed venue inventory.
- Preserved internal category keys and existing deep links; Aperitif is displayed as Aperitifs. Switching family resets the category. Subcategory selection remains intact when a drink profile is opened and closed.
- Extended shared obsidian surface tokens to navigation, filters, native selects, Saved/Recent controls, profile facts, tasting notes, pairings, related drinks, Accuracy & Sources, sharing, notifications, empty/error states and controls. Green and gold remain functional accents against dark purple surfaces, with readable opaque fallback backgrounds for browsers without blur support.
- Mobile categories use two columns and 44-pixel minimum button height. Existing focus indicators, reduced-motion behavior and drink-tray navigation remain intact.
- All 43 local tests pass. No catalog or pairing data changed. Updated the offline cache version. Rendered visual and real-device verification remain outstanding; the previously provided preview browser blocked local access. This update does not claim a new visual browser check.

## Obsidian glass / interactive drink tray

- Added a photographic-style tray hero inspired by the supplied composition, replacing the human centerpiece with four glasses. Wine → Wine; shot → Spirits; old fashioned → Whiskey; coupe → Cocktails. Hotspots use native, named links and clear stale collection filters on ordinary activation.
- Retained all family tabs, search, filters, Saved/Recent, pairing discovery, evidence disclosures and profile functionality. No drink or food data changed.
- Introduced near-black purple surfaces, translucent glossy borders, yellow-gold and green accents, rounded cards and soft star shimmer. Reduced-motion preferences disable shimmer. Mobile uses numbered photo hotspots and a separate two-column category key; the photo is never cropped, so hotspot alignment does not depend on viewport size.
- New generated hero asset: `assets/drink-tray.webp`, 1536 × 1024, 111,064 bytes. Built-in image generation; full prompt and provenance are in `ASSET_CREDITS.md`. It depicts illustrative drinks, not venue recipes.
- Native labels remain usable without the photo. The optional image is cached for offline use without making successful image retrieval a prerequisite for app installation. Updated service-worker cache version.
- Validation: 41 local automated tests pass, including four hotspot destinations, clearing stale filters, focus, browser history, modified clicks and existing regression checks. Browser visual QA is outstanding: the provided cloud browser returned `ERR_BLOCKED_BY_CLIENT` for the local preview. No rendered desktop/mobile or real-device verification is claimed.

Before merging, visually inspect the hero at 320, 390, 768 and 1440 px; check labels and glass positions, mobile category key, 200% zoom, reduced motion, image-failure fallback and VoiceOver navigation.

Iterations 1–5 build on the merged September 7 catalog and velvet-purple design and left tasting data unchanged. The flavor follow-up below changes that data separately.

## Flavor and pairing follow-up

Catalog-wide structural/rule checks now cover 359 records and 696 visible suggestions. Six profiles received fresh tasting/ingredient-source corrections; the other 353 retain prior evidence with explicit re-verification gaps. Added contextual pairing cautions, supporting principles, per-record audit coverage and source-check scope in the profile UI. Corrected unsupported dry-finish, smoke and light-Pinot assertions. Preserved unresolved identities, all IDs and historical routes. Added the new module to required offline assets. See `RESEARCH_AUDIT.md` for exact scope and limitations.

## 1. Navigation and reading continuity

Fixed profile close history, related-profile Back/Forward, paginated collection restoration, and focus return. Direct links close into the library without navigating away. Bookmark controls update in place, retaining profile scroll and expanded sources. Profile cards use native buttons; modified browser shortcuts are left alone. URL validation moved into a dedicated module.

## 2. Complete discovery flows

Saved/Recent views distinguish an empty collection from hidden matches and provide an actionable recovery path. Every filter, including family, can be removed individually. Clear filters retains the collection scope. Discover uses only the current result set and is disabled when it is empty. Loading more appends cards and focuses the first new profile. Share links omit local filters and support manual copying when native sharing/clipboard access is unavailable.

## 3. Data and network resilience

Catalog and food requests run concurrently with deadlines that include JSON parsing. Invalid catalogs show a retry state; failed food details no longer disable the drink catalog. Food retry preserves the current search. Service-worker fallback covers transient server errors and slow/offline connections. Optional food, photos, and documents cannot make offline installation fail just because a request rejects. Cache cleanup remains scoped to this application.

## 4. Saved-library reliability

Added backup and merge-only restore with format/version/size validation, legacy ID normalization, and unavailable-profile counts. Invalid backups cannot erase saves. Blocked storage retains in-memory changes with visible feedback. Tabs synchronize saves/history/preferences; open profiles are not rebuilt for save updates. Recent-history clearing and collection bookmark removal have a ten-second undo action (kept available while the action is focused).

## 5. Release readiness

Back restores the prior profile's scroll and source disclosure state. Pending dish links survive a food-menu outage and resolve on retry. Recent view disables the inapplicable sort control. Added mobile safe-area handling, skip navigation, PWA icons/manifest identity, Apple touch icon, and a reproducible icon generator. Added a complete syntax/test command and GitHub Actions validation on Node 22 and 24.

## Validation and limits

- Local syntax checks and automated tests pass on Node 24.19.0. The test suite uses jsdom for DOM interactions and a simulated service-worker environment.
- The catalog retains 358 distinct profiles, 696 pairing suggestions, and 41 listed dishes. Both drink JSON copies remain byte-identical.
- This branch does not deploy or merge the application, add runtime dependencies, or claim a September 18 menu review.
- The cloud browser rejected the local preview URL. No desktop/mobile visual, real service-worker lifecycle, screen-reader, or installed-PWA verification is claimed.

Before production release, verify these on the deployed preview:

1. At 320–430 px, verify family navigation, long names, filters, bookmark/undo controls, profile scrolling, keyboard appearance, and safe areas.
2. Use VoiceOver and keyboard navigation to open/save/close profiles, traverse source disclosures, remove filters, and load more. Check focus return and reduced-motion behavior.
3. Visit online, install/add to Home Screen, then reopen a drink and dish link offline. Confirm cached catalog access and reconnect updates. An initial offline visit without a completed cache cannot work.
4. Download a backup on iOS Safari, restore it in a different browser, and verify native sharing as well as the manual copy fallback.
5. Test an update from the previous service worker with an existing Saved collection. Confirm current assets, retained saves, and no effect on other apps at the same origin.
