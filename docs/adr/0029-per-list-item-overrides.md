# ADR-0029: Item icon and section overrides kept per list item, not per list row

- **Status:** 🟢 accepted
- **Date:** 2026-11-01
- **Deciders:** Sthirs

## Context

[ADR-0026](0026-store-section-order-and-item-overrides.md) stores the icon and
store section a member chooses for an item on its `list_items` row. The row is
the item's *entry* on the list, so:

- dish ingredients (`dish_ingredients`, [ADR-0024](0024-dishes-and-in-the-list-membership.md))
  reference the catalog or custom item directly and never see the choice. A
  custom item whose icon and section were changed on the list shows the tag
  icon and "Own items" in the dish form, so it looks like a different item;
- the search shows the item's default icon;
- removing the item deletes the row and its overrides, so adding it again
  brings back the default icon and section.

This was reported as a bug. ADR-0026 had rejected "overrides keyed by list and
catalog item or custom item" for simplicity, and listed "remembering overrides
after an item is removed" as a follow-up. [`docs/specifications.md`](../specifications.md)
§List now says the chosen icon and section show wherever the item appears in
that list and are kept when the item is removed and added again.

## Decision

We will store overrides per item in a list, in their own table, and stop
writing them on `list_items`. This supersedes the *Item overrides* storage rule
of ADR-0026; its section order, API shape and drag-and-drop decisions stand.

- **Table** `list_item_overrides`: `shopping_list_id` (cascade), exactly one of
  `catalog_item_key` (cascade) or `custom_item_id` (cascade), `icon_key
  varchar(60) NULL`, `section_key varchar(40) NULL` referencing
  `catalog_sections` with `ON DELETE SET NULL`. Unique per list and catalog
  item, and per list and custom item — the same references as `list_items`
  and `dish_ingredients`. A row that overrides nothing is deleted.
- **API.** `PATCH /api/lists/:id/items/:itemId` with `{ iconKey }` or
  `{ sectionKey }` is unchanged; it writes the override of the row's item.
  List items keep `sectionKey`, `defaultSectionKey` and `iconKey`.
  `GET /api/lists/:id/items` also returns `overrides`, every override of the
  list, so the search can show them. Dish ingredients gain `iconKey` and
  `defaultSectionKey`, and their `sectionKey` takes the override.
- **Removing** an item from the list keeps its override.
- **Existing data.** On startup the backend copies any override still on
  `list_items` into the new table and clears the old columns, in one
  transaction; it is idempotent. The `list_items.icon_key` and
  `list_items.section_key` columns stay, deprecated, so `DB_SYNC` does not
  drop them before the copy.

## Alternatives considered

- **Keep overrides on `list_items` and mirror them onto dish ingredients while
  the item is on the list.** Rejected: an ingredient not on the list would
  still look like a different item, and overrides would still be lost on
  removal.
- **Columns on `list_custom_items`.** Rejected, as in ADR-0026: catalog items
  can be overridden too, and catalog items have no per-list row.
- **Overrides on `dish_ingredients` as well.** Rejected: two copies of one
  choice would drift apart.

## Sources / Prior art

- [`docs/specifications.md`](../specifications.md) §List, §Dishes.
- [ADR-0026](0026-store-section-order-and-item-overrides.md): the rejected
  alternative and follow-up this ADR takes up.
- [ADR-0023](0023-default-item-catalog-and-list-items.md) and
  [ADR-0024](0024-dishes-and-in-the-list-membership.md): the catalog / custom
  item reference pair used by list items and dish ingredients.
- [ADR-0004](0004-postgresql-and-schema-management.md): `DB_SYNC` and no
  migrations.

## Consequences

- Positive: an item looks the same on the list, in the search and in its
  dishes, and a choice survives removing and re-adding the item.
- Negative / trade-offs: one more table and one more query when reading list
  items and dishes. Overrides of items no longer used in a list stay until the
  list (or the custom item) is deleted.
- **Schema change.** With `DB_SYNC=true` TypeORM creates the table on startup.
  Where an operator runs with `DB_SYNC=false`, run this once, before deploying:

  ```sql
  CREATE TABLE list_item_overrides (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shopping_list_id uuid NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    catalog_item_key varchar(60) NULL REFERENCES catalog_items(key) ON DELETE CASCADE,
    custom_item_id uuid NULL REFERENCES list_custom_items(id) ON DELETE CASCADE,
    icon_key varchar(60) NULL,
    section_key varchar(40) NULL REFERENCES catalog_sections(key) ON DELETE SET NULL,
    CONSTRAINT "CHK_list_item_overrides_one_reference"
      CHECK ((catalog_item_key IS NULL) <> (custom_item_id IS NULL))
  );
  CREATE UNIQUE INDEX "UQ_list_item_overrides_list_catalog_item"
    ON list_item_overrides (shopping_list_id, catalog_item_key);
  CREATE UNIQUE INDEX "UQ_list_item_overrides_list_custom_item"
    ON list_item_overrides (shopping_list_id, custom_item_id);
  ```

- Follow-ups (topics): dropping the deprecated `list_items.icon_key` and
  `list_items.section_key` columns and the startup copy once every deployment
  has run it; changing an item's icon or section from the dish form.
