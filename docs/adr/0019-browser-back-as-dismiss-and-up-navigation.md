# ADR-0019: Browser Back as dismiss-or-go-up, via history pops and routed overlays

- **Status:** 🟢 accepted
- **Date:** 2026-09-10
- **Deciders:** Sthirs

## Context

Without a deliberate design, the browser Back button fights the app. When every
topbar back arrow and every post-save / post-delete exit is a forward
`router.push`, "going back" *grows* the history stack:

> /lists → /lists/:id → /lists/:id/settings → /lists/:id     (4 entries)

One Back press from the last entry re-enters the page the user has just left.
Separately, a modal or picker opened and closed via a local `ref(false)` is
invisible to the router and the History API: Back does not close it, it navigates the browser away from the page underneath it.

The app is an installable PWA ([`docs/specifications.md`](../specifications.md)),
and on Android the system Back button — not an in-app control — is the primary
navigation affordance. This is a correctness issue on the app's main target
platform, not a desktop convenience.

**Intended outcome**, as the user stated it: "when I press the back button of
the browser: if there is a modal open then close it, if there is a back button
in the top bar then trigger it." The two behaviours must be *the same*
operation, not one imitating the other with a `popstate` listener.

## Decision

We will make a logical "back" a real history pop, and represent every
dismissable overlay as route state, so the browser Back button and the app's
own back affordances are literally the same navigation. This needs two
distinct pop primitives, because one back arrow (Account) is reachable from
everywhere in the app rather than from one fixed parent.

1. **`goBackTo(router, target)`** in `apps/frontend/src/lib/backNavigation.ts`
   pops history (`router.back()`) when the previous entry
   (`router.options.history.state.back`) already resolves to `target`, and falls
   back to `router.replace(target)` — never `router.push` — otherwise, so the
   stack never grows on the way "back." This is for back arrows whose parent is
   fixed by the route tree, and for post-save / post-delete exits that share the
   same target: list detail (target `shoppingLists`) and list settings (target
   `list-detail`).
2. **`goBackOr(router, fallback)`**, also in `lib/backNavigation.ts`, pops
   whenever there is *any* previous entry (`state.back` is non-null), and
   `replace`s with `fallback` only when there is none. This is for Account:
   it is reachable from every screen via the avatar in the global topbar
   (`components/AppTopbar.vue`), so "the previous entry" is whatever screen the
   user actually came from, not always `/lists`. Account's back arrow therefore
   uses the generic `common.back` label.
3. **`useRoutedOverlay(id)`** in `apps/frontend/src/composables/useRoutedOverlay.ts`
   represents one dismissable overlay as `?overlay=<id>` on the current route.
   `open()` pushes the query param (same route record, so the component is
   reused, not remounted); `close()` pops the entry it owns or replaces if the
   page was loaded with the overlay already open; `closeBeforeLeaving()` always
   replaces, for the case where the overlay's own entry must be dropped before a
   further pop (for example a delete-confirm panel). Only one overlay is
   representable at a time.
4. No `popstate` listener anywhere, and no raw History API beyond what
   vue-router already wraps. All navigation stays declarative through the
   router.

The net effect: the topbar back arrows, Account's avatar-reachable back arrow,
and the browser Back button all resolve to a `router.back()` call whenever there
is a previous entry to pop, and an open overlay is closed by a Back press
because closing it *is* a pop of the entry that opening it pushed.

## Alternatives considered

- **Intercept `popstate`, or cancel the navigation in a global `beforeEach`
  guard, and invoke the current view's back handler.** Rejected: it fights the
  browser instead of using it, vue-router's navigation guards cannot reliably
  distinguish a user-initiated history pop from a programmatic navigation, and
  the resulting behaviour is effectively untestable.
- **An invisible same-URL sentinel entry**, pushed with
  `router.push({ force: true, state: { overlay: id } })`. Rejected for a
  structural reason: a sentinel entry has an *identical* URL to the entry
  beneath it, so `goBackTo`'s `state.back === router.resolve(target).fullPath`
  comparison becomes true for the sentinel itself as well as for the real
  target, and popping would re-open the overlay instead of leaving the page. It
  also loses deep-linkability.
