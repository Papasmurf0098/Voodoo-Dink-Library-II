# Purple marble and rotary drink index

Design revision: October 3, 2026.

## Presentation

- Generated amethyst marble supplies irregular stone detail. Layered gradients create a polished reflection without moving the background. Aubergine surfaces keep labels readable; warm yellow appears on collection controls, selected edges and the primary entrance link.
- The entrance replaces the flat tray hotspots with four photographic collection cards on a rotary stack. Native links still open collections, including modified clicks. Other drink families remain directly available in the collection navigation.
- Library → collection → category → drink is visible as a breadcrumb. Category selection has its own title and history entry. The root library shows collection navigation first, revealing category choices after choosing a collection.
- A drink profile contains Overview, Food pairings, and Accuracy & sources section controls. Returning from the profile preserves the collection's loaded cards, focus and reading position.

## Research applied

[W3C ARIA carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) and [W3C carousel tutorial](https://www.w3.org/WAI/tutorials/carousels/): user-controlled navigation, named previous/next buttons, a labeled carousel and slides, a polite status announcement, and exclusion of inactive slides from keyboard and assistive-technology navigation. There is no automatic rotation. The arrow buttons retain focus. Arrow keys, Home and End work while focus is inside the index; swipes do not replace ordinary vertical scrolling. Reduced-motion preferences remove transitions.

[Nielsen Norman Group breadcrumb guidance](https://www.nngroup.com/articles/breadcrumbs/): show the hierarchy and parent destinations while keeping primary navigation available. Breadcrumbs are ordinary links with an identified current page, and profile breadcrumbs identify the drink's actual collection and category.

## Verification

- `npm run check`: JavaScript syntax checks and the full test suite.
- New interaction coverage checks rotation and wraparound, inactive-slide focus exclusion, arrow-key focus recovery, horizontal versus vertical and canceled pointer gestures, profile section controls, breadcrumb navigation and browser Back.
- Existing tests cover search, filters, saved profiles, deep links, profile return position, offline installation and data integrity.
- Generated marble and existing card photographs inspected directly. Responsive CSS includes desktop, tablet and narrow mobile layouts; the marble image is 1536 × 1024 WebP, approximately 284 KB.
- **Rendered desktop/mobile visual QA remains pending.** This environment has no installed Chromium; the official browser download returned an unavailable page, and the cloud browser cannot access the local preview or shared HTML files. No screenshots or browser-layout measurements are claimed.

The change does not modify drink data or tasting/pairing research.
