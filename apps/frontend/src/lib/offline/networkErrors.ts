import axios from 'axios';

/**
 * A failure worth retrying, or answering from the offline copy (ADR-0030):
 * no response at all (offline, DNS, a dropped connection, a timeout), the
 * server or ingress being down (5xx), or the rate limiter (429).
 */
export function isTransientFailure(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status >= 500 || status === 429;
}

/** The HTTP status of a failed request, if the server answered. */
export const statusOf = (error: unknown): number | undefined =>
  axios.isAxiosError(error) ? error.response?.status : undefined;
