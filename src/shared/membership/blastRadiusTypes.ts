/**
 * @module shared/membership/blastRadiusTypes
 * @description The vocabulary of the blast-radius report — "if I change these
 * profile attributes, what happens to this user's group access?"
 *
 * Split from the engine so a surface can render a report, or a hook can hold one
 * in state, without importing the evaluator and the expression explainer behind
 * it. Nothing here has behaviour; every rule in this file is a rule about what a
 * word is allowed to mean.
 *
 * ## One word carries the whole design
 *
 * - **`added` / `removed`** — a prediction is stated, not qualified. The value
 *   name ({@link GroupEffectKind}) says what the draft does to the membership.
 *   Three known gaps sit behind it and are being closed separately: a
 *   {@link RuleInventoryState} rule carries no exclusion list (a `FormattedRule`
 *   drops `conditions.people`), so an exclusion is invisible and can only ever
 *   make us over-predict; client-side evaluation is a reimplementation of Okta
 *   EL, not Okta EL; and rule application is asynchronous, so even a correct
 *   prediction describes a state Okta has not reached yet.
 * - **`not-predicted`** — the first-class "we declined to say". It is never a
 *   quieter way of saying "no": it always carries a {@link WithheldReason}
 *   naming what stopped us. Collapsing it into "nothing happens" is exactly the
 *   move ADR-0020 forbids, and {@link WithheldReason.rule-unevaluable-after} is
 *   the case that makes the ban concrete.
 *
 * ## Security
 *
 * Rule names, condition expressions, group names and every drafted attribute
 * value in {@link BlastRadiusInput.draft} are **end-user-controllable tenant
 * data**. Render them escaped, run them through `csvUtils.escapeCSV` before
 * export, and never log them. The only strings safe to log are the reason codes
 * ({@link WithheldReason}, `RuleUnevaluableReason`) and the enum members, which
 * are compile-time constants.
 *
 * @see {@link module:shared/membership/blastRadius} — the engine that produces these.
 * @see {@link module:shared/rules/unevaluableReasonText} — reason code → sentence, for the UI.
 */

import type { RuleUnevaluableReason } from '../ruleEvaluator';
import type { ClauseGroupMatch } from '../rules/explainExpression';
import type { GroupMembership, GroupRuleStatus, MembershipRule, OktaUser } from '../types';
import type { MembershipBucket } from '../../sidepanel/components/users/membershipVerdict';

/**
 * What is known about the org's group-rule inventory.
 *
 * **Structurally identical to — and deliberately not imported from —
 * `sidepanel/hooks/useUserMemberships`'s type of the same name.** That module is
 * a React hook: it pulls in `react`, `chrome.storage`, the entity cache and the
 * API facade, and `shared/` may not depend on the side panel. The two are
 * assignable in both directions (the hook's `FormattedRule[]` satisfies
 * `readonly MembershipRule[]`), so a caller passes `ruleInventory` straight in
 * with no adapter, and `blastRadius.test.ts` pins that assignability at compile
 * time so the two cannot drift apart unnoticed.
 *
 * Three answers that must never collapse into two:
 *
 * - `unresolved` — no attempt has completed yet. Yields
 *   {@link BlastRadiusReport.status} `not-computed`: nothing may be concluded
 *   **and nothing may be reported**.
 * - `available` — the inventory was obtained. `rules` may legitimately be empty.
 * - `unavailable` — an attempt completed and failed. Yields `unavailable`, which
 *   *is* a reportable finding: no prediction can be made about anything.
 *
 * Folding `unresolved` into `unavailable` is the bug `useUserMemberships`
 * documents at its own copy of this type — it made a surface announce a failure
 * that had not happened, during the ordinary gap before the rules arrive.
 */
export type RuleInventoryState =
  | { readonly status: 'unresolved' }
  | { readonly status: 'available'; readonly rules: readonly MembershipRule[] }
  | { readonly status: 'unavailable' };

