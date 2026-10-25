import { describe, it, expect } from 'vitest';

import { AVATAR_PALETTE, COVER_PALETTE, colorFromId, shoppingListInitials } from '@/lib/format';

describe('shoppingListInitials', () => {
  it('takes first letters of first two words', () => {
    expect(shoppingListInitials('Weekend in Venice')).toBe('WV');
    expect(shoppingListInitials('Office Lunch')).toBe('OL');
    expect(shoppingListInitials('Holiday in Palermo')).toBe('HP');
    expect(shoppingListInitials('Personal Spending')).toBe('PS');
  });

  it('returns empty string for empty input', () => {
    expect(shoppingListInitials('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(shoppingListInitials('   ')).toBe('');
  });

  it('skips Italian stopwords', () => {
    expect(shoppingListInitials('Viaggio a Roma')).toBe('VR');
    expect(shoppingListInitials('Cena con gli amici')).toBe('CA');
    expect(shoppingListInitials('Spesa di ieri')).toBe('SI');
  });
});

describe('colorFromId', () => {
  it('always returns the same palette colour for the same id', () => {
    const first = colorFromId('list-1', COVER_PALETTE);
    expect(colorFromId('list-1', COVER_PALETTE)).toBe(first);
    expect(COVER_PALETTE).toContain(first);
  });

  it('spreads different ids across the palette', () => {
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => colorFromId(id, AVATAR_PALETTE)));
    expect(colors.size).toBeGreaterThan(1);
  });
});
