/**
 * Unit tests for the VAPID_AUTO_GENERATE fallback in `config/env.ts`. It
 * exists so Minikube/CI never need a committed VAPID keypair (see
 * `helm/careto/templates/backend-secret.yaml` and ADR-0020) — each test
 * resets modules and re-imports `env` after stubbing `process.env` so the
 * module-level parsing in `env.ts` runs fresh.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('VAPID_AUTO_GENERATE', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('mints a well-formed keypair and enables push when no real keypair is configured', async () => {
    vi.stubEnv('VAPID_AUTO_GENERATE', 'true');
    vi.stubEnv('VAPID_PUBLIC_KEY', '');
    vi.stubEnv('VAPID_PRIVATE_KEY', '');

    const { env } = await import('../../src/config/env');

    expect(env.pushEnabled).toBe(true);
    expect(env.VAPID_PUBLIC_KEY).toBeTruthy();
    expect(env.VAPID_PRIVATE_KEY).toBeTruthy();
  });

  it('leaves push disabled when unset, same as today', async () => {
    vi.stubEnv('VAPID_AUTO_GENERATE', '');
    vi.stubEnv('VAPID_PUBLIC_KEY', '');
    vi.stubEnv('VAPID_PRIVATE_KEY', '');

    const { env } = await import('../../src/config/env');

    expect(env.pushEnabled).toBe(false);
    expect(env.VAPID_PUBLIC_KEY).toBeUndefined();
    expect(env.VAPID_PRIVATE_KEY).toBeUndefined();
  });

  it('never overrides an explicitly configured keypair', async () => {
    vi.stubEnv('VAPID_AUTO_GENERATE', 'true');
    vi.stubEnv('VAPID_PUBLIC_KEY', 'configured-public-key');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'configured-private-key');

    const { env } = await import('../../src/config/env');

    expect(env.pushEnabled).toBe(true);
    expect(env.VAPID_PUBLIC_KEY).toBe('configured-public-key');
    expect(env.VAPID_PRIVATE_KEY).toBe('configured-private-key');
  });
});

describe('AUTO_FILL_* (ADR-0027)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('runs the job hourly by default', async () => {
    vi.stubEnv('AUTO_FILL_ENABLED', '');
    vi.stubEnv('AUTO_FILL_INTERVAL_MS', '');

    const { env } = await import('../../src/config/env');

    expect(env.AUTO_FILL_ENABLED).toBe(true);
    expect(env.AUTO_FILL_INTERVAL_MS).toBe(3600000);
  });

  it('turns the job off only with "false"', async () => {
    vi.stubEnv('AUTO_FILL_ENABLED', 'false');

    const { env } = await import('../../src/config/env');

    expect(env.AUTO_FILL_ENABLED).toBe(false);
  });

  it('fails fast on an interval setInterval cannot honour', async () => {
    vi.stubEnv('AUTO_FILL_INTERVAL_MS', '0');
    await expect(import('../../src/config/env')).rejects.toThrow(/AUTO_FILL_INTERVAL_MS/);

    vi.resetModules();
    vi.stubEnv('AUTO_FILL_INTERVAL_MS', '2147483648');
    await expect(import('../../src/config/env')).rejects.toThrow(/AUTO_FILL_INTERVAL_MS/);
  });
});

describe('SEED_ON_STARTUP', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('seeds in development (dev and CI)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SEED_ON_STARTUP', 'true');

    const { env } = await import('../../src/config/env');

    expect(env.SEED_ON_STARTUP).toBe(true);
  });

  it('never seeds in production, and warns about it', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SEED_ON_STARTUP', 'true');

    const { env } = await import('../../src/config/env');

    expect(env.SEED_ON_STARTUP).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      '[seed] SEED_ON_STARTUP is ignored under NODE_ENV=production.',
    );
  });
});
