import type { ListItem } from '@/types/listItem';

/**
 * To-buy items grouped by the list's section order, then alphabetical by
 * localized label inside each section (spec §List).
 */
export function sortToBuy(
  items: readonly ListItem[],
  sectionOrder: readonly string[],
  labelOf: (item: ListItem) => string,
  locale: string,
): ListItem[] {
  const rank = new Map(sectionOrder.map((key, index) => [key, index]));
  const rankOf = (item: ListItem) => rank.get(item.sectionKey) ?? sectionOrder.length;

  return items
    .filter((item) => item.status === 'to_buy')
    .sort(
      (a, b) =>
        rankOf(a) - rankOf(b) || labelOf(a).localeCompare(labelOf(b), locale),
    );
}

/** Bought items, most recently bought first. */
export function sortLastUsed(items: readonly ListItem[]): ListItem[] {
  const time = (item: ListItem) => (item.lastBoughtAt ? Date.parse(item.lastBoughtAt) : 0);
  return items
    .filter((item) => item.status === 'bought')
    .sort((a, b) => time(b) - time(a));
}
