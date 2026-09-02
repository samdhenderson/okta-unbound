/**
 * @module sidepanel/components/rules/ruleIdentity
 * @description Turns a group rule into the header's identity descriptor.
 *
 * The third of ADR-0032 §2's per-entity builders, beside `groupIdentity` and
 * `userIdentity`: a `FormattedRule` in, plain data out, no JSX and no `oktaOrigin`. That
 * purity is what lets the badge choice, the pluralisation and — the part worth testing —
 * the omission rules be checked without rendering anything.
 *
 * ## Two decisions this file makes
 *
 * **Only `ACTIVE` is a quiet dot; the other two take the badge.** ADR-0032 §2 reserves the
 * header's trailing badge for `danger` and demotes everything else into the identity row.
 * A paused rule is not `danger` — nothing is broken — but it is the fact a reader most
 * needs off the header, because every other number on the page describes what the rule
 * *would* do and the status says whether it is doing it. So it takes the badge as
 * `warning`, and an active rule takes none: the normal case does not need announcing.
 * `INVALID` is the status the `danger` reservation was written for, and it is the reason
 * this decision is now a switch rather than an `isPaused = status !== 'ACTIVE'` flag
 * (D-085): that flag handed a rule Okta can no longer evaluate the **Paused** badge,
 * asserting a decision no admin made. Its word and treatment come from
 * {@link shared/ruleUtils.ruleStatusBadge}, so the detail header and the rule's card
 * cannot drift apart on what a broken rule is called.
 *
 * **There is no `link`.** {@link shared/utils/oktaUrl.OktaAdminEntityType} is
 * `'group' | 'user' | 'app'`, and Okta's Admin Console has no per-rule route — the best
 * available target is the org's rules *list*, which is not this rule. ADR-0032 §2a's rule
 * applies: a fact the builder cannot answer is omitted, never approximated. The generic
 * `/admin/groups#rules` anchor still exists on the detail view, where it is labelled as
 * what it is; putting it behind the header's "open in Okta" affordance would promise a
 * deep link into this rule and deliver a search page.
 */
import type { FormattedRule } from '../../../shared/types';
import { ruleStatusBadge } from '../../../shared/ruleUtils';
import type {
  EntityIdentityDescriptor,
  IdentityFact,
  IdentityRow,
} from '../shared/identityDescriptor';
import { getRelativeTime } from '../../../shared/utils/dateFormat';

/**
 * The header's trailing badge for a rule's status, or `undefined` when the status
 * belongs in the identity row instead.
 *
 * Exhaustive over the status union on purpose: a fourth Okta status becomes a compile
 * error here rather than silently inheriting whichever arm a ternary happened to
 * default to (D-085).
 *
 * @param status - The rule's status exactly as Okta reported it.
 * @returns The badge to render beside the title, or `undefined` for `ACTIVE`.
 */
function statusBadge(
  status: FormattedRule['status'],
): NonNullable<EntityIdentityDescriptor['badge']> | undefined {
  switch (status) {
    case 'ACTIVE':
      return undefined;
    case 'INACTIVE':
      return { text: 'Paused', variant: 'warning' };
    case 'INVALID': {
      // One source for the word and the treatment, shared with RuleCard's mark.
      const { text, variant } = ruleStatusBadge('INVALID');
      return { text, variant };
    }
  }
}

/** A counted fact, with its label pluralised to match. */
const metric = (
  icon: Extract<IdentityFact, { kind: 'metric' }>['icon'],
  n: number,
  singular: string,
  title?: string,
): Extract<IdentityFact, { kind: 'metric' }> => ({
  kind: 'metric',
  icon,
  value: n.toLocaleString(),
  label: n === 1 ? singular : `${singular}s`,
  title,
});

/**
 * Build the header identity descriptor for a group rule.
 *
 * Rows are identity, then counts, then timestamps — the same three-row convention the
 * group and user builders use, so a reader moving between detail rungs finds the same
 * kind of fact in the same place.
 *
 * Every count is **omitted at zero** rather than shown as `0`, per ADR-0032 §2a. The
 * distinction is meaningful for all three: a rule with no target groups assigns nobody
 * anywhere and is a different object from one that assigns to two; a rule reading no
 * `user.*` attribute matches on something else entirely; and "0 conflicts" is the state
 * every rule is in most of the time, which is exactly the fact that does not need a row.
 *
 * @param rule - The formatted rule to describe.
 * @returns The descriptor `PageHeader` renders through `EntityIdentity`.
 */
export function ruleIdentity(rule: FormattedRule): EntityIdentityDescriptor {
  const badge = statusBadge(rule.status);

  const identityRow: IdentityRow = [];
  // An active rule states so quietly in the row; a rule that is not in force takes the
  // header badge above and is not repeated here.
  if (!badge) {
    identityRow.push({ kind: 'status', variant: 'success', text: 'Active' });
  }
  identityRow.push({ kind: 'id', value: rule.id, copyLabel: `Copy rule id ${rule.id}` });

  const counts: IdentityRow = [];
  if (rule.groupIds.length > 0) {
    counts.push(
      metric('users', rule.groupIds.length, 'target group', 'Groups this rule assigns users to'),
    );
  }
  if (rule.userAttributes.length > 0) {
    counts.push(
      metric(
        'clipboard',
        rule.userAttributes.length,
        'attribute',
        'User profile attributes this rule’s condition reads',
      ),
    );
  }
  if (rule.conflicts && rule.conflicts.length > 0) {
    counts.push(
      metric(
        'alert',
        rule.conflicts.length,
        'conflict',
        'Other rules whose conditions overlap this one',
      ),
    );
  }

  // `getRelativeTime` returns `null` for an absent or unparseable timestamp, and a row
  // reading "Updated null" is worse than no row — so the null is what gates the fact,
  // not merely the presence of the field.
  const timestamps: IdentityRow = [];
  const updated = getRelativeTime(rule.lastUpdated);
  if (updated) timestamps.push({ kind: 'text', icon: 'clock', text: `Updated ${updated}` });
  const created = getRelativeTime(rule.created);
  if (created) timestamps.push({ kind: 'text', text: `Created ${created}` });

  return {
    key: rule.id,
    name: rule.name,
    badge,
    rows: [identityRow, counts, timestamps],
  };
}
