# ADR-0024: Dishes and "in the list" — derived from dish-to-item links, never stored

- **Status:** 🟢 accepted
- **Date:** 2026-10-26
- **Deciders:** Sthirs

## Context

The Dishes section ([`docs/specifications.md`](../specifications.md) §Dishes)
needs real dishes. The spec requires:

- a dish with a name, an optional image and a list of ingredients;
- adding a dish to the list, which adds its ingredients;
- pausing a dish until a date;
- remembering when each dish was last added.

The design canvas ("Careto", boards *Dishes*, *New dish* and *Dish*) splits
the screen into **In the list**, **Suggested** and **Paused**. It offers a ✓ on
an In-the-list card to take the dish off again.

The spec does not say when a dish is "in the list". Later features constrain
the answer:

1. **Week plan** (§Week plan) adds the ingredients of every planned dish when a
   plan is accepted. It proposes dishes by rotation and by the last time they
   were added. Two planned dishes can share an ingredient.
2. **Learning** (§Learning and Planning) must know *why* each item was bought.
   A purchase made for a dish must not shorten a recurring product's interval,
   and only manual additions and "have it" count as user signals.
3. **List items** ([ADR-0023](0023-default-item-catalog-and-list-items.md))
   appear at most once per list. Each one keeps a `source` of
   `user|dish|recurring`, which no code writes as `dish` yet.

The forces in tension:

- a stored "in the list" flag on the dish drifts as soon as a member buys or
  removes an item on the List screen;
- matching ingredients against the list by name would count a dish as "in the
  list" when a member added a shared ingredient by hand.

## Decision

We will link list items to the dishes that need them, and derive "in the list"
from those links.

- **Tables** (TypeORM entities, schema by `synchronize` per
  [ADR-0004](0004-postgresql-and-schema-management.md)):
  - `dishes(id, shopping_list_id, name, image_url?, paused_until date?,
    last_added_at?, previous_last_added_at?, created_by_id?)`. Deleting the
    list cascades.
  - `dish_ingredients(id, dish_id, catalog_item_key?, custom_item_id?,
    position)`. It has the same one-reference CHECK and per-dish uniqueness as
    `list_items`. A typed ingredient becomes a list custom item, as on the List.
  - `list_item_dishes(list_item_id, dish_id, fulfilled_at?)`. The PK covers both
    ids, and both FKs `ON DELETE CASCADE`. Each row means "this dish needs this
    item". The link stays **open** while `fulfilled_at` is null.
- **The rule.** A dish is *in the list* when it has at least one open link to a
  list item whose status is `to_buy`. The server computes this on every read
  and returns it as `inList`. Nothing stores it.
- **Add a dish** (`POST /lists/:id/dishes/:dishId/list`):
  - for each ingredient, ensure its list item is to buy. A new item gets
    `source='dish'`. An existing item keeps its `source` and goes back to
    `to_buy` if it was bought;
  - upsert the link with `fulfilled_at = null`;
  - set `last_added_at = now`, keeping the old value in
    `previous_last_added_at`.
- **Buy an item** (`PATCH …/items/:itemId` to `bought`): set `fulfilled_at` on
  every open link of that item.
  - When the last ingredient is bought, the dish leaves "in the list" on its own.
  - The fulfilled link stays as the reason behind the purchase, for Learning.
- **Add an item by hand**: no link is made, so no dish ever enters the list
  this way. If the dish is added later, the existing item is linked and keeps
  `source='user'`.
- **Remove an item** (swipe): its links cascade away.
- **Undo** (`DELETE /lists/:id/dishes/:dishId/list`):
  - delete the dish's open links;
  - then delete each linked item that is still `to_buy`, has `source='dish'`,
    and has no other open link;
  - restore `last_added_at` from `previous_last_added_at`.
  - items added by hand, and items another dish needs, stay.
- **Sections:**
  - *Suggested* is neither in the list nor paused. It is sorted by
    `last_added_at` ascending (never-added first), then by name. This is the
    rotation order the Week plan will reuse.
  - *Paused* means `paused_until` is after today. It is sorted by
    `paused_until`.
