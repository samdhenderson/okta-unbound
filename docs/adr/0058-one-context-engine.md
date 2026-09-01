# ADR-0058: One context engine

- Status: Proposed
- Date: 2026-08-29
- Scoped by: `D-062`
- Relates to: [ADR-0018](./0018-tabs-stay-mounted.md) (why an always-on hook is
  paid on every navigation), [ADR-0026](./0026-visibility-gating-patterns.md)
  (the gating patterns the removed gate came from),
  [ADR-0032](./0032-the-sticky-stack-and-a-header-that-owns-identity.md) (`ContextBar` describes the live
  tab; `PageHeader` describes what you are browsing), `D-059` (the other traffic
  cost the re-gate exposed)

> **Numbering note.** `D-062` reserved `0047` on 2026-08-28; the elevation ADR
> took it. See `D-072`.

## Context

`App` runs two independent `useOktaTabContext` instances:

- **`useGroupContext`** — a group-specific specialization, feeding every tab's
  `targetTabId` and `oktaOrigin`.
- **`useOktaPageContext`** — probes for all page types (`group | user | app |
policy | admin | unknown`), feeding the `ContextBar` masthead.

They have always overlapped: each sends its own `getOktaOrigin` plus its own
entity probes on every navigation. The overlap used to be bounded, because the
page hook was gated to the active Overview tab. Removing that tab (the Home
program) made it always-on, so the duplication is now paid on **every**
navigation rather than on some of them.

The two are not redundant in what they compute — one narrows to groups, the
other classifies five page types — but they are redundant in what they _cost_:
the same tab, the same origin resolution, the same content-script round trip,
twice. Folding one into the other would roughly halve probe traffic.

It is architecturally significant because it changes what feeds nine tabs and
the masthead, and because the two hooks have genuinely different failure
semantics today — one latches `error`, the other falls back to `admin`. That
difference is the substance of this decision, not an implementation detail.

## Decision

**One `useOktaPageContext` instance in `App`. `useGroupContext` becomes a pure
selector over it, not a second probe.**

### The merged shape

`useOktaPageContext` already computes a superset: its `PageType` includes
`'group'`, and its detection carries the entity info a group page yields. The
group-specific hook keeps its name and its return type — every call site is
unchanged — but its body becomes a derivation:

```
useOktaPageContext (one probe, one latch, one error state)
        │
        ├── ContextBar          reads pageType + entity
        └── useGroupContext     reads pageType === 'group' ? entity : null
```

No new abstraction, no new file. The engine is the hook that already classifies
everything; the specialization is a `useMemo` over its result.

### The two failure semantics reconcile toward the latch

This is the load-bearing choice. Today:

- `useOktaTabContext` exposes `connectionStatus: 'connecting' | 'connected' |
'error'` plus an `error: string | null`, and it **latches**: a terminal failure
  sets `error` and drops the same-entity latch so a document reload always
  re-probes (`useOktaTabContext.ts:228-240, 306-307`).
- `useOktaPageContext` falls back to `'admin'` when nothing matches
  (`useOktaPageContext.ts:53`).

These are not the same kind of statement, and merging them naively would destroy
information. **They must stay distinct after the merge**, because they answer
different questions:

- `pageType: 'admin'` means _the probe succeeded and this is not an entity page_.
  That is a real, useful answer, and it is the common case on an admin console
  landing page.
- `connectionStatus: 'error'` means _the probe did not succeed_, and nothing is
  known about the page at all.

The merged hook keeps both fields. What changes is that `pageType` is only
meaningful when `connectionStatus === 'connected'` — consumers must not read
`'admin'` out of a failed probe, which is precisely the conflation a single
merged field would invite. **The fallback-to-`admin` default moves behind the
connected check**, and a failed probe reports `pageType: 'unknown'` rather than
`'admin'`.

That is a behaviour change, and it is the one to test: today a `ContextBar`
whose probe failed can render as if it were on an admin page.

### A pin reads the same engine

Whatever pinning exists (an admin holding context while navigating away) applies
to the single engine and is therefore consistent across the masthead and the
tabs by construction. Today two engines can in principle disagree about what the
active tab is — a bug that has not been observed but is not prevented by
anything.

### Probe payload is the union, fetched once

The merged probe asks for every page type, which is what `useOktaPageContext`
already does. `useGroupContext` was not asking for less over the wire — it was
asking for the same round trip and discarding four of the five answers. So the
saving is a whole probe per navigation, not a smaller one.

## Consequences

Probe traffic on navigation roughly halves, and the two engines can no longer
disagree. `D-059` addressed the other cost the Home re-gate exposed; this closes
the pair.

The costs: `App`'s single context becomes a genuine single point of failure —
one failed probe now blanks the masthead _and_ the group-dependent tabs, where
today one could succeed while the other failed. That is more honest and less
resilient, and it is the right trade only because the two disagreeing was itself
a defect.

Every consumer of `useGroupContext` inherits `useOktaPageContext`'s timing
rather than its own, so anything that races on first paint may reorder. And the
`'admin'`-on-failure change is user-visible on a failed probe.

## Alternatives considered

**Fold `useOktaPageContext` into `useGroupContext`** — the other direction.
Wrong way round: the group hook computes a strict subset, so this would mean
teaching the specialization to classify five page types, which is just the
general hook with a misleading name.

**Share a cache between the two hooks, keeping both.** Smaller diff, keeps both
failure semantics untouched, halves the traffic. It leaves two engines that can
still disagree about state derived _after_ the cached probe, and adds a cache
whose invalidation is a third thing to get wrong. Rejected as the change that
buys the traffic win without the correctness one.

**Do nothing.** The duplication is a performance cost, not a correctness bug
that has been observed. Defensible until the first report of the masthead and a
tab describing different pages — at which point the fix is this ADR anyway.
