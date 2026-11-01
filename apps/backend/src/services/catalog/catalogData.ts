// Default item catalog: stable keys only (ADR-0014). Labels live in the
// frontend i18n catalogs under `catalog.*`. Order = default section order.
import { fruitsVegetables } from './sections/fruitsVegetables';
import { breadPastries } from './sections/breadPastries';
import { deli } from './sections/deli';
import { milkCheese } from './sections/milkCheese';
import { meatFish } from './sections/meatFish';
import { breakfast } from './sections/breakfast';
import { grainProducts } from './sections/grainProducts';
import { cannedGoods } from './sections/cannedGoods';
import { ingredientsSpices } from './sections/ingredientsSpices';
import { snacksSweets } from './sections/snacksSweets';
import { frozenConvenience } from './sections/frozenConvenience';
import { beverages } from './sections/beverages';
import { wineSpirits } from './sections/wineSpirits';
import { household } from './sections/household';
import { careHealth } from './sections/careHealth';
import { baby } from './sections/baby';
import { petSupplies } from './sections/petSupplies';
import { homeGarden } from './sections/homeGarden';

export const OWN_ITEMS_SECTION_KEY = 'own-items';

export const CATALOG_SECTIONS: ReadonlyArray<{
  key: string;
  items: readonly string[];
}> = [
  { key: 'fruits-vegetables', items: fruitsVegetables },
  { key: 'bread-pastries', items: breadPastries },
  { key: 'deli', items: deli },
  { key: 'milk-cheese', items: milkCheese },
  { key: 'meat-fish', items: meatFish },
  { key: 'breakfast', items: breakfast },
  { key: 'grain-products', items: grainProducts },
  { key: 'canned-goods', items: cannedGoods },
  { key: 'ingredients-spices', items: ingredientsSpices },
  { key: 'snacks-sweets', items: snacksSweets },
  { key: 'frozen-convenience', items: frozenConvenience },
  { key: 'beverages', items: beverages },
  { key: 'wine-spirits', items: wineSpirits },
  { key: 'household', items: household },
  { key: 'care-health', items: careHealth },
  { key: 'baby', items: baby },
  { key: 'pet-supplies', items: petSupplies },
  { key: 'home-garden', items: homeGarden },
];
