# Development

How to get Careto running locally and how to work on it day to day. For what
the product does, see the [README](../README.md); for the canonical product
spec, see [`specifications.md`](specifications.md). Before you open a pull
request, read [`AGENTS.md`](../AGENTS.md) — it defines the contribution
methodology and the ADR rules that changes have to follow.

## Overview

There is exactly one supported way to develop this project:

- Minikube runs the baseline cluster services.
- Helm deploys `frontend`, `backend`, and `postgres`.
- Telepresence intercepts `frontend` and/or `backend`.
- `npm run dev:frontend` and `npm run dev:backend` run the intercepted service
  locally against the rest of the stack in cluster.

Local Docker PostgreSQL and direct localhost-only development are **not** part
of the supported workflow.

## Prerequisites

- `nvm`
- Node.js — the version pinned in [`.nvmrc`](../.nvmrc)
- npm
- Docker
- Minikube
- Helm
- Telepresence

## First-time setup

```bash
nvm install
nvm use
npm ci
npm run cluster:up
npm run cluster:build
npm run cluster:deploy
```

The app is served through the Minikube ingress, which defaults to
`careto.$(minikube ip).nip.io`. Print the host any time with:

```bash
npm run dev:host
```

Seeded demo credentials:

- email: `demo@careto.local`
- password: `password123`

## Daily development

Connect Telepresence once per session:

```bash
npm run telepresence:connect
```

Then intercept whichever service you are working on.

### Backend only

```bash
npm run telepresence:backend
npm run dev:backend
```

### Frontend only

```bash
npm run telepresence:frontend
npm run dev:frontend
```

### Both

Use two terminals for the intercepts and one for the app processes:

```bash
npm run telepresence:backend
npm run telepresence:frontend
npm run dev
```

Open the application through the ingress host printed by `npm run dev:host`.
When you are done:

```bash
npm run telepresence:leave
```

### Testing a rebuilt image (no Telepresence)

To verify a change by running it as a deployed pod — e.g. before
`test:integration` or `test:playwright`, which both target an
already-running deployment — rebuild and redeploy instead of using a
Telepresence intercept. Reach the instance at the ingress host printed by
`npm run dev:host`.

Rebuild only the workspace you changed; it's faster than
`npm run cluster:build`, which builds both images:

```bash
minikube image build -f apps/frontend/Dockerfile -t careto/frontend:dev .
# or: apps/backend/Dockerfile -t careto/backend:dev
```

`scripts/minikube-build.sh` tags images `careto/frontend:dev` and
`careto/backend:dev` — a **fixed tag**. Because the tag never changes,
`npm run cluster:deploy` (`helm upgrade`) does not restart anything on its
own, so a rebuilt image is not picked up. Always follow a rebuild with an
explicit restart:

```bash
kubectl -n careto rollout restart deployment/careto-frontend
kubectl -n careto rollout status deployment/careto-frontend --timeout=180s
```

(swap `frontend` for `backend` as needed).

### Things to know

- The local backend process talks to the in-cluster PostgreSQL service over the
  Telepresence network.
- Reach the local frontend through the Minikube ingress host, **not** through
  `localhost:5173` directly.
- Vite HMR is configured for the ingress host so the frontend keeps working
  behind a Telepresence intercept.
- TypeORM uses schema synchronization (`DB_SYNC=true`); there are no migrations.
- Seed data is created by the in-cluster backend startup path.

## Configuration

### Auth toggles

Two environment variables control whether local (password-based) auth is
available. OAuth sign-in is unaffected by these flags.

| Variable                          | Default   | Effect when `"false"`                                                  |
|-----------------------------------|-----------|------------------------------------------------------------------------|
| `AUTH_LOCAL_LOGIN_ENABLED`        | `"true"`  | `POST /api/auth/login` returns 403; the login form is hidden in the UI |
| `AUTH_LOCAL_REGISTRATION_ENABLED` | `"false"` | `POST /api/auth/register` returns 403; devMode sets it to `"true"`     |

### Rate limiting

The API applies a global per-IP rate limiter (express-rate-limit):

- It covers all `/api` routes; `/api/health` is exempt.
- Exceeding the quota returns HTTP 429 with `RateLimit` and `RateLimit-Policy`
  headers (IETF draft-8) plus `Retry-After`.
- Local, Minikube, and CI deployments force a high limit through the chart's
  `devMode` toggle, so automated tests never hit the cap.

| Variable               | Default  | Effect                                            |
|------------------------|----------|---------------------------------------------------|
| `RATE_LIMIT_WINDOW_MS` | `300000` | Length of the per-IP quota window in milliseconds |
| `RATE_LIMIT_LIMIT`     | `500`    | Max requests per IP per window; excess gets 429   |

### Session lifetimes

Sessions are a short-lived access JWT plus a rotating refresh token
([ADR-0018](adr/0018-refresh-token-rotation.md)). The refresh window is
**sliding** — every rotation resets it — so a user who opens the app at least
once per window never has to sign in again.

| Variable                            | Default   | Effect                                                        |
|-------------------------------------|-----------|---------------------------------------------------------------|
| `ACCESS_TOKEN_TTL_SECONDS`          | `3600`    | Lifetime of the `Bearer` access JWT                           |
| `REFRESH_TOKEN_TTL_SECONDS`         | `7776000` | Sliding refresh window (90 days); every rotation extends it   |
| `REFRESH_TOKEN_REUSE_GRACE_SECONDS` | `30`      | Grace window for a replayed just-rotated token (see below)    |

Inside the grace window a replay is treated as a benign multi-tab race — 401,
family kept. Outside it, the replay is treated as theft: 401, and the whole
token family is revoked.

Notes:

