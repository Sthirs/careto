import compression from 'compression';
import type { Request, Response } from 'express';

// Token-issuing routes stay uncompressed: their bodies carry the access JWT
// (and login/register reflect the submitted email next to it), so compressed
// length must never leak secret bytes (BREACH). They are small enough that
// compression would buy nothing anyway.
const UNCOMPRESSED_PATH_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/session',
  '/api/auth/oauth',
];

export const isCompressionExcludedPath = (path: string) =>
  UNCOMPRESSED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const shouldCompress = (request: Request, response: Response) =>
  !isCompressionExcludedPath(request.path) && compression.filter(request, response);

/**
 * br / gzip / deflate negotiated from Accept-Encoding; bodies under 1 KB and
 * non-compressible types (images) are sent as-is. Every origin compresses its
 * own responses: the ingress routes /api straight to the backend, bypassing
 * the frontend nginx.
 */
export const responseCompression = compression({ filter: shouldCompress });
