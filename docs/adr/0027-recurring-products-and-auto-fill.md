# ADR-0027: Recurring products and auto-fill — item event log, derived habits, in-process job

- **Status:** 🟢 accepted
- **Date:** 2026-10-31
- **Deciders:** Sthirs (product owner), coding agent

## Context

The spec (§Learning and Planning) says the list fills itself from the user's buying habits:

- each recurring product has an interval in days;
- the interval is corrected only by user signals: manual additions and "have it";
- purchases made on the system's proposal do not measure how long a product lasts;
- dish consumption is separate from base consumption.

What the schema had before this ADR:

- `list_items.source` already had a `recurring` value
  ([ADR-0023](0023-default-item-catalog-and-list-items.md)), but no code wrote it;
- `list_items` keeps only `last_bought_at`, and removing an item deletes its row;
- the fulfilled `list_item_dishes` links ([ADR-0024](0024-dishes-and-in-the-list-membership.md)) are the only purchase history, and they cover dish purchases only.

So nothing records when a product ran out, or what happened to a product after it was removed.

The product owner decided the following for this first version:

- a product is added **as soon as it is due**: no shopping day and no batch;
- a stock lifetime is measured **from a purchase to the next hand add**, and it counts only once that add is bought;
- removing an item means **"not finished yet"**;
- the history is kept as an **event log**;
- the fill is done by a **backend job inside the API process**, debugged through its logs.

## Decision

We will log every list-item change in an append-only table. We will derive each product's habit from that log on every run, and run the auto-fill as a timer inside the backend process, guarded by a Postgres advisory lock.

### Event log

`list_item_events(id, shopping_list_id, catalog_item_key?, custom_item_id?, kind added|bought|unbought|removed, source user|dish|recurring, user_id?, at)`:

- schema by `synchronize` ([ADR-0004](0004-postgresql-and-schema-management.md));
- the same one-reference CHECK as `list_items`;
- indexes on `(list, reference, at)`;
- the list FK cascades; the user FK is `SET NULL`.

The table is keyed by the item's reference rather than its row, so the history survives a removal. `source` is why the item was to buy at that moment, following ADR-0024's meaning. A null `user_id` means the system acted.

What gets logged:

- `added`: when an add puts an item to buy (it is created, or reopened from bought), or when a hand add claims an item that is already to buy. A put-back from "Last used" after the 5-minute grace period is logged as `added`/`user`.
- `bought`: when an item goes from to buy to bought.
- `unbought`: an un-buy within the grace period, i.e. a mistaken tap.
- `removed`: when an item that is still to buy is deleted, and when the dish undo takes a dish item off (logged with source `dish`).

There is no backfill: lists start learning when this ships.

### Derivation

`deriveHabit` is a pure function over one product's events, in time order:

1. Each `unbought` cancels itself and the `bought` before it.
2. Events with source `dish` are ignored: dish consumption is not base consumption.
3. A **stock period** runs from one remaining purchase to the next. It gives at most one sample:
   - **exact**: from the purchase to the first `added`/`user` of the period, when the period ends with a buy;
   - **lower bound**, when there is no exact sample: from the purchase to the period's last `removed` ("not finished yet"), plus the snooze that removal caused.
4. A removal also cancels the period's pending hand add.
5. A purchase with source `recurring` starts a new period but measures nothing.
6. The **interval** is the median of the last 8 samples, in whole days, at least 1. A product needs at least 2 samples to count as recurring.
7. A removal **snoozes** the product for `max(1, round(interval × 25%))` days.
8. A product is **due** when `last purchase + interval ≤ now`, and it is not snoozed.

### Job

`runAutoFill(now)` takes `pg_try_advisory_lock` on a dedicated connection. If another replica holds the lock, the run is skipped. Inside the lock, for each list that has events:

- it calls `autoFillList`, which adds every due product that is not already to buy through `ensureListItem(…, 'recurring', null)` (so the add is logged too);
- a failing list is logged and skipped.

