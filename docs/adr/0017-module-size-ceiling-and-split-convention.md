# ADR-0017: Module size ceiling of 250 pure LOC and the responsibility-split convention

- **Status:** 🟢 accepted
- **Date:** 2026-08-31
- **Deciders:** Sthirs

## Context

A repository-wide clean-up pass measured every source file under `apps/backend/src` and
`apps/frontend/src` and found a dozen above 250 lines of code once blanks and
comments were excluded. The largest were a domain service, its controller,
and two Vue views, each between 450 and 714 lines.

Several forces made this worth deciding rather than leaving to taste:

1. **Measurement was not agreed.** Whole-file `awk` counts were wrong by 6 to 25
   lines for `.vue` files, and a naive "stop at the first `</template>`"
   extraction undercounted templates that nest `<template v-else>`. Without one
   canonical measurement, "is this file too big" had no answer.
2. **Layering had to survive the splits.** [`ADR-0003`](0003-backend-stack.md)
   fixes a routes/controllers/services/entities layering with a REST surface that
   callers depend on. Any split of a controller or a service has to keep that
   layering and keep every import specifier that routes, tests, and other
   services already use.
3. **Behaviour was pinned by tests that could not be edited.** Characterization
   suites pinned domain arithmetic and controller status-code discrimination.
   Splits had to be provably behaviour neutral, not merely plausible.
4. **Two files could not be split at all.** The i18n catalogs named by
   [`ADR-0014`](0014-internationalization-en-it.md) have no responsibilities to
   separate.

## Decision

We will hold every source file under `apps/backend/src` and `apps/frontend/src`
to a ceiling of **250 pure LOC**, measured only by
[`scripts/pure-loc.mjs`](../../scripts/pure-loc.mjs), and we will bring a file
back under the ceiling by splitting it along responsibility lines behind a
zero-logic re-export barrel, never by deleting behaviour and never by splitting
on line count.

### Measurement

Pure LOC is the number of non-blank lines remaining after comment removal,
summed across all top-level SFC blocks. `scripts/pure-loc.mjs` is the only
authority:

- `.ts` files: `//` and `/* */` comments are stripped by a character-level state
  machine that is aware of single-quoted, double-quoted, and nested template
  literals, including brace depth inside `${...}` interpolations, so a comment
  marker inside a string is never treated as a comment. Newlines inside block
  comments are preserved as blank lines so counting stays stable.
- `.vue` files: blocks are located with `@vue/compiler-sfc`'s `parse()`, never a
  regex. `<script>` and `<script setup>` use the TypeScript rules above,
  `<template>` strips `<!-- -->`, `<style>` strips CSS comments. Template and
  style lines **do** count toward the ceiling.

Measure **after** running Prettier. Its 80-column wrapping routinely adds 10–30%
to a file, so a file measured before formatting can cross the ceiling the moment
the formatter runs.

### Naming

New files are named for the single responsibility they own. `utils.ts`,
`helpers.ts`, `common.ts`, and numbered part files such as `foo_1.ts` are
banned. Reference examples in this repository:

- `apps/backend/src/services/shoppingList/`: `shoppingListRepositories.ts`,
  `shoppingListSerialization.ts`, `shoppingListMembership.ts`,
  `shoppingListCrud.ts`, `shoppingListService.ts`.
- `apps/backend/src/controllers/shoppingList/`: `shoppingListServiceInstance.ts`,
  `shoppingListHandlers.ts`, `memberHandlers.ts`, `invitationHandlers.ts`,
  `shoppingListImageHandlers.ts`.
- `apps/backend/src/services/seed/`: `seedData.ts` (declarative constants) and
  `seedExecution.ts` (the `seedDatabase()` function).
- `apps/frontend/src/components/list-detail/`: `TopbarSettingsButtons.vue`,
  `TopbarBackButton.vue`.

A single shared value gets its own named module rather than a grab bag:
`shoppingListServiceInstance.ts` exists solely so that the one
`new ShoppingListService()` stays one construction.

### Re-export barrels

The original file path stays alive as a barrel that contains re-exports and
nothing else. No logic, no instantiation, no re-wrapping.
`services/shoppingListService.ts`, `controllers/shoppingListController.ts`, and
`services/seedService.ts` are barrels, so routes and the
`vi.mock('../src/db/data-source')` pattern in tests keep working unchanged when
the modules behind them are split further.

### Vue SFCs: SCRIPT-ONLY versus DOM-RESTRUCTURING

Because `<template>` lines count, the script budget of an SFC is fixed before a
line is written: `budget = 249 - templatePureLoc`. That arithmetic decides the
technique.

