# ADR-0030: Offline list edits — a saved outbox replayed in order, with the time of the tap

- **Status:** 🟢 accepted
- **Date:** 2026-11-27
- **Deciders:** Sthirs

## Context

[`docs/specifications.md`](../specifications.md) §Features says the app must
work offline and sync when the connection is restored, and §List says that
while offline members can still add, remove and mark items as bought, and that
those changes survive a reload and are sent in order, with the time they were
made.

The typical case: the list is open in the shop, the connection drops for a few
minutes, and the user keeps working on the list. Before this ADR:

- `useListItems` applied a change on screen, sent it, and rolled it back when
  the request failed, so every offline change was undone;
- no API data was kept on the device, so a reload while offline showed the
  load error. The app shell itself is already precached by the service worker
  ([ADR-0020](0020-web-push-notifications.md));
- the server stamps `last_bought_at` and the item event log
  ([ADR-0027](0027-recurring-products-and-auto-fill.md)) with the time the
  request arrives. Replaying offline changes later would shift those times,
  reorder "Last used", skew the learned intervals, and break the 5-minute
  mistaken-tap undo ([ADR-0024](0024-dishes-and-in-the-list-membership.md)).

Other forces:

- An Android PWA in the background is often killed and reloaded, so waiting
  changes must outlive the page.
- The deploy purge of [ADR-0016](0016-client-cache-lifecycle-on-deploy.md)
  clears Cache Storage and service workers, not `localStorage`.
- Requests go through the shared Axios instance, whose 401 refresh-and-retry
  ([ADR-0018](0018-refresh-token-rotation.md)) must keep working after a long
  offline period.
- [ADR-0017](0017-module-size-ceiling-and-split-convention.md) caps modules at
  250 lines.

## Decision

We will send every add, status change and removal of a list item through a
client outbox saved in `localStorage`, show the list as the server state with
the waiting changes applied on top, and replay the outbox in order with the
time of each tap in an `X-Occurred-At` header.

- **Outbox** (`apps/frontend/src/lib/offline/outbox.ts`), saved per user at
  `careto.outbox.<userId>`:
  - one op per tap: `add` (with a temporary item id), `status` or `remove`,
    with its list id and the time it was made;
  - ops are sent one at a time, in order, through the shared `api` instance,
    under a Web Lock so two tabs never send the same op;
  - success removes the op; an `add` rewrites the later ops of its temporary
    item to the real id;
  - no response, a timeout, a 5xx or a 429 keeps the op and retries with
    backoff (2 s doubling to 30 s), and on `online` and on returning to the
    foreground;
  - a 404 on `DELETE` means the item is already gone and counts as done; any
    other 4xx drops the op, and the list reloads from the server and says so;
  - the same path is used online and offline, so the order of a member's
    changes is always the order of their taps.
- **Derived view.** The list shows `applyPending(server items, waiting ops)`,
  a pure function that mirrors the server rules (an add reopens an item already
  on the list, a buy stamps `lastBoughtAt`, a removal drops the item). A
  dropped op therefore undoes itself, with no manual rollback.
- **On-device copies** (`apps/frontend/src/lib/offline/listSnapshot.ts`):
  the last loaded list and its items per user and list, the catalog, and the
  signed-in user. They are used only when the network fails, so the list and
  the router guard work on an offline cold start. Signing out clears them, the
  outbox included.
- **Time of the tap** (backend). The item `POST`, status `PATCH` and `DELETE`
  read an optional `X-Occurred-At` ISO header; a missing, invalid, future or
  more than 7 days old value means "now". That time is used for
  `last_bought_at`, `list_item_dishes.fulfilled_at`, the mistaken-tap check and
  the event's `at`. A header keeps the body whitelists of
  [ADR-0010](0010-account-name-update-endpoint.md) unchanged and works for
  `DELETE` too. The mistaken-tap check also requires the un-buy to come after
  the buy.
- **Replay is safe at least once.** Re-sending an add that already landed
  changes and logs nothing, re-sending a status the item already has returns
  early, and re-sending a removal answers 404. No other API change is needed.
- **Scope.** Icon and section overrides, dishes, the week plan, settings and
  the lists overview stay online-only.

## Alternatives considered

- **Workbox Background Sync and runtime caching of `/api` in the service
  worker.** Rejected: the page cannot see what is waiting, so it cannot show
  the changes or the offline state; there is no way to remap a temporary item
  id for later ops; and the cache is keyed by URL, not by user.
- **Client-generated item UUIDs instead of temporary ids.** Rejected: it would
  change the API of [ADR-0023](0023-default-item-catalog-and-list-items.md) for
  a remap that fits in a few lines on the client.
- **Merging waiting ops (for example dropping an add followed by a removal).**
  Rejected: the event log gives each step a meaning; an add then a removal
  holds the product back (ADR-0027), so the ops are replayed as tapped.
- **Recording the sync time.** Rejected: it shifts "Last used", the learned
  intervals and the mistaken-tap window by however long the device was offline.
- **IndexedDB.** Rejected for now: the outbox and a list are a few kilobytes,
  and `localStorage` is synchronous and already used with the same guards.

## Sources / Prior art

- [`docs/specifications.md`](../specifications.md) §Features (offline) and §List.
- [ADR-0016](0016-client-cache-lifecycle-on-deploy.md) (what the deploy purge
  keeps), [ADR-0018](0018-refresh-token-rotation.md) (refresh-and-retry,
  Web Locks), [ADR-0023](0023-default-item-catalog-and-list-items.md) (item API),
  [ADR-0024](0024-dishes-and-in-the-list-membership.md) (mistaken-tap grace),
  [ADR-0027](0027-recurring-products-and-auto-fill.md) (event log),
  [ADR-0017](0017-module-size-ceiling-and-split-convention.md) (module size).
- The "outbox" / offline-first queue pattern, and the Workbox Background Sync
  documentation: <https://developer.chrome.com/docs/workbox/modules/workbox-background-sync>.
- Web Locks API: <https://developer.mozilla.org/docs/Web/API/Web_Locks_API>.

## Consequences

- Positive: the list stays usable through short and long outages, and a
  reload; changes reach the server in order with their real times, so learning
  and "Last used" are unaffected.
- Positive: one code path for online and offline edits removes the race where
  a response overtook a later tap.
- Negative / trade-offs: the client mirrors a few server rules in
  `applyPending`; the server answer replaces the guess as soon as it arrives.
- Negative / trade-offs: another member's changes made while this device was
  offline show only after the reload that follows the sync.
- Negative / trade-offs: a client clock that is wrong shifts the recorded
  times, bounded by the 7-day window and "not in the future".
- Follow-ups (topics): offline overrides, dishes and week plan; live updates
  between members.
