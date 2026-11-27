# ADR-0031: Offline replay — the latest tap wins, a change overtaken by a later one is refused

- **Status:** 🟢 accepted
- **Date:** 2026-11-27
- **Deciders:** Sthirs

This ADR replaces two points of
[ADR-0030](0030-offline-list-edits-outbox.md): **"Replay is safe at least
once"**, and the unbounded retry of a change that gets no answer, a 5xx or a
429. The rest of ADR-0030 stays as it is.

## Context

[ADR-0030](0030-offline-list-edits-outbox.md) sends each queued list change
with the time of the tap in the `X-Occurred-At` header. When a request fails
without an answer, the outbox keeps the change and sends it again. ADR-0030
said such a resend is safe: an add that already landed changes nothing, a
status the item already has returns early, and a removal answers 404.

That only holds when nobody else changes the item between the first attempt
and the resend. Review of the ADR-0030 change found two cases where it does
not hold:

1. Anna adds milk. The add lands, but her phone never gets the answer.
   Ben then buys the milk. Anna's phone resends the add. The server sees a
   bought item and puts it back to buy: Ben's purchase is undone, and the
   event log shows an add *before* the buy.
2. Anna buys milk. The buy lands, but the answer is lost. Ben puts the milk
   back to buy. Anna's resend buys it again, dated at her old tap, and closes
   the dish needs that Ben's put-back opened.

The server cannot tell a resend from a new tap: it only looks at the item's
current status.

A third, related case is a genuine offline tap that reaches the server after
another member's later change. Anna, offline, removes the milk at 10:00; Ben,
online, buys it at 10:01; Anna syncs at 10:10. Her removal is older than Ben's
buy, so it should not undo it either.

A fourth case is a change that can never land. ADR-0030 retries a change with
no answer, a 5xx or a 429 forever, in order. A change the server keeps failing
on, for example because a row it refers to was deleted meanwhile, then blocks
every later change of the member, on every list. A phone offline for a week
would also replay week-old taps, although the offline mode is meant for
outages of minutes or hours (a shop with a weak connection).

The item event log ([ADR-0027](0027-recurring-products-and-auto-fill.md)) already
holds, per list and product, every add, buy, un-buy and removal with its time,
and is indexed on `(shopping_list_id, catalog_item_key | custom_item_id, at)`.
It is kept by product, not by item row, so it survives a removal.

## Decision

We will refuse a list change that a later change of the same item has
overtaken: **the latest tap wins**.

- The item `POST` (add), the status `PATCH` and the `DELETE` read the time of
  the change as before (`X-Occurred-At`, or now). Before they change anything,
  they look up the latest event of the same product on the list. If that event
  is **strictly later** than the time of the change, the request changes
  nothing, writes no event and answers **409 Conflict**.
- An equal time is not later. The resend of a change that already landed
  therefore passes this check, and the existing checks of ADR-0030 make it a
  no-op, as before.
- A request without the header is dated now, so it is never refused.
  System changes (auto-fill, dishes) are dated now and are not checked.
- The check runs only after the existing early returns (a status the item
  already has answers 200 with the item, as before).
- The outbox treats the 409 like any other refusal: it drops the change and
  the later changes of an item whose add was refused, and the list reloads.
  The list says "Someone changed an item after you, so your older change was
  skipped." instead of the generic message.
- Unexpected server failures (for example the database being down) answer
  **500**, not 400, on the list-item endpoints. Only known domain errors are
  4xx (not found → 404, overtaken → 409). The outbox retries a 5xx and drops a
  4xx, so an outage must never look like a refusal.
- A database error that fails the same way on every retry is a 4xx, not a
  500: a foreign-key violation (a row the change refers to is gone) answers
  404, and invalid input (`22P02`, `23502`, `23514`, `22001`) answers 400.

### Retry limits

- A change still waiting **one hour** after its tap, measured on the phone's
  own clock, **expires**: the outbox drops it unsent, with the later changes
  of an item whose add expired, whether the phone is online or not. The list
  reloads and says "Changes made offline more than an hour ago were
  discarded, so the list was reloaded."
- A change that gets **10 answered server errors** (5xx or 429) in a row is
  dropped like a refusal, so one change the server keeps failing on never
  blocks the others for long. A request with no answer at all (offline, a
  timeout) counts only against the one-hour limit. The count is kept in
  memory, so a reload starts it over.
- The server keeps the 7-day window of ADR-0030 for `X-Occurred-At`; with the
  one-hour limit, a header older than that only comes from a wrong phone
  clock, for which "now" is the right answer.

## Alternatives considered

- **A durable operation id (`X-Op-Id`) the server stores and checks.** It
  catches exact resends and nothing else. Rejected for now: it needs a new
  table or column, it does not cover the genuine offline tap that arrives
  after another member's later change (the third case), and the event log already has
  what the time check needs.
- **Both an operation id and the time check.** Rejected for now: the time
  check alone covers the reported cases; an id can be added later if clock
  problems show up in practice.
- **Keep the status check and narrow the ADR-0030 guarantee in writing.**
  Rejected: it accepts that a lost answer can undo another member's purchase,
  which is the core case the offline mode is for (a shop with a weak
  connection).
- **Answer 200 with the current item instead of 409.** Rejected: the outbox
  would count the change as done and the member would never learn that their
  tap had no effect.

## Sources / Prior art

- [`docs/specifications.md`](../specifications.md) §List (offline changes).
- [ADR-0030](0030-offline-list-edits-outbox.md) (outbox, `X-Occurred-At`,
  replay), [ADR-0027](0027-recurring-products-and-auto-fill.md) (item event
  log and its indexes), [ADR-0024](0024-dishes-and-in-the-list-membership.md)
  (dish needs closed by a buy).
- Review of the ADR-0030 change (pull request #51), which found the two
  replay cases, and a later review of this branch, which found the blocked
  queue and the week-old replay.
- "Last writer wins" conflict resolution by timestamp, as used by offline-first
  sync systems (for example CouchDB/PouchDB revision winners and CRDT LWW
  registers), and HTTP 409 Conflict (RFC 9110 §15.5.10) for a request that
  conflicts with the current state of the resource.

## Consequences

- Positive: a lost answer can no longer undo another member's later change;
  the event log never gets an event dated before the change it undid; a
  member is told when an old offline change was skipped.
- Positive: a database outage during a replay is retried instead of dropping
  the member's queued changes.
- Positive: one failing change can no longer block the outbox for good, and
  stale taps from a long offline period never reach the server.
- Negative / trade-offs:
  - The rule trusts the phone's clock. A phone whose clock is behind dates
    its taps early, so a change another member made in that gap wins over it.
    The server still ignores future times and times older than 7 days
    (ADR-0030).
  - Two changes with exactly the same millisecond both apply, in the order
    they reach the server.
  - When an add made offline is refused, the later offline changes of that
    item are dropped with it.
  - One more indexed read per list change.
  - A member offline for more than an hour loses the changes made at the
    start of the outage; the list says so and shows the server state.
  - A database outage longer than about four minutes of retries (10 answered
    server errors) drops the change at the head of the queue as refused.
- Follow-ups: if clock skew proves a problem, a follow-up ADR on sending the
  age of the change (measured on the phone's own clock) instead of an absolute
  time, or on adding an operation id.