/** Input for `analyzeBlastRadius`. Pure data — the engine performs no I/O. */
export interface BlastRadiusInput {
  /** The user as Okta currently holds them, before the edit. */
  readonly user: OktaUser;
  /**
   * Proposed patch, attribute name → raw value, merged over `user.profile`.
   *
   * A key present with `undefined` means "clear it", and evaluates the same way
   * an absent attribute does. **PII** — never log.
   */
  readonly draft: Readonly<Record<string, unknown>>;
  /**
   * The user's **COMPLETE** membership list.
   *
   * Not negotiable: it becomes the `RuleGroupContext` every `isMemberOf*` clause
   * is answered from, and that answer is two-valued over the list it is given
   * (ADR-0021). A subset therefore turns every omitted group into a confident
   * `false` — a fabricated no-match, in a module whose entire purpose is to
   * never manufacture one.
   */
  readonly memberships: readonly GroupMembership[];
  /** Three-state, never a bare array. See {@link RuleInventoryState}. */
  readonly rules: RuleInventoryState;
  /**
   * Group id → display name, from `loadCachedGroupNames()`. A miss falls back to
   * the id, so an incomplete map degrades the labels and nothing else.
   * **Untrusted** — render escaped, never log.
   */
  readonly groupNames: ReadonlyMap<string, string>;
}

/**
 * What the draft does to one rule's verdict about this user.
 *
 * `undetermined` is not a shade of "no change" — it means at least one of the two
 * evaluations did not produce an answer, so the pair cannot be compared. It absorbs
 * an `unevaluable` on **either** side precisely so that no caller can read a
 * transition off a half-known pair.
 *
 * `unchanged-unevaluable` is the one case where an unreadable rule is nonetheless
 * settled: neither side could be evaluated **and** the expression provably reads
 * none of the attributes the draft touches, so whatever the verdict is, this edit
 * does not move it. That is a claim about the *edit*, never about the rule — it
 * does not say the user fails the condition, and nothing may round it to
 * `unchanged-no-match`. The report question is "what does this edit change", and a
 * rule the edit cannot reach is not an answer to it.
 *
 * The proof has to be exact, which is why it comes from the parsed AST
 * (`rules/explainExpression`'s `userAttributeNamesRead`) and never from
 * {@link RuleEffect.touchedAttributes}, a display aid that is allowed to miss.
 */
export type RuleTransition =
  | 'starts-matching'
  | 'stops-matching'
  | 'unchanged-match'
  | 'unchanged-no-match'
  | 'unchanged-unevaluable'
  | 'undetermined';

/** One rule, evaluated against the user before and after the draft. */
export interface RuleEffect {
  /** Okta rule id (`0pr…`). */
  readonly ruleId: string;
  /** Rule display name. **Untrusted** — render escaped, never log. */
  readonly ruleName: string;
  /**
   * The condition expression evaluated, from `conditionExpression` (or a raw
   * rule's `conditions.expression.value`) — **never** `FormattedRule.condition`,
   * which is a display string with `user.` stripped and does not parse.
   * **Untrusted** — render escaped, never log.
   */
  readonly expression: string;
  /** How the verdict moved. See {@link RuleTransition}. */
  readonly transition: RuleTransition;
  /**
   * Why the **pre-draft** evaluation gave up. Present whenever it did — under
   * `undetermined`, and also under `unchanged-unevaluable`, where the rule was
   * still not read and the row still says so.
   */
  readonly beforeReason?: RuleUnevaluableReason;
  /** Why the **post-draft** evaluation gave up. Present on the same terms as {@link beforeReason}. */
  readonly afterReason?: RuleUnevaluableReason;
  /** Groups this rule assigns matched users into. */
  readonly targetGroupIds: readonly string[];
  /**
   * The same groups, labelled from {@link BlastRadiusInput.groupNames}, index for
   * index with {@link targetGroupIds}; an unresolved id appears as itself.
   * **Untrusted.**
   */
  readonly targetGroupNames: readonly string[];
  /**
   * Which of the **drafted** attribute names this expression appears to read —
   * a display aid for "this rule is here because you touched `department`".
   *
   * **Approximate by construction, and never load-bearing.** It is the union of
   * the rule's own derived `userAttributes` and a textual scan of the
   * expression, intersected with the draft's keys. The engine deliberately does
   * **not** pre-filter rules on it: `userAttributes` is derived data, and a miss
   * there would silently drop a real effect rather than merely mislabel one.
   */
  readonly touchedAttributes: readonly string[];
  /** Whether the rule is `ACTIVE`. Neither `INACTIVE` nor `INVALID` places anybody. */
  readonly active: boolean;
  /**
   * The rule's {@link GroupRuleStatus} exactly as Okta reported it, so a caller
   * can distinguish a deactivated rule from a broken one — the distinction
   * {@link active} collapses on purpose, because the removal/addition gates in
   * `blastRadius.ts` only need "does this rule place anybody", not why not
   * (D-085). Optional so a fixture built before this field existed still
   * type-checks; the engine itself always sets it.
   */
  readonly status?: GroupRuleStatus;
}

