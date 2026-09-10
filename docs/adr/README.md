# Architecture decision records

Records of decisions where the **reasoning** has to outlive the rule.

Seventy-four records were deleted on 2026-09-09 and the rules that were still
live were folded into the specs in `docs/` as plain house rules. Numbering
restarts at **0001**, and the shelf is deliberately near-empty.

| Record                                    | Decision                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| [0001](0001-rule-assessment-certainty.md) | Rule assessment: the certainty ladder, and which expression functions the evaluator refuses |

## What went wrong the first time

Worth knowing, because the failure mode is easy to repeat.

The corpus grew to 74 records and roughly 12,000 lines, and every convention in
the project came to be cited by number. Reasoning about a single rule meant
walking a chain — `0051 §1` superseded by `0061 §1` superseded by `0068`, with
`0069` quietly falsifying `0061`'s worked example. Four records to learn one
thing, and the answer was in none of them individually.

Three specific failures, so they can be recognised early:

- **Records outlived their accuracy.** Because a record is immutable once
  accepted, and the code is not, a record slowly becomes a description of a
  system that no longer exists. Rewriting the specs against the code turned up
  drift in nearly every one: a whole shipped feature no record described, a
  record naming four published custom properties where the code publishes two, a
  flatly-stated ban with four live exceptions, a narration script filed under a
  path that was never used.
- **`Status:` stopped meaning anything.** Fifteen records sat at `Proposed`.
  Twelve of them were fully implemented and shipped; the field was simply never
  flipped. Deleting them as "never accepted" would have destroyed twelve live
  rules.
- **The rule and its argument were stored together**, so finding the rule meant
  reading the argument, every time — and the argument is the part that ages.

## The rule now

**A convention goes in a spec doc. An ADR is for the fork.**

Ask: if the reasoning were lost, would someone re-litigate this? If yes, write
the record. If the outcome can simply be stated as an instruction, state it in
the owning doc and write nothing here.

The bar is the plan-and-approval gate in `CLAUDE.md`: a change that commits to an
approach, is architecturally significant, is cross-cutting, touches the security
surface, or changes an existing contract. A change that does not need a plan does
not need a record.

## Writing one

1. Number sequentially from `0001`. Filename `NNNN-short-kebab-title.md`.
2. `Status: Accepted` with a date. If it is genuinely still a proposal, say so —
   and come back and change it, or delete it. A record that sits at `Proposed`
   while its code ships is worse than no record.
3. Context / Decision / Consequences. Keep it short; the argument is the point,
   not the ceremony.
4. **State the resulting rule in the owning spec doc in the same PR**, and add it
   to that doc's routing row if it is new. The record holds the _why_; the spec
   holds the _what_. A reader should never need this directory to do their job.
5. When a later decision changes an earlier one, **edit the spec doc to its final
   state** and write the new record. Do not build a supersession chain — that is
   what made the last corpus unreadable.

## One caveat while the reset settles

Roughly 1,270 comments under `src/` and 457 under `reel/` still cite the old
corpus by number, and have not been swept yet. Until they are, `ADR-0040` in a
code comment is ambiguous: it may mean a deleted record or a new one. Keep new
records few and deliberate until that sweep lands.

The deleted records remain in git history if an old rationale is ever needed.