- **Edits** to a dish's ingredients do not change the list. They apply the next
  time the dish is added. **Deleting** a dish cascades its ingredients and
  links, and its items stay on the list.
- **Images** reuse the [ADR-0015](0015-image-upload-architecture.md) pipeline
  (`POST /lists/:id/dishes/:dishId/image`).
- **Navigation:**
  - Dishes is a list section
    ([ADR-0022](0022-list-sections-as-siblings-back-to-lists.md)).
  - New dish (`/lists/:id/dishes/new`) and Dish (`/lists/:id/dishes/:dishId`)
    are pushed from it. Their back arrow, Cancel, Save and Delete all
    `goBackTo` Dishes ([ADR-0019](0019-browser-back-as-dismiss-and-up-navigation.md)).
  - The pause and delete sheets are routed overlays.

## Alternatives considered

- **A stored `in_list` flag or status on the dish.** Rejected: buying or
  swiping an item on the List screen would leave it stale, unless every
  list-item mutation also rewrote dishes. Nothing would explain which items made
  it true.
- **"In the list" while any ingredient is on the list to buy, matched by
  reference.** Rejected:
  - an item added by hand would mark every dish that uses it;
  - undo could not tell the dish's items from the user's;
  - Learning would lose the reason behind each purchase.
- **"In the list" until a fixed time after the add (for example, a shopping
  week).** Rejected: it ignores what is actually bought, and the shopping day
  is a per-list setting that the Week plan has not built yet.
- **A single `dish_id` column on `list_items`.** Rejected: an item can be needed
  by several dishes at once, which is the normal case with a week plan.
- **Hint "3 of 5 ingredients on the list" on Suggested cards.** Rejected by the
  user. It adds noise, and the rule above already keeps manual items out.

## Sources / Prior art

- [`docs/specifications.md`](../specifications.md): §Dishes, §Week plan,
  §Learning and Planning (reasons behind purchases, user signals), §List
  (`source`, one item per list).
- [ADR-0023](0023-default-item-catalog-and-list-items.md): the item references,
  `source`, and `ensure`/re-add semantics reused here.
- [ADR-0015](0015-image-upload-architecture.md), which already names dish
  images as a reuse of its pipeline.
- [ADR-0019](0019-browser-back-as-dismiss-and-up-navigation.md) and
  [ADR-0022](0022-list-sections-as-siblings-back-to-lists.md): back navigation
  and routed overlays.
- [ADR-0004](0004-postgresql-and-schema-management.md): schema sync and manual
  production DDL.
- Design canvas "Careto", boards *Dishes*, *New dish*, *Dish* and *Default dish
  icons*.
- Relational modelling practice: a many-to-many association table that carries
  its own attribute (`fulfilled_at`), instead of a denormalised flag.
- The user's decisions in the design review: "In the list" and "Suggested"
  always visible with an empty text, at least one ingredient per dish, no
  partial-ingredients hint.

## Consequences

- **Positive:**
  - "In the list" always matches the actual list. Buying, swiping, undoing and
    adding by hand all behave predictably.
  - The Week plan can add each planned dish through the same service. Shared
    ingredients just get one link per dish.
  - Learning can tell dish purchases (fulfilled links) from base consumption.
- **Negative / trade-offs:**
  - Reading the Dishes screen needs one extra query over the open links.
  - Add and undo touch several rows without one transaction. A failure halfway
    can leave an item on the list without its link. The next add repairs it.
  - Editing a dish that is in the list does not update the list.
- **Production DDL** (prod runs `DB_SYNC=false`). Create `dishes`,
  `dish_ingredients` and `list_item_dishes` before deploying. Generate them with
  `typeorm schema:log` against a scratch database, so the CHECK and index names
  match the entities.
- **Follow-ups (topics):**
  - the Week plan proposal and acceptance, reusing the add-dish service and the
    Suggested order;
  - whether a later edit to a dish in the list should add its new ingredients;
  - real-time or offline sync of dishes between members.
