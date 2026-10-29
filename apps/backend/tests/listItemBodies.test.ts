import { describe, expect, it } from 'vitest';

import {
  parseAddItemBody,
  parseItemUpdateBody,
  parseSectionOrderBody,
} from '../src/controllers/listItem/listItemBodies';
import { CATALOG_SECTIONS } from '../src/services/catalog/catalogData';

describe('parseAddItemBody', () => {
  it.each([
    [{ catalogItemKey: 'milk' }, { catalogItemKey: 'milk' }],
    [{ customItemId: '11111111-1111-1111-1111-111111111111' }, { customItemId: '11111111-1111-1111-1111-111111111111' }],
    [{ customName: '  Oat drink ' }, { customName: 'Oat drink' }],
  ])('accepts %j', (body, value) => {
    expect(parseAddItemBody(body)).toEqual({ ok: true, value });
  });

  it.each([
    [undefined],
    [{}],
    [{ catalogItemKey: 'milk', customName: 'x' }],
    [{ catalogItemKey: 3 }],
    [{ customItemId: 'not-a-uuid' }],
    [{ customName: '   ' }],
    [{ customName: 'x'.repeat(61) }],
  ])('rejects %j', (body) => {
    expect(parseAddItemBody(body).ok).toBe(false);
  });
});

describe('parseItemUpdateBody', () => {
  it('accepts the two statuses only', () => {
    expect(parseItemUpdateBody({ status: 'bought' })).toEqual({ ok: true, value: { status: 'bought' } });
    expect(parseItemUpdateBody({ status: 'to_buy' })).toEqual({ ok: true, value: { status: 'to_buy' } });
    expect(parseItemUpdateBody({ status: 'gone' }).ok).toBe(false);
  });

  it.each([
    [{ iconKey: 'milk' }, { iconKey: 'milk' }],
    [{ iconKey: null }, { iconKey: null }],
    [{ sectionKey: 'beverages' }, { sectionKey: 'beverages' }],
    [{ sectionKey: null }, { sectionKey: null }],
  ])('accepts the override %j', (body, value) => {
    expect(parseItemUpdateBody(body)).toEqual({ ok: true, value });
  });

  it.each([
    [undefined],
    [{}],
    [{ status: 'bought', iconKey: 'milk' }],
    [{ iconKey: 'not-an-item' }],
    [{ iconKey: 3 }],
    [{ sectionKey: 'own-items' }],
    [{ sectionKey: 'nowhere' }],
  ])('rejects %j', (body) => {
    expect(parseItemUpdateBody(body).ok).toBe(false);
  });
});

describe('parseSectionOrderBody', () => {
  const keys = CATALOG_SECTIONS.map((section) => section.key);

  it('accepts any permutation of the catalog sections', () => {
    const reversed = [...keys].reverse();
    expect(parseSectionOrderBody({ sectionKeys: reversed })).toEqual({ ok: true, value: reversed });
  });

  it.each([
    ['nothing', undefined],
    ['a missing section', { sectionKeys: keys.slice(1) }],
    ['a duplicate', { sectionKeys: [keys[0], ...keys.slice(0, -1)] }],
    ['own-items', { sectionKeys: ['own-items', ...keys.slice(1)] }],
    ['an extra section', { sectionKeys: [...keys, 'own-items'] }],
  ])('rejects %s', (_label, body) => {
    expect(parseSectionOrderBody(body).ok).toBe(false);
  });
});
