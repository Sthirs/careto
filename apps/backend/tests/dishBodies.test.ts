import { describe, expect, it } from 'vitest';

import { parseDishBody, parsePauseBody } from '../src/controllers/dish/dishBodies';

describe('parseDishBody', () => {
  it('accepts a name and ingredients, collapsing whitespace in the name', () => {
    expect(
      parseDishBody({
        name: '  Pasta   alla Norma ',
        ingredients: [{ catalogItemKey: 'eggplant' }, { customName: ' Ricotta salata ' }],
        extra: 'ignored',
      }),
    ).toEqual({
      ok: true,
      value: {
        name: 'Pasta alla Norma',
        ingredients: [{ catalogItemKey: 'eggplant' }, { customName: 'Ricotta salata' }],
      },
    });
  });

  it.each([
    [undefined],
    [{ ingredients: [{ catalogItemKey: 'milk' }] }],
    [{ name: '   ', ingredients: [{ catalogItemKey: 'milk' }] }],
    [{ name: 'x'.repeat(81), ingredients: [{ catalogItemKey: 'milk' }] }],
    [{ name: 'Soup' }],
    [{ name: 'Soup', ingredients: [] }],
    [{ name: 'Soup', ingredients: 'milk' }],
    [{ name: 'Soup', ingredients: [{ catalogItemKey: 'milk', customName: 'x' }] }],
    [{ name: 'Soup', ingredients: Array.from({ length: 101 }, () => ({ catalogItemKey: 'milk' })) }],
  ])('rejects %j', (body) => {
    expect(parseDishBody(body).ok).toBe(false);
  });
});

describe('parsePauseBody', () => {
  it('accepts a date or null', () => {
    expect(parsePauseBody({ pausedUntil: '2026-11-09' })).toEqual({ ok: true, value: '2026-11-09' });
    expect(parsePauseBody({ pausedUntil: null })).toEqual({ ok: true, value: null });
  });

  it.each([[{}], [{ pausedUntil: '2026-02-30' }], [{ pausedUntil: '9/11/2026' }], [{ pausedUntil: 3 }]])(
    'rejects %j',
    (body) => {
      expect(parsePauseBody(body).ok).toBe(false);
    },
  );
});