/**
 * What is predicted for one group.
 *
 * `not-predicted` is a peer of the other two, not their absence: it is emitted
 * only where something *was* implicated and we declined to call it, and it
 * always names why in {@link GroupEffect.withheldReason}.
 */
export type GroupEffectKind = 'added' | 'removed' | 'not-predicted';

/**
 * Why a prediction was withheld. Codes only — the sentences live in
 * `shared/rules/unevaluableReasonText` and the UI's own copy, so this module
 * ships no prose and nothing here is sensitive.
 *
 * - `rule-unevaluable-after` — **the load-bearing one.** Another ACTIVE rule
 *   targeting the group could not be evaluated against the drafted user, so we
 *   do not know that it fails to hold them. Predicting removal here would turn
 *   an `unevaluable` into a "no", which ADR-0017 and ADR-0020 forbid outright.
 * - `another-active-rule-still-matches` — a different ACTIVE rule targeting the
 *   group matches the drafted user, so the membership survives. Named in
 *   {@link GroupEffect.blockingRuleName}.
 * - `membership-not-credited-to-rule` — the membership is not in the `rule`
 *   bucket at all (a manual add, an app-mastered group, or unresolved), so no
 *   rule's verdict changing can take it away.
 * - `membership-attribution-deduced` — the membership *is* rule-bucketed, but
 *   *which* rule feeds it was deduced (`inferred`, `ambiguous`) rather than
 *   established. A deduced cause cannot support an asserted consequence.
 * - `rule-inactive` — the only implicated rules are `INACTIVE`. They place
 *   nobody, so their verdict flipping changes nothing.
 * - `app-mastered-group` — an `APP_GROUP` roster is managed by its application.
 *   No group rule adds to it and none removes from it.
 */
export type WithheldReason =
  | 'rule-unevaluable-after'
  | 'another-active-rule-still-matches'
  | 'membership-not-credited-to-rule'
  | 'membership-attribution-deduced'
  | 'rule-inactive'
  | 'app-mastered-group';

/**
 * Which way this edit turns the membership test a rule makes of an affected
 * group.
 *
 * **Structural, and never a prediction.** It is derived from the clause's own
 * `member`/`non-member` sense against the group's own `added`/`removed` kind —
 * not from evaluating the rule a second time. A `toward-match` rule has *not*
 * been shown to match; it has been shown to ask a question this edit answers.
 * Whether it then fires is the second hop `docs/claims.md` forbids chasing.
 *
 * `undetermined` is not a third shade of the other two: it means one rule reads
 * the group in both directions at once, so no single answer is available. It
 * absorbs on merge, exactly as {@link RuleTransition}'s own `undetermined` does,
 * so no caller can read a direction off a half-known pair.
 */
export type CascadeDirection = 'toward-match' | 'away-from-match' | 'undetermined';

/**
 * One rule that reads an affected group in its condition.
 *
 * **Carries ids, not names.** {@link BlastRadiusReport.rules} already holds every
 * rule in the inventory with its `ruleName`, `targetGroupIds` and
 * `targetGroupNames`; duplicating them here would double the untrusted-string
 * surface and give one name two places to go stale. Join by {@link ruleId}.
 */
export interface GroupCascadeRule {
  /** Okta rule id (`0pr…`), joinable against {@link BlastRadiusReport.rules}. */
  readonly ruleId: string;
  /** Which way this edit turns the rule's test of this group. See {@link CascadeDirection}. */
  readonly direction: CascadeDirection;
  /**
   * How the rule's condition named this group — a literal id or name, or one of
   * the three pattern forms.
   *
   * A compile-time union rather than the matched literal precisely so that
   * surfacing "this link is a pattern match" costs no new untrusted string: the
   * pattern itself is already on screen in the rule's own condition.
   */
  readonly matchedBy: ClauseGroupMatch;
}

/**
 * The rules that read one group this edit is predicted to add or remove.
 *
 * The one-hop cascade, and deliberately only one hop — see the engine's module
 * documentation and `docs/claims.md`'s withheld list. Every entry is a fact about
 * the rule inventory's structure; none is a claim that the rule will fire.
 */
export interface GroupCascade {
  /** The affected group's Okta id (`00g…`), joinable against {@link BlastRadiusReport.groups}. */
  readonly groupId: string;
  /** The rules whose condition reads it, in a total order. Never empty. */
  readonly rules: readonly GroupCascadeRule[];
}

