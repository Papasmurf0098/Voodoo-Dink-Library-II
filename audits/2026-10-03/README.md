# October 3, 2026 category review

The complete catalog was evaluated before the review commit. **Evaluated does not mean every claim was independently verified.** Producer pages, reference vintages, release-specific reviews, indexed excerpts, supplied recipes and identity-only sources support different levels of detail. Individual `research.flavorCheck` statuses preserve those distinctions.

| Review file | Records | Scope |
| --- | ---: | --- |
| bourbon-review.json | 85 | Bourbon category |
| whiskey-review.json | 88 | Other whiskey categories, including unresolved flights |
| spirits-review.json | 92 | Vodka, gin, rum, aperitifs, tequila, mezcal and liqueur |
| wine-review.json | 36 | Wine references and vintage/cuvée uncertainty |
| cocktails-review.json | 33 | Training-sheet and menu-based recipe expectations |
| other-review.json | 25 | Beer, mocktails, soft drinks, waters and RTD |
| Total | 359 | 358 distinct profiles plus one legacy duplicate |

The matching category JSON files contain the reviewed patches. `scripts/merge-flavor-reviews-2026-10-03.mjs` applies them and refuses incomplete or overlapping catalog coverage. It does not fetch or verify sources. `baseline-flavor-audit.json` preserves the previous audit accounting. The active summary is `data/flavor-audit.json`.

## What the review corrects

- Keep nose, palate and finish separate when the source distinguishes them. Overall descriptors are not silently assigned to undocumented sensory stages.
- Remove or qualify body, finish length and flavor intensity that the source does not establish.
- Identify reference releases and vintages. A producer or reviewer reference is not verification of the venue bottle.
- Describe cocktails and mocktails as ingredient/build expectations. Recipe inconsistencies and menu-versus-training-sheet differences remain visible.
- Reconcile pairing reasons with retained sensory notes and documented dish components. Pairings remain editorial suggestions rather than tested or venue-endorsed matches.
- Correct Corn Ribs to the October 3 menu description: cane vinegar aioli, Parmesan and blackening. Preserve previous food components as history and leave other food evidence dates intact. The menu does not specify the seasoning blend or heat level.

## Remaining evidence to obtain

1. Inspect labels for ambiguous bottle names, private barrels, varying releases and wine cuvées/vintages. Do not resolve identities from menu shorthand alone.
2. Obtain actual flight contents and complete house recipes where names or ingredient lists are insufficient.
3. Confirm which recipe version is served when the training sheet and online menu differ, and clarify internal batch-pour discrepancies.
4. Replace inaccessible, identity-only or indexed-only sensory evidence with an accessible exact-product primary source when possible.
5. Confirm current dish preparation and inventory with the venue. A web listing is not a stock check.

No firsthand tasting, label inspection, measured finished-cocktail ABV or complete venue inventory audit is claimed. Existing strengths, IDs, saved-profile routes and historical records remain intact except explicitly documented ingredient/reference-origin corrections.
