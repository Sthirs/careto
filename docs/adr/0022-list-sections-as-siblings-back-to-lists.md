# ADR-0022: List sections are siblings — tabs replace history, every section's back arrow goes to My lists

- **Status:** 🟢 accepted
- **Date:** 2026-10-25
- **Deciders:** Sthirs
- **Supersedes:** [ADR-0019](0019-browser-back-as-dismiss-and-up-navigation.md), decision 1, for the list-settings back target only. Every other part of ADR-0019 stays in force.

## Context

[`docs/specifications.md`](../specifications.md) gives each shopping list four
sections: the list, dishes, week plan, and list settings. The new design (the
"Careto" design canvas, boards *List* and *List settings*) shows them as a
bottom tab bar ("List sections") on every section screen, and the header back
arrow of every section — List settings included — leads to **My lists**.

[ADR-0019](0019-browser-back-as-dismiss-and-up-navigation.md) decision 1
fixed the list-settings back target to `list-detail`, because settings was
then a page *nested under* the list, reached from a topbar Settings button.
With the tab bar, settings is a *peer* of the list, not a child of it, and the
user asked explicitly: "The backarrow must go to the lists page".

ADR-0019's core rule still holds and must keep holding: the browser Back
button and the in-app back arrow are the same history operation. If tabs
pushed history entries while every back arrow targeted `/lists`, the two
would disagree (Back from Settings would land on the List tab, the arrow on
My lists), and `goBackTo` would `replace` instead of popping, leaving dead
entries below.

## Decision

We will treat the four list sections (`list-detail`, `list-dishes`,
`list-week`, `list-settings`) as siblings one level below My lists: switching
tab **replaces** the current history entry (`RouterLink replace` in
`components/list-sections/ListSectionsNav.vue`), and every section's back
arrow calls `goBackTo(router, { name: 'shoppingLists' })`.

## Alternatives considered

- **Keep ADR-0019's `list-settings → list-detail` target.** Rejected: contradicts
  the design and the user's explicit instruction, and treats a tab as a
  nested page.
- **Tabs push, back arrows target `/lists`.** Rejected: browser Back and the
  back arrow would reach different screens after any tab switch, breaking
  ADR-0019's central rule; `goBackTo` would `replace` with `/lists` on top of
  stale section entries.
- **Tabs push, back arrow uses `goBackOr` (pop to whatever came before).**
  Rejected: the arrow would walk back through every tab visited, which is
  not "go to My lists".

## Sources / Prior art

- [`docs/specifications.md`](../specifications.md) — "Each shopping list has the
  list, dishes, week plan, and list settings sections."
- [ADR-0019](0019-browser-back-as-dismiss-and-up-navigation.md) — `goBackTo`
  semantics and the Back-equals-arrow rule this ADR keeps.
- Design canvas "Careto", boards *List* and *List settings*: shared tab bar,
  back arrow to My lists.
- Material Design 3, *Navigation bar*: destinations in a bottom bar are
  top-level peers; switching between them does not build a back stack.
- vue-router `RouterLink` `replace` prop (`router.replace` instead of
  `router.push`).

## Consequences

- Positive: from any section, one Back press — browser or arrow — returns to
  My lists; the history stack is at most `/lists → /lists/:id/<section>`.
- Positive: one back target for every section, so Dishes and Week need no
  special case when they are built.
- Negative / trade-offs: the browser Back button cannot step back through
  previously visited tabs; the tab bar itself is the way to move between them.
- Negative / trade-offs: ADR-0019's text still names `list-detail` as the
  list-settings target; readers must follow this ADR for that one point.
- Follow-ups, by topic: whether a list section should remember its scroll
  position when re-entered through the tab bar.