/** What the draft is predicted to do to one group's membership. */
export interface GroupEffect {
  /** Okta group id (`00g…`). */
  readonly groupId: string;
  /**
   * Group display name, or the id when {@link BlastRadiusInput.groupNames} has no
   * entry. **Untrusted** — render escaped, never log.
   */
  readonly groupName: string;
  /** Added, removed, or declined. See {@link GroupEffectKind}. */
  readonly kind: GroupEffectKind;
  /**
   * The rule this hinges on — set **iff** exactly one rule is implicated, so it
   * is a fact rather than array order. Read {@link contributingRuleIds} for the
   * general case.
   */
  readonly ruleId?: string;
  /** That rule's name. **Untrusted.** */
  readonly ruleName?: string;
  /**
   * Every rule whose transition implicated this group, in report order. For a
   * withheld effect these are the rules that *would* have driven it.
   */
  readonly contributingRuleIds: readonly string[];
  /** Present exactly when `kind` is `not-predicted`. See {@link WithheldReason}. */
  readonly withheldReason?: WithheldReason;
  /**
   * The rule that keeps the membership alive — set only for
   * `another-active-rule-still-matches`. **Untrusted.**
   */
  readonly blockingRuleName?: string;
  /**
   * How the membership is currently accounted for, straight from
   * `membershipVerdict`'s single classifier. Absent when the user does not hold
   * the group.
   */
  readonly currentBucket?: MembershipBucket;
  /** Whether the user holds this group today. */
  readonly currentlyHeld: boolean;
}

/** Per-kind and per-transition tallies, so a summary line needs no re-scan. */
export interface BlastRadiusCounts {
  /** Groups with `kind: 'added'`. */
  readonly added: number;
  /** Groups with `kind: 'removed'`. */
  readonly removed: number;
  /** Groups with `kind: 'not-predicted'`. */
  readonly notPredicted: number;
  /** Rules with `transition: 'starts-matching'`. */
  readonly starts: number;
  /** Rules with `transition: 'stops-matching'`. */
  readonly stops: number;
  /**
   * Rules with `transition: 'undetermined'` — unreadable **and** within the edit's
   * reach. Deliberately excludes `unchanged-unevaluable`: a rule the edit cannot
   * move is not something the admin was asking about.
   */
  readonly undetermined: number;
}

/**
 * The whole answer for one draft.
 *
 * `status` gates the rest: only `computed` may be read as a finding. Under
 * `not-computed` and `unavailable` every array is empty and every count is zero,
 * and the two remain distinct because "not yet" and "we tried and failed" are
 * different things to tell an admin.
 */
export interface BlastRadiusReport {
  /**
   * `not-computed` — the rule inventory has not resolved yet; render as
   * "not computed", **never** as a finding. `unavailable` — the inventory could
   * not be obtained; that is itself reportable. `computed` — the arrays below
   * are meaningful.
   */
  readonly status: 'not-computed' | 'unavailable' | 'computed';
  /**
   * One entry per implicated group, ordered `added` → `removed` →
   * `not-predicted`, then by name, then by id. Groups nothing implicates are
   * absent entirely.
   */
  readonly groups: readonly GroupEffect[];
  /**
   * **Every** rule in the inventory, ordered `starts-matching` →
   * `stops-matching` → `undetermined` → `unchanged-match` →
   * `unchanged-no-match` → `unchanged-unevaluable`, then by name, then by id.
   *
   * The unchanged rules are carried rather than dropped so a caller can show
   * "and 40 rules are unaffected". `unchanged-unevaluable` ranks last of them: it
   * is the weakest claim in the list, because it says only that this edit does not
   * reach the rule and nothing at all about the verdict.
   */
  readonly rules: readonly RuleEffect[];
  /** Tallies over {@link groups} and {@link rules}. */
  readonly counts: BlastRadiusCounts;
  /**
   * The one-hop cascade: for each group this draft adds or removes, the rules
   * whose condition reads that group.
   *
   * **Reported rather than resolved, deliberately.** Naming the rules that read a
   * moving group is structure, read off the rule text. Chasing whether they then
   * fire is the second pass the engine refuses to make — see the module
   * documentation for why, and `docs/claims.md`'s withheld list for the rule.
   *
   * Groups with no cascade are absent entirely, so this is never a way to ask
   * "does nothing read this group?" — the scan under-reports by design (a negated
   * connective and a declined regex pattern both yield no references), and a
   * caller that rendered an absence here would turn that blind spot into a false
   * claim. Render what is present; never render its lack.
   */
  readonly cascades: readonly GroupCascade[];
}
