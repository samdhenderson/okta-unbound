/**
 * Tests for the reader over Okta's `expand=group-rules` member embed.
 *
 * Two things are load-bearing and pinned here: the **three** distinct states
 * (named rules / positively no rules / nothing said), and totality — every
 * malformed shape degrades to `unknown` so the caller falls back to the
 * heuristic instead of dropping a member.
 *
 * Fixtures use only fake placeholders (`0prFAKE…`, `00uFAKE…`) per CLAUDE.md.
 */
import { describe, it, expect } from 'vitest';
import {
  GROUP_RULES_EXPAND,
  readEmbeddedGroupRules,
  memberWithGroupRulesSchema,
} from './memberRuleAttribution';

/** Build a member row carrying the given `_embedded` value. */
function row(embedded: unknown): unknown {
  return { id: '00uFAKE1', _embedded: embedded };
}

describe('GROUP_RULES_EXPAND', () => {
  it('is the hyphenated key Okta actually uses', () => {
    expect(GROUP_RULES_EXPAND).toBe('group-rules');
  });
});

describe('readEmbeddedGroupRules', () => {
  it('reports the rules Okta names', () => {
    const result = readEmbeddedGroupRules(
      row({ 'group-rules': [{ id: '0prFAKE1', name: 'Eng feeder' }] }),
    );

    expect(result).toEqual({
      state: 'rules',
      rules: [{ id: '0prFAKE1', name: 'Eng feeder' }],
    });
  });

  it('keeps every rule of a multi-rule member', () => {
    const result = readEmbeddedGroupRules(
      row({
        'group-rules': [
          { id: '0prFAKE1', name: 'Eng feeder' },
          { id: '0prFAKE2', name: 'Contractor feeder' },
        ],
      }),
    );

    expect(result).toMatchObject({ state: 'rules' });
    expect(result).toHaveProperty('rules.length', 2);
  });

  it('collapses a repeated rule id so a member is credited once per rule', () => {
    const result = readEmbeddedGroupRules(
      row({
        'group-rules': [
          { id: '0prFAKE1', name: 'Eng feeder' },
          { id: '0prFAKE1', name: 'Eng feeder' },
        ],
      }),
    );

    expect(result).toEqual({ state: 'rules', rules: [{ id: '0prFAKE1', name: 'Eng feeder' }] });
  });

  it('keeps the usable entries of a partially malformed array', () => {
    const result = readEmbeddedGroupRules(
      row({ 'group-rules': [{ nope: true }, { id: '0prFAKE1', name: 'Eng feeder' }] }),
    );

    expect(result).toEqual({ state: 'rules', rules: [{ id: '0prFAKE1', name: 'Eng feeder' }] });
  });

  // The distinction the whole module exists for.
  it('reports an EMPTY array as a positive "no rule feeds this member"', () => {
    expect(readEmbeddedGroupRules(row({ 'group-rules': [] }))).toEqual({ state: 'no-rules' });
  });

  it('reports an ABSENT group-rules key as unknown, never as "no rule"', () => {
    expect(readEmbeddedGroupRules(row({}))).toEqual({ state: 'unknown' });
    expect(readEmbeddedGroupRules({ id: '00uFAKE1' })).toEqual({ state: 'unknown' });
  });

  it.each([
    ['a null embed', null],
    ['a string embed', 'nope'],
    ['a number embed', 7],
    ['a non-array group-rules value', { 'group-rules': 'nope' }],
    ['a null group-rules value', { 'group-rules': null }],
    ['an array of unusable entries', { 'group-rules': [null, {}, { id: 42 }] }],
    ['a camelCase key Okta does not use', { groupRules: [{ id: '0prFAKE1', name: 'x' }] }],
  ])('degrades %s to unknown rather than throwing', (_label, embedded) => {
    expect(readEmbeddedGroupRules(row(embedded))).toEqual({ state: 'unknown' });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'nope'],
  ])('returns unknown for %s instead of a member row', (_label, member) => {
    expect(readEmbeddedGroupRules(member)).toEqual({ state: 'unknown' });
  });
});

describe('memberWithGroupRulesSchema', () => {
  const validMember = {
    id: '00uFAKE1',
    status: 'ACTIVE',
    profile: {
      login: 'ada@example.com',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Fake',
    },
  };

  it('keeps the embed on a valid row', () => {
    const parsed = memberWithGroupRulesSchema.parse({
      ...validMember,
      _embedded: { 'group-rules': [{ id: '0prFAKE1', name: 'Eng feeder' }] },
    });

    expect(readEmbeddedGroupRules(parsed)).toMatchObject({ state: 'rules' });
  });

  // The trap this schema is shaped to avoid: parseOktaList DROPS rows that fail
  // validation, so a stricter `_embedded` would delete real members from a group.
  it.each([
    ['a malformed embed', 'nope'],
    ['a non-array group-rules value', { 'group-rules': 42 }],
    ['no embed at all', undefined],
  ])('still validates a member with %s', (_label, embedded) => {
    const input =
      embedded === undefined ? { ...validMember } : { ...validMember, _embedded: embedded };

    expect(memberWithGroupRulesSchema.safeParse(input).success).toBe(true);
  });
});
