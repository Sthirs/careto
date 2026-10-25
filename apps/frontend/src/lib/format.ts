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
