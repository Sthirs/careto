import { AppDataSource } from './data-source';

export type LockedRun<T> = { acquired: false } | { acquired: true; result: T };

/**
 * Runs `work` while holding the Postgres session advisory lock `key`, or
 * skips it when another connection (another replica) holds it. The lock is
 * taken and released on one dedicated connection, as session locks require.
 */
export async function withAdvisoryLock<T>(
  key: number,
  work: () => Promise<T>,
): Promise<LockedRun<T>> {
  const runner = AppDataSource.createQueryRunner();
  await runner.connect();
  try {
    const [{ locked }] = (await runner.query('SELECT pg_try_advisory_lock($1) AS locked', [
      key,
    ])) as { locked: boolean }[];
    if (!locked) return { acquired: false };
    try {
      return { acquired: true, result: await work() };
    } finally {
      await runner.query('SELECT pg_advisory_unlock($1)', [key]);
    }
  } finally {
    await runner.release();
  }
}
