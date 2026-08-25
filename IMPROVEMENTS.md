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

### I-001 · A reusable resolved-name badge with copy + open

- **Category:** ux
- **Priority:** P2
- **Size:** M
- **Files:** `src/sidepanel/components/shared/EntityLink.tsx`,
  `src/sidepanel/components/shared/CopyableId.tsx`,
  `src/sidepanel/components/shared/index.ts`
- **Problem:** No single component resolves an entity id to a name badge
  _and_ offers copy-id _and_ open-in-detail together. `EntityLink` does
  name+open (falls back to inert text + tooltip when unlinkable);
  `CopyableId` does truncated-id+copy. Zero files import both — every call
  site that wants all three currently can't get them from one import.
- **Done when:** A shared component (new, or an `EntityLink` variant) renders
  a name badge, a copy-to-clipboard button for the raw id, and an open
  action into the entity's detail view; exported from the `components/shared`
  barrel; co-located `.stories.tsx`, axe-clean, TypeDoc header + prop
  comments.
- **Risk:** Low — additive, no existing call site changes yet.
- **Status:** done:#68

### I-002 · Resolve group ids inside rule-condition expression text

- **Category:** ux
- **Priority:** P2
- **Size:** M
- **Files:** `src/sidepanel/components/groups/detail/ClauseChecklist.tsx:154`,
  `src/sidepanel/components/users/comparison/CauseWorklistRow.tsx:198`
- **Verified:** 2026-08-24 — both call sites still render raw ids.
- **Problem:** The flagship example from Sam's dump. `explainRuleExpression`'s
  reconstructed source text (e.g. `isMemberOfAnyGroup("00g1abc…")`) renders
  as opaque `<code>` with raw group ids, even though the sibling
  `ClauseGroupList` component in the same view already resolves and links
  the same ids via a `resolveGroupName` prop. An admin reading why a rule
  matched has to go look the id up somewhere else.
- **Done when:** Both call sites render group-id literals inside the
  expression text using I-001's badge wherever the id is resolvable from
  whatever data the view already has in hand (no new fetch); falls back to
  today's raw-id rendering when the name isn't loaded, with a story/test
  proving that fallback still renders cleanly.
- **Risk:** Low-medium — user-facing rule display; needs both the resolved
  and unresolved cases tested.
- **Status:** done:#94
- **Depends on:** I-001
- **Ungated 2026-08-24:** the `groups/detail/` off-limits window was lifted
  (`CLAUDE.md`, `NIGHTLY.md` 2026-08-24). This item is implementable whole; it
  had been skipped on 2026-08-21 despite sorting to the top of the open list.

### I-003 · Extend the id badge to RuleCard and push-mapping fallbacks

- **Category:** ux
- **Priority:** P2
- **Size:** M
- **Files:** `src/sidepanel/components/RuleCard.tsx:98-99,259`,
  `src/sidepanel/components/groups/GroupListItemDetails.tsx:83`,
  `src/sidepanel/components/groups/detail/GroupPushSection.tsx:51`
  (**path corrected 2026-08-21** — the original filing said
  `groups/GroupPushSection.tsx`, which does not exist)
- **Verified:** 2026-08-24 — three call sites, all still raw.
- **Problem:** Same class of bug as I-002. `RuleCard` shows a raw group id
  when `allGroupNamesMap` doesn't have it; the two push-mapping sites show
  `mapping.appId` as plain text when `mapping.appName` is missing.
- **Done when:** Each site uses I-001's badge when a name is available, and
  visibly (not silently) indicates when only the id is known. Render-time fix
  only — no new fetch.
- **Risk:** Low.
- **Status:** open
- **Depends on:** I-001
- **Ungated 2026-08-24:** the `groups/detail/` window was lifted, so all three
  sites ship together. Do **not** split this into "the two easy ones" — a
  two-thirds-done item reads as complete in the ledger, which is why it was
  skipped whole rather than partially on 2026-08-21.

