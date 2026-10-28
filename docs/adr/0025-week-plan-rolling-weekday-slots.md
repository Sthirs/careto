# ADR-0025: Week plan — one rolling plan per list, slots keyed by weekday

- **Status:** 🟢 accepted
- **Date:** 2026-10-28
- **Deciders:** Sthirs

## Context

The Week section ([`docs/specifications.md`](../specifications.md) §Week plan)
is a collection of days with a lunch and a dinner slot, each empty or holding a
dish. When the user adds the plan to the list, the ingredients of the planned
dishes are added.

The design canvas ("Careto", boards *Week*, *Week · choose a dish* and
*Week · search a dish*) shows Monday to Sunday with no week navigation, a
"{n} of 14 meals planned" count, a **New plan** action that clears every slot
(with undo), and an **Add ingredients to list** button.

How people use it: before going shopping they fill the week and add it to the
list. During the week they read the menu. Before the next shopping they fill
it again. There is no shopping-day setting yet, and the shopping day slips in
practice.

[ADR-0024](0024-dishes-and-in-the-list-membership.md) already gives one service
that adds a dish to the list, and notes that the Week plan should reuse it.

## Decision

We will keep **one rolling week plan per list**: rows in `week_slots`, keyed by
weekday and meal, that stay until a member changes them or starts a new plan.

- **Schema** (TypeORM `synchronize`,
  [ADR-0004](0004-postgresql-and-schema-management.md)):
  `week_slots(id, shopping_list_id, weekday 1–7 (ISO, Monday = 1),
  meal 'lunch'|'dinner', dish_id, created_at, updated_at)`.
  - Unique on `(shopping_list_id, weekday, meal)`.
  - Both FKs `ON DELETE CASCADE`: deleting a dish empties its slots.
  - An empty slot is the absence of a row.
- **API** (members only,
  [ADR-0003](0003-backend-stack.md)):
  - `GET /lists/:id/week` → `{ slots: [{ weekday, meal, dishId }] }`.
  - `PUT /lists/:id/week/slots` `{ weekday, meal, dishId | null }` — set or
    empty one slot. The dish must belong to the list. The slot is in the body,
    not the path, because every path id is checked for UUID shape.
  - `PUT /lists/:id/week` `{ slots }` — replace the whole plan. **New plan**
    sends `[]`, and its undo sends the previous slots back.
  - `POST /lists/:id/week/list` — for each distinct planned dish, call the
    ADR-0024 add-dish service. A dish already in the list is unchanged, so
    pressing it again is harmless. The plan itself is not changed.
- **Frontend:** the Week section
  ([ADR-0022](0022-list-sections-as-siblings-back-to-lists.md)) replaces the
  placeholder. The dish picker and the New plan confirmation are routed
  bottom-sheet overlays
  ([ADR-0019](0019-browser-back-as-dismiss-and-up-navigation.md),
  [ADR-0021](0021-motion-tokens-and-bottom-sheet.md)).

## Alternatives considered

- **Dated plans per calendar week.** Rejected for now: the screen would empty
  itself every Monday regardless of when the user shops, and past weeks would
  need cleanup or history views nobody asked for.
- **Dated plans anchored to the shopping day.** Rejected for now: needs the
  shopping-day setting (§List Settings), which does not exist, and is rigid
  when the shopping day moves.
- **Clear the plan once all its ingredients are bought.** Rejected: the menu
  would disappear right when it is needed for cooking.
- **A "confirmed" stamp on the plan.** Rejected: the button only confirms each
  tap for a moment ("Adding…", then "Added to the list") and keeps no
  confirmed state; ADR-0024 already makes repeated adds harmless.
- **A batch add-dishes endpoint with one transaction.** Not needed: looping over
  the existing service keeps one code path; ADR-0024's known trade-off (no
  transaction) applies unchanged.

## Sources / Prior art

- [`docs/specifications.md`](../specifications.md): §Week plan, §List Settings
  (shopping day, slots per day), §Dishes.
- [ADR-0024](0024-dishes-and-in-the-list-membership.md): add-dish service,
  `source='dish'`, and the note that the Week plan reuses it.
- [ADR-0003](0003-backend-stack.md), [ADR-0004](0004-postgresql-and-schema-management.md),
  [ADR-0019](0019-browser-back-as-dismiss-and-up-navigation.md),
  [ADR-0021](0021-motion-tokens-and-bottom-sheet.md),
  [ADR-0022](0022-list-sections-as-siblings-back-to-lists.md).
- Design canvas "Careto", boards *Week*, *Week · choose a dish*,
  *Week · search a dish*, *List* (dish badge on list items).
- The user's decisions in planning: rolling plan with an explicit New plan, add
  every planned dish, no confirmed state on the button.

## Consequences

- **Positive:**
  - The plan matches how people shop: fill, add, cook, start over.
  - No dates, no cleanup job, no dependency on settings that do not exist.
  - Adding reuses the dish service, so list items get `source='dish'` and
    links exactly as when adding a dish from the Dishes screen.
- **Negative / trade-offs:**
  - No history of past plans.
  - Undoing a new plan rewrites the whole plan, so a concurrent edit by another
    member in the undo window is lost.
  - Adding the plan is not atomic; a failure halfway leaves some dishes added.
    Pressing the button again repairs it.
- **Production DDL** (prod runs `DB_SYNC=false`): create `week_slots` with its
  unique index and FKs before deploying, generated with `typeorm schema:log`
  against a scratch database.
- **Follow-ups (topics):**
  - proposing a plan the day before the shopping day, by rotation (§Week plan);
  - one or two slots per weekday (§List Settings);
  - real-time sync of the plan between members.
