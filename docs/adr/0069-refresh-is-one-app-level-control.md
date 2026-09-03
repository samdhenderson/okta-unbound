# ADR-0069: Refresh is one control at the top of the app, not a verb on every rung

- Status: Accepted
- Date: 2026-09-03
- Relates to: [ADR-0068](./0068-a-rungs-primary-is-a-verb-that-acts.md) (which excludes a
  refresh from `primary` because this ADR removes it from the strip),
  [ADR-0032](./0032-the-sticky-stack-and-a-header-that-owns-identity.md) §1 (`ContextBar`
  and `PageHeader` describe different subjects and must not converge),
  [ADR-0030](./0030-detail-page-layout-contract.md) §2 (`PageHeader.actions` is the slot
  verbs are moved _out_ of), [ADR-0018](./0018-tabs-stay-mounted.md) (tabs stay mounted, so
  every fetch is gated on `isActive`),
  [ADR-0050](./0050-the-chrome-leaves-the-scroller.md) (the chrome band sits outside the
  scroller), [ADR-0059](./0059-one-bucket-is-not-the-org.md) (per-bucket rate-limit gating,
  which a refresh spends against)

## Context

Five rungs have a refresh and no two of them agree on what it is.

| Where                                                     | What it is                  | What it refreshes                     |
| --------------------------------------------------------- | --------------------------- | ------------------------------------- |
| `GroupsTab.tsx:476-483`                                   | `PageHeader.actions` Button | `loadAllGroups(true)`                 |
| `AppsTab.tsx:209/223`                                     | `PageHeader.actions` Button | `loadApps(true)`                      |
| `AuthPoliciesTab.tsx:128/151`                             | `PageHeader.actions` Button | `loadPolicies(...)`                   |
| `RulesTab.tsx:529-535`                                    | An `ActionBar` descriptor   | `loadRules(...)`                      |
| `ContextBar.tsx:166` → `App.tsx:319` (`handleRefreshAll`) | An `IconButton`             | the page-context probe, and only that |

Three of them also double as the rung's initial load, so the same control reads _Load All
Groups_ or _Refresh_ depending on whether anything has been fetched yet — which means the
label of the most-pressed control on the page is a state readout for a distinction the
reader did not ask about.

Four consequences, and none of them is cosmetic.

**The reader has to know the app's fetch topology to find the button.** On the Rules rung
it is in the verb strip; on three others it is in the header; on a detail rung there is no
refresh at all — `GroupDetailView` re-runs its loads only as a side effect of a write
(`GroupDetailView.tsx:247-250`, `onCleanupDone`). So the answer to "this data looks stale,
how do I re-pull it?" is different on every rung and absent on half of them.

**`PageHeader.actions` is exactly the slot ADR-0030 §2 exists to empty**, and three list
rungs are still using it for their single most-pressed control.

**It cost the panel its one filled button.** ADR-0061 promoted `RulesListActionBar`'s
_Load rules_ / _Refresh_ to `primary` on the strength of it being the rung's page-level
verb. It is a fetch. [ADR-0068](./0068-a-rungs-primary-is-a-verb-that-acts.md) now excludes
fetches from `primary` on the grounds that they do not act — and that exclusion is only
safe because this ADR gives the fetch somewhere else to live.

**The one control that _is_ in the chrome refreshes the wrong thing.** `handleRefreshAll`
re-probes the page context and nothing else. An admin who presses the refresh button at
the top of the panel, while looking at a stale group roster, gets a re-read of the Okta
tab's URL. Nothing they were looking at changes. It also disables itself while pinned,
because a context probe is meaningless when you have deliberately stopped following the
live tab — which is correct for a context probe and would be badly wrong for a data
refresh.

## Decision

**There is one refresh control, at the top of the app beside the Pin, and its subject is
whatever the panel is currently showing.**

### 1. Refresh is neither a strip verb nor a `PageHeader` action

It is app chrome. It sits in the top bar next to the Pin, above the rail, outside the
scroller (ADR-0050), and it is present on every rung of every tab — the same control in
the same pixel, always.

That placement is the whole point. A refresh is not a verb about the entity, it is a verb
about **the panel's confidence in what it is displaying**, and that question is identical
on all nine sections. A control whose meaning does not vary by rung should not be
re-declared per rung, and ADR-0068 has just established that the two slots it currently
occupies are for something else: `ActionBar` holds verbs that act, `PageHeader.actions`
holds as little as possible.

### 2. Its subject is what the panel is showing, and the tooltip says which

The control resolves its subject from the current view, not from configuration:

- **On a list rung** — that list. The rung's own loader, forced.
- **On a detail rung** — that entity's cache keys, dropped, plus a re-run of the loads the
  rung performs on open.

