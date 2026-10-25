// Default item catalog: stable keys only (ADR-0014). Labels live in the
// frontend i18n catalogs under `catalog.*`. Order = default section order.
import { fruitsVegetables } from './sections/fruitsVegetables';
import { breadPastries } from './sections/breadPastries';
import { milkCheese } from './sections/milkCheese';
import { meatFish } from './sections/meatFish';
import { ingredientsSpices } from './sections/ingredientsSpices';
import { frozenConvenience } from './sections/frozenConvenience';
import { grainProducts } from './sections/grainProducts';
import { snacksSweets } from './sections/snacksSweets';
import { beverages } from './sections/beverages';
import { household } from './sections/household';
import { careHealth } from './sections/careHealth';
import { petSupplies } from './sections/petSupplies';
import { homeGarden } from './sections/homeGarden';

export const OWN_ITEMS_SECTION_KEY = 'own-items';

export const CATALOG_SECTIONS: ReadonlyArray<{
  key: string;
  items: readonly string[];
}> = [
  { key: 'fruits-vegetables', items: fruitsVegetables },
  { key: 'bread-pastries', items: breadPastries },
  { key: 'milk-cheese', items: milkCheese },
  { key: 'meat-fish', items: meatFish },
  { key: 'ingredients-spices', items: ingredientsSpices },
  { key: 'frozen-convenience', items: frozenConvenience },
  { key: 'grain-products', items: grainProducts },
  { key: 'snacks-sweets', items: snacksSweets },
  { key: 'beverages', items: beverages },
  { key: 'household', items: household },
  { key: 'care-health', items: careHealth },
  { key: 'pet-supplies', items: petSupplies },
  { key: 'home-garden', items: homeGarden },
];
