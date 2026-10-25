import { describe, expect, it } from 'vitest';

import { sortLastUsed, sortToBuy } from '@/lib/listItemOrder';
import type { ListItem } from '@/types/listItem';

const item = (overrides: Partial<ListItem>): ListItem => ({
  id: 'id',
  status: 'to_buy',
  source: 'user',
  lastBoughtAt: null,
  catalogItemKey: null,
  customItem: null,
  sectionKey: 'own-items',
  ...overrides,
});

const LABELS: Record<string, string> = { milk: 'Milk', cheese: 'Cheese', pineapple: 'Pineapple' };
const labelOf = (i: ListItem) => i.customItem?.name ?? LABELS[i.catalogItemKey ?? ''];

describe('listItemOrder/sortToBuy', () => {
  it('groups by the list section order, then sorts alphabetically', () => {
    const items = [
      item({ id: 'p', catalogItemKey: 'pineapple', sectionKey: 'fruits-vegetables' }),
      item({ id: 'm', catalogItemKey: 'milk', sectionKey: 'milk-cheese' }),
      item({ id: 'c', catalogItemKey: 'cheese', sectionKey: 'milk-cheese' }),
      item({ id: 'n', customItem: { id: 'x', name: "Nonna's sauce" } }),
      item({ id: 'b', catalogItemKey: 'milk', sectionKey: 'milk-cheese', status: 'bought' }),
    ];
    const order = ['milk-cheese', 'fruits-vegetables', 'own-items'];

    expect(sortToBuy(items, order, labelOf, 'en').map((i) => i.id)).toEqual(['c', 'm', 'p', 'n']);
  });

  it('puts sections missing from the order last', () => {
    const items = [
      item({ id: 'p', catalogItemKey: 'pineapple', sectionKey: 'unknown' }),
      item({ id: 'm', catalogItemKey: 'milk', sectionKey: 'milk-cheese' }),
    ];
    expect(sortToBuy(items, ['milk-cheese'], labelOf, 'en').map((i) => i.id)).toEqual(['m', 'p']);
  });
});

describe('listItemOrder/sortLastUsed', () => {
  it('keeps bought items, most recent first', () => {
    const items = [
      item({ id: 'old', status: 'bought', lastBoughtAt: '2026-10-01T10:00:00Z' }),
      item({ id: 'todo' }),
      item({ id: 'new', status: 'bought', lastBoughtAt: '2026-10-20T10:00:00Z' }),
    ];
    expect(sortLastUsed(items).map((i) => i.id)).toEqual(['new', 'old']);
  });
});
