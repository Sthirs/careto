# ADR-0023: Default item catalog and list items — slug-keyed reference tables, labels in the frontend

- **Status:** 🟢 accepted
- **Date:** 2026-10-25
- **Deciders:** Sthirs

## Context

The List screen ([`docs/specifications.md`](../specifications.md) §List) needs
real items. The spec requires:

- a default catalog of common items, grouped by store section and translated;
- custom items that belong to one list only;
- a search over both;
- each item appearing at most once per list;
- per-list store-section order, with items sorted alphabetically inside a
  section;
- bought items kept as "Last used", with the time they were bought and how
  they were added.

The forces at play:

1. **Labels.** [`ADR-0014`](0014-internationalization-en-it.md) and the spec's
   Product Decisions say domain values are stable keys in code and in the API,
   and their labels are localized in the frontend catalogs. ADR-0014 explicitly
   rejects a backend-driven translation catalog.
2. **Source data.** The starting catalog is a third-party grocery catalog with
   English and Italian names: 13 store sections and about 390 items. Its
   identifiers are German words, which mean nothing in this product. It also
   holds a brand entry and two pairs of duplicates ("Mushrooms", "Tuna").
3. **Schema management.** Per [`ADR-0004`](0004-postgresql-and-schema-management.md)
   the schema comes from TypeORM entities with `synchronize`. Production runs
   `DB_SYNC=false`, and new tables are created by hand there.
4. **Module size.** [`ADR-0017`](0017-module-size-ceiling-and-split-convention.md)
   sets a 250-line ceiling. Only `en.ts`/`it.ts` are exempt.

## Decision

We will store the default catalog as reference data keyed by English kebab-case
slugs, keep every label in the frontend i18n catalogs, and model list contents
as one row per item per list.

- **Keys.**
  - Sections and items get slugs derived from their English name, for example
    `fruits-vegetables` and `cherry-tomatoes`. The German identifiers are dropped.
  - Duplicates are merged into one entry, and the brand entry is dropped.
  - A pseudo-section `own-items` holds custom items.
  - Keys are permanent once shipped. Renaming a label never changes its key.
- **Reference tables.**
  - `catalog_sections(key PK, position)` holds the default section order.
  - `catalog_items(key PK, section_key FK)` has no position column. Items sort
    on the client by their label in the active locale.
  - The source of truth is `apps/backend/src/services/catalog/` (one key file
    per section).
  - `syncCatalog()` upserts it on **every** backend start, independent of
    `SEED_ON_STARTUP`, because production needs the reference data too.
  - The sync never deletes rows, so items already on lists keep resolving.
- **Labels and icons.**
  - `catalog.sections.<key>` and `catalog.items.<key>` live in `en.ts`/`it.ts`,
    which are covered by the existing ADR-0017 exemption and the key-parity test.
  - A frontend test asserts that every backend key has a label in both locales.
  - Icons are a slug-keyed map in `apps/frontend/src/lib/itemIcons/`. An item
    without its own icon uses its section's icon, and custom items use a tag icon.
- **Per-list data.**
  - `list_section_orders(shopping_list_id, section_key) PK, position` is the
    per-list section order. Sections with no row follow in default order.
  - `list_custom_items(id, shopping_list_id, name, normalized_name, created_by_id)`
    is unique on `(shopping_list_id, normalized_name)`.
  - `list_items(id, shopping_list_id, catalog_item_key?, custom_item_id?, status
    to_buy|bought, source user|dish|recurring, last_bought_at, added_by_id)`:
    - a CHECK requires exactly one of the two references;
    - unique on `(list, catalog_item_key)` and on `(list, custom_item_id)`.
  - Removing an item deletes its `list_items` row but keeps the custom item, so
    it can still be found in that list's search.
  - Deleting a list cascades to all of its rows.
- **API.**
  - `GET /api/catalog` returns keys only.
  - `GET /api/lists/:id/items` returns `{ sectionOrder, items, customItems }`.
  - `POST /api/lists/:id/items` takes exactly one of `catalogItemKey`,
    `customItemId` or `customName`. It answers 201 when the item is new, and 200
    when the item was already in the list (moved back to to-buy).
  - `PATCH /api/lists/:id/items/:itemId` takes `{ status }`.
  - `DELETE /api/lists/:id/items/:itemId` removes the item.
  - Non-members get 404 on all of these, like the rest of the list API.
