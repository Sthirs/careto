import { test, expect } from './fixtures/auth';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const TOKEN_KEY = 'careto.auth.token';
const COMPRESSED = /^(gzip|br)$/;

test.describe('Response compression', () => {
  test('frontend assets are served gzip-compressed and keep their cache policy', async ({ request }) => {
    const indexResponse = await request.get(`${baseURL}/`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    expect(indexResponse.status()).toBe(200);
    expect(indexResponse.headers()['content-encoding']).toBe('gzip');

    const html = await indexResponse.text();
    const scriptMatch = html.match(/assets\/[^"'>\s]+\.js/);
    expect(scriptMatch).not.toBeNull();

    const assetResponse = await request.get(`${baseURL}/${scriptMatch![0]}`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    expect(assetResponse.status()).toBe(200);
    expect(assetResponse.headers()['content-encoding']).toBe('gzip');
    expect(assetResponse.headers()['vary'] ?? '').toMatch(/accept-encoding/i);
    expect(assetResponse.headers()['cache-control'] ?? '').toContain('immutable');
  });

  test('API JSON responses are compressed for a signed-in user', async ({ authenticatedPage: page }) => {
    await page.goto('/lists');
    const token = await page.evaluate((key: string) => localStorage.getItem(key), TOKEN_KEY);
    expect(token).toBeTruthy();

    const response = await page.context().request.get(`${baseURL}/api/catalog`, {
      headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'br, gzip' },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-encoding']).toMatch(COMPRESSED);
    expect(await response.json()).toBeTruthy();
  });
});
