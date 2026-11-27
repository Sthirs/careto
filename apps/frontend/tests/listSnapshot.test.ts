import { beforeEach, describe, expect, it } from 'vitest';

import {
  readCatalogSnapshot,
  readListSnapshot,
  readUserSnapshot,
  saveListSnapshot,
} from '@/lib/offline/listSnapshot';

const LIST_KEY = 'careto.offline.u1.list.l1';
const items = { sectionOrder: [], items: [], customItems: [], overrides: [] };

describe('device copies (ADR-0030)', () => {
  beforeEach(() => localStorage.clear());

  it('reads back what was saved', () => {
    saveListSnapshot('u1', 'l1', { items });
    expect(readListSnapshot('u1', 'l1')).toEqual({ items });
  });

  it('treats a copy of the wrong shape as no copy', () => {
    for (const damaged of ['5', '[]', '{"items":{}}', '{"items":{"items":[],"customItems":{}}}']) {
      localStorage.setItem(LIST_KEY, damaged);
      expect(readListSnapshot('u1', 'l1')).toBeNull();
    }
    for (const damaged of ['{}', '{"sections":[],"items":{}}']) {
      localStorage.setItem('careto.offline.catalog', damaged);
      expect(readCatalogSnapshot()).toBeNull();
    }
    for (const damaged of ['{}', '[]', '{"id":7}']) {
      localStorage.setItem('careto.offline.user', damaged);
      expect(readUserSnapshot()).toBeNull();
    }
  });

  it('replaces a damaged copy instead of merging into it', () => {
    localStorage.setItem(LIST_KEY, '{"items":{}}');
    saveListSnapshot('u1', 'l1', { items });
    expect(readListSnapshot('u1', 'l1')).toEqual({ items });
  });
});