- **Search** runs on the client, over the active locale's labels plus the
  list's custom items. It folds case and accents and tokenizes Unicode-aware,
  as ADR-0014 requires.

## Alternatives considered

- **Store `name_en`/`name_it` columns in `catalog_items` and return labels
  from the API.** Rejected: it contradicts ADR-0014 and the spec's Product
  Decisions, and every new locale would need a schema change and a backfill.
- **Ship the catalog only as a frontend/static module, with no tables.**
  Rejected: list items could not hold a foreign key to the catalog, so an
  unknown or mistyped key could reach the database unchecked.
- **Keep the source's German identifiers as keys.** Rejected: they are
  meaningless to this product's contributors, and several are German compound
  words that collide once diacritics are stripped.
- **UUID primary keys plus a unique slug.** Rejected: the slug already is the
  stable public identifier. A second id adds a join for every label lookup and
  gains nothing.
- **Search on the server (`ILIKE` or full-text).** Rejected: the labels live
  only in the frontend, and the whole catalog is about 390 short strings. That
  is trivial to search on the client, with no request on each keystroke.
- **Per-section icon files or labels under `src/i18n/catalog/`.** Rejected for
  the labels: a new file there is not covered by the ADR-0017 exemption. Icons
  are split per section, and every icon file fits under the ceiling.

## Sources / Prior art

- [`docs/specifications.md`](../specifications.md): §List, §List Settings, and
  Product Decisions (labels localized in the frontend).
- [`ADR-0003`](0003-backend-stack.md) (layering),
  [`ADR-0004`](0004-postgresql-and-schema-management.md) (schema sync, manual
  production DDL),
  [`ADR-0010`](0010-account-name-update-endpoint.md) (whitelist body parsing),
  [`ADR-0014`](0014-internationalization-en-it.md) (keys in the API, labels in
  the catalogs, Unicode-aware matching),
  [`ADR-0017`](0017-module-size-ceiling-and-split-convention.md) (size ceiling
  and the i18n exemption).
- A third-party default grocery catalog (en/it), exported as section and item
  names. It is the source of the default items and their translations.
- The Careto design canvas, "List" and "Item icons" artboards. These are the
  source of the screen layout and the icon paths.
- PostgreSQL documentation: unique indexes treat NULLs as distinct, `CHECK`
  constraints, and `INSERT … ON CONFLICT` (the TypeORM `upsert`).

## Consequences

- **Positive:**
  - Labels stay in one place per locale, so adding a locale means translating
    `en.ts` only.
  - List items reference the catalog with real foreign keys.
  - Search is instant and works on the cached catalog.
  - A list's contents and its section order are plain rows, ready for the
    future reorder screen and for the dish and recurring sources.
- **Negative / trade-offs:**
  - `en.ts`/`it.ts` grow by about 400 lines each.
  - The server cannot render item names, for example in push notifications, so
    it would have to send keys and let the client resolve them.
  - The catalog keys must stay in step between backend and frontend, which the
    coverage test enforces.
- **Production DDL** (prod runs `DB_SYNC=false`). Create these tables once,
  before deploying, matching the entities:

  ```sql
  CREATE TABLE catalog_sections (key varchar(40) PRIMARY KEY, position int NOT NULL);
  CREATE TABLE catalog_items (key varchar(60) PRIMARY KEY,
    section_key varchar(40) NOT NULL REFERENCES catalog_sections(key) ON DELETE RESTRICT);
  CREATE TABLE list_section_orders (
    shopping_list_id uuid NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    section_key varchar(40) NOT NULL REFERENCES catalog_sections(key) ON DELETE CASCADE,
    position int NOT NULL, PRIMARY KEY (shopping_list_id, section_key));
  -- list_custom_items and list_items: generate with `typeorm schema:log` against
  -- a scratch database, so the enum types, CHECK and unique index names match.
  ```

- **Follow-ups (topics):**
  - a List settings screen and endpoint to reorder store sections;
  - the item ⋮ menu (rename or delete a custom item);
  - dish and recurring sources writing `list_items.source`;
  - real-time or offline sync of list items between members.