`index.ts` runs the job once at startup, after seeding, then every `AUTO_FILL_INTERVAL_MS` (default 1 h) with `setInterval(...).unref()`, outside `createApp()`. This follows the refresh-token pruning precedent of [ADR-0018](0018-refresh-token-rotation.md). `AUTO_FILL_ENABLED=false` turns the job off.

Logs:

- every run: `[auto-fill] run: lists=N filled=N`;
- each list it fills: `[auto-fill] list=<id> added=[keys]`.

Due dates are timestamps, so no time zone is involved.

### UI

A to-buy item with `source: 'recurring'` shows a repeat badge, "Added by the automatic planner", next to the existing dish badge. The API shape does not change.

### Tests

The integration and Playwright suites run against the deployed app ([ADR-0008](0008-testing-strategy.md)), so they can neither move the clock nor write to the database. Instead, the seeder rebuilds a demo list called "Dispensa" on every startup, with a back-dated history relative to now:

- two products with two 7-day lifetimes each, last bought 8 days ago, so both are due;
- one product bought only for dishes, which must never be filled.

The startup run fills the list, and both suites read it. The derivation and the job are covered by unit tests.

## Alternatives considered

- **Aggregates only**, i.e. one row of running state per product: smaller, but past events could never be reconstructed or recomputed when the rules change. Rejected by the product owner.
- **Fill once per shopping cycle**, from the day before a shopping day: it gives one review moment and a clean "skip this trip" meaning for "have it". It needs a per-list shopping day and time zone, and it leaves mid-week trips without the due items. The product owner chose "as soon as due" and left the shopping day for later.
- **Measure from purchase to purchase**: cleaner timestamps, but it includes the days the product was already finished, so the fill would lag one cycle behind.
- **Kubernetes CronJob** with the same image and a separate entrypoint: kept apart from API traffic, but it needs a new Helm template, its own DB bootstrap and a pod start per run, and the seeded e2e data would have to trigger it. Rejected for an in-process timer.
- **Fill when a member opens the List**: no job and no lock, but nothing is added until someone looks. Rejected because the product owner chose a job.

## Sources / Prior art

- [`docs/specifications.md`](../specifications.md) §Learning and Planning (base vs dish consumption, user signals, purchases on proposal) and §List (items keep how they were added and when they were last bought).
- [ADR-0023](0023-default-item-catalog-and-list-items.md): `list_items` and its `source` values; a removal deletes the row.
- [ADR-0024](0024-dishes-and-in-the-list-membership.md): `source` means why the item is to buy now; the 5-minute mistaken-tap window; fulfilled links as dish-purchase history.
- [ADR-0004](0004-postgresql-and-schema-management.md): schema by `synchronize`.
- [ADR-0018](0018-refresh-token-rotation.md): an in-process `setInterval` job started from `index.ts`.
- [ADR-0017](0017-module-size-ceiling-and-split-convention.md): the new logic lives in its own modules (`itemEvents.ts`, `recurrence.ts`, `autoFill.ts`) to keep `listItemMutations.ts` under the ceiling.
- PostgreSQL documentation, "Advisory Locks" (`pg_try_advisory_lock`, session-level locks on a single connection).
- Survival analysis practice of treating "still alive at time t" as a right-censored observation. The lower-bound sample is a simple stand-in for it.

## Consequences

- Positive:
  - the full history is kept, so the rules can change later and be recomputed without data loss;
  - dish purchases never distort base consumption;
  - the fill happens without anyone opening the app;
  - the job is safe with several backend replicas and is observable through its logs.
- Negative / trade-offs:
  - one event row per list-item change, which grows without bound;
  - every run re-reads each list's full history;
  - an event is written after the change it records, outside a transaction, so a crash in between loses that one event;
  - the lower-bound sample is a heuristic, not a statistical estimate.
- Follow-ups:
  - event retention, or a per-product summary, once history size matters;
  - the shopping day and the week plan proposal from §Week plan;
  - a "list is ready" or "due items" notification;
  - quantities from dish ingredients;
  - learning which dishes the user likes, from the same log.
