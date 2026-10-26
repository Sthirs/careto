/**
 * Route + status-code tests for the dish endpoints: the real Express app via
 * supertest, with `DishService` stubbed, as in `shoppingListController.test.ts`.
 */
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/data-source', () => ({
  AppDataSource: { getRepository: vi.fn(() => ({})), transaction: vi.fn() },
  initializeDatabase: vi.fn(async () => undefined),
}));

import { createApp } from '../src/app';
import { AuthService } from '../src/services/authService';
import { DishService } from '../src/services/dishService';

const JWT_SECRET = 'change-me-in-real-environments';
const LIST = '11111111-1111-4111-8111-111111111111';
const DISH = '22222222-2222-4222-8222-222222222222';
const auth = () => ({
  Authorization: `Bearer ${jwt.sign({ userId: 'u1', email: 'u@careto.local' }, JWT_SECRET)}`,
});
const body = { name: 'Lasagna', ingredients: [{ catalogItemKey: 'pasta' }] };

describe('dish routes (service layer mocked)', () => {
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

  it('GET /dishes → 200 { dishes }', async () => {
    vi.spyOn(DishService.prototype, 'listDishes').mockResolvedValue([{ id: DISH }] as never);
    const response = await request(createApp()).get(`/api/lists/${LIST}/dishes`).set(auth());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ dishes: [{ id: DISH }] });
  });

  it('GET /dishes → 401 without a token', async () => {
    const response = await request(createApp()).get(`/api/lists/${LIST}/dishes`);
    expect(response.status).toBe(401);
  });

  it('GET /dishes → 404 for a non-member', async () => {
    vi.spyOn(DishService.prototype, 'listDishes').mockRejectedValue(
      new Error('List not found or you are not a member.'),
    );
    const response = await request(createApp()).get(`/api/lists/${LIST}/dishes`).set(auth());
    expect(response.status).toBe(404);
  });

  it('POST /dishes → 201 with a valid body', async () => {
    const create = vi.spyOn(DishService.prototype, 'createDish').mockResolvedValue({ id: DISH } as never);
    const response = await request(createApp()).post(`/api/lists/${LIST}/dishes`).set(auth()).send(body);
    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(LIST, body, 'u1');
  });

  it('POST /dishes → 400 without ingredients, before the service', async () => {
    const create = vi.spyOn(DishService.prototype, 'createDish');
    const response = await request(createApp())
      .post(`/api/lists/${LIST}/dishes`)
      .set(auth())
      .send({ name: 'Lasagna', ingredients: [] });
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('PUT /dishes/:dishId → 404 for an unknown dish', async () => {
    vi.spyOn(DishService.prototype, 'updateDish').mockRejectedValue(new Error('Dish not found.'));
    const response = await request(createApp()).put(`/api/lists/${LIST}/dishes/${DISH}`).set(auth()).send(body);
    expect(response.status).toBe(404);
  });

  it('GET /dishes/:dishId → 404 for a malformed id', async () => {
    const response = await request(createApp()).get(`/api/lists/${LIST}/dishes/nope`).set(auth());
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Dish not found.');
  });

  it('PATCH /dishes/:dishId → pauses and resumes', async () => {
    const pause = vi.spyOn(DishService.prototype, 'setDishPause').mockResolvedValue({ id: DISH } as never);
    const app = createApp();
    expect((await request(app).patch(`/api/lists/${LIST}/dishes/${DISH}`).set(auth()).send({ pausedUntil: '2026-11-09' })).status).toBe(200);
    expect((await request(app).patch(`/api/lists/${LIST}/dishes/${DISH}`).set(auth()).send({ pausedUntil: null })).status).toBe(200);
    expect(pause).toHaveBeenNthCalledWith(1, LIST, DISH, '2026-11-09', 'u1');
    expect(pause).toHaveBeenNthCalledWith(2, LIST, DISH, null, 'u1');
  });

  it('PATCH /dishes/:dishId → 400 for a bad date', async () => {
    const response = await request(createApp())
      .patch(`/api/lists/${LIST}/dishes/${DISH}`)
      .set(auth())
      .send({ pausedUntil: 'tomorrow' });
    expect(response.status).toBe(400);
  });

  it('DELETE /dishes/:dishId → 204', async () => {
    vi.spyOn(DishService.prototype, 'deleteDish').mockResolvedValue(undefined);
    const response = await request(createApp()).delete(`/api/lists/${LIST}/dishes/${DISH}`).set(auth());
    expect(response.status).toBe(204);
  });

  it('POST and DELETE /dishes/:dishId/list → add and undo', async () => {
    vi.spyOn(DishService.prototype, 'addDishToList').mockResolvedValue({ id: DISH, inList: true } as never);
    vi.spyOn(DishService.prototype, 'removeDishFromList').mockResolvedValue({ id: DISH, inList: false } as never);
    const app = createApp();
    const added = await request(app).post(`/api/lists/${LIST}/dishes/${DISH}/list`).set(auth());
    const undone = await request(app).delete(`/api/lists/${LIST}/dishes/${DISH}/list`).set(auth());
    expect(added.body).toEqual({ dish: { id: DISH, inList: true } });
    expect(undone.body).toEqual({ dish: { id: DISH, inList: false } });
  });

  it('POST /dishes/:dishId/image → 400 without a file', async () => {
    const response = await request(createApp()).post(`/api/lists/${LIST}/dishes/${DISH}/image`).set(auth());
    expect(response.status).toBe(400);
  });
});
