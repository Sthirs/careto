import express from 'express';
import request from 'supertest';

import { createApp } from '../src/app';
import { sendUncompressed } from '../src/middleware/compression';

const largeBody = { items: Array.from({ length: 200 }, (_, index) => ({ id: index, name: `item-${index}` })) };

const appWithLargeRoutes = () => {
  const app = createApp();
  app.get('/api/test-large', (_request, response) => {
    response.json(largeBody);
  });
  // Mounted through nested routers like the real API, where Express strips the
  // mount prefixes from request.path before the response goes out.
  const inner = express.Router();
  inner.post('/large', (_request, response) => {
    sendUncompressed(response);
    response.json(largeBody);
  });
  const outer = express.Router();
  outer.use('/nested', inner);
  app.use('/api/test', outer);
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

  it('never compresses a large response marked with sendUncompressed inside nested routers', async () => {
    const response = await request(appWithLargeRoutes())
      .post('/api/test/nested/large')
      .set('accept-encoding', 'br, gzip');

    expect(response.status).toBe(200);
    expect(response.headers['content-encoding']).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store, no-transform');
    expect(response.body).toEqual(largeBody);
  });
});
