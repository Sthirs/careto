import { describe, it, expect } from 'vitest';

import { shoppingListInitials } from '@/lib/format';

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
