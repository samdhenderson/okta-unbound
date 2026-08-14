# ADR-0026: Visibility gating — five patterns, and why they do not belong in `useEntityQuery`

- Status: Accepted
- Date: 2026-08-13
- Amends: [ADR-0018](./0018-tabs-stay-mounted.md)
- Relates to: [ADR-0025](./0025-retire-boolean-rule-evaluation-apis.md)

## Context

ADR-0018's core decision stands and is not in question: tabs stay mounted, and every
fetch, poll and shared listener gates on `isActive`. What this ADR corrects is its
**taxonomy**, and it blocks a refactor that was about to be built on top of that
taxonomy.

### ADR-0018 misclassifies two hooks

ADR-0018 names two gating patterns and assigns hooks to them:

> 1. **Deferred re-arm** … `useAppsData` and `AuthPoliciesTab` use this for their
>    auto-loads.
> 2. **Owed-load latch** — for an effect that must **not** re-run every time the tab
>    is re-shown … `useGroupRuleReferences` is the reference implementation.

Both named hooks are **owed-load latches**, not deferred re-arms:

```ts
// AuthPoliciesTab.tsx
const autoLoadedRef = useRef<number | null>(null);
if (!isActive || targetTabId == null || autoLoadedRef.current === targetTabId) return;

// useAppsData.ts
const autoLoadedFor = useRef<string | null>(null);
const target = `${targetTabId}\u0000${oktaOrigin ?? ''}`;
if (autoLoadedFor.current === target) return;
```

Each holds the last input it actually loaded and refuses to re-run for the same one.
A bare hide/show with an unchanged target issues no request — which is the defining
behaviour of pattern 2, not pattern 1. They differ from `useGroupRuleReferences` only
in **idiom**: a single effect comparing against the last-processed value, versus two
effects raising and paying a boolean flag.

The ADR contradicts itself on this point. Pattern 2's own warning — "without the
latch, 'gate on `isActive`' silently turns every tab revisit into a refetch" —
describes precisely the bug these two hooks avoid by having a latch.

### There are five patterns, not two

An audit of every visibility-gated site found:

| Pattern                    | Behaviour                                                                                | Sites                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Owed-load latch**        | fires once per real input change; deferred while hidden; never on a bare reshow          | `useGroupRuleReferences`, `GroupDetailView`, `useAppsData`, `AuthPoliciesTab`                       |
| **Refetch-on-every-show**  | no idempotency beyond a debounce; re-runs whenever shown                                 | `useExportTab`'s match-count probe, `useGroupLiveSearch`, `useDebouncedUserSearch`, `useAddToGroup` |
| **Reset-on-hide**          | does work when the surface goes **invisible**                                            | `useUserComparison`                                                                                 |
| **Bookkeeping-on-arrival** | fires per arrival; no data, no cache, nothing to key                                     | `RulesTab`'s `markTabVisited`                                                                       |
| **Dual-axis owed-resync**  | gated on `enabled` **and** `document.hidden`, with `!isPinned` folded into the same flag | `useOktaTabContext`                                                                                 |

Only the first two are load-triggering, so "two patterns" is defensible as a
description of _loads_ — but the assignment is wrong, and the other three shapes are
real code that the taxonomy does not describe.

### The proposed fix does not work

The data-layer plan proposed adding `visible` and `revalidateOnShow` to
`useEntityQuery` to "encode ADR-0018's two sub-patterns once". Three findings block it:

1. **A show-time boolean pair cannot express reset-on-hide.** `useUserComparison`
   clears comparison state the moment its surface goes off-screen so the next open
   starts clean. Neither `revalidateOnShow: false` ("fire once on next show") nor
   `true` ("fire on every show") describes work that happens on _hide_.

2. **No current consumer needs it.** All six `useEntityQuery` call sites pass
   `enabled` for key-readiness only and are correctly ungated, because their keys are
   frozen upstream by `useOktaPageContext(activeTab === 'overview' && !isPinned)`. The
   gating already lives one level up the tree. Adding the option gives them nothing.

3. **`useAppsData` cannot take it.** Its latch identity is `(targetTabId, oktaOrigin)`
   while its cache key is `oktaOrigin` alone — deliberately, so two Chrome tabs on one
   org share an inventory. `useEntityQuery` refetches on cache-key identity plus TTL,
   not on "has the visible tab already attempted this input". Migrating means widening
   the key (undoing the shared-inventory design) or keeping the bespoke ref anyway.

## Decision

**Do not add `visible` / `revalidateOnShow` to `useEntityQuery`.** Visibility gating
stays where it is: at the hook or tab that owns the effect.

**Correct the classification.** `useAppsData` and `AuthPoliciesTab` are owed-load
latches. ADR-0018's table entry for them is wrong and this ADR supersedes it. Its core
decision, its per-tab audit, and its scroll-state section are unaffected.

**The owed-load latch is the one duplicated pattern worth extracting**, when someone
gets to it: four implementations in two idioms, all computing "has the currently
visible surface already loaded for this exact input?". Extract it as a small
standalone hook that takes the identity to latch on — deliberately _not_ a
`useEntityQuery` option, because the identity it latches on is not always the cache
key, and `useAppsData` is the proof.

**Gating sometimes belongs one hook up the tree.** The six ungated `useEntityQuery`
consumers are correct as written. Before adding a gate to a consumer, check whether
the thing that would change its key is already gated upstream.

## Consequences

- The plan's slice for this is cancelled. What survives is the latch extraction and
  `lastFetchTime`, both narrower.
- ADR-0018 keeps its force. A reader must now read this ADR alongside it for the
  pattern assignment, which is the cost of immutability — the alternative was editing
  a dated record.
- The three non-load shapes (reset-on-hide, bookkeeping-on-arrival, dual-axis resync)
  are now named. Anyone generalising visibility behaviour has to account for them
  rather than rediscovering them.
- `useOktaTabContext` is explicitly out of scope for any `useEntityQuery` migration:
  different contract, Chrome listeners, retry/backoff, and a `document.hidden` axis
  that no cache-keyed hook models.
