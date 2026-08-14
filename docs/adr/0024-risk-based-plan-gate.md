# ADR-0024: Trigger the plan gate on risk, not on a file count

- Status: Accepted
- Date: 2026-08-13
- Supersedes: the trigger in [ADR-0013](./0013-plan-and-approval-gate.md); its
  rationale and required plan contents stand.

## Context

ADR-0013 gates any change touching **more than ~2 files** behind a plan and explicit
approval. The intent was right — surface a disagreement at the plan, not in review —
but the trigger is a proxy for risk, and a poor one.

Nearly everything here touches three files. A shared component is its own file plus a
barrel plus a story (all three mandated by ADR-0010 and `docs/components.md`). A
renamed export touches every importer. Adding a util touches the util, its test, and
its caller. The gate fires on all of it, including changes with no design content
whatsoever.

Two failure modes follow, and both are worse than no gate:

- **The gate becomes ceremony.** A plan produced for a mechanical three-file rename
  teaches a reviewer nothing, so plans stop being read carefully — including the ones
  that matter.
- **The gate blocks the wrong work.** A cleanup program that deletes 40 files is
  maximally mechanical and minimally risky, yet maximally gated. Meanwhile a
  genuinely consequential one-file change — a new cache key grammar, a scheduler
  priority change, a regex against user-controlled input — is exempt.

File count measures diff size. What the gate should measure is whether an approach is
being committed to.

## Decision

**The plan gate fires on risk, not on a file count.** Produce a plan and stop for
explicit go-ahead when a change:

- **commits to an approach** that would be expensive to unwind — a new abstraction,
  data path, storage schema, cache-key grammar, or message action;
- **is architecturally significant** in the ADR-0001 sense, i.e. it will need an ADR;
- **is cross-cutting** — one pattern applied across many call sites, where landing it
  half-done is worse than not starting;
- **is scoped from** `docs/features-plan.md` or `docs/rockstar-parity-plan.md`;
- **touches the security surface** — the manifest, message validation, the XSRF path,
  logging, exports, or Okta-response handling;
- **changes an existing contract** — an assertion under
  [ADR-0022](./0022-test-lifecycle.md), a public hook signature, or a documented
  behavior.

**Explicitly exempt**, at any file count:

- mechanical mass changes — deletions of already-identified dead code, renames,
  de-exporting, formatting, dependency bumps;
- migrations already approved as part of a program plan. The program plan **is** the
  approval; re-gating each slice re-litigates a settled decision. Individual slices
  still land one at a time and are still reviewed.
- single-file fixes with no design content, as before.

The plan's required contents are unchanged from ADR-0013: **affected files**,
**approach**, **which existing tests it should be checked against**, and **any new
tests needed**. Claude Code's plan mode remains the mechanism.

When in doubt, the test is: _would a reviewer disagree with the approach after the
code exists?_ If yes, plan first. If the only possible disagreement is "you missed
one," don't.

## Consequences

- Fewer plans, each carrying more signal. The gate stops being background noise.
- Some multi-file changes now proceed without a plan. That is the intended trade:
  the exempted categories are ones where the diff _is_ the plan.
- "Cross-cutting" and "commits to an approach" require judgment, where "more than 2
  files" did not. That is deliberate — the old trigger was precise and wrong. The
  exemption list is what keeps it from drifting back to gating everything.
- The cleanup program this ADR lands with is itself the first beneficiary: its
  Phase 1 deletions and Phase 2 migration slices are exempt under the program-plan
  clause, while each new ADR it produces is gated on its own merits.
- ADR-0013 stays on the record. Its Context, its required plan contents, and its
  relationship to the ADR process are all still current; only the trigger moves.
