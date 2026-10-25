import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    // Every test round-trips the in-cluster backend (ingress + bcrypt), so the
    // 5s default flakes on slow CI runners.
    testTimeout: 15_000,
    globals: true,
  },
});