### I-004 · Copy affordance on self-referencing ids that have none today

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/RuleCard.tsx:311`,
  `src/sidepanel/components/policies/PolicyCard.tsx:94`,
  `src/sidepanel/components/apps/AppListItem.tsx:133`
  (**paths corrected 2026-08-21** — the filing cited both files directly under
  `components/`; they live in the `policies/` and `apps/` subdirectories. Line
  numbers are from the original filing and unverified against the moved files.)
- **Problem:** Each row shows the entity's own id in its own expanded detail
  row as bare `<code>`, no copy button — unlike `UserIdentityCard` and
  `GroupListItemDetails`, which already pair id text with `CopyableId`/
  `CopyButton`.
- **Done when:** Each site uses `CopyableId` instead of bare `<code>`.
- **Risk:** Low.
- **Resolution note:** only `AppListItem` actually used a bare `<code>`; the
  other two used a `font-mono` `<span>`. The substance of the item was the
  missing copy affordance, not the tag name. Labels fold the entity name in,
  falling back to the id when the name is empty (both schemas accept
  `name: ""`). The residual same-name collision is filed as `I-010`.
- **Status:** done:#74

### I-005 · Compare Users view has no scroll preservation

- **Category:** ux
- **Priority:** P2
- **Size:** M
- **Files:** `src/sidepanel/components/users/UserComparisonView.tsx`,
  `src/sidepanel/components/users/UserComparisonPanel.tsx`,
  `src/sidepanel/hooks/useScrollPreservation.ts`
- **Problem:** Neither file wires `useScrollPreservation`, unlike
  `GroupsTab`/`TabPanel`/`GroupsListPanel`, which do. A hide/show or push/pop
  cycle of a comparison has no defined scroll behavior — whatever the browser
  happens to do, instead of restoring the saved offset the way list views do.
  (Row _reordering_ while editing is intentionally stable per
  `attributeParity.ts` — that's not the bug; the missing hook is.)
- **Done when:** The comparison view's scroll offset survives a push/pop or
  tab hide/show cycle the same way `GroupDetailView`'s does, verified with
  the same test pattern used for the working views.
- **Risk:** Low — additive hook wiring, proven pattern.
- **Status:** done:#68

### I-006 · Lead the Compare view's diff-filter pills with "All"

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/users/comparison/ComparisonDiffTab.tsx:152-160`,
  `ComparisonAttributesToolbar.tsx:160-168`
- **Problem:** Both render filter pills in order Differences, Shared, All.
  Sam wants All to lead.
- **Done when:** Both files render All, Differences, Shared in that reading
  order. The _default selected_ filter stays `'differences'` — this item is
  about pill order, not which filter opens active; don't change the default
  without checking with Sam first.
- **Risk:** Low.
- **Resolution note:** pill order only. The default stayed `'differences'` in
  both views — there was no one to check with on an unattended run, so the
  item's own instruction to leave it alone was taken literally. One added
  assertion per file reads the row in DOM order and pins each whole label, so
  a later reorder cannot carry a count onto the wrong pill.
- **Status:** done:#75

