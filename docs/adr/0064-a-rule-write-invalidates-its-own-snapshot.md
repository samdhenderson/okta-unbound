# ADR-0064: A rule write invalidates its own snapshot

- Status: Proposed
- Date: 2026-09-02
- Relates to: [ADR-0006](./0006-zod-boundary-validation.md) (the same boundary this
  effect now sits beside), [ADR-0012](./0012-no-test-tampering.md) and
  [ADR-0022](./0022-test-lifecycle.md) (the assertions this moved, and where they
  went), `D-089`, `D-095`, `D-096` (the item that asked for this decision)

## Context

`RulesCache` is a single global slot in `chrome.storage.local` holding a
5-minute-TTL snapshot of the org's entire group-rule inventory: the formatted
rules, the raw rules, the active/inactive/conflict totals, and the detected
conflicts. Every surface that shows "the rules" reads it.

Three hooks write rules, all through the same `createRuleWriteOperations`
factory:

- `useCreateFeedingRule` — creates a rule from the Group Detail rung.
- `useRuleConsolidation` — creates, activates, deactivates and deletes rules.
- `useRuleLifecycle` — activates and deactivates a rule from the Rules tab.

Each was separately responsible for calling `RulesCache.clear()` afterwards.
`useCreateFeedingRule` did. `useRuleConsolidation` did not until `D-089`.
`useRuleLifecycle` never did (`D-095`) — so for up to five minutes after an
admin deactivated a rule, every surface reading the snapshot still reported it
`ACTIVE`, with the totals to match.

That is two out of three write paths getting it wrong, which is the shape of a
rule nobody can see rather than a rule anybody disagrees with. The invariant is a
property of the write, not of any caller's flow: **if a rule changed in Okta, the
org-wide snapshot is wrong.** Nothing about which hook issued the write bears on
it.

The objection recorded in `D-096`, and the reason it was filed research-only, is
real: `ruleWrites.ts` was a pure transport factory over `CoreApi`, its module doc
said exactly that, and giving it a `chrome.storage`-backed global side effect
changes what that layer _is_. It also changes `useRuleLifecycle`'s observable
behaviour as a consequence of a refactor rather than as a decision. This ADR is
that decision.

## Decision

**`createRuleWriteOperations` invalidates the org-wide rules snapshot itself.**
Every operation it returns that changes a rule in Okta — create, delete,
activate, deactivate — drops the `RulesCache` entry. The three callers make no
invalidation call; the two that had one lose it.

Three sub-decisions carry most of the weight:

1. **A read never invalidates.** `getRawGroupRule` is a `GET` and leaves the
   entry alone.

2. **Invalidation follows the write, not the returned result.** A create whose
   `POST` succeeded but whose response then fails zod validation returns
   `success: false` — and still invalidates, because the rule exists in Okta.
   This is what preserves the property `D-089` deliberately built into the
   consolidation flow: the snapshot is dropped the moment the replacement rule
   exists, _before_ the activate step that can abort the run, so an aborted run
   never leaves a rule-short snapshot behind. Under the old per-caller shape that
   ordering was a comment in one hook; it is now structural. A write the
   transport rejected changed nothing and invalidates nothing.

3. **The cache never decides the write's result.** Invalidation is wrapped so a
   storage failure is logged and swallowed. A stale snapshot expires on its own
   inside the TTL; a write reported as failed when Okta accepted it does not
   recover.

`ruleWrites.ts`'s module doc no longer claims to be pure transport. It now says,
first thing, that this layer is transport **plus one cache effect**, what
invalidates, what does not, and why — because the next person adding an
operation there is the person this decision exists to protect.

## Consequences

**`useRuleLifecycle` changes behaviour.** Activating or deactivating a rule now
invalidates the org-wide snapshot. That is `D-095` fixed, deliberately, as part
of this decision rather than as a side effect of it.

**The transport layer is no longer a pure function of `CoreApi`.** A test of
`createRuleWriteOperations` has to mock `RulesCache`. That cost is paid once, in
one suite, versus being re-derived correctly by every future caller.

**`createRuleWriteOperations` is the only rule-write entry point,** exported from
`useOktaApi/index.ts` and composed into the facade in `useOktaApi.ts`. A caller
who wanted to write a rule without invalidating would have to hand-roll the
requests against `makeApiRequest`, which is visible in review in a way that a
missing `clear()` is not.

**Where the tests went.** The per-caller assertions were retargeted, not thinned
(ADR-0022). `useCreateFeedingRule`'s "drops the org-wide rules cache once the
write lands" and "leaves the cache alone when Okta rejects the create" are now
`ruleWrites.test.ts`'s "drops the org-wide snapshot when a rule is created" and
"leaves the snapshot alone when the create is rejected". `useRuleConsolidation`'s
three cache assertions became write-ordering assertions in that suite — which
writes it issues before it aborts, the thing the hook is still responsible for —
plus, at the write layer, the created-rule-failed-validation case that pins the
`D-089` abort path. The activate/deactivate pair no caller ever asserted
(`D-095`) is now covered there too, in both the success and failure directions.

## Alternatives considered

**Leave it per-caller and add a lint rule or a test that fails when a write path
forgets.** Rejected: any such check has to know which functions are "rule writes"
and which call sites are "callers", which is the same knowledge the invalidation
itself encodes — so it is a second, weaker copy of the invariant that can drift
from the first. It also does nothing for a caller that calls `clear()` in the
wrong place, which is half of what `D-089` was about.

**A thin decorator above `ruleWrites`, keeping the transport pure.** This was the
most attractive alternative and is what `D-096` floated. It fails on
enforceability: the decorator has to be applied somewhere, and the undecorated
factory stays exported and importable, so "a rule write cannot silently skip
invalidation" degrades to "a rule write composed the usual way does not skip it".
Making it airtight means the undecorated factory becomes module-private and the
exported name becomes the decorated one — at which point the exported
`createRuleWriteOperations` invalidates, which is this decision with an extra
file. The extra file buys a cleaner unit test for the transport half and costs a
reader one more hop; that trade was judged not worth it while there is exactly
one cache to invalidate.

**Invalidate on `success` of the returned result rather than of the transport.**
Simpler to state and wrong in the one case that matters: a created rule whose
response we could not parse is a rule that exists.

## Not decided here

The repopulation race `D-096` noted is still open. Between a create and its
follow-up deletes, a concurrent `loadRules(false)` can refill the entry with a
pre-delete inventory that then lives its full TTL. Moving the invalidation under
the write narrows the window — there is now a `clear()` after _each_ retire
rather than one before them all, so a snapshot written mid-loop is dropped by the
next delete instead of surviving — but the last write's own race remains. Closing
it is cache-generation work (a monotonic generation stamped on read and checked
on write), not another `clear()`, and it should be decided on its own.
