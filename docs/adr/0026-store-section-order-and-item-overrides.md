# ADR-0026: Store section order and per-item icon and section overrides

- **Status:** 🟢 accepted
- **Date:** 2026-10-29
- **Deciders:** Sthirs

## Context

[`docs/specifications.md`](../specifications.md) §List Settings says the user
can sort the store sections of a list. §List says each item to buy has a menu
to remove it, change its icon, or move it to another store section.

[ADR-0023](0023-default-item-catalog-and-list-items.md) already stores a
per-list order in `list_section_orders` and applies it when list items are read
(`getSectionOrder`). Nothing writes it yet. ADR-0023 lists the reorder endpoint
and the item ⋮ menu as follow-ups. It also keys icons by catalog slug in a
frontend map, and derives an item's section from its catalog item, or puts it
under `own-items` for a custom item.

The design canvas ("Careto", boards *List settings*, *Store sections*,
*Store sections · dragging*, *List*, *List · change item icon* and
*List · change item section*) shows:

- a Store sections screen with drag handles, arrow-key moves, a reset action
  and a Save order button;
- an item sheet with Change icon, Store section and Remove from list;
- an icon picker over the catalog icons, and a section picker over the 13
  catalog sections. "Own items" is not offered in either the order screen or
  the picker.

## Decision

We will store both overrides on the `list_items` row, and replace a list's
section order as a whole:

- **Section order.**
  - `GET /api/lists/:id/section-order` returns `{ sectionKeys }`, the list's
    effective order without `own-items`.
  - `PUT /api/lists/:id/section-order` takes `{ sectionKeys }`, which must be
    an exact permutation of the catalog section keys without `own-items`. It
    replaces the list's `list_section_orders` rows in one transaction.
  - `DELETE /api/lists/:id/section-order` deletes the rows, so the list falls
    back to the default order.
  - `own-items` is never stored, so it keeps following the placed sections.
- **Item overrides.**
  - `list_items.icon_key varchar(60) NULL` holds a catalog item key whose icon
    replaces the item's own. It has no foreign key: the icon map lives in the
    frontend, and an unknown key falls back to the usual icon.
  - `list_items.section_key varchar(40) NULL` references `catalog_sections`
    with `ON DELETE SET NULL`. When set, it replaces the item's section in the
    serialized `sectionKey`. The item's own section is sent as
    `defaultSectionKey`.
  - `PATCH /api/lists/:id/items/:itemId` accepts exactly one of `{ status }`,
    `{ iconKey }` or `{ sectionKey }`. A `null` value clears the override, and
    `own-items` is not a valid `sectionKey`.
  - Removing an item deletes its row, so its overrides go with it.
- **Drag and drop** is hand-written with pointer events on the row's grip, like
  the sheet drag of [ADR-0021](0021-motion-tokens-and-bottom-sheet.md). The grip
  also takes ArrowUp and ArrowDown.

## Alternatives considered

- **Overrides keyed by list and catalog item or custom item** in their own
  table, so they survive removing and re-adding an item. This was rejected for
  now: it needs another table and join, and the user chose the simpler rule.
- **Section on `list_custom_items`** for custom items only. This was rejected
  because the design lets any item change section, and one column on
  `list_items` covers both kinds.
- **Reorder through one `PATCH` per moved section.** This was rejected because
  a full replace is idempotent and needs no position arithmetic on the server.
- **A drag-and-drop library** such as SortableJS. This was rejected because
  one sortable list does not justify a dependency, and HTML5 drag and drop does
  not fire on touch screens.

## Sources / Prior art

- [`docs/specifications.md`](../specifications.md) §List, §List Settings.
- [ADR-0023](0023-default-item-catalog-and-list-items.md): `list_section_orders`
  and the follow-ups this ADR closes.
- [ADR-0019](0019-browser-back-as-dismiss-and-up-navigation.md): the item sheet
  is a routed overlay.
- [ADR-0021](0021-motion-tokens-and-bottom-sheet.md): bottom sheet and
  hand-written pointer drag.
- WAI-ARIA Authoring Practices, the radio group and listbox patterns used by the
  section and icon pickers.

## Consequences

- Positive: the list sorts the way the user walks through the shop, and a
  wrongly filed or badly drawn item can be fixed in place.
- Negative / trade-offs: an override is lost when the item is removed and added
  again. Overrides are per list item, so the same catalog item can look
  different in two lists.
- **Schema change.** With `DB_SYNC=true`, the default per
  [ADR-0004](0004-postgresql-and-schema-management.md), TypeORM adds the
  columns on startup. Where an operator runs with `DB_SYNC=false`, run this
  once, before deploying:

  ```sql
  ALTER TABLE list_items
    ADD COLUMN icon_key varchar(60) NULL,
    ADD COLUMN section_key varchar(40) NULL
      REFERENCES catalog_sections(key) ON DELETE SET NULL;
  ```

- Follow-ups (topics): renaming a custom item from the item menu; remembering
  overrides after an item is removed.
