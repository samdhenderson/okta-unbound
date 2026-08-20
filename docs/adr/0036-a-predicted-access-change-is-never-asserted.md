# ADR-0036: A predicted access change is hedged, withheld, or silent — never asserted

- Status: Accepted
- Date: 2026-08-20
- Relates to: ADR-0017 (`unevaluable` is never `no-match`), ADR-0020 (provenance;
  a failed lookup is never an attribution), ADR-0021 (group-context evaluation
  needs a **complete** list), ADR-0031 (per-membership proof, on demand),
  ADR-0035 (the profile write this predicts)

## Context

[ADR-0035](./0035-the-first-profile-write.md) gave the extension its first
user-profile write. In an org with group rules that write is not metadata
maintenance: **the attribute is the access control**. Setting `department` to
`Finance` is a group grant, issued through a field that looks like HR data and
applied asynchronously by a scheduler nobody in the panel can see.

An admin about to commit such an edit wants the obvious question answered — _what
does this do to their access?_ — and the panel is unusually well placed to answer
it. It already holds the user, the org's rule inventory, and (on the detail rung)
the user's complete membership list. Answering costs no request at all.

The danger is equally obvious. A prediction is a claim about a state that does not
exist yet, produced by a client-side reimplementation of Okta EL, over an inventory
that is missing data Okta has. Everything ADR-0017 and ADR-0020 established about
_reads_ — that "we could not evaluate this" must never be rounded to "this does not
match", that a failed lookup is never an attribution — applies with more force to a
statement about the future, because the reader is about to act on it.

## Decision

**Answer the question, and let every answer carry its own certainty in the value's
own name: `likely-added`, `likely-removed`, or `not-predicted` with a reason.**

`shared/membership/blastRadius.ts` is a pure, synchronous engine costing **zero API
calls**: it re-evaluates the org's rule inventory against the drafted user and diffs
the verdicts. It imports no logger and must never have one — every string it touches
(rule names, condition expressions, group names, drafted values) is
end-user-controllable tenant data, which is why the report carries **reason codes**
and the sentences live in `shared/rules/unevaluableReasonText`.

### 1. Everything is `likely`, and the hedge lives in the value

The hedge is in the name of the `GroupEffectKind` rather than in a caption a caller
might drop. Certainty is structurally unavailable, for three reasons:

1. A `MembershipRule` carries no exclusion list — a cache-served `FormattedRule`
   drops `conditions.people` entirely — so an exclusion is invisible here and can
   only ever make the engine **over**-predict.
2. `ruleEvaluator` is a client-side reimplementation of a documented subset of Okta
   EL, not Okta EL.
3. Rule application is asynchronous, so even a correct prediction describes a state
   Okta has not reached yet.

### 2. Predicting a gain is cheap; predicting a loss must clear six gates

An addition needs a rule to start matching and the user not to already hold the
group. A **removal** is the claim that costs an admin something when it is wrong,
so `removalEffect` requires all six of:

1. **The user holds the group** — otherwise nothing is emitted at all. A removal is
   meaningless for a group they are not in; this is the existence question, and
   every gate below it is about evidence.
2. **Some candidate rule is `ACTIVE`** — else `rule-inactive`. An `INACTIVE` rule
   places nobody, so its verdict flipping changes nothing.
3. **The group is not an `APP_GROUP`** — else `app-mastered-group`. The application
   owns that roster; no group rule adds to it and none removes from it, and
   `ruleImpact.classifyGroupImpact` returns the identical answer from the rule side.
4. **The membership is rule-bucketed** — else `membership-not-credited-to-rule`. A
   manual add, an app-mastered group or an unresolved membership is not taken away
   by a rule ceasing to match.
5. **Its attribution is an answer, not a deduction** — else
   `membership-attribution-hedged`. Past gate 4 the only other labels are `Rule?`
   and `Rule · N?`, both hedges, and a hedged cause cannot carry an unhedged
   consequence (ADR-0020).
6. **No _other_ ACTIVE rule targeting the group still holds them.**

Gates 4 and 5 go through **`membershipVerdict`'s classifier** rather than
re-reading `membershipType` / `attribution` / `provenance` here — a second reading
of those fields is exactly the drift that module exists to prevent, and is what
would let this engine predict a removal for a membership the Groups pane displays
as `Direct`.

Exclusion lists are deliberately not consulted in gate 6: a `FormattedRule` does not
carry one, so the check would be vacuous for the inventory this normally runs on —
and where one is present, counting an excluding-but-matching rule as a blocker
merely withholds a prediction. The cheap reading is also the conservative one.

### 3. The two hard cases, and why both withhold

Gate 6 has two halves, and both are the point.

- **Another ACTIVE rule still matches the drafted user** → withhold, and **name the
  blocker** (`another-active-rule-still-matches`, carrying `blockingRuleName`). The
  membership survives, and saying which rule keeps it alive beats shrugging.
- **Another ACTIVE rule targeting the group is _unevaluable_ against the drafted
  user** → withhold, `rule-unevaluable-after`. We do not know that it fails to hold
  them, and predicting removal anyway converts an `unevaluable` into a "no" — the
  one conversion ADR-0017 and ADR-0020 forbid outright. This is the gate that gets
  missed, and it is the whole reason the reason code exists.

