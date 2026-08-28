# Product

The **why** doc. Every other doc in `docs/` describes how to build something; this
one says what to build and what to refuse. Read it before scoping a feature,
before adding a tab, and before arguing that something belongs in the roadmap.

## Purpose

Okta's admin console shows you a **curated subset** of what your admin role can
actually do, and it never explains **why** access is the way it is. Okta Unbound
removes both limits — with the explanation, preflight, audit, and undo the
console would not have given you either.

Two differentiators, one table-stakes tier:

| Tier             | What it means                                                    |
| ---------------- | ---------------------------------------------------------------- |
| **Explain**      | Why this access exists, what would change it, what would break   |
| **Unbind**       | The actions your role entitles you to that the console withholds |
| **Table stakes** | Browsing, search, CSV export — necessary, not differentiating    |

A feature that is not in a differentiating tier is capped, not championed.

## Who it is for

Okta administrators at orgs large enough that "why does this person have that"
is a recurring ticket rather than a curiosity — and the security teams who
review extensions before approving them. Distributed publicly, so a feature must
survive orgs we have never seen: no assumptions about org size, naming
conventions, or which profile attributes exist.

## The jobs

| #   | Job                                          | Tier         |
| --- | -------------------------------------------- | ------------ |
| J1  | "Why does this person have (or not have) X?" | Explain      |
| J2  | "If I change this, who breaks?"              | Explain      |
| J3  | "Why are these two people different?"        | Explain      |
| J4  | "Is this population healthy?"                | Explain      |
| J5  | "Prove it to an auditor"                     | Table stakes |
| J6  | "Now fix it"                                 | Unbind       |

J6 is where the product is weakest and where the console is most restrictive.
That is not a coincidence — it is the opportunity.

## Outcomes

There is no backend and no telemetry, so these are task-shaped, not dashboards.

- **O1 — Time-to-answer.** A "why does X have Y" ticket goes from several console
  tabs and a hand-read rule expression to one panel and under a minute.
- **O2 — No blind writes.** Every mutating verb shows a preflight or predicted
  impact before it commits. This is an invariant, not a per-feature choice.
- **O3 — Every answer is defensible.** No claim on screen without a named source,
  or an explicit `unevaluable` / `likely-*` hedge. Already enforced in code by
  ADR-0020, ADR-0031 and ADR-0036 — this is the moat. Anyone can list groups;
  nobody else refuses to guess.
- **O4 — Zero trust cost.** Passes an enterprise extension review cold. See
  `security.md`. Already true; protect it.
- **O5 — Sprawl reduction.** The only outcome measurable in-product: clutter
  score before and after.

## Two rules for information architecture

> **Rule 1 — A tab is a question you arrive with, not an object type you own.**
> Object types live at the detail rung. If a tab cannot state its question in one
> sentence that no other tab answers, it is not a tab.

> **Rule 2 — An action lives on the ActionBar of the entity it mutates, and
> nowhere else.** ADR-0039 says this. A verb reachable only from a
> context-detected surface is a bug, not a shortcut.

### The tab map

| Tab      | Its one question                          | State                        |
| -------- | ----------------------------------------- | ---------------------------- |
| Home     | Is my tenant OK, and what changed?        | To build — replaces Overview |
| Users    | Why does this person have what they have? | Has a detail rung            |
| Groups   | Who is in this and why?                   | Has a detail rung            |
| Apps     | Who can reach this, through what?         | Needs a detail rung          |
| Rules    | What does this do, and what breaks?       | Needs a detail rung          |
| Export   | Give me the evidence                      | Done; capped                 |
| History  | What changed, and can I undo it?          | Needs widening               |
| Policies | (unresolved — deepen or dissolve)         | Read-only cards today        |
| Explorer | (developer tool)                          | Demote behind advanced       |

**Overview is dissolved, not restyled.** Today it is a weaker fifth rendering of
entities that already have proper detail rungs — same member explorer, fewer
sections, plus two buttons that duplicate `GroupActionBar`. Home replaces it with
the one thing a detail rung structurally cannot duplicate: an org-scoped report.
ADR-0040 was written to unblock exactly this and says so in its own Context
section; `I-012` (tiered snapshot depth) is the gate.

## Write verbs — the Unbind bar

A write earns its place by clearing this bar. State each answer in the feature's
ADR:

1. **What the console does instead, and why ours is better.** If the console does
   it well, we do not build it.
2. **The preflight** — what the admin sees before committing (O2).
3. **The reversal** — what is captured so undo can _restore_, not just log.
4. **The blast radius** — never write an attribute a feeding rule reads without
   naming the rule and the membership change it would cause (ADR-0036).

### Three reversibility classes

ADR-0039 sorts verbs into reversible-on-the-row and destructive-behind-More. A
third class exists and needs its own treatment:

- **Reversible** — defaults to the action row.
- **Destructive but restorable** — behind **More**, confirm modal, prior state
  captured so undo restores.
- **Irreversible** — no prior state exists to capture. Set Password is the
  archetype: you cannot restore a password. These need a confirm that says so in
  plain language, and an audit entry that records the act without pretending it
  can be undone. **Do not ship an irreversible verb whose confirm implies
  otherwise.**

### Ranked Unbind backlog

| Verb                                      | Why it clears the bar                         |
| ----------------------------------------- | --------------------------------------------- |
| Bulk attribute edit over a filtered group | No console equivalent; entered from an answer |
| Add group from Compare's diff             | The diff is computed; the write is not wired  |
| Set Password to a chosen value            | Console offers only email reset / random temp |
| Admin roles — view, then grant/revoke     | Console has no "who has what" list at all     |
| Verify Factors                            | Console can reset a factor, not verify one    |

Every one of these is a **named** operation with knowable consequences, which is
what makes rules 1–4 above satisfiable.

## What we deliberately do not build

Recorded so it is not re-litigated. See also the parked lists in
`features-plan.md` and `rockstar-parity-plan.md`.

- **Free-form Explorer writes.** A generic method-and-body box is the one write
  surface that cannot be preflighted, explained, audited meaningfully, or undone,
  because it has no known semantics. It breaks O2 and O3 by construction. If the
  Explorer ever writes, it replays documented operations; it does not accept
  arbitrary bodies. (ADR-0041 keeps it GET-only today.)
- **Anything that sends data to a third party.** Kills O4 outright.
- **Cross-tenant work.** The single-tab session model cannot address two tenants,
  and persisting credentials to fix that is not on the table.
- **Cosmetic tweaks to Okta's own pages.** A side panel supersedes them.
- **HTML scraping of console pages.** Fragile, and against "every response is
  untrusted, no hand-built HTML."

## How this doc relates to the roadmap docs

- **This doc** — purpose, outcomes, tiers, and the bar a feature must clear.
- [features-plan.md](./features-plan.md) — the ranked backlog and UX sketches.
- [rockstar-parity-plan.md](./rockstar-parity-plan.md) — **evidence, not a goal.**
  Its triage table is a useful survey of what admins reach for. "Stop needing
  rockstar" is not a purpose and cannot tell us what to build once parity lands;
  this doc supersedes it as the source of direction.
