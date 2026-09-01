# ADR-0062: Every kind the panel searches has a wire

- Status: Proposed
- Date: 2026-09-01
- Relates to: [ADR-0039](./0039-wrap-the-strip-and-ship-no-verb-without-a-wire.md)
  (no verb without a wire — the rule this applies to a search result row),
  [ADR-0030](./0030-detail-page-layout-contract.md) §2 (what a destination is),
  [ADR-0040](./0040-the-background-owns-the-org.md) §5 and §7 (users are not
  stored; a partial walk is not an absence),
  [ADR-0057](./0057-a-keyboard-route-into-the-panel.md) (the ⌘K route)

## Context

The ⌘K palette jumped between the panel's nine tabs and nothing else. Extending
it into a spotlight over the org — groups, apps, rules, policies, users — ran
straight into a contract that had been quietly true since `NavigationContext`
was written:

```ts
const navigationHandlers = { rule, group, user }; // app and policy absent
```

`canNavigateTo('app')` and `canNavigateTo('policy')` both returned `false`, and
that was a deliberate, documented choice. `EntityLink` reads it to decide whether
an app chip is a control or plain text, and `JumpResultRow` reads it to decide
whether a result row navigates or degrades to an **Open in Okta** link. Reporting
a kind as unreachable was the honest thing to do while no handler existed.

`useJumpResolver` also gates its **fan-out** on it: a kind with no destination is
never searched, on the reasoning that it is better not to find something than to
find it and be unable to open it. So "search apps and policies" was not a feature
that could be added to the palette. Either the two kinds got real destinations,
or the palette would search five kinds and silently return three.

The obvious objection is that neither tab has a detail rung to deep-link _into_.
`AppsTab` is a flat filtered inventory; `AuthPoliciesTab` is a flat list with
lazily expandable rows. Neither has a "page" for one entity the way `GroupsTab`
and `UsersTab` do.

## Decision

**Register `app` and `policy` handlers. A destination is where the reader
arrives, not a page shape.**

Arriving at one app means arriving on the Applications tab with the inventory
filtered to that app. Arriving at one policy means the same on Auth Policies.
That is a real destination — the reader asked to see a thing and is now looking
at it — and it does not require inventing a detail page neither tab has earned.

Three properties make it a destination rather than a trick:

1. **The filter is the visible search box, not hidden state.** Both tabs set
   `searchQuery` to the entity's _name_, never its id. The reader can see why the
   list narrowed and can widen it by pressing backspace. An id shoved into a name
   filter would match nothing and read as "that app is gone."
2. **It is one-shot.** `selectedAppId` / `selectedPolicyId` are consumed on
   arrival and cleared by the tab, following the `listView` precedent already in
   `AppsTab`. Returning to the tab later does not re-apply a stale jump.
3. **An unmatched id changes nothing.** The app inventory is the org snapshot,
   which may still be walking. Filtering to empty because an id is not in a
   partial collection would state an absence the snapshot cannot support —
   ADR-0040 §7's defect wearing a different hat. So an id the tab cannot find
   leaves the list exactly as it was, and the tab waits rather than consuming the
   request against a list that has not loaded yet.

### What this changes beyond the palette

This is not a palette-local change and should not be reviewed as one. Flipping
`canNavigateTo` for two kinds reaches **every consumer of `NavigationContext`**:

- Every `EntityLink` for an app or a policy upgrades from plain text (or an
  Okta link) to a live in-panel control.
- Home's own jump bar rows for those kinds do the same, though Home does not
  search them — an app id _resolved_ there now navigates instead of linking out.

That upgrade is the point, not a side effect. The kinds were unreachable because
nothing had wired them, not because reaching them was wrong.

### What this deliberately does not change

**`oktaId.ts` still refuses to classify a policy id.** The `00p`/`rst` prefixes
overlap other objects and a policy has no `OktaAdminEntityType`, so a pasted
policy id is still not something the panel claims to recognise. Searching a
policy by _name_ and resolving a policy _id_ are different questions, and only
the first is now answered. That split is carried by `JumpKind = OktaIdKind |
'policy'`, which keys the `searchers` map while `fetchers` and id resolution stay
on `OktaIdKind`.

**Neither tab gains a detail rung.** Expanding a policy's rules, or opening an
app's assignment panel, is state owned inside the list panels. Threading it
through a deep link is a second decision and is not made here.

## Consequences

- The palette can search all five kinds without producing a row that only
  refuses (ADR-0039).
- Existing tests and stories that assert the Open-in-Okta fallback for an app
  chip now describe behaviour that changed. They are retargeted assertion by
  assertion, not deleted (ADR-0022) — the fallback path still exists and is still
  correct for `rule` and `policy`, which have no admin-console route.
- `jumpDestinations` and `JumpResultRow` module headers cited `app` being
  unreachable as a live example. Both are corrected in the same change; a comment
  that documents the opposite of the file it sits in is worse than no comment.
- If a future build removes a handler, the degradation path is unchanged and
  still correct — that is why reachability stayed a runtime question rather than
  being baked into the destination table.