A definite blocker is checked before an unevaluable one only because naming the
rule is more useful than shrugging at it; both outcomes are equally non-committal.

Hence `not-predicted` is a **peer** of the other two kinds, not their absence. It is
emitted only where something was implicated, always carries a `WithheldReason`, and
collapsing it into "nothing happens" is the move ADR-0020 banned. The report's
`status` is three-valued for the same reason: `not-computed` (the rule inventory has
not resolved yet — render as "not computed", never as a finding) is kept distinct
from `unavailable` (an attempt completed and failed, which _is_ reportable),
because "not yet" and "we tried and failed" are different things to tell an admin.

### 4. One pass, not a fixed point

Gaining or losing a group can flip an `isMemberOf*` clause in another rule. The
engine makes a **single pass** and then merely _scans_ for that possibility, naming
the rules that could cascade (`secondOrderPossible`, `secondOrderRuleNames`). It
does not iterate, for two reasons:

- A `likely-added` group fed back into round two is consumed by `isMemberOf*` as
  **fact** — those functions are two-valued over the list they are given (ADR-0021)
  — so rounds of "likely" would compound into one confident claim with no
  vocabulary left to carry the accumulated doubt.
- Rule application is scheduled per rule, not transactional, so there is no moment
  at which the round-two input state is guaranteed to exist.

The gap is **named in the UI** instead of being closed by arithmetic. That is the
answer an admin can act on.

### 5. Zero API calls, and what makes the group context sound

The engine performs no I/O: it takes the user, the draft, the membership list, the
rule inventory and a group-name map, and returns a report. Its React wrapper
(`useBlastRadius`) adds one `chrome.storage.local` read for the name map and
nothing else, so this path never touches the scheduler. It is also **opt-in** — a
button, not a live readout — because a prediction that redraws itself mid-word
invites an admin to read a verdict about a half-typed value as a verdict about the
value they meant. A report is retracted the instant the draft or the subject
changes: a stale report beside an edited field is a confident, specific, wrong
answer that a reader cannot tell apart from a fresh one.

## How this sits with ADR-0020, ADR-0021 and ADR-0031

It contradicts none of them and depends on all three.

- **ADR-0020** governs what may be said about a membership that exists; this
  governs one that does not exist yet. Its ban — never manufacture a confident
  answer out of an absent one — is inherited wholesale: `not-predicted` with a
  named reason is the future-tense form of `UNKNOWN` / `ambiguous`. The
  `MembershipAttribution` union is untouched; nothing adds a fourth level, and the
  engine reads the existing classifier rather than writing a second.
- **ADR-0021** is a load-bearing precondition, not merely a relation.
  `BlastRadiusInput.memberships` must be **complete**, because it becomes the
  `RuleGroupContext` every `isMemberOf*` clause is answered from and that answer is
  two-valued over the list it is given; a subset would turn every omitted group into
  a fabricated no-match, in a module whose whole purpose is never to manufacture
  one. The same two-valuedness is what makes §4's single-pass decision necessary.
  `groupContextOf` is replicated from `accessCause`'s module-private helper and
  pinned against it by test, so two surfaces cannot answer `isMemberOfGroup`
  differently about one person.
- **ADR-0031** is untouched and unreached: its per-membership proof is a
  user-initiated read against a different endpoint, and this engine issues no
  requests at all. Where a proof has been taken the engine sees it only through
  `membershipVerdict`, the single classifier both go through — so a proven
  membership strengthens a prediction by the ordinary route, and nothing re-derives
  provenance.

## Consequences

- An admin can see what an edit does to access **before** committing it, at no
  request cost, and the report is explicit about what it declined to say. The
  withheld entries are the feature, not the shortfall.
- The engine is pure and lives in `shared/`, so it is testable without React and
  reusable by the bulk editor (`features-plan.md` item C) without a rewrite. It
  reaches into `sidepanel/components/users/membershipVerdict` for the classifier
  — deliberately, to avoid a second one — which is the one direction of that import
  worth accepting.
- No new API call, message action, permission or cache key.
- Two module-private helpers (`groupContextOf`, the condition-expression accessor)
  are **replicated** from `accessCause` rather than exported across a feature
  boundary, and pinned against the originals by test. Copying is normally the wrong
  answer; here the alternative was widening another module's seam for one caller,
  and the test makes the copies unable to drift.
- **Residual.** ADR-0020's known evaluator gap is inherited: `shared/ruleEvaluator`
  resolves an absent profile attribute to `null`, which compares as a definitive
  no-match rather than `unevaluable`. A drafted user with a sparse profile can
  therefore produce an `unchanged-no-match` the engine is entitled to assert; the
  report carries every unchanged rule rather than dropping it, so that assertion is
  at least visible to a reader.
- **Residual.** The invisible exclusion list (§1) means the engine can predict an
  addition Okta will not make. It is bounded in one direction — over-prediction, not
  under-prediction — and the `likely` vocabulary is what carries it. Naming an
  exclusion would need the raw rule rather than the cached `FormattedRule`.
