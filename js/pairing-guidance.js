// Editorial service guidance, not measured compatibility or dietary advice.
export const PAIRING_PRINCIPLES = [
  { title: 'WSET: food, wine and personal preference', url: 'https://www.wsetglobal.com/knowledge-centre/blog/2023/july/13/four-rules-to-masterful-food-and-wine-pairing' },
  { title: 'WSET: sweetness and chile heat', url: 'https://www.wsetglobal.com/knowledge-centre/blog/2020/december/21/winter-wine-and-food-matching' },
  { title: 'CraftBeer.com: IPA and spicy food', url: 'https://www.craftbeer.com/beer-and-food/science-says-youre-wrong-about-pairing-ipas-and-spicy-foods' },
];

const desserts = new Set(['chocolate', 'date-cake', 'elvis', 'beignets', 'holy-sunday']);
const sweetDishes = new Set([...desserts, 'waffles']);
const delicateDishes = new Set(['raw-oysters', 'wood-oysters', 'garden-district-ceviche', 'salmon-tartare', 'pear', 'roasted-peach-salad', 'eggs', 'crab']);
// These dishes explicitly list chile-bearing components; this is not an exhaustive heat rating.
const chileDishes = new Set(['gator', 'wings', 'corn-ribs', 'garden-district-ceviche', 'fried-chicken', 'etouffee', 'redfish', 'filet', 'ribeye', 'wood-oysters']);

export function pairingGuidance(entry, pair) {
  const notes = [];
  const spirit = ['Whiskey', 'Spirit'].includes(entry.family);
  const alcoholic = ['Whiskey', 'Spirit', 'Wine', 'Cocktail', 'Beer', 'RTD'].includes(entry.family);
  const hoppy = entry.family === 'Beer' && /\bIPA\b|\bhops?\b/i.test([entry.subtype, ...(entry.tasting?.flavor || [])].join(' '));
  if (entry.pairingReview?.conditional || pair.conditional) notes.push('Confirm the bottle or recipe first; this match uses the reference profile.');
  if (spirit && delicateDishes.has(pair.dishId)) notes.push('A neat spirit may overpower this dish. Consider a small taste with water or ice; dilution changes the profile.');
  if (alcoholic && chileDishes.has(pair.dishId)) notes.push(hoppy
    ? 'Hop bitterness and alcohol may intensify the chile heat; this is not a cooling pairing.'
    : 'Alcohol may intensify chile heat. Adjust the sauce or choose a nonalcoholic alternative if heat-sensitive.');
  if (sweetDishes.has(pair.dishId) && alcoholic) notes.push(spirit
    ? 'Sweet-smelling notes do not establish sugar content. Treat this as an aromatic match; the spirit may taste sharper beside a sweet dish.'
    : 'Check sweetness in the glass: a sweet dish can make a drier drink seem less fruity or more bitter.');
  return notes;
}

export function profileGuidance(entry) {
  if (!entry.pairings?.restaurant?.length) return '';
  const notes = ['Editorial suggestions, not restaurant endorsements or tested guarantees. Sauce, serving temperature, dilution and personal preference can change the match.'];
  if (['Whiskey', 'Spirit'].includes(entry.family)) notes.push('Fruit or citrus aromas do not establish acidity; vanilla or caramel aromas do not establish sweetness.');
  if (entry.menu?.status === 'not-found') notes.push('This is a retained reference drink, not a confirmed current menu option.');
  notes.push('Flavor notes are not ingredient or allergen declarations; confirm dietary needs with the venue.');
  return notes.join(' ');
}
