/**
 * Default dish art, used when a dish has no photo. Paths and colors come from
 * the design canvas "Default dish icons" board.
 */
export type DishArt = { name: string; background: string; path: string };

export const DISH_ART: readonly DishArt[] = [
  {
    name: 'plate',
    background: '#B5452E',
    path: 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M3 3v5 M4.5 3v5 M6 3v5 M3 8a1.5 1.5 0 0 0 3 0 M4.5 9.5V21 M21 21V3c-1.5 1-2.5 3-2.5 6.5H21',
  },
  { name: 'cloche', background: '#C0662F', path: 'M2 18h20 M4 18a8 8 0 0 1 16 0 M12 10V8 M10 8h4 M7 14.5a5 5 0 0 1 3-3' },
  {
    name: 'bowl',
    background: '#8A6A45',
    path: 'M3 12h18a9 7 0 0 1-18 0z M9 19h6 M8 9c0-1.5 1-2 0-3.5 M12 9c0-1.5 1-2 0-3.5 M16 9c0-1.5 1-2 0-3.5',
  },
  {
    name: 'pot',
    background: '#7A7F35',
    path: 'M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z M2 10h20 M10 7h4 M12 7V5.5 M2 13h2 M20 13h2',
  },
  {
    name: 'pan',
    background: '#B8902F',
    path: 'M9.5 19.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z M9.5 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M16 13h6',
  },
];

/** The same art for the same id on every render and device. */
export function dishArtFor(id: string): DishArt {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return DISH_ART[hash % DISH_ART.length];
}

/** Fork and knife: the Dishes tab, and the badge of items to buy for a dish. */
export const DISH_ICON = 'M7 3v8 M5 3v4a2 2 0 0 0 4 0V3 M7 11v10 M17 21V3c-2 1-3 4-3 7h3';
