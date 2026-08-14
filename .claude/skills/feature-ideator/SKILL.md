---
name: feature-ideator
version: 1.0.0
description: >-
  Generates and triages candidate features for Okta Unbound — sourcing ideas from real
  Okta admin jobs-to-be-done, from the gap between what the API can answer and what the
  app currently asks, from promises the docs make that the code does not keep, and from
  parking rationales that have expired; then killing anything this architecture forbids,
  costing the survivors in API calls, and writing them up in the house format. Use when
  asked what to build next, for feature ideas, UX or usability improvements, a roadmap
  suggestion, "what's missing", "what would make this more useful to an Okta admin",
  "how could this be better", "any quick wins", when grooming docs/features-plan.md or
  docs/rockstar-parity-plan.md, or when evaluating whether a proposed feature is worth
  building.
---

# Generating features worth building

Ideas are cheap; _survivable_ ideas are not. Most of the value here is in the four
steps around the creative one — sourcing from real admin work rather than from whatever
is on screen, killing what this architecture forbids before writing it up, costing what
survives, and presenting it so a decision can actually be made.

Okta Unbound is a Chrome MV3 side panel for Okta group/user administration: read-heavy,
audited, single-tenant, all traffic rate-limited through a background scheduler.

## The procedure

**1. Read prior art first — always.** `docs/features-plan.md` (ranked catalog, shipped
work, tech debt, parked/rejected with rationale) and `docs/rockstar-parity-plan.md`
(the Port / Re-scope / Drop triage and the phased roadmap). Both are living documents
and both record _why_ something was rejected specifically so it is not re-litigated.
Proposing a rejected idea without engaging its rejection wastes the reader's time.

**2. Establish what ships today.** Not what the README claims — what the code does. The
gap between the two is itself an idea source (step 3 in
`references/idea-sources.md`).

**3. Generate from the four sources.** Admin jobs-to-be-done, the capability-surface
diff, stated-vs-shipped gaps, and expired parking rationales. Worked as methods in
`references/idea-sources.md`; the admin-work taxonomy is in
`references/admin-jobs.md`.

**4. Apply the kill filters** — below, before writing anything up.

**5. Cost each survivor.** Hand the call-count question to the **`okta-api`** skill.

**6. Write up in the house format** — below.

## The kill filters

Apply these before an idea is written up, not after. Each has already killed something
real, which is why it is stated as precedent rather than as principle.

| Filter                                                                                                     | What it kills                                                                                     | Precedent                                                                                                           |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Single-tenant.** Every call targets one browser tab's live Okta session. Two orgs at once is impossible. | Cross-tenant migration, org-to-org diffing, "compare staging to prod"                             | Feature G (Policy Migrator) **rejected** — would need a different transport plus persisted cross-tenant credentials |
| **Never persist tokens; never send data anywhere.**                                                        | External enrichment, cloud backup/restore, third-party analytics, "sync to a spreadsheet service" | Backupta integration **dropped** on privacy grounds                                                                 |
| **No DOM scraping, no hand-built HTML, no dynamic code execution.**                                        | Anything reading Okta's own settings pages for data the API does not expose                       | App Notes and App Sign-On Policy scraping **dropped**                                                               |
| **All traffic on the scheduler; per-entity fan-out is a real cost.**                                       | "Just check every user" ideas that are not costed, cancellable, and progress-reporting            | ADR-0009 — one batch runner, bounded concurrency                                                                    |
| **Least privilege.** A new manifest permission or host match needs its own ADR.                            | Casual "we could also read X" scope creep                                                         | ADR-0015                                                                                                            |
| **Every mutation audits, confirms, and captures prior state so undo can restore.**                         | Write features estimated as if they were read features                                            | `docs/features-plan.md` ground rules                                                                                |
| **Okta responses are untrusted; validate with zod at the boundary.**                                       | Features that branch on unvalidated response shape                                                | ADR-0006                                                                                                            |

Two filters that are softer but decide priority rather than survival:

- **Read beats write.** A read feature ships behind no ADR and no undo contract. The
  same insight delivered read-only is often 60% of the value at 20% of the cost — and
  the parity plan already re-scoped several features this way rather than dropping
  them.
