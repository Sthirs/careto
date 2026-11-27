/**
 * Route + status-code tests for the item override and section order
 * endpoints: the real Express app via supertest, with `ListItemService`
 * stubbed, as in `weekPlanController.test.ts`.
 */
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/data-source', () => ({
  AppDataSource: { getRepository: vi.fn(() => ({})), transaction: vi.fn() },
  initializeDatabase: vi.fn(async () => undefined),
}));

import { createApp } from '../src/app';
import { CATALOG_SECTIONS } from '../src/services/catalog/catalogData';
import { AuthService } from '../src/services/authService';
import { NotFoundError, SupersededChangeError } from '../src/services/domainErrors';
import { ListItemService } from '../src/services/listItemService';

const JWT_SECRET = 'change-me-in-real-environments';
const LIST = '11111111-1111-4111-8111-111111111111';
const ITEM = '33333333-3333-4333-8333-333333333333';
const KEYS = CATALOG_SECTIONS.map((section) => section.key);
const auth = () => ({
  Authorization: `Bearer ${jwt.sign({ userId: 'u1', email: 'u@careto.local' }, JWT_SECRET)}`,
});

describe('list item override and section order routes (service layer mocked)', () => {
  beforeEach(() => {
    vi.spyOn(AuthService.prototype, 'findById').mockResolvedValue({
      id: 'u1',
      email: 'u@careto.local',
      displayName: 'U',
      language: 'en',
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('PATCH /items/:itemId { iconKey } → 200 via the override', async () => {
    const set = vi
      .spyOn(ListItemService.prototype, 'setListItemOverride')
      .mockResolvedValue({ id: ITEM } as never);
    const status = vi.spyOn(ListItemService.prototype, 'setListItemStatus');
    const response = await request(createApp())
      .patch(`/api/lists/${LIST}/items/${ITEM}`)
      .set(auth())
      .send({ iconKey: 'coffee' });
    expect(response.status).toBe(200);
    expect(set).toHaveBeenCalledWith(LIST, ITEM, { iconKey: 'coffee' }, 'u1');
    expect(status).not.toHaveBeenCalled();
  });

  it('PATCH /items/:itemId { sectionKey } → 200', async () => {
    const set = vi
      .spyOn(ListItemService.prototype, 'setListItemOverride')
      .mockResolvedValue({ id: ITEM } as never);
    const response = await request(createApp())
      .patch(`/api/lists/${LIST}/items/${ITEM}`)
      .set(auth())
      .send({ sectionKey: 'beverages' });
    expect(response.status).toBe(200);
    expect(set).toHaveBeenCalledWith(LIST, ITEM, { sectionKey: 'beverages' }, 'u1');
  });

  it('PATCH /items/:itemId → 400 for own-items', async () => {
    const response = await request(createApp())
      .patch(`/api/lists/${LIST}/items/${ITEM}`)
      .set(auth())
      .send({ sectionKey: 'own-items' });
    expect(response.status).toBe(400);
  });

  it('PATCH /items/:itemId { status } still updates the status', async () => {
    const status = vi
      .spyOn(ListItemService.prototype, 'setListItemStatus')
      .mockResolvedValue({ id: ITEM } as never);
    const response = await request(createApp())
      .patch(`/api/lists/${LIST}/items/${ITEM}`)
      .set(auth())
      .send({ status: 'bought' });
    expect(response.status).toBe(200);
    expect(status).toHaveBeenCalledWith(LIST, ITEM, 'bought', 'u1', expect.any(Date));
  });

  it('PATCH /items/:itemId { status } passes the X-Occurred-At time on (ADR-0030)', async () => {
    const status = vi
      .spyOn(ListItemService.prototype, 'setListItemStatus')
      .mockResolvedValue({ id: ITEM } as never);
    const at = new Date(Date.now() - 3 * 60_000).toISOString();
    const response = await request(createApp())
      .patch(`/api/lists/${LIST}/items/${ITEM}`)
      .set(auth())
      .set('X-Occurred-At', at)
      .send({ status: 'bought' });
    expect(response.status).toBe(200);
    expect(status).toHaveBeenCalledWith(LIST, ITEM, 'bought', 'u1', new Date(at));
  });

  it('POST and DELETE /items pass the X-Occurred-At time on', async () => {
    const add = vi
      .spyOn(ListItemService.prototype, 'addListItem')
      .mockResolvedValue({ item: { id: ITEM }, created: true } as never);
    const remove = vi.spyOn(ListItemService.prototype, 'removeListItem').mockResolvedValue();
    const at = new Date(Date.now() - 60_000).toISOString();

    const added = await request(createApp())
      .post(`/api/lists/${LIST}/items`)
      .set(auth())
      .set('X-Occurred-At', at)
      .send({ catalogItemKey: 'milk' });
    const removed = await request(createApp())
      .delete(`/api/lists/${LIST}/items/${ITEM}`)
      .set(auth())
      .set('X-Occurred-At', at);

    expect(added.status).toBe(201);
    expect(add).toHaveBeenCalledWith(LIST, { catalogItemKey: 'milk' }, 'u1', new Date(at));
    expect(removed.status).toBe(204);
    expect(remove).toHaveBeenCalledWith(LIST, ITEM, 'u1', new Date(at));
  });

  it('GET /section-order → 200 { sectionKeys }', async () => {
    vi.spyOn(ListItemService.prototype, 'getSectionOrder').mockResolvedValue({ sectionKeys: KEYS });
    const response = await request(createApp()).get(`/api/lists/${LIST}/section-order`).set(auth());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ sectionKeys: KEYS });
  });

  it('GET /section-order → 404 for a non-member', async () => {
    vi.spyOn(ListItemService.prototype, 'getSectionOrder').mockRejectedValue(
      new NotFoundError('List not found or you are not a member.'),
    );
    const response = await request(createApp()).get(`/api/lists/${LIST}/section-order`).set(auth());
    expect(response.status).toBe(404);
  });

  it('PATCH /items/:itemId { status } → 409 when a later change overtook it (ADR-0031)', async () => {
    vi.spyOn(ListItemService.prototype, 'setListItemStatus').mockRejectedValue(
      new SupersededChangeError(),
    );
    const response = await request(createApp())
      .patch(`/api/lists/${LIST}/items/${ITEM}`)
      .set(auth())
      .send({ status: 'bought' });
    expect(response.status).toBe(409);
  });

  it('POST /items → 500, not 400, when something unexpected fails, so the outbox retries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(ListItemService.prototype, 'addListItem').mockRejectedValue(
      new Error('Connection terminated unexpectedly'),
    );
    const response = await request(createApp())
      .post(`/api/lists/${LIST}/items`)
      .set(auth())
      .send({ catalogItemKey: 'milk' });
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Unable to add item.' });
  });

  it('PUT /section-order → 200 and passes the order on', async () => {
    const reversed = [...KEYS].reverse();
    const replace = vi
      .spyOn(ListItemService.prototype, 'replaceSectionOrder')
      .mockResolvedValue({ sectionKeys: reversed });
    const response = await request(createApp())
      .put(`/api/lists/${LIST}/section-order`)
      .set(auth())
      .send({ sectionKeys: reversed });
    expect(response.status).toBe(200);
    expect(replace).toHaveBeenCalledWith(LIST, reversed, 'u1');
  });

  it('PUT /section-order → 400 for an incomplete order', async () => {
    const replace = vi.spyOn(ListItemService.prototype, 'replaceSectionOrder');
    const response = await request(createApp())
      .put(`/api/lists/${LIST}/section-order`)
      .set(auth())
      .send({ sectionKeys: KEYS.slice(1) });
    expect(response.status).toBe(400);
    expect(replace).not.toHaveBeenCalled();
  });

  it('DELETE /section-order → 200 with the default order', async () => {
    const reset = vi
      .spyOn(ListItemService.prototype, 'resetSectionOrder')
      .mockResolvedValue({ sectionKeys: KEYS });
    const response = await request(createApp())
      .delete(`/api/lists/${LIST}/section-order`)
      .set(auth());
    expect(response.status).toBe(200);
    expect(reset).toHaveBeenCalledWith(LIST, 'u1');
  });
});
