import { fruitsVegetablesIcons } from './fruitsVegetables';
import { breadPastriesIcons } from './breadPastries';
import { deliIcons } from './deli';
import { milkCheeseIcons } from './milkCheese';
import { meatFishIcons } from './meatFish';
import { breakfastIcons } from './breakfast';
import { grainProductsIcons } from './grainProducts';
import { cannedGoodsIcons } from './cannedGoods';
import { ingredientsSpicesIcons } from './ingredientsSpices';
import { snacksSweetsIcons } from './snacksSweets';
import { frozenConvenienceIcons } from './frozenConvenience';
import { beveragesIcons } from './beverages';
import { wineSpiritsIcons } from './wineSpirits';
import { householdIcons } from './household';
import { careHealthIcons } from './careHealth';
import { babyIcons } from './baby';
import { petSuppliesIcons } from './petSupplies';
import { homeGardenIcons } from './homeGarden';

/** Every catalog item's own icon path, keyed by catalog item key. */
export const ITEM_ICONS: Readonly<Record<string, string>> = {
  ...fruitsVegetablesIcons,
  ...breadPastriesIcons,
  ...deliIcons,
  ...milkCheeseIcons,
  ...meatFishIcons,
  ...breakfastIcons,
  ...grainProductsIcons,
  ...cannedGoodsIcons,
  ...ingredientsSpicesIcons,
  ...snacksSweetsIcons,
  ...frozenConvenienceIcons,
  ...beveragesIcons,
  ...wineSpiritsIcons,
  ...householdIcons,
  ...careHealthIcons,
  ...babyIcons,
  ...petSuppliesIcons,
  ...homeGardenIcons,
};

/** Fallback icon per section, for catalog items without their own icon. */
export const SECTION_ICONS: Readonly<Record<string, string>> = {
  'fruits-vegetables': 'M3 13h18l-2 7H5z M8 13c0-4 1-7 4-9 M12 13V6 M16 13c0-3-1-5-3-6 M12 6c-1-2-3-2.5-4.5-1.5 M12 6c1-2 3-2.5 4.5-1.5',
  'bread-pastries': 'M5 11a4 4 0 0 1 2-7h10a4 4 0 0 1 2 7v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z',
  'milk-cheese': 'M3 16l12-9 6 4v7H3z M3 16h18 M10 13h.01 M15 15h.01',
  'meat-fish': 'M5 8c2-4 8-5 12-3s5 7 3 10-7 5-11 3S3 12 5 8z M12 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0z',
  'ingredients-spices': 'M8 8c0-3 2-5 4-5s4 2 4 5v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z M8 8h8 M11 5h.01 M13 5h.01 M12 4h.01',
  'frozen-convenience': 'M6 3h12l-1 2 1 2v11l1 2-1 1H6l-1-1 1-2V7L5 5z M6 7h12 M6 18h12 M12 9v7 M9 10.75l6 3.5 M15 10.75l-6 3.5',
  'grain-products': 'M12 12L5 7v10z M12 12l7-5v10z M11 11h2v2h-2z',
  'snacks-sweets': 'M6.5 3h11a1.5 1.5 0 0 1 1.5 1.5v15a1.5 1.5 0 0 1 -1.5 1.5h-11a1.5 1.5 0 0 1 -1.5 -1.5v-15a1.5 1.5 0 0 1 1.5 -1.5z M5 9h14 M5 15h14 M12 3v18',
  beverages: 'M6 4h12l-1.5 16h-9z M12 10c1.5 2 2.5 3.2 2.5 4.6a2.5 2.5 0 0 1-5 0c0-1.4 1-2.6 2.5-4.6z',
  household: 'M5 9h14l-2 12H7z M5 9c0-4 3-6 7-6s7 2 7 6 M9 13h6',
  'care-health': 'M10 2h4v3h-4z M9 5h6l2 3v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8z M9 12c1 1 2 2 3 2s2-1 3-2',
  'pet-supplies': 'M3 15h18l-2 5H5z M8 9a1.5 1.5 0 1 0-1.5 2 1.5 1.5 0 1 0 1.5 2h8a1.5 1.5 0 1 0 1.5-2 1.5 1.5 0 1 0-1.5-2z',
  'home-garden': 'M12 21V11 M12 11c-3 0-5-2-5-6l2.5 2L12 3l2.5 4L17 5c0 4-2 6-5 6z M12 17c-2-2-4-2-6-1 2 2 4 2 6 1z M12 15c2-2 4-2 6-1-2 2-4 2-6 1z',
  deli: 'M4 12a8 8 0 1 0 16 0a8 8 0 1 0 -16 0z M9 9h.01 M14 8h.01 M15.5 13h.01 M10 15.5h.01 M12 12h.01',
  breakfast: 'M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z M16 10h2a2 2 0 0 1 0 4h-2 M8 2v3 M11 2v3',
  'canned-goods': 'M6 5a6 2 0 0 0 12 0a6 2 0 0 0-12 0 M6 5v14a6 2 0 0 0 12 0V5 M9 13.6a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z M12 10.6v-1.6 M10.5 10.4l1.5 .8 1.5-.8',
  'wine-spirits': 'M7 3h10c0 5-2 8.5-5 8.5S7 8 7 3z M12 11.5V20 M8 21h8 M7.5 6.5h9',
  baby: 'M10 2h4v2h-4z M9 4h6l1 3H8z M8 7h8v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z M8 11h3 M8 14h3 M8 17h3',
};

/** Icon for custom items (a tag). */
export const CUSTOM_ITEM_ICON = 'M3 12V4h8l10 10-8 8z M7.5 7.5h.01';

/**
 * The icon for a list item: the chosen one (ADR-0026), else its own, else its
 * section's, else the tag.
 */
export const iconForItem = (
  catalogItemKey: string | null,
  sectionKey: string,
  iconKey: string | null = null,
): string =>
  (iconKey && ITEM_ICONS[iconKey]) ||
  (catalogItemKey && ITEM_ICONS[catalogItemKey]) ||
  SECTION_ICONS[sectionKey] ||
  CUSTOM_ITEM_ICON;
