import { describe, expect, it } from 'vitest';

import { iconForItem, ITEM_ICONS, SECTION_ICONS } from '@/lib/itemIcons';
import { insertionIndex, moveBefore, sameOrder } from '@/lib/sectionOrder';

describe('moveBefore', () => {
  const order = ['a', 'b', 'c', 'd'];

  it('moves an entry up', () => {
    expect(moveBefore(order, 2, 0)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('moves an entry down, before the entry at the drop point', () => {
    expect(moveBefore(order, 0, 3)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an entry to the end', () => {
    expect(moveBefore(order, 1, 4)).toEqual(['a', 'c', 'd', 'b']);
  });
});

describe('insertionIndex', () => {
  it('drops before the first row whose middle is below the pointer', () => {
    expect(insertionIndex([10, 50, 90], 5)).toBe(0);
    expect(insertionIndex([10, 50, 90], 60)).toBe(2);
    expect(insertionIndex([10, 50, 90], 200)).toBe(3);
  });
});

describe('sameOrder', () => {
  it('compares position by position', () => {
    expect(sameOrder(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false);
  });
});

describe('iconForItem override', () => {
  it('prefers the chosen icon, then falls back as before', () => {
    expect(iconForItem('milk', 'milk-cheese', 'coffee')).toBe(ITEM_ICONS.coffee);
    expect(iconForItem('milk', 'milk-cheese', 'unknown-key')).toBe(ITEM_ICONS.milk);
    expect(iconForItem(null, 'beverages')).toBe(SECTION_ICONS.beverages);
  });
});
