import { describe, expect, it } from 'vitest';

import { applyPending, type PendingContext } from '@/lib/offline/applyPending';
import type { OutboxOp } from '@/lib/offline/outboxOps';
import type { ListItem } from '@/types/listItem';

const item = (overrides: Partial<ListItem>): ListItem => ({
  id: 'i1',
  status: 'to_buy',
  source: 'user',
  lastBoughtAt: null,
  catalogItemKey: 'milk',
  customItem: null,
  sectionKey: 'milk-cheese',
  defaultSectionKey: 'milk-cheese',
  iconKey: null,
  ...overrides,
});

const ctx = (overrides: Partial<PendingContext> = {}): PendingContext => ({
  sectionOf: (key) => ({ milk: 'milk-cheese', coffee: 'beverages' })[key],
  overrides: [],
  customItems: [],
  ...overrides,
});

let seq = 0;
const op = (change: Record<string, unknown>, occurredAt = '2026-11-27T10:00:00.000Z'): OutboxOp =>
  ({ id: `op${(seq += 1)}`, listId: 'l1', occurredAt, ...change }) as OutboxOp;

describe('applyPending (ADR-0030)', () => {
  it('shows the server items untouched when nothing waits', () => {
    const items = [item({})];
    expect(applyPending(items, [], ctx()).items).toBe(items);
  });

  it('adds a new catalog item under its section, with the list override', () => {
    const view = applyPending(
      [],
      [op({ kind: 'add', tempItemId: 'local:a', input: { catalogItemKey: 'coffee' } })],
      ctx({ overrides: [{ catalogItemKey: 'coffee', customItemId: null, iconKey: 'tea', sectionKey: 'breakfast' }] }),
    );
    expect(view.items).toEqual([
      item({
        id: 'local:a',
        catalogItemKey: 'coffee',
        sectionKey: 'breakfast',
        defaultSectionKey: 'beverages',
        iconKey: 'tea',
      }),
    ]);
  });

  it('puts an item already on the list back to buy, as added by hand', () => {
    const view = applyPending(
      [item({ status: 'bought', source: 'dish', lastBoughtAt: '2026-11-26T10:00:00.000Z' })],
      [op({ kind: 'add', tempItemId: 'local:a', input: { catalogItemKey: 'milk' } })],
      ctx(),
    );
    expect(view.items).toHaveLength(1);
    expect(view.items[0]).toMatchObject({ id: 'i1', status: 'to_buy', source: 'user' });
  });

  it('adds a typed name as a new custom item, or reuses one with the same name', () => {
    const typed = op({ kind: 'add', tempItemId: 'local:a', input: { customName: '  Oat   drink ' } });
    const fresh = applyPending([], [typed], ctx());
    expect(fresh.customItems).toEqual([{ id: 'local:a:custom', name: 'Oat drink' }]);
    expect(fresh.items[0]).toMatchObject({
      id: 'local:a',
      catalogItemKey: null,
      customItem: { id: 'local:a:custom', name: 'Oat drink' },
      sectionKey: 'own-items',
    });

    const existing = applyPending([], [typed], ctx({ customItems: [{ id: 'c1', name: 'oat drink' }] }));
    expect(existing.customItems).toHaveLength(1);
    expect(existing.items[0].customItem).toEqual({ id: 'c1', name: 'oat drink' });
  });

  it('buys an item at the time of the tap and removes another', () => {
    const view = applyPending(
      [item({}), item({ id: 'i2', catalogItemKey: 'coffee' })],
      [
        op({ kind: 'status', itemId: 'i1', status: 'bought' }, '2026-11-27T10:01:00.000Z'),
        op({ kind: 'remove', itemId: 'i2' }),
      ],
      ctx(),
    );
    expect(view.items).toEqual([
      item({ status: 'bought', lastBoughtAt: '2026-11-27T10:01:00.000Z' }),
    ]);
  });

  it('keeps the source of a buy undone within the grace, and claims it after', () => {
    const bought = item({ status: 'bought', source: 'dish', lastBoughtAt: '2026-11-27T10:00:00.000Z' });
    const soon = op({ kind: 'status', itemId: 'i1', status: 'to_buy' }, '2026-11-27T10:03:00.000Z');
    const late = op({ kind: 'status', itemId: 'i1', status: 'to_buy' }, '2026-11-27T10:06:00.000Z');
    expect(applyPending([bought], [soon], ctx()).items[0].source).toBe('dish');
    expect(applyPending([bought], [late], ctx()).items[0].source).toBe('user');
  });

  it('chains the ops of an item added offline', () => {
    const view = applyPending(
      [],
      [
        op({ kind: 'add', tempItemId: 'local:a', input: { catalogItemKey: 'milk' } }),
        op({ kind: 'status', itemId: 'local:a', status: 'bought' }),
        op({ kind: 'add', tempItemId: 'local:b', input: { catalogItemKey: 'coffee' } }),
        op({ kind: 'remove', itemId: 'local:b' }),
      ],
      ctx(),
    );
    expect(view.items.map(({ id, status }) => [id, status])).toEqual([['local:a', 'bought']]);
  });

  it('ignores ops on items that are no longer there', () => {
    const items = [item({})];
    const view = applyPending(items, [op({ kind: 'status', itemId: 'gone', status: 'bought' })], ctx());
    expect(view.items).toBe(items);
  });

  it('changes nothing when the server items already hold the result of each op', () => {
    // The answer lands while its op is still queued (outbox settle).
    const custom = { id: 'c1', name: 'Tofu' };
    const synced = [
      item({ id: 'i1', status: 'bought', lastBoughtAt: '2026-11-27T10:00:00.000Z' }),
      item({ id: 'i2', catalogItemKey: null, customItem: custom, sectionKey: 'own-items', defaultSectionKey: 'own-items' }),
    ];
    const view = applyPending(
      synced,
      [
        op({ kind: 'status', itemId: 'i1', status: 'bought' }),
        op({ kind: 'add', tempItemId: 'local:t', input: { customName: ' tofu ' } }),
        op({ kind: 'remove', itemId: 'gone' }),
      ],
      ctx({ customItems: [custom] }),
    );
    expect(view.items).toEqual(synced);
    expect(view.customItems).toEqual([custom]);
  });
});
