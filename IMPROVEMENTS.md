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
- **Problem:**
- **Done when:** <checkable without asking Sam>
- **Risk:**
- **Status:** open | claimed:<branch> | blocked:<reason> | done:<PR#>
```

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
- **Problem:** The flagship example from Sam's dump. `explainRuleExpression`'s
  reconstructed source text (e.g. `isMemberOfAnyGroup("00g1abc…")`) renders
  as opaque `<code>` with raw group ids, even though the sibling
  `ClauseGroupList` component in the same view already resolves and links
  the same ids via a `resolveGroupName` prop.
- **Done when:** Both call sites render group-id literals inside the
  expression text using I-001's badge wherever the id is resolvable from
  whatever data the view already has in hand (no new fetch); falls back to
  today's raw-id rendering when the name isn't loaded, with a story/test
  proving that fallback still renders cleanly.
- **Risk:** Low-medium — user-facing rule display; needs both the resolved
  and unresolved cases tested.
- **Status:** open
- **Depends on:** I-001

### I-003 · Extend the id badge to RuleCard and push-mapping fallbacks

- **Category:** ux
- **Priority:** P2
- **Size:** M
- **Files:** `src/sidepanel/components/RuleCard.tsx:98-99,259`,
  `src/sidepanel/components/groups/GroupListItemDetails.tsx:83`,
  `src/sidepanel/components/groups/detail/GroupPushSection.tsx:51`
- **Problem:** Same class of bug as I-002. `RuleCard` shows a raw group id
  when `allGroupNamesMap` doesn't have it; the two push-mapping sites show
  `mapping.appId` as plain text when `mapping.appName` is missing.
- **Done when:** Each site uses I-001's badge when a name is available, and
  visibly (not silently) indicates when only the id is known. Render-time fix
  only — no new fetch.
- **Risk:** Low.
- **Status:** open
- **Depends on:** I-001
- **Selection note (2026-08-21, 5th run):** the third call site was filed as
  `groups/GroupPushSection.tsx`; it actually lives at
  `groups/detail/GroupPushSection.tsx` — path corrected above. That puts one of
  this item's three sites inside the `groups/detail/` off-limits window, so
  `SESSION.md` step 2 skips the item until Sam's Group Detail v2 lands. The
  other two sites are unaffected; whoever picks this up after the window closes
  should take all three together rather than splitting the item.

### I-004 · Copy affordance on self-referencing ids that have none today

- **Category:** ux
- **Priority:** P3
- **Size:** S
- **Files:** `src/sidepanel/components/RuleCard.tsx:311`,
  `src/sidepanel/components/PolicyCard.tsx:94`,
  `src/sidepanel/components/AppListItem.tsx:133`
- **Problem:** Each row shows the entity's own id in its own expanded detail
  row as bare `<code>`, no copy button — unlike `UserIdentityCard` and
  `GroupListItemDetails`, which already pair id text with `CopyableId`/
  `CopyButton`.
- **Done when:** Each site uses `CopyableId` instead of bare `<code>`.
- **Risk:** Low.
- **Status:** open

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
- **Status:** open

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
- **Status:** open

### I-008 · Propose Okta Expression Language function coverage

- **Category:** feature-completeness
- **Priority:** P2
- **Size:** L
- **Files:** `src/shared/ruleEvaluator.ts:308-320` (`SUPPORTED_FUNCTIONS`)
- **Problem:** No `toString`/`DateTime`/`Instant` support; `String.*` is
  limited to `toUpperCase`/`toLowerCase`/`len`/`stringContains`/`startsWith`/
  `endsWith`/`append`. Sam wants broader coverage both for rule-display
  fidelity and because it's shared groundwork for future policy evaluation.
- **Done when:** Not yet defined — **this is research-only per Sam's Step 1
  answer.** The deliverable is a written proposal (function list, arity/type
  handling for Okta's date/time semantics, security considerations given
  ADR-0017 exists specifically because ad hoc expression evaluation is a
  known risk, a test plan) — not code.
- **Risk:** High if implemented without scoping — touches a
  security-relevant expression evaluator.
- **Status:** blocked:needs-breakdown

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
