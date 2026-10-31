import compression from 'compression';
import type { Response } from 'express';

/**
 * br / gzip / deflate negotiated from Accept-Encoding; bodies under 1 KB and
 * non-compressible types (images) are sent as-is. Every origin compresses its
 * own responses: the ingress routes /api straight to the backend, bypassing
 * the frontend nginx.
 *
 * Responses marked with `Cache-Control: no-transform` are never compressed
 * (built into the `compression` package); see `sendUncompressed`.
 */
export const responseCompression = compression();

/**
 * Opt one response out of compression. Call it in every handler whose body or
 * Location carries a secret (the access JWT) next to request-controlled data —
 * the BREACH precondition: compressed length would leak the secret's bytes.
 *
 * The opt-out is marked where the token is issued rather than matched on the
 * request path, because the compression filter runs inside the nested routers,
 * where Express has already stripped the mount prefixes from `request.path`.
 * Token bodies are not small: they embed the user's `imageUrl` data URL
 * (ADR-0015), so the 1 KB threshold does not protect them.
 */
export const sendUncompressed = (response: Response): void => {
  response.setHeader('Cache-Control', 'no-store, no-transform');
};
