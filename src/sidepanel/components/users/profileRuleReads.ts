/**
 * @module sidepanel/components/users/profileRuleReads
 * @description Maps each profile attribute to the group rules that **read it and
 * currently grant this user access** — the fact that turns the Profile pane from a
 * data dump into an explanation.
 *
 * An attribute on its own says nothing: `department = "Engineering"` is a string.
 * The interesting question an admin is actually asking is _what does this value
 * buy them?_ — and the answer is the set of rules whose condition reads that
 * attribute and whose target group this user is presently in.
 *
 * ## Only rules that currently grant access
 *
 * A rule that reads `department` but grants this user nothing must not appear
 * beside `department`. Counting every rule that mentions an attribute would make
 * the chip a measure of the org's rule corpus rather than of this user's access,
 * and every busy attribute would carry a large, meaningless number. So a rule
 * qualifies only when both hold:
 *
 * 1. it is `ACTIVE` — an inactive rule is not granting anything *currently*; and
 * 2. it targets (feeds) at least one group this user is a member of.
 *
 * "Targets a group they are in" is the honest available test. Okta does not
 * report, per membership, which rule put the user there — that ambiguity is
 * exactly what {@link GroupMembership.attribution} exists to describe — so this
 * module deliberately does **not** narrow to `membership.rules`, whose entries
 * are candidates rather than answers under `inferred`/`ambiguous`. The chip
 * claims "rules that read this and feed a group you are in", and that is what it
 * computes.
 *
 * ## No I/O, no second parser
 *
 * Pure and synchronous, like
 * {@link module:sidepanel/components/users/comparison/comparisonAnalytics}. The
 * attribute references come from clause text already produced by
 * {@link explainRuleExpression} — the app's one parse of a rule condition — plus
 * {@link FormattedRule.userAttributes}, which the API boundary already extracted
 * and which is the only source that survives an expression the parser rejects.
 * Nothing here fetches, and no new API call is needed to render a chip.
 *
 * ## Security
 *
 * Rule names, condition text and attribute names are end-user-controllable tenant
 * data. They are returned for React to escape at the render site; **nothing in
 * this module logs**. Keys are additionally filtered through
 * {@link isExcludedProfileField}, so a security/recovery key can never enter the
 * map even if a tenant rule references one.
 */
import type { FormattedRule, GroupMembership, OktaUser } from '../../../shared/types';
import { explainRuleExpression } from '../../../shared/rules/explainExpression';
import { isExcludedProfileField } from '../../../shared/utils/profileFields';

/** `user.department` — the ordinary dotted reference. */
const DOT_REFERENCE = /\buser\.([A-Za-z_$][A-Za-z0-9_$]*)/g;

/**
 * `user["department"]` — the computed form. Rare in tenant-authored rules, but
 * the AST unparser emits it verbatim, and dropping it would silently under-count
 * a chip rather than fail loudly.
 */
const BRACKET_REFERENCE = /\buser\[(['"])([^'"]*)\1\]/g;

/**
 * A quoted string literal, escapes included.
 *
 * Literals are blanked out *before* references are collected, because a rule may
 * legitimately carry `user.department` inside a quoted argument —
 * `isMemberOfAnyGroupName("user.department")` names a group, it does not read an
 * attribute — and counting that would put a chip beside `department` for a rule
 * that never looks at it. The bracket form is matched from the original text
 * first, since its attribute name *is* a literal.
 */
const STRING_LITERAL = /(['"])(?:\\.|(?!\1)[^\\])*\1/g;

/** Add every `user.<attr>` / `user["<attr>"]` reference in `text` to `into`. */
function collectReferences(text: string, into: Set<string>): void {
  for (const match of text.matchAll(BRACKET_REFERENCE)) into.add(match[2]);
  for (const match of text.replace(STRING_LITERAL, '""').matchAll(DOT_REFERENCE)) {
    into.add(match[1]);
  }
}

/**
 * The profile attributes one rule's condition reads.
 *
 * Two sources, unioned rather than ranked, because each covers the other's gap:
 * the clause explanation is AST-derived (so it sees a computed reference and
 * cannot be fooled by a quoted string), while `userAttributes` was extracted at
 * the API boundary and still answers for an expression the parser rejected — in
 * which case `clauses` is empty and the attribute would otherwise vanish.
 */
function attributesReadBy(rule: FormattedRule, user: OktaUser): Set<string> {
  const names = new Set<string>();

  const expression = rule.conditionExpression ?? '';
  if (expression !== '') {
    // `rule.condition` is deliberately not consulted: it is the display string,
    // which has had `user.` stripped out of it, so it cannot be parsed for
    // references at all.
    for (const clause of explainRuleExpression(expression, user).clauses) {
      collectReferences(clause.expressionText, names);
    }
  }

  for (const name of rule.userAttributes ?? []) names.add(name);

  return names;
}

/**
 * Whether a rule currently grants this user access — see the module header for
 * why this, and only this, counts.
 */
function grantsAccess(rule: FormattedRule, memberGroupIds: ReadonlySet<string>): boolean {
  if (rule.status !== 'ACTIVE') return false;
  return rule.groupIds.some((groupId) => memberGroupIds.has(groupId));
}

/**
 * Which rules read each of this user's profile attributes, restricted to the
 * rules that currently grant them access.
 *
 * @param rules - Every group rule already loaded for this org. Rules that grant
 *   this user nothing are skipped, not counted.
 * @param user - The user whose profile is on screen. Used to explain each rule's
 *   condition against real values; never logged.
 * @param memberships - The user's group memberships. A rule qualifies by feeding
 *   one of these groups.
 * @returns Attribute **Okta name** (`department`, matching
 *   `AttributeDescriptor.name`) to the names of the qualifying rules that read
 *   it, de-duplicated and in the order the rules were given. Attributes no
 *   qualifying rule reads are absent from the map — never present with an empty
 *   array, so `name in reads` is a safe test.
 *
 * @example
 * const reads = profileRuleReads(rules, user, memberships);
 * reads.department; // ['Engineering → VPN Access']
 * reads.nickName;   // undefined
 */
export function profileRuleReads(
  rules: readonly FormattedRule[],
  user: OktaUser,
  memberships: readonly GroupMembership[],
): Record<string, string[]> {
  const memberGroupIds = new Set(memberships.map((membership) => membership.group.id));
  const reads: Record<string, string[]> = {};

  for (const rule of rules) {
    if (!grantsAccess(rule, memberGroupIds)) continue;

    for (const name of attributesReadBy(rule, user)) {
      // Defence in depth: the attribute inventory already filters these, so a
      // key excluded here could never have matched a rendered row — but the map
      // is a public return value and must not carry one either.
      if (isExcludedProfileField(name)) continue;
      const named = reads[name] ?? (reads[name] = []);
      if (!named.includes(rule.name)) named.push(rule.name);
    }
  }

  return reads;
}