Its tooltip names that subject **by kind and position, never by identity**: _Refresh the
groups list_, _Refresh this group_, _Refresh the app inventory_. That constraint is
load-bearing rather than stylistic and §3 is why.

There is no global "refresh everything". The subject is always exactly what is on screen,
because a control that silently re-pulls nine tabs' worth of data from a single press is
a rate-limit event, not a refresh (ADR-0059's per-bucket gating makes it a slow one, which
is worse — it would appear to hang).

**It is not disabled while pinned.** The pin governs whether the panel follows the live
Okta tab; it says nothing about whether the roster you are reading is current. The context
re-probe half of the press — the part `handleRefreshAll` does today — is the half that is
skipped under a pin. The data half always runs.

### 3. This does not converge `ContextBar` with `PageHeader`, and here is the line

ADR-0032 §1 is unambiguous: `ContextBar`'s subject is the live Okta tab, `PageHeader`'s is
what you are browsing, and "the two showing the same name is a coincidence, not duplication
to remove". A control that acts on **what you are browsing**, housed in the band that
describes **the live tab**, is the shape of exactly the convergence that section forbids.
It has to be answered rather than waved past.

**The answer: ADR-0032 §1 governs what each band _describes_, not what is docked in it.**
Its table has three rows — Subject, Source, Changes when — and all three are about the
readout. The failure it was written from was a group being **named three times on one
screen**. Nothing here adds a fourth naming: the bar's readout is untouched, still the
live tab's entity, still fed by `useOktaPageContext` or the pinned snapshot, still refusing
to follow in-panel navigation.

The line, stated so it can be enforced:

> The refresh control **never renders the name of the thing it refreshes.** Its tooltip is
> deictic — "this group", "the groups list" — and it has no label, no badge and no count.

Say the tooltip were _Refresh Payments Team_ instead. That puts the browsed entity's
identity into the chrome band, beside a readout naming a possibly different entity, and
ADR-0032 §1 is violated in substance and not merely in shape. The deictic form carries the
same information to the reader who needs it — they can see what is on screen — and carries
no identity at all.

**The alternative was considered and rejected.** Putting the control in `PageHeader`, whose
subject genuinely is what you are browsing, is the obviously ADR-0032-shaped answer. It
fails on ADR-0030 §2: that is the slot this ADR is emptying, and a control that must appear
on every rung is precisely what a shared header should not be re-implementing nine times.
It also puts refresh back inside the scroller, where a detail rung's collapsing header can
take it off screen at the moment a reader decides the data looks stale.

**The residual is named, not papered over.** One property of the chrome band does now
change: its refresh control's _behaviour_ tracks in-panel navigation, where everything else
above the rail tracks the Okta tab. That is a real asymmetry. It is accepted because the
band is app chrome that _contains_ a context readout rather than being one — the Pin
already lives there and is not a description of anything either — and because §3's naming
rule keeps the asymmetry out of everything the reader can see.

### 4. Every existing rung-level refresh moves into it

All five call sites in the Context table lose their control. Specifically:

- `GroupsTab`, `AppsTab` and `AuthPoliciesTab` lose their `PageHeader.actions` Button.
  Their badges stay; ADR-0051 §6's collapsing subtitle is unaffected.
- `RulesListActionBar` loses the `load` descriptor entirely (§6).
- `ContextBar` loses the "Refresh context" `IconButton`. Its `onRefresh` prop and
  `App.tsx`'s `handleRefreshAll` survive as the context-probe half of the new control's
  press — and as the thing `handleReconnect` calls after reloading the tab, which is
  unchanged.

**The dual-purpose labels go with them.** _Load All Groups_ / _Refresh_ and
_Load Policies_ / _Refresh_ collapse: a rung that has not loaded yet renders its empty
state with its own prompt, which is where an initial load belongs, and the chrome control
means "again" in every state.

### 5. The connection dot becomes the reconnect control

`ContextBar` renders a hue-coded dot by `PageType` with `role="img"` and an `aria-label`
of the connection text — a decorative status light — and puts a separate _Reconnect_
`Button` beside it when there is an error.

The dot becomes the control. It is a real `button` with an accessible name that states
both the status and the action, it is keyboard reachable and focus-visible, and pressing
it does what _Reconnect_ does today: reload the Okta tab so a fresh content script is
injected, then re-probe.

Two reasons this is not decoration-churn. The status and the recovery for that status are
the same object — an admin who notices the dot has gone amber wants to act on the dot, and
today has to find a different control that only exists in the error state. And it clears a
slot: with reconnect on the dot and refresh beside the Pin, the bar holds one readout and
three controls with no two of them meaning the same thing.

**Hue is not the only carrier**, per ADR-0061's standing correction. The accessible name
states the status in words; the dot's colour is a second channel, not the channel.

### 6. The Rules tab fetches on open, gated on `isActive`

