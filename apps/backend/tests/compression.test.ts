import request from 'supertest';

import { createApp } from '../src/app';
import { isCompressionExcludedPath } from '../src/middleware/compression';

const largeBody = { items: Array.from({ length: 200 }, (_, index) => ({ id: index, name: `item-${index}` })) };

const appWithLargeRoutes = () => {
  const app = createApp();
  app.get('/api/test-large', (_request, response) => {
    response.json(largeBody);
  });
  app.post('/api/auth/session/test-large', (_request, response) => {
    response.json(largeBody);
  });
  return app;
};

describe('response compression', () => {
  it('gzips JSON responses over the threshold when the client accepts it', async () => {
    const response = await request(appWithLargeRoutes())
      .get('/api/test-large')
      .set('accept-encoding', 'gzip');

    expect(response.status).toBe(200);
    expect(response.headers['content-encoding']).toBe('gzip');
    expect(response.headers['vary']).toMatch(/accept-encoding/i);
    expect(response.body).toEqual(largeBody);
  });

  it('prefers brotli when the client accepts it', async () => {
    const response = await request(appWithLargeRoutes())
      .get('/api/test-large')
      .set('accept-encoding', 'br, gzip');

    expect(response.headers['content-encoding']).toBe('br');
  });

  it('sends small responses uncompressed', async () => {
    const response = await request(createApp()).get('/api/health').set('accept-encoding', 'gzip');

    expect(response.headers['content-encoding']).toBeUndefined();
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('never compresses token-issuing auth routes', async () => {
    const response = await request(appWithLargeRoutes())
      .post('/api/auth/session/test-large')
      .set('accept-encoding', 'gzip');

    expect(response.status).toBe(200);
    expect(response.headers['content-encoding']).toBeUndefined();
  });

  it.each([
    ['/api/auth/login', true],
    ['/api/auth/register', true],
    ['/api/auth/session/refresh', true],
    ['/api/auth/oauth/dex/callback', true],
    ['/api/auth/me', false],
    ['/api/auth/loginx', false],
    ['/api/lists', false],
  ])('excludes %s from compression: %s', (path, excluded) => {
    expect(isCompressionExcludedPath(path)).toBe(excluded);
  });
});
