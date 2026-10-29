/**
 * Moves the entry at `from` so it lands before the entry now at `insertAt`
 * (`insertAt === order.length` puts it last). Returns a new array.
 */
export function moveBefore<T>(order: readonly T[], from: number, insertAt: number): T[] {
  const next = [...order];
  const [moved] = next.splice(from, 1);
  const target = insertAt > from ? insertAt - 1 : insertAt;
  next.splice(Math.max(0, Math.min(next.length, target)), 0, moved);
  return next;
}

/** Where a pointer at `y` drops a row: before the first row whose middle is below it. */
export function insertionIndex(rowMiddles: readonly number[], y: number): number {
  const index = rowMiddles.findIndex((middle) => y < middle);
  return index === -1 ? rowMiddles.length : index;
}

export const sameOrder = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((key, index) => key === b[index]);
