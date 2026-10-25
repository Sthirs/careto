// Filler words skipped when picking initials ("Weekend in the Mountains" → "WM").
// Combined English + Italian stopwords so shoppingListInitials behaves correctly for
// both locales without the caller needing to specify.
const SHOPPING_LIST_INITIAL_STOPWORDS = new Set([
  // English
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'the', 'to', 'with',
  // Italian
  'di', 'del', 'della', 'dei', 'degli', 'delle', 'e', 'il', 'lo', 'la', 'gli', 'le',
  'un', 'una', 'uno', 'per', 'con', 'su', 'in', 'al', 'alla', 'ai', 'agli', 'dal', 'dalla',
]);

// Extract up to 2 initials from list name (first letter of first 2 meaningful words)
export const shoppingListInitials = (name: string): string => {
  if (!name || !name.trim()) return '';
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => !SHOPPING_LIST_INITIAL_STOPWORDS.has(w.toLowerCase()));
  return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
};

// Placeholder colours from the design: member avatars and list covers without
// an image. Picked per id so a given person or list keeps its colour.
export const AVATAR_PALETTE = ['#8ED9C9', '#F5C6A5', '#C9C3F5', '#F2E29B', '#A9D4F5'] as const;
export const COVER_PALETTE = ['#B5452E', '#5A6F8C', '#A8682A', '#6E8A3A', '#3C7A8C'] as const;

// Stable palette pick: the same id always maps to the same colour.
export const colorFromId = (id: string, palette: readonly string[]): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
};
