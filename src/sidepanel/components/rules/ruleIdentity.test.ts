/**
 * @module sidepanel/components/rules/ruleIdentity.test
 * @description The rule header's identity descriptor: what it states, and what it omits.
 *
 * The omissions are the point. ADR-0032 §2a's rule — a fact the builder cannot answer is
 * omitted, never shown as a misleading zero — is only worth anything if it is enforced,
 * and every one of these fields has a zero that means something different from "unknown".
 */
import { describe, it, expect } from 'vitest';
import { ruleIdentity } from './ruleIdentity';
import type { FormattedRule } from '../../../shared/types';

/** A minimal rule; each test overrides only the fields it is about. */
const rule = (over: Partial<FormattedRule> = {}): FormattedRule => ({
  id: '0prFAKErule000000001',
  name: 'Engineering intake',
  status: 'ACTIVE',
  condition: "user.department == 'Engineering'",
  conditionExpression: "user.department == 'Engineering'",
  groupIds: [],
  groupNames: [],
  userAttributes: [],
  created: '2024-01-01T00:00:00.000Z',
  lastUpdated: '2024-06-01T00:00:00.000Z',
  ...over,
});

/** Flatten the descriptor's rows so a test can ask "is this fact anywhere". */
const facts = (r: FormattedRule) => ruleIdentity(r).rows.flat();

describe('ruleIdentity', () => {
  it('names the rule and keys on its id', () => {
    const identity = ruleIdentity(rule());

    expect(identity.name).toBe('Engineering intake');
    expect(identity.key).toBe('0prFAKErule000000001');
  });

  it('offers no Okta deep link, because Okta has no per-rule route', () => {
    // Not an oversight: `OktaAdminEntityType` has no 'rule', and the nearest real target
    // is the org's rules *list*. An "open in Okta" that lands on a search page is a
    // worse answer than no link (ADR-0032 §2a).
    expect(ruleIdentity(rule()).link).toBeUndefined();
  });

  it('always carries the copyable rule id', () => {
    expect(facts(rule())).toContainEqual({
      kind: 'id',
      value: '0prFAKErule000000001',
      copyLabel: 'Copy rule id 0prFAKErule000000001',
    });
  });
});

describe('ruleIdentity status', () => {
  it('states an active rule quietly, in the identity row, with no header badge', () => {
    const identity = ruleIdentity(rule({ status: 'ACTIVE' }));

    expect(identity.badge).toBeUndefined();
    expect(identity.rows.flat()).toContainEqual({
      kind: 'status',
      variant: 'success',
      text: 'Active',
    });
  });

  it('promotes a paused rule to the header badge, and does not also say it in the row', () => {
    // The one fact that changes what every other number on the page means: the counts
    // describe what the rule *would* do, and this says whether it is doing it.
    const identity = ruleIdentity(rule({ status: 'INACTIVE' }));

    expect(identity.badge).toEqual({ text: 'Paused', variant: 'warning' });
    expect(identity.rows.flat().filter((f) => f.kind === 'status')).toHaveLength(0);
  });
});

describe('ruleIdentity counts', () => {
  it('counts target groups, attributes and conflicts, pluralising each', () => {
    const identity = ruleIdentity(
      rule({
        groupIds: ['00gFAKE0000000000001'],
        userAttributes: ['user.department', 'user.title'],
        conflicts: [
          { severity: 'high', reason: 'overlaps', rule2: { name: 'Other' } },
          { severity: 'low', reason: 'overlaps', rule2: { name: 'Another' } },
        ] as FormattedRule['conflicts'],
      }),
    );
    const counted = identity.rows.flat().filter((f) => f.kind === 'metric');

    expect(counted).toEqual([
      expect.objectContaining({ value: '1', label: 'target group' }),
      expect.objectContaining({ value: '2', label: 'attributes' }),
      expect.objectContaining({ value: '2', label: 'conflicts' }),
    ]);
  });

  /*
    Each of these zeros means something, and none of them means "unknown" — which is
    exactly why none is rendered. A rule with no target groups assigns nobody anywhere;
    "0 conflicts" is the state most rules are in permanently.
  */
  it('omits every count at zero rather than stating it', () => {
    const counted = facts(rule({ groupIds: [], userAttributes: [], conflicts: [] })).filter(
      (f) => f.kind === 'metric',
    );

    expect(counted).toEqual([]);
  });

  it('omits the conflict count when conflicts were never populated', () => {
    const counted = facts(rule({ conflicts: undefined })).filter((f) => f.kind === 'metric');

    expect(counted).toEqual([]);
  });
});

describe('ruleIdentity timestamps', () => {
  it('states both timestamps relatively', () => {
    const texts = facts(rule())
      .filter((f) => f.kind === 'text')
      .map((f) => (f.kind === 'text' ? f.text : ''));

    expect(texts.some((t) => t.startsWith('Updated '))).toBe(true);
    expect(texts.some((t) => t.startsWith('Created '))).toBe(true);
  });

  /*
    The guard that matters: `getRelativeTime` returns `null` for an absent or
    unparseable date, and a header row reading "Updated null" is worse than no row.
  */
  it('omits a timestamp it cannot render rather than printing null', () => {
    const texts = facts(rule({ created: '', lastUpdated: 'not-a-date' })).filter(
      (f) => f.kind === 'text',
    );

    expect(texts).toEqual([]);
  });
});
