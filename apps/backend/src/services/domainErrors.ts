import { QueryFailedError } from 'typeorm';

/**
 * Errors a service throws on purpose, so a handler can answer them with the
 * right status. Anything else is unexpected and answers 500: the offline
 * outbox retries a 5xx and drops a 4xx (ADR-0030), so a database outage must
 * never look like a refused request.
 */

/** The list, item or reference does not exist, or the user may not see it. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * A change dated by the time of its tap came after another change to the same
 * item: the later one wins, so this one has no effect.
 */
export class SupersededChangeError extends Error {
  constructor() {
    super('The item changed after this change was made.');
    this.name = 'SupersededChangeError';
  }
}

/** The Postgres error code (SQLSTATE) of a failed query, if it is one. */
export const postgresCodeOf = (error: unknown): string | undefined =>
  error instanceof QueryFailedError
    ? (error.driverError as { code?: string } | undefined)?.code
    : undefined;
