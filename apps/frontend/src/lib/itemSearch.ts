/**
 * Pure item search over the default catalog plus the list's custom items,
 * matching the active locale's labels. Case- and accent-insensitive, with
 * Unicode-aware tokenizing (ADR-0014).
 */
export type SearchEntry =
  | { kind: 'catalog'; key: string; label: string }
  | { kind: 'custom'; id: string; label: string };

export const DEFAULT_RESULT_LIMIT = 6;

/** Lower-cases and strips diacritics so "perche" finds "perché". */
export const foldText = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

const tokenize = (text: string): string[] =>
  foldText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * Lower is better; `null` means no match. 0 exact, 1 label prefix, 2 every
 * query word prefixes a label word, 3 substring.
 */
export function matchScore(label: string, query: string): number | null {
  const foldedLabel = foldText(label);
  const foldedQuery = foldText(query);
  if (!foldedQuery) return null;
  if (foldedLabel === foldedQuery) return 0;
  if (foldedLabel.startsWith(foldedQuery)) return 1;

  const labelWords = tokenize(label);
  const queryWords = tokenize(query);
  if (
    queryWords.length > 0 &&
    queryWords.every((word) => labelWords.some((labelWord) => labelWord.startsWith(word)))
  ) {
    return 2;
  }

  return foldedLabel.includes(foldedQuery) ? 3 : null;
}

export function searchItems(
  query: string,
  entries: readonly SearchEntry[],
  locale: string,
  limit = DEFAULT_RESULT_LIMIT,
): SearchEntry[] {
  return entries
    .map((entry) => ({ entry, score: matchScore(entry.label, query) }))
    .filter((scored): scored is { entry: SearchEntry; score: number } => scored.score !== null)
    .sort(
      (a, b) => a.score - b.score || a.entry.label.localeCompare(b.entry.label, locale),
    )
    .slice(0, limit)
    .map((scored) => scored.entry);
}

/** True when some entry is exactly what was typed, so no custom row is offered. */
export const hasExactMatch = (query: string, entries: readonly SearchEntry[]): boolean =>
  entries.some((entry) => matchScore(entry.label, query) === 0);
