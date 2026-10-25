import { describe, expect, it } from 'vitest';

import { foldText, hasExactMatch, matchScore, searchItems, type SearchEntry } from '@/lib/itemSearch';

const ENTRIES: SearchEntry[] = [
  { kind: 'catalog', key: 'pineapple', label: 'Pineapple' },
  { kind: 'catalog', key: 'apple-juice', label: 'Apple juice' },
  { kind: 'catalog', key: 'apples', label: 'Apples' },
  { kind: 'catalog', key: 'tomato-puree', label: 'Tomato purée' },
  { kind: 'catalog', key: 'cherry-tomatoes', label: 'Cherry tomatoes' },
  { kind: 'custom', id: 'c1', label: "Nonna's sauce" },
];

describe('itemSearch/foldText', () => {
  it('folds case and diacritics', () => {
    expect(foldText('  Purée ÀÈ ')).toBe('puree ae');
  });
});

describe('itemSearch/matchScore', () => {
  it('ranks exact, prefix, word prefix, then substring', () => {
    expect(matchScore('Apples', 'apples')).toBe(0);
    expect(matchScore('Apples', 'app')).toBe(1);
    expect(matchScore('Cherry tomatoes', 'tom')).toBe(2);
    expect(matchScore('Pineapple', 'apple')).toBe(3);
    expect(matchScore('Apples', 'pear')).toBeNull();
    expect(matchScore('Apples', '   ')).toBeNull();
  });

  it('ignores accents in both directions', () => {
    expect(matchScore('Tomato purée', 'puree')).toBe(2);
    expect(matchScore('Tomato puree', 'purée')).toBe(2);
  });
});

describe('itemSearch/searchItems', () => {
  it('orders by score, then alphabetically', () => {
    expect(searchItems('apple', ENTRIES, 'en').map((entry) => entry.label)).toEqual([
      'Apple juice',
      'Apples',
      'Pineapple',
    ]);
  });

  it('finds the list custom items', () => {
    expect(searchItems('sauce', ENTRIES, 'en')).toEqual([
      { kind: 'custom', id: 'c1', label: "Nonna's sauce" },
    ]);
  });

  it('caps the number of results', () => {
    expect(searchItems('e', ENTRIES, 'en', 2)).toHaveLength(2);
  });
});

describe('itemSearch/hasExactMatch', () => {
  it('is true only for an exact (folded) label', () => {
    expect(hasExactMatch('APPLES', ENTRIES)).toBe(true);
    expect(hasExactMatch('apple', ENTRIES)).toBe(false);
  });
});
