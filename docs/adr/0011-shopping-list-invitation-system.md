# ADR-0011: Shopping list invitation system — email-keyed pending invitation with accept/decline lifecycle

- **Status:** 🟢 accepted
- **Date:** 2026-08-15
- **Deciders:** Sthirs

## Context

The specification requires that users can create shopping lists and invite other users to join via email, whether or not the invitee has registered yet ([`docs/specifications.md`](../specifications.md) §Features). The invitee's display name and id must NOT be shared with the inviter or the list until the invitee accepts; the invitee can accept or decline, and the inviter can cancel an unaccepted invitation.

A plain "add member by email" that only looks up an already-registered user cannot satisfy this: it fails for unregistered emails, and it reveals the invitee immediately. There must be an intermediate pending state.

[`ADR-0005`](0005-authentication-and-identity.md) captures the authentication and identity decision (JWT local auth + OIDC PKCE provider registry), which defines the user-creation paths that a deferred-attach hook must integrate with. [`ADR-0010`](0010-account-name-update-endpoint.md) provides the style reference for this record; it also cites the `oauthService.ts` attach-point that is relevant here.

## Decision

We will use an email-keyed `Invitation` entity (with `status: 'pending' | 'accepted' | 'declined'`, a `shopping_list_id` FK, an `inviter_id` FK, a NULLABLE `invitee_id` FK, an `invitee_email` snapshot string, and created/updated timestamps) plus an `invitationService.ts` exposing `createInvitation`, `acceptInvitation`, `declineInvitation`, `cancelInvitation`, `listPendingForInvitee`, and `attachPendingInvitationsForEmail`, along with accept/decline/cancel routes:

- `POST /api/lists/:id/invitations/:invitationId/accept`
- `POST /api/lists/:id/invitations/:invitationId/decline`
- `DELETE /api/lists/:id/invitations/:invitationId`

`POST /api/lists/:id/members` CREATES an invitation (returning `201 { invitation }`, email-only, never `displayName`); the invitee's `displayName` and `id` are absent from `members` until the invitation is `accepted`. A deferred-attach hook (`attachPendingInvitationsForEmail`) runs in `authService.register` and in the `oauthService.handleCallback` new-user-creation branch (after `userRepo.save(user)`), so invitations to not-yet-registered emails become visible once a matching user registers.

`GET /api/lists` returns an `invitations` array for the invitee alongside their shopping lists; `GET /api/lists/:id` includes a `pendingInvitations` array (email-only) for members.

## Alternatives considered

- **Alternative A: direct-add-without-invitation** — rejected. The UX implies acceptance, and name-hiding is impossible without an intermediate pending state.
- **Alternative B: registered-users-only with no deferred attach** — rejected. Invites must work for any email, attaching on later registration.
- **Alternative C: email-sending (SMTP/vendor)** — rejected. In-app only (plus OS push per [`ADR-0020`](0020-web-push-notifications.md)), no SMTP or vendor dependency.

## Sources / Prior art

- [`docs/specifications.md`](../specifications.md) §Features — invitation requirements.
- [`docs/adr/0005-authentication-and-identity.md`](0005-authentication-and-identity.md) — authentication and identity decision; defines the user-creation paths the deferred-attach hook must integrate with.
- [`docs/adr/0010-account-name-update-endpoint.md`](0010-account-name-update-endpoint.md) — focused-ADR style reference; cites the `oauthService.ts` attach-point relevant here.
- `apps/backend/src/services/oauthService.ts` — three-tier branching in `handleCallback` (existing identity, link-by-email, new user). The deferred-attach hook runs in the new-user branch after `userRepo.save(user)`.
- `apps/backend/src/entities/ShoppingList.ts` — the `shopping_list_members` join-table membership the `Invitation` entity complements.
- `apps/backend/src/controllers/shoppingList/` — the manual-validation pattern the invitation routes follow.
- [`docs/adr/0004-postgresql-and-schema-management.md`](0004-postgresql-and-schema-management.md) — `synchronize: true`, no migrations. The pending-uniqueness invariant is enforced at the service layer (a `WHERE status='pending'` check) rather than a native partial-unique index, because TypeORM `synchronize` does not emit partial indexes.

## Consequences

- Positive: email-keyed invites work for not-yet-registered users. An invitation to `foo@example.com` becomes visible to `foo` as soon as they register via any path (local or OAuth).
- Positive: name privacy until acceptance. The invitee's `displayName` and `id` are not shared with the inviter or the shopping list until the invitee accepts.
- Negative / trade-offs: `invitee_id` is NULL until the user exists. The deferred-attach hook must be maintained on every future user-creation path (local register, OAuth new-user branch). If a new user-creation path is added without the hook, invitations to that email will silently fail to attach.
- Negative / trade-offs: the pending-uniqueness invariant (one pending invitation per email per shopping list) is enforced at the service layer rather than a native partial-unique index. A race between two concurrent `createInvitation` calls for the same email and list could produce two pending rows until the service-layer check is hardened.
- Follow-ups: real email notifications for invitations (a separate ADR). Today invitations are in-app and push only.
- Follow-ups: native partial-unique index via a TypeORM migration if [`ADR-0004`](0004-postgresql-and-schema-management.md) is revisited and migrations are introduced.
- Follow-ups: removal of the deferred-attach hook if email-only registration is ever dropped and all users are guaranteed to exist at invite time.