Rules no longer wait for a press. `RulesTab` fetches when the tab is opened, and
`RulesListActionBar` is left with its three panel toggles.

It is cheap: one org-level call populates the rung, and `RulesCache` already serves
repeat opens. The premise of the manual gate — that the fetch is expensive enough to be
worth a deliberate press — was never true of this endpoint, and it cost the tab its
meaning until pressed.

> **ADR-0018 applies and is the trap here.** Tabs stay mounted. A fetch written as a plain
> mount effect will fire for the Rules tab while the reader is on Groups, and will re-fire
> nothing on the actual switch. The fetch is gated on `isActive`, like every other fetch,
> poll and shared listener in the panel.

The empty state keeps its own load prompt for the case where the fetch failed or was never
eligible to run, so an inactive-then-failed tab is not a dead end.

### 7. What a detail-rung press invalidates, and the two hooks that cannot yet be re-run

The mechanics exist; one gap does not.

`entityCache` already has everything the invalidation half needs — `invalidate(key)`
(`src/sidepanel/cache/entityCache.ts:243`), where a prefix drops every nested entry;
`registerDerived(derivedPrefix, sourcePrefix)` (`:269`), which already cascades
`groupMembers/X` to `memberSource/X`; and `getOrFetch(key, fetcher, { force })` (`:348`),
whose `force` option is documented as the one manual refresh uses. Keys are built from the
factories in `src/sidepanel/cache/keys.ts` and nowhere else.

The re-run half has a real gap. `useGroupAccessGrants` and `useGroupRuleReferences`
(`src/sidepanel/hooks/`) expose no re-run function at all — `useGroupRuleReferences`
returns `{ rules, status, error }` and `useGroupAccessGrants` returns
`{ apps, appsStatus, appsError, roles, rolesStatus }`. Both must gain one, and it must be
the only one they gain.

`useGroupSource` already has `refreshRules`, added for `I-032` (a created feeding rule not
appearing until the group was reopened), which reloads the rules half alone and leaves the
paid-for member walk standing. **Reuse it. Do not add a second rules reload** — a hook with
two ways to re-fetch the same half is how the two halves drift.

The precedent for composing the whole press is already in the tree:
`GroupDetailView.tsx:247-250`'s `onCleanupDone` invalidates one key and re-runs one
analysis. A detail-rung refresh is that shape, over the rung's full key set.

## Consequences

- **Five call sites lose a control and one gains it.** `GroupsTab.tsx:476-483`,
  `AppsTab.tsx:209/223`, `AuthPoliciesTab.tsx:128/151`, `RulesTab.tsx:529-535` and
  `ContextBar.tsx:166`. Three `PageHeader.actions` slots empty, which is the ADR-0030 §2
  outcome those rungs never got.
- **Detail rungs gain a refresh they have never had.** Today the only way to re-pull a
  group's roster is to pop to the list and drill in again, and even that serves from cache.
  This is a new capability, not a relocation, and it is the half of the decision most
  likely to be wanted immediately.
- **Two hooks gain a re-run function and it is the only thing they gain.**
  `useGroupAccessGrants` and `useGroupRuleReferences`. Their existing return shapes are
  additive-only changes, so no consumer breaks.
- **`RulesListActionBar` is left with three read-only panel toggles and, under ADR-0068 §1,
  probably no `primary` at all.** That judgement belongs to the change that empties the
  strip.
- **The `PageType`-hued dot becomes a `button` and needs a story.** Per ADR-0010/0014,
  `ContextBar`'s stories must cover the connected, connecting, error and pinned states of
  the new control and be axe-clean — the dot's current `role="img"` was axe-clean as
  decoration and will not be as an unnamed control.
- **Tests that press a rung's refresh must be retargeted, not deleted.** Every suite
  asserting `Refresh` / `Load All Groups` / `Load Policies` / `Load rules` is asserting a
  real behaviour that still exists, from a different control. ADR-0012 and ADR-0022 apply
  in full: retarget assertion-by-assertion, with a PR note saying what stays covered.
- **The Rules tab's fetch is the ADR-0018 risk in this ADR.** An ungated mount effect
  fetches for a tab nobody is looking at and, because the tab never unmounts, never fetches
  again when they arrive. It is worth a test that asserts no request is issued while
  `isActive` is false.
- **A refresh on a detail rung can cost several requests**, since it drops a key set and
  re-runs every load the rung performs. It is a deliberate press with a visible spinner, so
  the cost is attributable — but it interacts with ADR-0059's per-bucket gating, and a
  press during a cooldown will feel slow. Nothing here reserves budget for it.
- **The chrome band now holds one behaviour that follows in-panel navigation** (§3). If
  that asymmetry proves to read as convergence in use, the control moves to `PageHeader`
  and ADR-0030 §2 takes the exception instead — recorded here so the fallback is a decision
  someone already reasoned about rather than a reversal.
