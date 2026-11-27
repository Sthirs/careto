import { OWN_ITEMS_SECTION_KEY } from '@/lib/sectionOrder';
import type { CustomItem, ListItem, SavedItemOverride } from '@/types/listItem';

import type { OutboxOp } from './outboxOps';

/** The backend's mistaken-tap grace (ADR-0024): an un-buy this soon keeps the source. */
export const UNBUY_GRACE_MS = 5 * 60_000;

export type PendingContext = {
  /** A catalog item's own store section. */
  sectionOf: (catalogItemKey: string) => string | undefined;
  overrides: SavedItemOverride[];
  customItems: CustomItem[];
};

export type PendingView = { items: ListItem[]; customItems: CustomItem[] };

/** The backend's custom-name normalization, case folded as its unique key is. */
const normalizedName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const overrideOf = (
  overrides: SavedItemOverride[],
  ref: { catalogItemKey: string | null; customItemId: string | null },
) =>
  overrides.find((saved) =>
    ref.customItemId
      ? saved.customItemId === ref.customItemId
      : saved.catalogItemKey === ref.catalogItemKey,
  );

const newItem = (
  id: string,
  catalogItemKey: string | null,
  customItem: CustomItem | null,
  ctx: PendingContext,
): ListItem => {
  const defaultSectionKey = catalogItemKey
    ? (ctx.sectionOf(catalogItemKey) ?? OWN_ITEMS_SECTION_KEY)
    : OWN_ITEMS_SECTION_KEY;
  const override = overrideOf(ctx.overrides, { catalogItemKey, customItemId: customItem?.id ?? null });
  return {
    id,
    status: 'to_buy',
    source: 'user',
    lastBoughtAt: null,
    catalogItemKey,
    customItem,
    sectionKey: override?.sectionKey ?? defaultSectionKey,
    defaultSectionKey,
    iconKey: override?.iconKey ?? null,
  };
};

type Draft = { items: ListItem[]; customItems: CustomItem[] };

function applyAdd(draft: Draft, op: Extract<OutboxOp, { kind: 'add' }>, ctx: PendingContext) {
  const { input } = op;
  let customItem: CustomItem | null = null;
  if ('customName' in input) {
    const wanted = normalizedName(input.customName);
    customItem = draft.customItems.find((item) => normalizedName(item.name) === wanted) ?? null;
    if (!customItem) {
      // A name typed offline: the server creates the custom item on sync.
      customItem = { id: `${op.tempItemId}:custom`, name: input.customName.trim().replace(/\s+/g, ' ') };
      draft.customItems = [...draft.customItems, customItem];
    }
  } else if ('customItemId' in input) {
    customItem = draft.customItems.find((item) => item.id === input.customItemId) ?? null;
    if (!customItem) return;
  }

  const catalogItemKey = 'catalogItemKey' in input ? input.catalogItemKey : null;
  const index = draft.items.findIndex((item) =>
    customItem ? item.customItem?.id === customItem.id : item.catalogItemKey === catalogItemKey,
  );
  if (index === -1) {
    draft.items = [...draft.items, newItem(op.tempItemId, catalogItemKey, customItem, ctx)];
    return;
  }
  // Already on the list, bought or not: it goes back to buy, as added by hand.
  const items = [...draft.items];
  items[index] = { ...items[index], status: 'to_buy', source: 'user' };
  draft.items = items;
}

function applyStatus(draft: Draft, op: Extract<OutboxOp, { kind: 'status' }>) {
  const index = draft.items.findIndex((item) => item.id === op.itemId);
  if (index === -1) return;
  const item = draft.items[index];
  if (item.status === op.status) return;

  const next: ListItem = { ...item, status: op.status };
  if (op.status === 'bought') {
    next.lastBoughtAt = op.occurredAt;
  } else {
    const sinceBuy = item.lastBoughtAt
      ? Date.parse(op.occurredAt) - Date.parse(item.lastBoughtAt)
      : Number.NaN;
    const mistakenTap = sinceBuy >= 0 && sinceBuy <= UNBUY_GRACE_MS;
    if (!mistakenTap) next.source = 'user';
  }
  const items = [...draft.items];
  items[index] = next;
  draft.items = items;
}

/**
 * The list as it will be once the waiting ops reach the server (ADR-0030):
 * the server's items with each op applied in order, mirroring the server's
 * rules. A dropped op therefore undoes itself, with no rollback to manage.
 */
export function applyPending(
  serverItems: ListItem[],
  ops: OutboxOp[],
  ctx: PendingContext,
): PendingView {
  const draft: Draft = { items: serverItems, customItems: ctx.customItems };
  for (const op of ops) {
    if (op.kind === 'add') applyAdd(draft, op, ctx);
    else if (op.kind === 'status') applyStatus(draft, op);
    else draft.items = draft.items.filter((item) => item.id !== op.itemId);
  }
  return draft;
}