- **Zero-API-cost beats everything.** A feature computed from data already loaded has
  no rate-limit budget, no cancellation UI, and no failure mode. Feature H leads the
  catalog for exactly this reason.

## Costing

Every idea carries a call count, and the difference between shapes is decisive:

| Shape                                     | Cost                          | Verdict                                                                                             |
| ----------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| Pure computation over already-loaded data | 0 calls                       | Ship it                                                                                             |
| One paginated list                        | `ceil(n/200)`                 | Cheap                                                                                               |
| A list plus a collapsing `expand`         | `ceil(n/200)`                 | Cheap — this is the win `expand` exists for                                                         |
| One call per entity, collapsible          | N, reducible to `ceil(n/200)` | Ask `okta-api` for the parameter                                                                    |
| One call per entity, **irreducible**      | N                             | Needs confirm-gating, progress, and cancellation. Per-user MFA factor reads are the canonical case. |

Ask **`okta-api`** for the actual numbers rather than estimating: which endpoint, which
collapsing parameter exists, whether it survives the `rel="next"` link, and whether the
cost is irreducible. "Irreducible" is a respectable answer — it changes the UX (a
confirm-gated manual load, as the MFA scan already does), not the verdict.

## Output format

Match `docs/features-plan.md`, which is where accepted ideas land. Per idea:

- **The question it answers**, in an admin's own words — _"who loses access if I
  deactivate this rule?"_, _"why isn't this person in that group?"_. An idea that
  cannot be phrased this way is a solution looking for a problem.
- **Effort / Impact / Verdict** — S/M/L/XL, Low/Med/High, and one of Build ·
  Fast-follow · Parked · Rejected.
- **Reuse row** — the existing primitive it builds on, named with its path. The reuse
  map at the top of `features-plan.md` is the first place to look; proposing something
  that reinvents `runBatch`, `BulkTargetList`, or `ProgressContext` signals the idea
  was not grounded.
- **API cost** — from the costing step, as numbers.
- **Ground rules triggered** — new write surface? new permission? an ADR? Say so in the
  pitch, not during implementation.
- **Done when** — one falsifiable sentence.

Where a real design fork exists, give **three options with one recommended** — the
established convention in both plan docs. Where no fork exists, do not manufacture one.

## Standing rules

- **Ground every idea in something checkable** — a specific endpoint, a specific file,
  a documented Okta behaviour, a recorded admin pain. An idea with no anchor is a guess
  and should be labelled one.
- **Honour recorded rejections.** Re-proposing a parked idea is legitimate _only_ by
  showing its stated reason has expired. Say which reason and what changed.
- **Do not silently rescope.** An idea that survives only in reduced form is a
  different idea; present it as one.
- **Propose; do not edit the plan docs.** Produce ideas in the conversation and offer
  to append accepted ones to `docs/features-plan.md`. Editing a living planning
  document unprompted pre-empts the plan gate (ADR-0024) and the one-concern-per-PR
  rule.
- **Prefer specificity over volume.** Three costed, anchored, kill-filtered ideas beat
  a list of twelve.

## Routing table

| If the task is…                                                             | Read                                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Grounding an idea in what Okta admins actually spend time on                | `references/admin-jobs.md`                                                               |
| Understanding what the API can answer that the app never asks               | `references/idea-sources.md`                                                             |
| Working the stated-vs-shipped gap, or checking an expired parking rationale | `references/idea-sources.md`                                                             |
| Costing an idea, picking an endpoint, or checking a collapsing parameter    | the **`okta-api`** skill                                                                 |
| What has already been proposed, shipped, parked, or rejected                | `docs/features-plan.md`, `docs/rockstar-parity-plan.md` — read live, never restated here |
| Whether an idea fits the message-passing and caching architecture           | `docs/architecture.md`, `docs/state-management.md`                                       |
| Whether a UX idea meets the loading / empty / error / a11y bar              | `docs/ux-guidelines.md`                                                                  |
| Landing an accepted export idea as code                                     | the **`export-descriptor`** skill                                                        |

## Additional resources

- `references/admin-jobs.md` — the Okta admin jobs-to-be-done taxonomy, each job mapped
  to what the app does today and where the gap is.
- `references/idea-sources.md` — the four generation methods worked in detail,
  including the capability-diff recipe and the parking-rationale expiry check.
