// Page numbers refer to the user-supplied 30-page training PDF, not the online menu.
// Preserve exact recipe versions and legacy profile IDs. Never substitute a similar drink.
export const BUILD_SHEET_SOURCE = '25 Update lates 9-18.pdf';
const pages = [
  ['espresso-old-fashioned', 2, 'Espresso Old Fashioned (Carajillo)'],
  ['verdita', 3, 'Verdita'],
  ['blanche-devereaux-vol-3', 4, 'Blanche Devereaux (vol3)'],
  ['bourbon-peach-tea', 5, 'Bourbon Peach Tea'],
  ['gris-gris-rita', 6, 'Gris Gris Margarita'],
  ['jameoretto-sour', 7, 'Jameo-retto Sour'],
  ['black-magic-lemonade', 8, 'Black Magic Lemonade'],
  ['saint-vallencourt', 9, 'Saint Vallencourt'],
  ['the-mixtress', 10, 'The Mistress'],
  ['snake-oil-saloon', 11, 'Snake Oil Salesman'],
  ['lavender-love', 12, 'Lavender Love Spell'],
  ['turbo-lover-espresso-martini', 13, 'Turbo Lover (Espresso Martini)'],
  ['voodoo-smoked-old-fashioned', 14, 'Smoked Old Fashioned'],
  ['fortunate-son', 15, 'Fortunate Son'],
  ['frozen-bourbon-milk-punch', 16, 'Frozen Bourbon Milk Punch'],
  ['frozen-hurricane', 17, 'Frozen Hurricane'],
  ['shakeys-cajun-bloody-mary', 21, 'Shakey’s Cajun Bloody Mary'],
  ['breakfast-old-fashioned', 22, 'Breakfast Old Fashioned'],
  ['the-big-lebowski', 23, 'The Big Lebowski'],
  ['hooo-lawd', 24, 'Hooo Lawd'],
  ['grasshopper', 25, 'Grasshopper'],
  ['pimp-chalice', 27, 'Pimp Chalice'],
  ['voodoo-child', 28, 'Voodoo Child'],
  ['blanche-devereaux-vol-2', 29, 'Blanche Devereaux (vol2)'],
  ['depeache-mode', 30, 'DePeache Mode'],
];
const notes = {
  'the-big-lebowski': 'The training sheet specifies whipped cream; the menu-based profile lists coconut cream. Confirm the current house recipe.',
  'breakfast-old-fashioned': 'The training sheet specifies a brown sugar cube; the menu-based profile lists maple. Confirm the current house recipe.',
  'frozen-bourbon-milk-punch': 'The source gives machine service and garnish, but no batch quantities.',
  'frozen-hurricane': 'The source gives machine service and garnish, but no batch quantities or Hurricane Mix recipe.',
  'blanche-devereaux-vol-2': 'Historical Vol. 2 recipe, not Vol. 3. The ingredient list and batched build differ; confirm the house batch.',
  'blanche-devereaux-vol-3': 'Vol. 3 only. The batched pour and ingredient measures differ; confirm the house batch.',
  'turbo-lover-espresso-martini': 'The source omits the unit for “0.5 Borghetti”; confirm the measure before preparing.',
  'voodoo-smoked-old-fashioned': 'The source lists a 4 oz batch pour separately from the ingredient measures; batch dilution is not specified.',
};
export const COCKTAIL_BUILD_SHEETS = Object.fromEntries(pages.map(([id, page, title]) => [id, {
  page, title, href: `./assets/build-sheets/${id}.pdf`, note: notes[id] || '',
}]));

export function getBuildSheet(entry) {
  return entry.family === 'Cocktail' ? COCKTAIL_BUILD_SHEETS[entry.id] || null : null;
}