- The refresh token is delivered as an httpOnly cookie named
  `careto.auth.refresh`, scoped to `/api/auth/session` — the mount point of the
  two endpoints that use it, `POST /api/auth/session/refresh` and
  `POST /api/auth/session/logout`. It is never present in a response body.
- The cookie is marked `secure` when `NODE_ENV=production`, so **a production
  deployment requires TLS**. Over plain HTTP the browser silently discards it and
  users are signed out every `ACCESS_TOKEN_TTL_SECONDS`; the backend logs a
  warning at startup when it detects that combination.
- `devMode` forces `REFRESH_TOKEN_REUSE_GRACE_SECONDS=1` so the reuse-detection
  integration tests stay fast. The two TTLs are deliberately **not** overridden,
  so dev and CI exercise the real lifetimes.
- Rotation is single-use: each refresh consumes the presented token and issues a
  successor in the same family. Presenting an already-consumed token outside the
  grace window revokes the whole family, which is how a stolen token gets
  detected. Signing out revokes it too.

### Push notifications

Device notifications ([ADR-0020](adr/0020-web-push-notifications.md)) use the
Web Push protocol with VAPID. There is no in-app setting — the feature
degrades to a silent no-op whenever `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are
unset, so it is safe to deploy without them.

| Variable            | Required | Effect                                                 |
|---------------------|----------|--------------------------------------------------------|
| `VAPID_PUBLIC_KEY`  | No       | Served to the frontend via `GET /api/push/public-key`  |
| `VAPID_PRIVATE_KEY` | No       | Signs outgoing push payloads; never exposed to clients |
| `VAPID_SUBJECT`     | No       | Contact URI/mailto sent to push services; not a secret |

Minikube and CI never get a committed keypair — a real VAPID keypair is
high-entropy key material, unlike the dummy `JWT_SECRET`/`OAUTH_STATE_SECRET`
values the chart's `devMode` guard commits, so there's no "obviously fake"
version of it to check in. Instead, `devMode` sets `VAPID_AUTO_GENERATE=true`
and the backend mints its own ephemeral keypair at boot
(`apps/backend/src/config/env.ts`) whenever no real keypair is configured.
Every restart mints a new one, which invalidates existing subscriptions the
same harmless way a manual rotation does (see below) — clients re-subscribe
automatically the next time they open the app.

**A production deployment needs its own persisted keypair** — leave
`VAPID_AUTO_GENERATE` unset/`"false"` there, since an ephemeral per-restart
keypair would break push across every pod restart and wouldn't be shared
across replicas. Generate one and provision it as the secret named by
`backend.secrets.vapid.secretName` in `values.yaml`:

```bash
npx --package=web-push web-push generate-vapid-keys
kubectl create secret generic <backend.secrets.vapid.secretName> \
  --namespace <namespace> \
  --from-literal=VAPID_PUBLIC_KEY=<public key> \
  --from-literal=VAPID_PRIVATE_KEY=<private key>
```

Replace `<backend.secrets.vapid.secretName>` and `<namespace>` with the
values actually configured in `values.yaml` (`careto-backend-vapid` and
`careto` by default) — the Helm `Deployment` only reads the secret if its
name and namespace match.

Rotating the keypair invalidates every existing subscription; clients
re-subscribe automatically the next time they open the app (see
`apps/frontend/src/lib/push.ts`), so no coordinated rollout is needed.

## Testing

Every user-facing feature needs at least one Playwright e2e test — see
[`AGENTS.md`](../AGENTS.md) §4.2.

### Unit tests

```bash
npm run test
```

Runs the Vitest suites in both workspaces. No cluster required.

### Backend integration tests

The integration suite targets an already running backend deployment; it does not
start a server process of its own.

```bash
npm run test:integration -- http://careto.127.0.0.1.nip.io
```

Or via an environment variable:

```bash
BACKEND_BASE_URL=http://careto.127.0.0.1.nip.io npm run test:integration
```

Notes:

- The endpoint must expose `/api/health` and `/api/*`. The backend exposes
  health only on `/api/health`.
- Tests use unique emails and list names so they can run against the shared
  Minikube database.
- There is one test file per endpoint area: `auth/register`, `auth/login`,
  `auth/me`, `auth/me/image`, `auth/session/refresh`, `auth/session/logout`,
  `lists GET`, `lists POST`, `lists/:id`, `lists/:id/image`, members,
  invitations, push subscriptions, list items, dishes, and the week plan.

### End-to-end tests

Playwright also expects the app to already be running — the config has no
`webServer`.

```bash
npm run test:playwright -- http://careto.127.0.0.1.nip.io
```

## Command reference

```bash
npm run cluster:up
npm run cluster:build
npm run cluster:deploy
npm run telepresence:connect
npm run telepresence:frontend
npm run telepresence:backend
npm run telepresence:leave
npm run dev:frontend
npm run dev:backend
npm run dev
npm run dev:host
npm run seed
npm run build
npm run lint
npm run test
npm run test:integration -- http://careto.127.0.0.1.nip.io
npm run test:playwright -- http://careto.127.0.0.1.nip.io
```

## Repository structure

```text
apps/
  backend/            Express + TypeORM API
  frontend/           Vue 3 PWA
docs/
  adr/                architecture decision records
  specifications.md   canonical product spec
helm/
  careto/             chart deploying frontend, backend, and postgres
scripts/              cluster, dev, and tooling scripts
tests/
  e2e/                Playwright specs and page objects
```

## Where to go next

- [`AGENTS.md`](../AGENTS.md) — contribution methodology, ADR rules, and the
  checks to run before opening a pull request.
- [`specifications.md`](specifications.md) — the canonical product spec.
- [`adr/README.md`](adr/README.md) — the ADR process and index.
