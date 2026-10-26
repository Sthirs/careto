import { describe, expect, it } from 'vitest';

import { addMonths, formatAgo, fromIsoDate, toIsoDate } from '@/lib/dishDates';
import { DISH_ART, dishArtFor } from '@/lib/dishIcons';

describe('dishArtFor', () => {
  it('always picks the same art for the same id', () => {
    expect(dishArtFor('11111111-1111-4111-8111-111111111111')).toBe(dishArtFor('11111111-1111-4111-8111-111111111111'));
  });

  it('spreads ids over every art', () => {
    const used = new Set(Array.from({ length: 50 }, (_, i) => dishArtFor(`dish-${i}`).name));
    expect(used.size).toBe(DISH_ART.length);
  });
});

describe('dishDates', () => {
  it('round-trips local dates', () => {
    expect(toIsoDate(fromIsoDate('2026-11-09'))).toBe('2026-11-09');
    expect(toIsoDate(addMonths(fromIsoDate('2026-10-26'), 1))).toBe('2026-11-26');
  });

  it('clamps addMonths to the last day of a shorter month', () => {
    const plusOne = (iso: string) => toIsoDate(addMonths(fromIsoDate(iso), 1));
    expect(plusOne('2026-01-31')).toBe('2026-02-28');
    expect(plusOne('2028-01-31')).toBe('2028-02-29');
    expect(plusOne('2026-03-31')).toBe('2026-04-30');
    expect(plusOne('2026-12-31')).toBe('2027-01-31');
  });

  it('formats how long ago a dish was added', () => {
    const now = new Date('2026-10-26T12:00:00Z');
    expect(formatAgo('2026-10-25T12:00:00Z', 'en', now)).toBe('yesterday');
    expect(formatAgo('2026-09-14T12:00:00Z', 'en', now)).toBe('6 weeks ago');
    expect(formatAgo('2026-06-28T12:00:00Z', 'en', now)).toBe('4 months ago');
  });
});
