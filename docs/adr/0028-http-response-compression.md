# ADR-0028: HTTP response compression — each origin compresses its own responses

- **Status:** 🟢 accepted
- **Date:** 2026-10-31
- **Deciders:** Sthirs (product owner), coding agent

## Context

No response was compressed. The app is a PWA used mostly on phones, often on
mobile data: the JS/CSS bundle and the JSON payloads (catalog, list detail,
dish and list images embedded as data URLs per ADR-0015) all went over the wire
uncompressed.

The Helm Ingress (ADR-0006, `helm/careto/templates/ingress.yaml`) routes `/api`
**straight to the backend Service** and `/` to the frontend nginx, so the
frontend nginx never sees production API traffic. Compression at the ingress
controller is not portable: ingress-nginx's `use-gzip` is a controller-wide
ConfigMap setting, not a per-Ingress annotation, and other clusters may run a
different controller.

Constraints: the ADR-0016 Cache-Control policy in `apps/frontend/nginx.conf`
(one server-level `add_header`, to avoid the nginx inheritance trap) must stay
intact, and the ADR-0018 token-issuing endpoints must not leak secrets through
compressed length (BREACH).

## Decision

We will make every origin compress its own responses:

- **Backend:** the `compression` Express middleware
  (`apps/backend/src/middleware/compression.ts`) negotiates br / gzip / deflate
  for every response over 1 KB of a compressible type, **except** the
  token-issuing routes `/api/auth/login`, `/api/auth/register`,
  `/api/auth/session/*` and `/api/auth/oauth/*`, which are always sent
  uncompressed.
- **Frontend:** the image build precompresses text assets (`gzip -9 -k`) after
  `vite build`. nginx serves them with `gzip_static on` and uses on-the-fly
  `gzip` as a fallback (`gzip_vary on`, `gzip_proxied any`, level 6, 1 KB
  minimum). The Cache-Control map and its single `add_header` are unchanged.

## Alternatives considered

- **Compression at the ingress controller** — not portable (controller-wide
  setting, controller-specific), and invisible to the docker-only / Telepresence
  setups.
- **Brotli in nginx** — the `nginxinc/nginx-unprivileged` image ships without
  the brotli module. Building a custom nginx image is a maintenance cost that
  isn't worth it at this bundle size. Browsers that support br get gzip from
  nginx and br from the API.
- **A Vite compression plugin** — adds a dependency to do what a single `find
  … gzip` in the Dockerfile does. It would also have to run after
  vite-plugin-pwa writes `sw.js`.
- **Compress every API response, including auth** — rejected. Login/register
  reflect the submitted email next to the access token, which is the BREACH
  precondition. These bodies are tiny anyway.

## Sources / Prior art

- ADR-0006 (Ingress routing), ADR-0015 (images as data URLs in JSON), ADR-0016
  (nginx Cache-Control policy), ADR-0018 (access/refresh tokens).
- nginx docs: `ngx_http_gzip_module`, `ngx_http_gzip_static_module`.
- expressjs/compression README (brotli support since 1.8.0, `filter`,
  `threshold`).
- BREACH attack — <https://www.breachattack.com/>.
- ingress-nginx ConfigMap `use-gzip` documentation.

## Consequences

- Positive: JS/CSS/HTML and JSON transfer sizes drop sharply. Static assets cost
  no CPU per request (precompressed). All environments behave the same because
  compression lives in the images, not the cluster.
- Negative / trade-offs: some CPU on the backend per large JSON response. The
  frontend image is slightly larger (`.gz` siblings). nginx serves gzip, not br.
  Any new token-issuing route must be added to the exclusion list.
- Follow-ups: brotli for static assets if bundle size grows (custom nginx
  image or precompressed `.br` with a brotli-enabled server).
