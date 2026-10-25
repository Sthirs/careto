import { describe, expect, it } from 'vitest';

import { parseAddItemBody, parseStatusBody } from '../src/controllers/listItem/listItemBodies';

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

describe('parseStatusBody', () => {
  it('accepts the two statuses only', () => {
    expect(parseStatusBody({ status: 'bought' })).toEqual({ ok: true, value: 'bought' });
    expect(parseStatusBody({ status: 'to_buy' })).toEqual({ ok: true, value: 'to_buy' });
    expect(parseStatusBody({ status: 'gone' }).ok).toBe(false);
  });
});
