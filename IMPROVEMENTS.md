# Improvements

UX and feature-completeness work. Correctness/security/perf/standards bugs
live in `DEBT.md` instead — same item format, different track.

Seeded from Sam's Step 1 idea dump (2026-08-20) plus a real scan of the code
each item cites. **Treat that dump as a taste signal, not a literal ceiling**
— the underlying principle ("the same logic/data should behave the same
everywhere it's shown"; "a raw id should become a named, actionable thing
wherever it appears") is what nightly runs should keep hunting for, not just
the exact call sites Sam happened to name.

Format:

```
### I-NNN · <title>
- **Category:** ux | feature-completeness
- **Priority:** P0 security/data-loss · P1 correctness · P2 perf/UX friction · P3 polish
- **Size:** S <1hr · M half-day · L needs breaking down
- **Files:**
- **Verified:** YYYY-MM-DD — <who or what confirmed the Problem still holds>
- **Problem:**
- **Done when:** <checkable without asking Sam>
- **Risk:**
- **Status:** open | claimed:<branch> | research:awaiting-review
  | blocked:<reason> | done:<PR#> | closed:refuted-<date>
  | closed:overtaken-by-<sha>
```

The status words and the `Verified` line mean exactly what `DEBT.md`'s format
block says they mean — same vocabulary, one definition, defined there.

---

### I-008 · Propose Okta Expression Language function coverage

- **Category:** feature-completeness
- **Priority:** P2
- **Size:** L
- **Files:** `docs/adr/0055-what-the-evaluator-refuses-to-guess.md` (to be
  created), `src/shared/ruleEvaluator.ts:298-320` (read-only, for reference)
- **Verified:** 2026-08-24 — `SUPPORTED_FUNCTIONS` still holds seven entries.
- **Problem:** The evaluator implements seven `String.*` functions and nothing
  else — no `toString`, no `DateTime`, no `Instant`. A group rule whose
  condition uses any of those is reported as unevaluable, so the admin asking
  "why is this person in this group" gets no answer for exactly the rules that
  are hardest to reason about by hand. Sam wants broader coverage both for
  rule-display fidelity and as groundwork for future policy evaluation.
- **Done when:** `docs/adr/0055-what-the-evaluator-refuses-to-guess.md` exists
  at Status: Proposed. **This item ships no code** — its PR touches `docs/`
  only. The proposal must:
  1. Enumerate the OEL functions reachable inside a **group-rule condition**
     specifically, not the whole language surface — `SUPPORTED_FUNCTIONS`'
     doc comment already notes that `Arrays.*` helpers are unavailable there
     and deliberately absent.
  2. Classify each candidate as unambiguous / ambiguous / unsupported-by-design,
     and **carry forward the existing principle rather than quietly dropping
     it**: a function is implemented only when its Okta semantics are
     unambiguous, because an approximation that produces a confidently wrong
     answer is strictly worse than reporting the expression unevaluable. Say
     which candidates that rules out and why — a proposal that adds everything
     has not done the work.
  3. Propose arity and type handling for date/time semantics (`Instant`,
     `DateTime`), including timezone and the `UNRESOLVED` propagation the
     evaluator already uses.
  4. State the ADR-0017 security argument for every addition. That ADR exists
     precisely because ad hoc expression evaluation is a known risk, and rule
     expressions are end-user-controllable input (ADR-0006).
  5. Give a test plan, including the malformed and hostile inputs.
- **Risk:** None to write. High if implemented without this scoping — it is a
  security-relevant evaluator.
- **Status:** research:awaiting-review
- **ADR written 2026-08-29** (`chore/unstick-backlog`), at Status: Proposed:
  `docs/adr/0055-what-the-evaluator-refuses-to-guess.md`. The number this item reserved on 2026-08-24 had been taken by an
  unrelated ADR before the item was picked up, so the proposal is **ADR-0055** — see
  `D-072`. Status stays `research:awaiting-review` deliberately: only Sam's
  acceptance moves it to `open`, never the session that wrote it.

### I-009 · EntityLink's default copy-id label collides when two entities share a name

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/shared/EntityLink.tsx:187`
- **Problem:** `copyIdLabel` defaults to `Copy <type> id for <name>`, and
  I-001's prop doc frames distinguishability as solved by folding the name
  in. Two entities can legitimately share a display name — the same "one
  name can match groups from more than one source" case `EntityLink`'s own
  module header calls out — and then two copy controls on one screen carry
  an identical accessible name with nothing to tell them apart, unless the
  caller remembers to pass `copyIdLabel`. `CopyableId` sidesteps this by
  making `label` required rather than derived. Raised by `ui-reviewer` on
  PR #68 as advisory.
- **Done when:** Two `EntityLink`s with `copyId`, the same `type` and the
  same `name` but different ids expose distinguishable accessible names
  without the caller passing `copyIdLabel` — or, if the derived default is
  kept, its doc comment states plainly that a caller rendering same-named
  entities must pass `copyIdLabel`, and a story shows the collision case.
- **Risk:** Low.
- **Status:** open
- **Widened 2026-08-25 by `ui-reviewer` on `I-002`'s diff:** the copy control
  is only half of it. `EntityLink`'s **chip** derives its `aria-label` as
  `Open <type> <name>` (`EntityLink.tsx:146`) and exposes **no override prop
  at all**, so a caller cannot disambiguate it the way `copyIdLabel` allows for
  the copy control. `I-002` now renders two badges side by side inside one rule
  expression, which makes this reachable: two groups sharing a display name
  produce two identically-named "Open group …" controls with different
  destinations. `I-002` passed an explicit `copyIdLabel`, which moves the
  collision to the open control rather than closing it. **Done when** should
  therefore cover the chip's label too, not just the copy control's — and the
  story it asks for should render two badges with the same name and different
  ids, which nothing in the repo does today.

- **Partially addressed in #118 (still open).** The copy half is closed: the
  ghost copy-id recipe became the shared `CopyIconButton` and its label now
  always names what it copies, id included. The **chip** half was deliberately
  not taken. Folding the id into every chip's `aria-label` makes each one
  unique, but a screen-reader user then hears ~20 opaque characters on every
  row of every list to disambiguate a collision that is usually absent — a
  constant cost for a rare problem. Sam's call on 2026-09-02 was to keep the id
  on copy and drop it from open, so `EntityLink.tsx` carries that reasoning as
  a comment and the residual is filed as `D-107`. Close this item only when the
  chip disambiguates _conditionally_, per `D-107`.

### I-010 · The `Copy <type> id for <name>` label still collides on duplicate names

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/RuleCard.tsx:317`,
  `src/sidepanel/components/policies/PolicyCard.tsx:101`,
  `src/sidepanel/components/apps/AppListItem.tsx:148`,
  `src/sidepanel/components/apps/AppListItem.tsx` (the expand/collapse
  `IconButton`, labelled bare `Expand`/`Collapse`)
- **Problem:** `I-004` gave three id rows a copy control named
  `Copy <type> id for <name>`, and handled the empty-name case by falling back
  to the id. It does **not** handle two entities sharing a non-empty display
  name — two rules named the same, two app instances both labelled
  "Salesforce" — which is legitimate in Okta and is the same defect `I-009`
  already pins on `EntityLink`. With both rows expanded, the two copy controls
  carry an identical accessible name with nothing to tell them apart. Raised
  by `ui-reviewer` on PR #74 as advisory, alongside a second instance one
  control over: `AppListItem`'s disclosure button is labelled just
  `Expand`/`Collapse` with no app name at all, where `PolicyCard` next door
  does it correctly (`Show rules for ${name}`).
- **Done when:** Two rows of the same type with the same non-empty name but
  different ids expose distinguishable accessible names on both their copy and
  their disclosure controls, with a story covering the duplicate-name case.
  Decide alongside `I-009` whether the answer is a shared naming helper or a
  per-call-site convention — they are the same problem and should not get two
  different fixes.
- **Risk:** Low.
- **Status:** open
- **Related:** `I-009` (same defect on `EntityLink`'s derived
  `copyIdLabel` default), `I-004` (introduced these three call sites)

- **Partially addressed in #118 (still open).** The three copy controls
  (`RuleCard`, `PolicyCard`, `AppListItem`) now carry labels that name the
  entity and its id. The **disclosure** half is untouched: `PolicyCard`'s
  `Show/Hide rules for <name>` and `AppListItem`'s bare `Expand`/`Collapse`
  still collide on duplicate names. Both were left with explaining comments
  rather than changed, because their assertion files sat outside the lane that
  found them. Filed as `D-103`; close this item alongside it.

### I-011 · A truncated list-row name has no way to reveal itself

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/users/GroupMembershipRow.tsx:195`
  (the `<h4>`), `src/sidepanel/components/groups/GroupListItem.tsx:208`
  (the `<h3>`)
- **Problem:** Both primary row names carry `truncate` and no `title`, so a
  name long enough to clip is simply lost — no tooltip, no accessible-name
  fallback, and no way to read the rest without opening the row. The side
  panel's 360px floor makes this reachable with ordinary Okta group names,
  and the two rows are the ones an admin scans most. Raised by `ui-reviewer`
  on the `I-007` diff as advisory and filed rather than folded in
  (`CLAUDE.md`): it is pre-existing on both files, `I-007` did not introduce
  it, and it spans a file that item never named.
- **Done when:** A name that clips can be read in full — a `title` carrying
  the untruncated name is the cheap route; if a shared treatment is wanted
  instead, apply the same one to both rows rather than two different ones. A
  story renders a name long enough to clip and asserts the full text is
  reachable.
- **Risk:** Low. Note `title` is a hover/focus affordance, not a substitute
  for an accessible name — the name text is already in the accessibility
  tree, so this is about the visual reader.
- **Status:** open

### I-012 · Tiered snapshot depth, and the reporting it unlocks

- **Category:** feature-completeness
- **Priority:** P2
- **Size:** L
- **Files:** `docs/adr/0056-how-deep-the-snapshot-goes.md` (to be created);
  read-only for reference: `docs/adr/0040-the-background-owns-the-org.md`,
  `src/shared/snapshot/snapshotSync.ts` (the `CollectionSpec` / `ShardProvider`
  model), `src/shared/snapshot/types.ts:9-25`,
  `src/sidepanel/components/home/OrgSnapshotCard.tsx`
- **Verified:** 2026-08-24 — four collections wired (`groups`, `apps`, `rules`,
  `appGroups`); no depth control exists.
- **Problem:** ADR-0040 gave the org one background-owned store, and the
  collection model has since grown from "one paginated listing" to "a fan-out
  derived from another collection" (`appGroups`). Nothing yet says **how far**
  an org's snapshot should go, or lets an admin choose. Depth is currently an
  implicit constant — the four collections that happen to be wired — so every
  richer question ("which groups have no rule feeding them?", "which
  app-sourced groups point at a deleted app?", "which rules can never match?")
  is either free or impossible, with nothing in between and no way to opt into
  more.

  The point of naming depth is what it unlocks: with the right collections
  local and fresh, the Overview stops being a set of buttons that each cost a
  walk and becomes a report that is already computed — including **recommended
  org actions**, which need breadth (several collections joined) far more than
  they need any single expensive call.

- **Done when:** `docs/adr/0056-how-deep-the-snapshot-goes.md` exists at
  Status: Proposed. **This item ships no code** — its PR touches `docs/` only.
  It must define named depth levels, what each level walks, what each level
  makes answerable, and how an admin moves between them, plus two hard
  constraints stated up front:
  1. **Every level is priced in both currencies** — requests to reach it, and
     rows stored to hold it — checked against `docs/security.md`'s "store no
     more than needed". Depth is the axis along which a snapshot stops being
     org metadata and starts being a copy of the directory, and the ADR has to
     say where that line is rather than leaving it to whoever wires the next
     collection.
  2. **No level includes group membership without its own retention
     argument.** `src/shared/snapshot/types.ts:9-16` already commits to this —
     membership is the largest and most personal collection in an org, and
     ADR-0040's questions are served by `expand=stats` counts instead. A depth
     proposal is exactly where that commitment would get eroded by accident.

  It must also say how a level interacts with `refreshIntervalMs`, and what
  happens to stored rows when an admin moves **down** a level — a level change
  that only ever adds is a one-way ratchet on disk.

- **Risk:** None to write. Medium once implemented — the design commits the
  storage schema and the sync budget to a shape later levels must live inside.
- **Status:** research:awaiting-review
- **ADR written 2026-08-29** (`chore/unstick-backlog`), at Status: Proposed:
  `docs/adr/0056-how-deep-the-snapshot-goes.md`. The number this item reserved on 2026-08-24 had been taken by an
  unrelated ADR before the item was picked up, so the proposal is **ADR-0056** — see
  `D-072`. Status stays `research:awaiting-review` deliberately: only Sam's
  acceptance moves it to `open`, never the session that wrote it.

### I-014 · Normalize an attribute across the filtered members

- **Category:** feature-completeness
- **Priority:** P1
- **Size:** L
- **Files:** `docs/features-plan.md` item C (the full inventory of what exists
  and what remains lives there, not duplicated here);
  an ADR titled "The first many-user write" (not yet written, and deliberately
  **not** naming a number — `D-072`: ADR-0044 was claimed by an unrelated decision
  while this item held it in reserve);
  `src/shared/undoManager.ts`;
  `src/sidepanel/hooks/useOktaApi/profileOperations.ts`
- **Verified:** 2026-08-24 — the Members tab's filter and the Insights tab's
  attribute spread both shipped on `feat/group-detail-parity`; no bulk write
  exists.
- **Problem:** The Group Detail rework ends one step short of acting on what it
  found. Insights now reports the attribute spread across every browseable
  attribute and marks outlier values — a `department` spelled four ways is
  visible for the first time — and the Members tab can filter down to exactly
  the people holding a given value. Nothing can then fix them. The whole point
  of surfacing config drift is being able to correct it, and the single-user
  editor (ADR-0035) already shipped every piece of machinery the many-user
  version needs.
- **Done when:** An admin can pick an outlier value from the Insights attribute
  spread, review the affected users, and normalize the attribute across them,
  with the run previewed, confirmed, audited and revertable. **Both blockers in
  `docs/features-plan.md` item C are closed first** — the sparse-patch merge
  behaviour verified against a real org, and the undo cap redesigned as one
  run-scoped entry rather than one per user. Ships with the ADR named above at
  Status: Accepted.
- **Risk:** High, and the reason this is its own item rather than a commit on
  the parity branch. It is the app's first many-user write, driven by a
  client-side filter the admin cannot audit row by row, and one of its two
  blockers **cannot be closed from the repo** — verifying the endpoint needs a
  live org.
- **Status:** blocked:needs-live-org
- **Re-gated 2026-08-29 by Sam.** The status was
  `blocked:sparse-patch-merge-unverified`, which named the symptom rather than
  what is actually missing. The item's own **Risk** paragraph already says it:
  one of its two blockers "**cannot be closed from the repo** — verifying the
  endpoint needs a live org." That is the same wall `D-028` sits behind, so it
  now carries the same gate word, and for the same reason — an unattended
  session should not select it and should not spend prose re-deriving why.

  The second blocker (the undo cap, redesigned as one run-scoped entry rather
  than one per user) is **not** live-org work and could be designed from the
  repo today. It is deliberately left inside this item rather than split out:
  designing an undo for a write whose merge semantics are unverified is how the
  undo ends up correct for behaviour Okta does not have.

  If a live-org session happens, run this with `D-028` — both are waiting on the
  same access, and the sparse-patch-merge check is a natural eleventh entry in
  that audit's list.

### I-015 · `ClauseGroupList`'s resolved rows print a raw, uncopyable id

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/users/comparison/ClauseGroupList.tsx:201-205`
- **Verified:** 2026-08-25 — noticed while implementing `I-002`.
- **Problem:** `GroupEntry` renders the raw group id under a resolved name in a
  hand-rolled `<span className="font-mono">` — not copyable, not linked.
  `I-002` cited this list as the sibling that already did the right thing, and
  it now is the _less_ capable of the two: the expression text beside it badges
  the same ids with `EntityLink copyId`.
- **Done when:** The id under a resolved name uses `EntityLink` with `copyId`
  like the expression text does, or the raw `<span>` is replaced with
  `CopyableId` where a link would be wrong. The unresolvable case keeps
  rendering as it does today.
- **Risk:** Low — render-time change, no new fetch.
- **Status:** open
- **Related:** `I-002`, `I-001`

### I-016 · `RuleExpressionText` is consumed cross-feature from `groups/detail/`

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/groups/detail/RuleExpressionText.tsx`,
  `src/sidepanel/components/users/comparison/CauseWorklistRow.tsx`,
  `src/sidepanel/components/shared/index.ts`, `docs/components.md`
- **Verified:** 2026-08-25 — created and immediately cross-imported by `I-002`.
- **Problem:** `I-002` added `RuleExpressionText` under `groups/detail/` and
  `users/comparison/CauseWorklistRow` imports it from there. It is the first
  cross-feature consumer of a `groups/detail/` component (`MembershipRuleEvidence`
  is the existing precedent for the coupling, which is the reason this was not
  treated as blocking). A component two features consume is a shared component
  that happens to live in one of them.
- **Done when:** Either it moves to `components/shared/`, is exported from the
  barrel and gains a `docs/components.md` entry, or a note in `docs/components.md`
  records why feature-to-feature imports are acceptable here so the next case is
  not re-litigated.
- **Risk:** Low — a move plus import updates, no behavior change.
- **Status:** open
- **Related:** `I-002`

### I-017 · One unresolved-entity reference, not three

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/RuleCard.tsx` (`UnnamedGroupChip`),
  `src/sidepanel/components/groups/GroupListItemDetails.tsx` (`UnnamedPushApp`),
  `src/sidepanel/components/groups/detail/GroupPushSection.tsx` (`UnnamedPushApp`),
  `src/sidepanel/components/shared/EntityLink.tsx`,
  `src/sidepanel/components/shared/index.ts`, `docs/components.md`
- **Verified:** 2026-08-26 — all three written by `I-003` in one sitting.
- **Problem:** `I-003` fixed "an id must not sit in a name's slot" at three call
  sites and produced three near-identical local chips to do it — glyph, a muted
  italic "…name not loaded", and a `CopyableId` — differing only in glyph, text
  size, and whether the chip has a border. This is the same drift `D-015` and
  `I-016` describe: a recipe that exists three times is a shared component that
  has not been written yet. Two things it would fix at once:
  1. **The id-only state cannot open the entity.** A valid, navigable group or
     app id is in hand, but `EntityLink` requires a `name`, and passing the id as
     the name is precisely the defect `I-003` removed. So the unresolved state
     copies but does not open, which is a capability regression against the
     resolved state sitting next to it.
  2. **Chip chrome disagrees with the non-answer convention.** `RuleCard`'s copy
     gives the unresolved state a dashed-border pill; the two push copies render
     as plain inline text. `GroupSourceIndicator.tsx` and `AppScopeIndicator.tsx`
     both state the rule explicitly — a chip is for a proven answer, and a
     non-answer is left un-chipped so it never carries an answer's weight.
     Raised by `ui-reviewer` on the `I-003` diff as advisory.
- **Done when:** One treatment for "this reference is known only by id" — an
  id-only mode on `EntityLink` is the obvious home, since it already owns the
  resolved case and the unlinkable-name case. All three sites use it, it opens
  the entity when the id is navigable, and its chrome follows the non-answer
  convention. A story renders resolved and unresolved side by side in one list.
- **Risk:** Low — render-time only, no new fetch, three call sites.
- **Note on contrast:** the three chips use `text-neutral-600` (chosen over the
  precedent's `text-neutral-400`, which is ~2.2:1 and would risk axe). Against
  `bg-neutral-50` that computes to ~4.63:1 — over the 4.5:1 AA floor, but by a
  thin margin, with no lint gate watching it. Settle the register here, once,
  with a real contrast check rather than by eye. Raised by `ui-reviewer`.
- **Status:** open
- **Related:** `I-003` (created all three), `I-001`, `I-015`, `I-016`, `D-015`

### I-018 · A ⌘K that works before you have clicked into the panel

- **Category:** ux
- **Priority:** P2
- **Size:** M
- **Files:** `docs/adr/0057-a-keyboard-route-into-the-panel.md` (to be created);
  read-only for reference: `src/sidepanel/hooks/useCommandPalette.ts`,
  `src/sidepanel/components/TabJumpPalette.tsx`, `manifest.json`
- **Verified:** 2026-08-28 — `useCommandPalette` registers a plain `window`
  keydown inside the side-panel document; `manifest.json` has no `commands` key.
- **Problem:** The ⌘K palette is unreachable in the situation it exists for.
  Its listener lives in the side-panel document, so the chord only lands once
  you have already clicked into the panel; pressed while focus is in the Okta
  page, Chrome takes it for the omnibox. Home's jump bar softens this — it is a
  real autofocused input on a real tab — but the _shortcut_ is still a control
  that does nothing from the place a person would use it.

  The fix is a `manifest.json` `commands` entry, which needs an ADR and Sam's
  explicit review: it is a new permission-shaped surface, it can collide with a
  user's own bindings, and Chrome's four-shortcut budget per extension makes it
  a decision about which single chord is worth spending.

- **Done when:** A Proposed-status ADR exists under `docs/adr/` covering the
  chord, the collision story, and what happens when the panel is closed. **Zero
  files under `src/`.**
- **Risk:** n/a — research only.
- **Status:** research:awaiting-review
- **ADR written 2026-08-29** (`chore/unstick-backlog`), at Status: Proposed:
  `docs/adr/0057-a-keyboard-route-into-the-panel.md`. The number this item reserved on 2026-08-28 had been taken by an
  unrelated ADR before the item was picked up, so the proposal is **ADR-0057** — see
  `D-072`. Status stays `research:awaiting-review` deliberately: only Sam's
  acceptance moves it to `open`, never the session that wrote it.
- **Related:** the Home tab program (which made the jump bar the primary route)

### I-019 · MFA coverage for a group, from Home

- **Category:** feature-completeness
- **Priority:** P3
- **Size:** M
- **Files:** `src/sidepanel/components/home/ReportsCard.tsx`,
  `src/sidepanel/components/home/homeReports.ts`,
  `src/sidepanel/hooks/useHomeReports.ts`,
  `src/sidepanel/components/groups/detail/GroupDetailView.tsx` (`autoAnalyze`),
  `src/sidepanel/components/GroupsTab.tsx`, `src/sidepanel/App.tsx`
- **Verified:** 2026-08-28 — the Home reports shipped with two rows; this third
  one was deliberately left out, not overlooked.
- **Problem:** The third report the Home design names is _MFA coverage for a
  group_: pick a group, and see how much of it has a factor enrolled. Unlike the
  two that shipped it is **not free** — it is a per-member factor scan — so it
  is a scoped, opt-in launcher rather than a number on a row: choose a group
  from the snapshot (zero requests), then land on that group's Insights pane
  with `useMemberMfaScan` ready but still not auto-run.

  The reason it was cut is plumbing, not doubt about the feature.
  `GroupDetailView.autoAnalyze` is a boolean doing two jobs at once: it triggers
  the member-source analysis _and_ picks the initial pane. Landing on Insights
  needs it generalised into `initialPane?: GroupDetailTab`, and that request has
  to thread Home → `App` → `GroupsTab` → `GroupDetailView`. That is a contract
  change across four files and belongs in its own commit.

- **Done when:** `autoAnalyze` is widened to `initialPane` without changing what
  a plain drill-in does (`GroupDetailView.test.tsx` already pins both the
  `autoAnalyze` landing and the budget-based auto-load landing — neither may
  move), a group chooser expands in place in `ReportsCard` reading the groups
  snapshot rather than searching Okta per keystroke, and the scan still never
  auto-runs.
- **Risk:** Medium — the `initialPane` widening touches a component four
  surfaces mount.
- **Status:** open
- **Related:** the Home reports commit, ADR-0018

### I-020 · Home's reports as Export Engine descriptors

- **Category:** feature-completeness
- **Priority:** P3
- **Size:** M
- **Files:** `src/sidepanel/export/types.ts`,
  `src/sidepanel/export/descriptors/`, `src/sidepanel/export/registry.ts`,
  `src/sidepanel/components/home/ReportsCard.tsx`,
  `src/sidepanel/components/home/homeReports.ts`, `src/sidepanel/App.tsx`
  (`handleNavigateToExport`)
- **Verified:** 2026-08-28 — the reports ship as expand-in-place only; the
  preview caps at 25 and says so, with no route to the rest.
- **Problem:** An opened report shows its first 25 findings and states that it
  is truncating. There is nowhere to send someone who wants all 137, and no way
  to get the list out of the panel — which is exactly what an admin acting on
  "empty groups nothing fills" needs.

  The Export tab already solves both. It is descriptor-driven
  (`EntityExport`), `App.tsx` already owns the `ExportRequest` route into it,
  and CSV escaping is already handled (`csvUtils.escapeCSV`). The work is
  deciding what a report-shaped descriptor is: today every descriptor fetches
  from an `endpoint`, and these produce their rows from a **local join** over
  the org snapshot, with no endpoint at all. That is a new `EntityContextMode`
  or a new row source, and it is a design decision rather than a new file.

- **Done when:** A report can be opened in the Export tab pre-scoped, its
  columns come from the same descriptor the preview reads, and the honesty rules
  survive the trip — a report whose collections cannot support a count must not
  become an export that quietly ships a partial list.
- **Risk:** Medium — it widens a contract every existing descriptor implements.
- **Status:** open
- **Related:** `I-019`, ADR-0030, ADR-0040

### I-021 · Icon registry entries for the three glyphs `GroupCollections` still hand-rolls

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Verified:** 2026-08-28
- **Files:** `src/sidepanel/components/shared/Icon.tsx`,
  `src/sidepanel/components/groups/GroupCollections.tsx`
- **Narrowed 2026-08-31:** the funnel is done. Promoting the two hand-copied
  filter toggles to `shared/FilterToggle` added it to the registry as
  `Icon type="filter"` and deleted the call site that hand-rolled it. What is
  left is `GroupCollections`' three.
- **Problem:** `GroupCollections` hand-rolls upload, refresh and pencil-rename
  glyphs as inline `<svg>`. None has a matching entry in the `Icon` registry, so
  the polish pass could not convert them the way it converted
  `GroupExportModal`'s warning triangle (`Icon type="alert"`) and
  `BulkOperationsPanel`'s chevron. `GroupCollections`' four icon-buttons were
  deliberately left as a matched set rather than swapping only the one with
  an exact registry match (`trash`), because mixing one `Icon`-sized glyph
  into a row of custom-sized SVGs is visibly inconsistent.
- **Done when:** `upload`, `refresh-cw` (or an agreed name) and `pencil` exist
  in the `Icon` registry with stories; `GroupCollections` renders them through
  `Icon` at a registry size; no inline `<svg>` remains in it.
- **Risk:** Low — the glyphs are decorative, both call sites already carry
  their own `aria-label`.
- **Status:** open

### I-022 · A spacing role for the toolbar cluster, or a documented refusal

- **Category:** architecture
- **Priority:** P3
- **Size:** S
- **Verified:** 2026-08-28
- **Files:** `src/sidepanel/tailwind.css`,
  `docs/adr/0048-spacing-roles-and-derived-density.md`,
  `src/sidepanel/components/GroupsTab.tsx`, `src/sidepanel/components/AppsTab.tsx`,
  `src/sidepanel/components/AuthPoliciesTab.tsx`
- **Problem:** ADR-0048's six roles have no name for the gap inside a toolbar
  cluster — search field + filter toggle + filter panel + selection bar. It
  is not chips (`--sp-inline`), not form controls (`--sp-field`), not a card
  interior (`--sp-card`), and calling it `--sp-rung` would erase the
  deliberate distinction between the tighter toolbar zone and the roomier
  card stack below it. Three tab roots therefore keep a raw `space-y-3` /
  `space-y-2` with an inline comment explaining why, which is exactly the
  per-component prose the ADR set out to eliminate — just honestly labelled.
- **Done when:** either a seventh role exists (values across the three
  density scopes, ADR amended, the three call sites converted), or ADR-0048
  gains a short section stating that toolbar rhythm is deliberately outside
  the role system and why, so the raw values stop reading as unfinished work.
- **Risk:** Low — either outcome is additive or documentation-only.
- **Status:** open
- **`D-092` 2026-09-02:** this item shipped with no `Status:` line at all, so
  `SESSION.md` step 3's filter could never offer it. Set to `open` because the
  filing is complete and its Problem was re-read and still holds; it was invisible,
  not deferred.

### I-023 · PolicyCard's header is not click-to-toggle like its siblings

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Verified:** 2026-08-28
- **Files:** `src/sidepanel/components/policies/PolicyCard.tsx`
- **Problem:** `AppListItem` and `RuleCard` both make the whole card header a
  click target that toggles the disclosure. `PolicyCard` only toggles via its
  trailing `IconButton`, so the same gesture that opens an app or a rule does
  nothing on a policy. Pre-dates the polish pass; noticed while adding press
  feedback, and deliberately not fixed there because it is a behaviour change
  rather than a motion change.
- **Done when:** `PolicyCard`'s header toggles on click the way
  `AppListItem`'s does, keyboard-operable, with the trailing `IconButton`
  either kept as a redundant affordance or removed — and the story covers
  both the header click and the keyboard path.
- **Risk:** Low — one component, existing pattern to copy from two siblings.
- **Status:** open
- **`D-092` 2026-09-02:** this item shipped with no `Status:` line at all, so
  `SESSION.md` step 3's filter could never offer it. Set to `open` because the
  filing is complete and its Problem was re-read and still holds; it was invisible,
  not deferred.

### I-024 · Org-snapshot findings say "of 1 applications"

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Verified:** 2026-08-28
- **Files:** `src/sidepanel/hooks/useOrgFigures.ts:186-187,209,226`,
  `src/sidepanel/components/home/OrgSnapshotCard.tsx`
- **Problem:** Each finding renders `of {count} {noun}` where `noun` is a
  hardcoded plural (`'applications'`, `'group rules'`, `'groups'`), so a
  single-item denominator reads "of 1 applications" and "of 1 group rules".
  Visible on the Home tab, which is the panel's landing surface and the first
  thing an admin sees — spotted by screenshotting it at 360px during the
  ADR-0048 polish pass, not by any test.
- **Done when:** the denominator pluralises on its count. Check whether a
  pluralisation helper already exists before adding one — several surfaces
  (`'N Policy/Policies'` in `AuthPoliciesTab`, the member counts in
  `groupIdentity`) already solve this locally, and a fourth private
  implementation is the drift `Eyebrow` and `ListRow` exist to prevent.
- **Risk:** Low — display string only, no API or cache behaviour. Note
  `useOrgFigures.test.tsx:130-131` asserts the current plural nouns and will
  need retargeting to the new contract.
- **Status:** open
- **`D-092` 2026-09-02:** this item shipped with no `Status:` line at all, so
  `SESSION.md` step 3's filter could never offer it. Set to `open` because the
  filing is complete and its Problem was re-read and still holds; it was invisible,
  not deferred.

### I-025 · The capture fingerprint does not cover the app it films

- **Category:** tooling
- **Priority:** P2
- **Size:** M
- **Verified:** 2026-08-28
- **Files:** `.storybook/scripts/capture/capture.mjs:92-98` (`SHARED_INPUTS`)
- **Problem:** A clip's fingerprint hashes `src/sidepanel/demo`, four rig
  modules and the chapter's own walk. It does not hash the panel. So a change to
  the product a chapter is _about_ leaves every clip reading as current, and the
  reel goes on showing behaviour the extension no longer has - silently, since
  "unchanged" is exactly what a correct cache reports.

  Not hypothetical. `D-064` changed how the Groups pane behaves after a profile
  write; `npm run capture -- users-fix` answered "unchanged" over footage of the
  old behaviour, and the only reason the reel is right is that the manifest was
  deleted by hand to force a re-shoot.

  The obvious fix - add `src/sidepanel` - is not obviously correct: every
  product commit would then re-film every chapter, about 4 minutes, which is a
  real tax on unrelated work. Worth considering instead: hash only what a
  chapter's own story mounts, or accept the cost and make the shoot incremental
  in CI rather than local.

- **Done when:** a change to the code a chapter films invalidates that chapter,
  by some rule that does not re-film all nine for an unrelated commit. Whatever
  is chosen is recorded next to `SHARED_INPUTS`, since the current list reads as
  complete and is not.
- **Related:** ADR-0045 (capture thin, compose in React), D-064
- **Status:** open
- **`D-092` 2026-09-02:** this item shipped with no `Status:` line at all, so
  `SESSION.md` step 3's filter could never offer it. Set to `open` because the
  filing is complete and its Problem was re-read and still holds; it was invisible,
  not deferred.

### I-026 · The demo org derives memberships from rules it does not declare

- **Category:** fixtures
- **Priority:** P3
- **Size:** M
- **Verified:** 2026-08-28
- **Files:** `src/sidepanel/demo/memberships.ts` (`RULE_FED`),
  `src/sidepanel/demo/snapshot.ts` (`demoRules`)
- **Problem:** `RULE_FED` fills roughly twenty groups from predicates - ten
  departments, the office groups, `Datadog - Engineering`, `everyone`,
  `workdayAllWorkers`. `demoRules` declares nine rules. The two lists are not
  the same list, and nothing checks that they are.

  It shows on camera. The Users chapter corrects a `department` and the blast
  radius predicts two groups will move, by name, and three do: the third is
  `Datadog - Engineering`, whose membership derives from a `department`
  predicate that no rule in the org expresses, so the panel had nothing to
  predict from and was right not to guess. The reel narrates the two it named
  and stays quiet about the third, which is accurate but is working around a
  fixture that says two different things about the same group.

  It also makes Home's strongest finding harder to trust than it should be:
  "Groups no rule fills" counts groups with no rule, and some of those groups
  are visibly filled by a predicate.

- **Done when:** every group in `RULE_FED` has a rule in `demoRules` whose
  expression is the predicate, or is moved out of `RULE_FED`. A test asserts the
  two agree, because the drift is invisible until something evaluates the rules
  rather than the predicates. Note this re-films every chapter and moves Home's
  `unruled` figure.
- **Related:** ADR-0043 (memberships are derived, not asserted), ADR-0052
- **Status:** open
- **`D-092` 2026-09-02:** this item shipped with no `Status:` line at all, so
  `SESSION.md` step 3's filter could never offer it. Set to `open` because the
  filing is complete and its Problem was re-read and still holds; it was invisible,
  not deferred.

### I-027 · A snapshot cannot ask for a field it did not used to store

- **Category:** architecture
- **Priority:** P3
- **Size:** M
- **Verified:** 2026-08-29
- **Files:** `src/shared/snapshot/orgSnapshotStore.ts:33`,
  `src/shared/snapshot/snapshotSync.ts:394`, `src/shared/snapshot/types.ts:69`
- **Problem:** `orgSnapshotStore` stores whole entity rows and is deliberately
  content-agnostic (`DB_VERSION = 1`, `keyPath: ['origin','id']`), and the
  freshness machinery reasons entirely about _counts_ and _watermarks_. Neither
  has any notion of "which fields this row was stored with". So when the app
  starts parsing a field it previously ignored, already-synced orgs keep serving
  rows without it until some unrelated cause triggers a full or delta walk, and
  nothing anywhere can tell that they are incomplete rather than simply
  unpopulated.

  Encountered concretely when `lastMembershipUpdated` was parsed (`0247c9f`):
  the value had been arriving and being persisted (the list schema is
  `.passthrough()`), but only for orgs synced after the mapper learned to read
  it. The chosen mitigation was graceful degradation — the UI renders "Not
  reported by Okta" and staleness falls back to `lastUpdated` — which is correct
  for one field and does not generalise. The next field added will make the same
  decision from scratch.

- **Done when:** a snapshot carries a schema/parse version alongside its sync
  metadata, and a bump forces the affected collection to re-walk once. The
  interesting design question is scope: per-collection is probably right (a new
  group field should not invalidate the apps inventory), and the version should
  describe _what the app knows how to read_, not the DB layout, since
  `DB_VERSION` already covers the latter and does not need to move.
- **Risk:** Medium. Getting it wrong in the eager direction re-walks every
  collection on every release, which is exactly the cost ADR-0040 exists to
  avoid. Wants an ADR before code.
- **Status:** open
- **`D-092` 2026-09-02:** this item shipped with no `Status:` line at all, so
  `SESSION.md` step 3's filter could never offer it. Set to `open` because the
  filing is complete and its Problem was re-read and still holds; it was invisible,
  not deferred.

### I-028 · Dormant access: the report `lastMembershipUpdated` actually unlocks

- **Category:** feature
- **Priority:** P2
- **Size:** M
- **Verified:** 2026-08-29
- **Files:** `src/sidepanel/components/groups/ruleOrphans.ts`,
  `src/sidepanel/hooks/useHomeReports.ts:132`
- **Problem:** `findUnmaintainedAppAccess` finds groups that hold an app open
  and that no rule fills — "whoever is in one of these is in it because a person
  put them there, and nothing will take them out again". True, but it cannot
  distinguish a group a human or a Workflow curates carefully every week from
  one nobody has touched since 2021. Both are "unmanaged"; only the second is
  abandoned, and only the second is the finding worth acting on.

  `lastMembershipUpdated` separates them, and does so for free — it is on rows
  the snapshot already holds. It is also the _only_ signal in the app that sees
  the write paths `INVISIBLE_MAINTAINERS` warns about: Workflows, SCIM, HR
  provisioning, direct API writes and IdP sync all bump it and none leave a rule
  behind. So this report can say something the rule-based ones structurally
  cannot: not "we see nothing filling this", but "nothing filled it".

- **Done when:** a `findDormantAccess` in `ruleOrphans.ts` plus a fourth
  `buildReport` in `useHomeReports`, reusing the existing
  `counted`/`gates`/`caveat` completeness machinery. Zero API cost. Two things
  to get right: `INVISIBLE_MAINTAINERS` must be **narrowed** for this report
  rather than pasted — repeating "anything could be filling this invisibly"
  under a finding that specifically rules that out would undersell it; and
  `APP_GROUP` rows must be labelled or excluded, since a quiet app group means
  the upstream directory is quiet.
- **Risk:** Low to build, but it is a new security-relevant report and the
  claims it makes are stronger than the existing ones, so it wants an ADR
  fixing the wording before the code. Depends on `D-076` for the numbers to be
  trustworthy on a long-lived snapshot.
- **Status:** open
- **`D-092` 2026-09-02:** this item shipped with no `Status:` line at all, so
  `SESSION.md` step 3's filter could never offer it. Set to `open` because the
  filing is complete and its Problem was re-read and still holds; it was invisible,
  not deferred.

### I-029 · The reel's rule-impact chapter can come back, arguing both verbs

- **Category:** feature-completeness
- **Priority:** P3
- **Size:** M
- **Files:** `docs/adr/0043-the-demo-is-a-stage-the-script-is-the-director.md`
  (the held-out chapter), the reel's chapter sources under `src/sidepanel/demo/`,
  and whatever `npm run capture` re-shoots
- **Verified:** 2026-08-30 — `D-052`'s **Related** note is the source: the
  chapter was deliberately held out of the reel "until this lands". It has now
  landed, so the block is gone and the item is actionable.
- **Problem:** ADR-0043 pulled the rule-impact chapter from the demo reel
  because the product was making a claim that was not true — that deactivating
  a rule retracts membership. `D-052` fixed the claim, and nothing now records
  that the chapter is free to return; the knowledge lived only in `D-052`'s
  **Related** paragraph, and `D-052` is closed.

  The chapter should not simply be re-shot as it was. `D-052`'s own note says
  what it should now argue: **both verbs side by side** — deactivate, where
  nobody moves but N members become unattributed, and delete, where
  `removeUsers` is the irreversible choice between removing N and keeping them
  as now-manual members. That contrast is a better demo than the original scene
  was, because it shows the product knowing something an admin usually gets
  wrong.

- **Done when:** the chapter is back in the reel, it shows both verbs and names
  `removeUsers` as the irreversible choice, ADR-0043's held-out note is updated
  to say it returned and why, and `npm run capture:check` passes on the new
  footage.
- **Risk:** Low to the app — this is demo footage, not product code. Note that
  the hero rule's solely-held set is **empty**, which is exactly why the
  original defect went unnoticed for so long; the scene needs a fixture where
  the count is non-zero or it will demonstrate nothing.
- **Status:** open
- **Related:** `D-052` (the defect that held it out), ADR-0043, ADR-0045

### I-031 · Group Detail's rules section answers "what does it say?" by leaving the tab

- **Category:** ux
- **Priority:** P3
- **Size:** M
- **Verified:** 2026-08-31
- **Files:** `src/sidepanel/components/groups/detail/GroupRulesSection.tsx`,
  `src/sidepanel/components/groups/detail/GroupDetailView.tsx`,
  `src/sidepanel/components/rules/RuleDetailView.tsx`
- **Problem:** `GroupRulesSection` lists the two rule relationships a group has —
  rules that assign into it, and rules that name it in a condition. Its rows used
  to be `RuleCard`s with a disclosure, and the section's whole justification was
  that the disclosure held the condition expression, the referenced attributes and
  the target groups: _"the one question this tab exists to answer — what does that
  rule actually say? — could only be answered by leaving it."_

  Building the rule detail rung took that disclosure away, on purpose: four write
  verbs flex-wrapped inside a list row's body is the ADR-0030 §2 failure the rung
  exists to fix, and the rung holds strictly more than the disclosure ever did. But
  the trade is real and worth naming rather than quietly banking. The row still
  carries the condition in human-readable form and the press now lands on a rung
  that fully answers the question — it just answers it **on the Rules tab**, and
  the reader loses their place in the group they were studying.

  Three options, in rough order of cost:

  1. **Accept it and say so** — the deep link is one press, lands somewhere better
     than it used to, and a group's rules are a secondary concern on that tab.
  2. **Push the rule's rung onto the _group_ stack.** `useViewStack` is per tab and
     the trail is already generic; the blocker is that the rung's write verbs act on
     a rule and this section deliberately wires none of them, so it would need a
     read-only mode for `RuleDetailView` rather than the full strip.
  3. **Inline the one section that matters** — a read-only "When" block under the
     row, reusing `RuleDetailView`'s condition renderer directly. Cheapest, and it
     is also where Feature H's clause explainer wants to live on this surface.

- **Done when:** one of the three is chosen and recorded in `GroupRulesSection`'s
  docblock, with the two rejected options named so the question does not re-open.
  If (2) or (3), the section's tests regain a case asserting the condition
  expression is reachable without a tab change — the assertion
  `GroupRulesSection.test.tsx` gave up when the disclosure went.
- **Risk:** Low for (1) and (3). (2) touches `useViewStack` wiring on the Groups
  tab and would need `RuleDetailView` to render without an `ActionBar`, which no
  caller needs today.
- **Status:** open
- **Related:** ADR-0030 §2, ADR-0039, ADR-0016, `docs/features-plan.md` §H

### I-032 · A created feeding rule does not appear until the group is reopened

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/hooks/useGroupSource.ts` (which exposes only
  `open()`), `src/sidepanel/components/groups/detail/GroupRulesSection.tsx`,
  `src/sidepanel/hooks/useCreateFeedingRule.ts`
- **Verified:** 2026-08-31 — found by the `I-013` writer, which shipped around
  it deliberately rather than reaching outside its scope.
- **Problem:** `I-013` lets an admin create a feeding rule from Group Detail,
  and the write succeeds — but the open Rules pane still shows the empty state
  that prompted the verb, because `useGroupSource` has no rules-only refresh.
  Its only reload is `open()`, which also resets the member-source analysis and
  would discard a walk the admin already paid for, so the hook deliberately does
  not call it. The success step names the created rule and offers a jump, which
  covers the gap but does not close it: the pane the admin is looking at
  contradicts the action they just took.
- **Done when:** `useGroupSource` exposes a rules-only reload that leaves the
  member-source analysis intact, and a successful create calls it; the Rules
  pane shows the new rule without a reopen. A test pins that the member-source
  analysis survives the refresh.
- **Risk:** Low-medium — touches the hook every Group Detail pane reads.
- **Status:** open
- **Related:** `I-013`

### I-033 · Two mounts of the org snapshot index, for one org

- **Category:** performance
- **Priority:** P3
- **Size:** M
- **Files:** `src/sidepanel/hooks/useOrgEntityIndex.ts`,
  `src/sidepanel/components/CommandPalette.tsx`,
  `src/sidepanel/components/HomeTab.tsx`, `src/sidepanel/App.tsx`
- **Verified:** 2026-09-01 — found while wiring the ⌘K palette's entity search,
  which shipped the second mount deliberately rather than lifting a shared hook
  into a provider inside a feature PR.
- **Problem:** `useOrgEntityIndex` opens four `useOrgSnapshot` reads (groups,
  rules, apps, appGroups) and registers four `snapshotUpdated` listeners. Its
  own module header says two hooks reading the same collection is the thing it
  exists to prevent — and there are now two hooks doing exactly that: `HomeTab`
  mounts one, `CommandPalette` mounts another. Eight IndexedDB reads and eight
  broadcast listeners for one org's four collections.

  `CommandPalette` softens it: it passes `oktaOrigin: null` until the palette
  has been opened once, so a session that never presses ⌘K pays nothing, and
  `enabled: isOpen` keeps it from ever driving a sync. So this is duplicated
  _reads and listeners_, never duplicated _requests_. That is why it is a P3 and
  not a defect.

- **Done when:** One `OrgEntityIndexProvider` mounted in `App` serves both
  surfaces, `useOrgEntityIndex` becomes its hook, and a test pins that rendering
  Home and the palette together opens one set of `useOrgSnapshot` reads rather
  than two. The lazy-until-opened behaviour must survive the lift, or Home's
  mount silently starts paying for the palette's collections at panel open.
- **Risk:** Medium — every Home consumer of `index` (`useOrgFigures`,
  `useHomeReports`, the jump bar) reads through the same object, so the
  provider's identity stability is load-bearing in three more places.
- **Status:** open
- **Related:** ADR-0040, ADR-0062

### I-035 · `ContextBar`'s "Unpin & switch" is a raw `<button>` on nobody's list

- **Category:** architecture
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/ContextBar.tsx:207-213`,
  `docs/components.md` (the §3 documented-exception list)
- **Verified:** 2026-09-02 — spotted by the `I-034` writer while evaluating
  `ContextBar` as a home for the ⌘K affordance, then confirmed directly: it is
  the only raw `<button>` in the file, and it carries no `§3 exception`
  comment.
- **Problem:** `CLAUDE.md` bans hand-rolled `<button>`s outside the exceptions
  `docs/components.md` §3 records, and each surviving raw control is supposed
  to carry an inline `§3 exception` marker at its call site. The
  "Unpin & switch" control in the live-context-changed hint is a raw
  `<button type="button">` with `font-semibold underline hover:no-underline`,
  and it has neither: it is absent from the exception list and unmarked in the
  file.

  It is not a rogue control so much as an unlisted member of a class the doc
  already knows about. §3's "awaiting a new shared primitive" bullet describes
  chromeless **text-links** exactly like this one and names
  `GroupFilterPanel`, `AttributeFacet` and `ComparisonOverviewTab` as the
  sites a future `TextLink` would discharge. `ContextBar` belongs in that
  enumeration and is missing from it, which is the part that actually costs
  something: the list is what a future `TextLink` change would be scoped
  against, so a site absent from it is a site that migration would miss.

- **Done when:** either `ContextBar` is added to §3's text-link enumeration
  and its call site carries the inline `§3 exception` comment the convention
  requires, or — if `TextLink` is built first — it is migrated with the other
  three. Not both, and the choice is a scoping call about `TextLink`, not
  about this file.
- **Risk:** Low. Documentation and a comment, unless `TextLink` lands first.
- **Status:** done:#118
- **Related:** `I-034` (found it), `docs/components.md` §3

## Archive

Closed items, collapsed to one line each. The verbose Problem/Done-when/Risk
prose that used to live here is recoverable from git history at the linked
commit — that is the point of moving it out of this file. Ids here are
permanently retired: never reuse an archived id for a new item (the
uniqueness guard in `scripts/check-cited-paths.mjs` enforces this across both
ledgers). See `SESSION.md` step 7 and `CLAUDE.md`'s "Nightly maintenance
system" section for when an item moves here.

- **I-001** — A reusable resolved-name badge with copy + open — done:#68 ([808ab30](https://github.com/samdhenderson/okta-unbound/commit/808ab30))
- **I-002** — Resolve group ids inside rule-condition expression text — done:#94 ([ca07a02](https://github.com/samdhenderson/okta-unbound/commit/ca07a02))
- **I-003** — Extend the id badge to RuleCard and push-mapping fallbacks — done:#95 ([3930f4b](https://github.com/samdhenderson/okta-unbound/commit/3930f4b))
- **I-004** — Copy affordance on self-referencing ids that have none today — done:#74 ([bcf5a39](https://github.com/samdhenderson/okta-unbound/commit/bcf5a39))
- **I-005** — Compare Users view has no scroll preservation — done:#68 ([808ab30](https://github.com/samdhenderson/okta-unbound/commit/808ab30))
- **I-006** — Lead the Compare view's diff-filter pills with "All" — done:#75 ([9d71a26](https://github.com/samdhenderson/okta-unbound/commit/9d71a26))
- **I-007** — Normalize verdict-badge placement in GroupMembershipRow — done:#75 ([9d71a26](https://github.com/samdhenderson/okta-unbound/commit/9d71a26))
- **I-013** — Create a feeding rule from the Group Detail action bar — done:#107 ([069ef48](https://github.com/samdhenderson/okta-unbound/commit/069ef48))
- **I-030** — The Groups list strip has no `primary`, and reads as six equal buttons — done:#113 ([1d54e77](https://github.com/samdhenderson/okta-unbound/commit/1d54e77))
- **I-034** — ⌘K is the only route to two sections, and nothing points at it — done:#117 ([4c28cd2](https://github.com/samdhenderson/okta-unbound/commit/4c28cd2))