- **A blind `router.back()` everywhere**, with no target check at all.
  Rejected: `LoginView.vue` pushes the post-login redirect target, so a user who
  deep-links into a page while logged out has `state.back === '/login'`. A blind
  pop would land on `/login`, which the `meta.guestOnly` guard then bounces to
  `/lists` — the wrong screen, reached by two hops instead of one intentional
  `replace`.
- **`router.replace` on every logical-back exit, unconditionally.** Rejected: it
  leaves a dead Back press — two consecutive history entries render the same
  screen — and discards the entry that legitimately came after the current one.
- **Trap Back entirely when there is no history to pop** (a deep link in a fresh
  tab). Rejected: Back must still be able to leave the site, so the fallback is
  `replace` to the logical parent, not a trap.

## Sources / Prior art

- [`ADR-0017`](0017-module-size-ceiling-and-split-convention.md): the 250
  pure-LOC ceiling is why this logic lives in two single-responsibility
  modules rather than inline in the views.
- [`ADR-0008`](0008-testing-strategy.md): the Vitest-unit-plus-Playwright model
  this change follows (Vitest for `goBackTo`/`goBackOr`/`useRoutedOverlay`,
  Playwright for the browser Back button itself in
  `tests/e2e/navigation/back-button.spec.ts`).
- vue-router's web history implementation (`buildState`, `push`, `replace`):
  `push` writes `back` as a plain fullPath string on the new entry, while
  `replace` *preserves* the existing entry's `back` value. This is why the
  `state.back === resolve(target).fullPath` comparison is sound, and why falling
  back to `replace` never corrupts a later pop's view of what came before.
- vue-router's `createMemoryHistory` does **not** populate `back`, `current`,
  `forward`, or `position`, which is why the unit tests for
  `goBackTo`/`goBackOr` use a hand-rolled fake router.
- `Router.back(): void` is fire-and-forget, unlike `push`/`replace` which return
  a `Promise`.
- The user's stated rule, verbatim: "when I press the back button of the
  browser: if there is a modal open then close it, if there is a back button in
  the top bar then trigger it."

## Consequences

- Positive: two small, targeted rules replace hand-written forward-push exits,
  so the topbar back arrows and the browser Back button are the same history
  operation rather than behaviours kept in sync by hand.
- Positive: overlays are deep-linkable (e.g. `/lists/:id?overlay=date`).
- Positive: Back and Escape are the same gesture for every overlay.
- Negative / trade-offs: URLs carry transient UI state (`?overlay=…`) that has
  no meaning once the overlay closes. Only one overlay is representable at a
  time, enforced structurally: the overlay query key is single-valued, and
  `open()` must `replace` rather than `push` when a *different* overlay is
  already open on the same route, keeping at most one history entry per route
  for the whole overlay layer.
- Negative / trade-offs: `router.back()` is fire-and-forget, so a fast
  double-tap could pop two entries. A `popPending` latch is therefore mandatory:
  it is set before calling `router.back()` and cleared by a lazily-installed
  `router.afterEach`, which fires even on failed or aborted navigations, so the
  latch can never get stuck open.
- Negative / trade-offs: each component that opens an overlay needs a router in
  its unit tests, and a component mounted twice on one page needs a distinct
  overlay id per instance.
- Negative / trade-offs: scroll position is not restored across a pop. No
  `scrollBehavior` is configured on the router, and the app scrolls inner
  `overflow-y-auto` containers rather than the window.
- Negative / trade-offs, accepted deliberately: after a pop from a successful
  *delete* that went through a routed confirm overlay, a forward or back entry
  may point at a now-deleted resource; the page must degrade to its "not found"
  state rather than break. The alternative — `replace` instead of pop after a
  delete — leaves a duplicate entry and a dead-feeling Back press.
- Follow-ups, by topic: whether an overlay stack or nesting is ever needed;
  whether `authStore.logout()` should `replace` rather than `push` `/login`; and
  a router `scrollBehavior` using `savedPosition`.