**SCRIPT-ONLY.** When the template alone fits under the ceiling, extract
composables and leave the template byte-identical (for example
`useShoppingListsView.ts` behind `ShoppingListsView.vue`, and
`useShoppingListSettings.ts` behind `ShoppingListSettingsPanel.vue`). Two
constraints follow from a frozen template: every name the template references
must remain a top-level `<script setup>` binding, so a wide destructure is
mandatory, and template `ref="..."` bindings survive a destructure but fail
silently when they do not, so they need a characterization test first.

**DOM-RESTRUCTURING.** When the template alone exceeds the ceiling, no amount of
composable extraction is enough and child components are required.

### Extract as is

Child extraction is done verbatim:

- Copy the template region unchanged. No new wrapper elements, no class changes.
- Each region's existing root element becomes the child's **single** root. A
  single-root child with no extra attributes renders identical `outerHTML`.
- Leave rendered HTML comments in the parent, immediately before the child tag.
  Moving a comment into the child makes it multi-root, which changes attribute
  fallthrough and is the one thing that breaks byte identity.
- When a region is naturally multi-root, look one level up for a single-vnode
  wrapper that already exists, such as a `<Teleport>`, `<Transition>`, or
  `<section>`, rather than inventing a `<div>`.
- Compute shared values once in the parent and pass the result down, rather than
  re-instantiating a store per child.

Held to this discipline, a split produces byte-identical DOM and existing inline
DOM snapshots pass unedited. When a child must write shared reactive state, use
a typed `provide`/`inject` rather than a prop, because a prop trips
`vue/no-mutating-props` and every workaround is lint-rule evasion.

### The i18n catalog exemption

`apps/frontend/src/i18n/en.ts` and `apps/frontend/src/i18n/it.ts` are **exempt**
from the ceiling. [`ADR-0014`](0014-internationalization-en-it.md) names exactly
these two paths as the statically imported message catalogs, with Italian
type-checked against the English schema via `satisfies MessageSchema`. They are
declarative data with a single responsibility, so any split would be a split by
line count, which this ADR bans. They are the only permitted exemption; a new
exemption requires a new ADR.

## Alternatives considered

- **A repo-wide `max-lines` ESLint rule.** Rejected: ESLint's counter does not
  understand SFC blocks, so `.vue` files would be counted wrongly, and a lint
  error offers no place to record the i18n exemption and its grounds.
- **A soft guideline with no number.** Rejected: a soft guideline is what
  produced a 714-line view. A number that a script can check is what makes the
  rule enforceable in review.
- **Splitting by line count into numbered part files.** Rejected: it satisfies
  the measurement while making the code harder to navigate, and it destroys the
  property that makes splits safe, namely that each new module owns one
  nameable concept.
- **Changing import specifiers at every call site instead of a barrel.**
  Rejected: it forces edits to routes and to characterization tests whose
  unchanged state is the proof that a split was behaviour neutral.
- **Raising the ceiling to accommodate the i18n catalogs.** Rejected: the
  catalogs are the exception, not the rule, and raising the number for two
  declarative data files would licence a 300-line controller.

## Sources / Prior art

- [`ADR-0003`](0003-backend-stack.md): the routes/controllers/services layering
  every backend split preserves, and the REST surface the barrels keep intact.
- [`ADR-0014`](0014-internationalization-en-it.md): names
  `apps/frontend/src/i18n/en.ts` and `it.ts` as exactly two statically imported
  catalogs, which is the grounds for the exemption above.
- [`ADR-0008`](0008-testing-strategy.md): the unit plus deployed-browser proof
  model that SFC splits follow.
- Empirical basis: a clean-up pass where behaviour was locked first with characterization tests and inline
  DOM snapshots, then each split was verified with `scripts/pure-loc.mjs`.

## Consequences

- Positive: file size has one canonical answer that a script produces, so
  "too big" stops being a matter of taste in review.
- Positive: the barrel convention means a split is invisible to callers.
- Positive: extract-as-is turns existing DOM snapshots into an exact, free
  regression proof instead of a diff to rubber stamp.
- Negative: the ceiling counts template and style lines, so a template-heavy SFC
  has a small script budget and may need child components for what feels like a
  small change. `ShoppingListsView.vue` is close to the ceiling.
- Negative: measuring after Prettier means a file can be compliant while being
  written and non-compliant once formatted, so the check belongs at the end of
  the change, not the start.
- Negative: the exemption list is a standing invitation to grow. It is capped at
  the two i18n catalogs on purpose, and widening it needs a new ADR.
- Follow-ups: a decision on whether the ceiling should be enforced automatically
  in CI rather than by review, which would need its own ADR.
