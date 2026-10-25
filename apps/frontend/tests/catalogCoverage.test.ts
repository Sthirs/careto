import { describe, expect, it } from 'vitest';

// The backend owns the catalog keys; the frontend owns their labels and icons
// (ADR-0014). This test keeps the two sides in step.
import {
  CATALOG_SECTIONS,
  OWN_ITEMS_SECTION_KEY,
} from '../../backend/src/services/catalog/catalogData';
import { en } from '@/i18n/en';
import { it as itMessages } from '@/i18n/it';
import { ITEM_ICONS, SECTION_ICONS } from '@/lib/itemIcons';

const sectionKeys = [...CATALOG_SECTIONS.map((section) => section.key), OWN_ITEMS_SECTION_KEY];
const itemKeys = CATALOG_SECTIONS.flatMap((section) => section.items);

describe('catalog coverage', () => {
  it.each([
    ['en', en.catalog],
    ['it', itMessages.catalog],
  ])('labels every section and item in %s', (_locale, catalog) => {
    expect(Object.keys(catalog.sections).sort()).toEqual([...sectionKeys].sort());
    expect(Object.keys(catalog.items).sort()).toEqual([...itemKeys].sort());
  });

  it('has an icon for every item, its own or its section fallback', () => {
    for (const section of CATALOG_SECTIONS) {
      expect(SECTION_ICONS[section.key], section.key).toBeTruthy();
    }
    expect(Object.keys(ITEM_ICONS).filter((key) => !itemKeys.includes(key))).toEqual([]);
  });

  it('has unique item keys', () => {
    expect(new Set(itemKeys).size).toBe(itemKeys.length);
  });
});
