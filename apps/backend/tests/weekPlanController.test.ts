/**
 * Route + status-code tests for the week plan endpoints: the real Express app
 * via supertest, with `WeekPlanService` stubbed, as in `dishController.test.ts`.
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
import { WeekPlanService } from '../src/services/weekPlanService';

const JWT_SECRET = 'change-me-in-real-environments';
const LIST = '11111111-1111-4111-8111-111111111111';
const DISH = '22222222-2222-4222-8222-222222222222';
const auth = () => ({
  Authorization: `Bearer ${jwt.sign({ userId: 'u1', email: 'u@careto.local' }, JWT_SECRET)}`,
});

describe('week plan routes (service layer mocked)', () => {
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

  it('GET /week → 200 { slots }', async () => {
    const slots = [{ weekday: 1, meal: 'lunch', dishId: DISH }];
    vi.spyOn(WeekPlanService.prototype, 'getPlan').mockResolvedValue({ slots } as never);
    const response = await request(createApp()).get(`/api/lists/${LIST}/week`).set(auth());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ slots });
  });

  it('GET /week → 401 without a token', async () => {
    const response = await request(createApp()).get(`/api/lists/${LIST}/week`);
    expect(response.status).toBe(401);
  });

  it('GET /week → 404 for a non-member', async () => {
    vi.spyOn(WeekPlanService.prototype, 'getPlan').mockRejectedValue(
      new Error('List not found or you are not a member.'),
    );
    const response = await request(createApp()).get(`/api/lists/${LIST}/week`).set(auth());
    expect(response.status).toBe(404);
  });

  it('PUT /week/slots → 200 and passes the slot on', async () => {
    const set = vi.spyOn(WeekPlanService.prototype, 'setSlot').mockResolvedValue({ slots: [] });
    const slot = { weekday: 3, meal: 'dinner', dishId: null };
    const response = await request(createApp())
      .put(`/api/lists/${LIST}/week/slots`)
      .set(auth())
      .send(slot);
    expect(response.status).toBe(200);
    expect(set).toHaveBeenCalledWith(LIST, slot, 'u1');
  });

  it.each([
    { weekday: 0, meal: 'lunch', dishId: DISH },
    { weekday: 8, meal: 'lunch', dishId: DISH },
    { weekday: 1, meal: 'breakfast', dishId: DISH },
    { weekday: 1, meal: 'lunch', dishId: 'nope' },
  ])('PUT /week/slots → 400 for %o, before the service', async (slot) => {
    const set = vi.spyOn(WeekPlanService.prototype, 'setSlot');
    const response = await request(createApp())
      .put(`/api/lists/${LIST}/week/slots`)
      .set(auth())
      .send(slot);
    expect(response.status).toBe(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('PUT /week/slots → 404 for a dish of another list', async () => {
    vi.spyOn(WeekPlanService.prototype, 'setSlot').mockRejectedValue(new Error('Dish not found.'));
    const response = await request(createApp())
      .put(`/api/lists/${LIST}/week/slots`)
      .set(auth())
      .send({ weekday: 1, meal: 'lunch', dishId: DISH });
    expect(response.status).toBe(404);
  });

  it('PUT /week → 200 replaces the plan', async () => {
    const replace = vi
      .spyOn(WeekPlanService.prototype, 'replacePlan')
      .mockResolvedValue({ slots: [] });
    const response = await request(createApp())
      .put(`/api/lists/${LIST}/week`)
      .set(auth())
      .send({ slots: [] });
    expect(response.status).toBe(200);
    expect(replace).toHaveBeenCalledWith(LIST, [], 'u1');
  });

  it('PUT /week → 400 for a repeated slot', async () => {
    const slot = { weekday: 1, meal: 'lunch', dishId: DISH };
    const response = await request(createApp())
      .put(`/api/lists/${LIST}/week`)
      .set(auth())
      .send({ slots: [slot, slot] });
    expect(response.status).toBe(400);
  });

  it('POST /week/list → 204', async () => {
    const add = vi.spyOn(WeekPlanService.prototype, 'addPlanToList').mockResolvedValue();
    const response = await request(createApp()).post(`/api/lists/${LIST}/week/list`).set(auth());
    expect(response.status).toBe(204);
    expect(add).toHaveBeenCalledWith(LIST, 'u1');
  });
});