### I-007 · Normalize verdict-badge placement in GroupMembershipRow

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/users/GroupMembershipRow.tsx:165-168,183-186`
- **Problem:** The row's "On page" badge sits inline with the name; its
  verdict badge (the row's primary classification — same role as the inline
  badges in `GroupListItem.tsx:213-218` and `BlastRadiusGroupRow.tsx:192-196`)
  is instead pushed to a trailing slot next to the expand/collapse button.
- **Done when:** Verdict badge placement matches the inline-with-name
  convention the other two rows use — unless there's a deliberate reason for
  the current layout, in which case record it as a comment instead of moving
  the badge.
- **Risk:** Low.
- **Resolution note:** no deliberate reason found, and the evidence ran the
  other way — the file's module header already describes the row as "name,
  verdict, source line", and `membershipVerdict.ts`'s short-label rule
  presumes the badge sits _beside_ the name. Badge moved. The name line gained
  `flex-wrap`, because it now carries two `shrink-0` badges and at the 360px
  floor they no longer share a line with a long name; the `<h4>` keeps
  `truncate` and a `LongGroupName` story pins that case. The residual — a
  clipped name has no way to reveal itself — is filed as `I-011`.
- **Status:** done:#75

### I-008 · Propose Okta Expression Language function coverage

- **Category:** feature-completeness
- **Priority:** P2
- **Size:** L
- **Files:** `docs/adr/0042-what-the-evaluator-refuses-to-guess.md` (to be
  created), `src/shared/ruleEvaluator.ts:298-320` (read-only, for reference)
- **Verified:** 2026-08-24 — `SUPPORTED_FUNCTIONS` still holds seven entries.
- **Problem:** The evaluator implements seven `String.*` functions and nothing
  else — no `toString`, no `DateTime`, no `Instant`. A group rule whose
  condition uses any of those is reported as unevaluable, so the admin asking
  "why is this person in this group" gets no answer for exactly the rules that
  are hardest to reason about by hand. Sam wants broader coverage both for
  rule-display fidelity and as groundwork for future policy evaluation.
- **Done when:** `docs/adr/0042-what-the-evaluator-refuses-to-guess.md` exists
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
- **Files:** `docs/adr/0043-how-deep-the-snapshot-goes.md` (to be created);
  read-only for reference: `docs/adr/0040-the-background-owns-the-org.md`,
  `src/shared/snapshot/snapshotSync.ts` (the `CollectionSpec` / `ShardProvider`
  model), `src/shared/snapshot/types.ts:9-25`,
  `src/sidepanel/components/OverviewTab.tsx`
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

- **Done when:** `docs/adr/0043-how-deep-the-snapshot-goes.md` exists at
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

### I-013 · Create a feeding rule from the Group Detail action bar

- **Category:** feature-completeness
- **Priority:** P2
- **Size:** M
- **Files:** `src/sidepanel/components/groups/detail/GroupActionBar.tsx`,
  `src/sidepanel/components/groups/detail/GroupDetailView.tsx`,
  `src/sidepanel/hooks/useOktaApi/ruleWrites.ts` (the POST already exists),
  `src/shared/membership/blastRadius.ts` (read-only, for the consequence copy)
- **Verified:** 2026-08-24 — the group-detail strip ships _Export members_,
  _Add_ and _Compare_, and has **no disclosure tier**; `ruleWrites.ts` already
  holds the create call, wired only from the Rules tab.
- **Problem:** The Rules tab now shows, in place, both rule relationships a
  group has — and the most common answer to "no rule assigns users to this
  group" is that someone wants to create one. Today that means leaving the
  group, going to the Rules tab, and rebuilding the context by hand. The verb
  the page is missing is the one its own empty state implies.
- **Done when:** The group-detail action bar offers _Create feeding rule_
  **behind More**, not in the row — ADR-0039 puts it there because it changes
  state with no symmetric undo: deleting a rule does **not** un-grant the
  memberships it already made. It ships with a confirm `Modal` stating that
  consequence in plain language, and the confirm respects ADR-0036 — a new
  rule's blast radius is a **prediction**, never asserted. This gives the strip
  its first tier, so `ActionBar`'s `expansion` slot gets its first group-side
  consumer. Co-located stories, axe-clean; the empty state on the Rules tab
  gains a companion assertion beside its existing one rather than a rewrite.
- **Risk:** Medium. It is the first group-level _write_ on this rung that is
  not a membership change, and the first thing on the page that cannot be
  undone by pressing the opposite button.
- **Status:** open

### I-014 · Normalize an attribute across the filtered members

- **Category:** feature-completeness
- **Priority:** P1
- **Size:** L
- **Files:** `docs/features-plan.md` item C (the full inventory of what exists
  and what remains lives there, not duplicated here);
  `docs/adr/0044-the-first-many-user-write.md` (to be created);
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
- **Status:** blocked:sparse-patch-merge-unverified

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
