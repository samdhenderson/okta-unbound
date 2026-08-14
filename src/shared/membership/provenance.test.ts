/**
 * Tests for the join between Okta's three-state answer and the additive
 * `provenance` field a membership carries (ADR-0031).
 *
 * Two things are load-bearing and pinned here:
 *
 * 1. **`no-rules` is an answer and `unknown` is not.** Okta positively asserting
 *    that no rule feeds a membership must survive as a provenance with an empty
 *    rule list; Okta saying nothing must produce no provenance at all. Collapsing
 *    them would manufacture a confident "added directly" out of a failed request.
 * 2. **Provenance is additive.** It never rewrites `membershipType`, `rules` or
 *    `attribution`, so nothing that branches on the attribution union changes
 *    behaviour (ADR-0020 §3).
 *
 * Fixtures use only fake placeholders (`00gFAKE…`, `0prFAKE…`) per CLAUDE.md.
 */
import { describe, it, expect } from 'vitest';
import { membershipProvenanceOf, withMembershipProvenance } from './provenance';
import { membershipSourceLine, sourceLineLabel } from './sourceLine';
import type { MemberRuleAttribution } from './memberRuleAttribution';
import type { GroupMembership } from '../types';

/** A hedged, rule-attributed membership — the classifier's own guess. */
const guessed: GroupMembership = {
  group: { id: '00gFAKEvpn', type: 'OKTA_GROUP', profile: { name: 'VPN Access' } },
  membershipType: 'RULE_BASED',
  attribution: 'ambiguous',
  rules: [
    {
      id: '0prFAKEguess',
      name: 'Contractors → VPN',
      status: 'ACTIVE',
      conditionExpression: 'isMemberOfGroupName("Contractors")',
    },
  ],
};

const namedByOkta: MemberRuleAttribution = {
  state: 'rules',
  rules: [{ id: '0prFAKEhr', name: 'HR sync' }],
};

describe('membershipProvenanceOf', () => {
  it('carries the rules Okta named', () => {
    expect(membershipProvenanceOf(namedByOkta)).toEqual({
      source: 'okta',
      rules: [{ id: '0prFAKEhr', name: 'HR sync' }],
    });
  });

  it('keeps every rule of a multi-rule answer', () => {
    const provenance = membershipProvenanceOf({
      state: 'rules',
      rules: [
        { id: '0prFAKEhr', name: 'HR sync' },
        { id: '0prFAKEeng', name: 'Eng feeder' },
      ],
    });

    expect(provenance?.rules.map((r) => r.id)).toEqual(['0prFAKEhr', '0prFAKEeng']);
  });

  // The distinction the whole module exists for.
  it('turns "Okta says no rule" into an answer with an empty rule list', () => {
    expect(membershipProvenanceOf({ state: 'no-rules' })).toEqual({ source: 'okta', rules: [] });
  });

  it('turns "Okta said nothing" into no provenance at all, never an empty answer', () => {
    expect(membershipProvenanceOf({ state: 'unknown' })).toBeUndefined();
  });
});

describe('withMembershipProvenance', () => {
  it('attaches Okta’s answer without touching the classification', () => {
    const proven = withMembershipProvenance(guessed, { state: 'no-rules' });

    expect(proven.provenance).toEqual({ source: 'okta', rules: [] });
    // Additive, per ADR-0020 §3: the classifier's verdict is still readable.
    expect(proven.membershipType).toBe('RULE_BASED');
    expect(proven.attribution).toBe('ambiguous');
    expect(proven.rules).toEqual(guessed.rules);
  });

  it('leaves the membership untouched when Okta said nothing', () => {
    const result = withMembershipProvenance(guessed, { state: 'unknown' });

    expect(result.provenance).toBeUndefined();
    expect(result).toEqual(guessed);
  });

  it('does not mutate the membership it was given', () => {
    withMembershipProvenance(guessed, namedByOkta);

    expect(guessed.provenance).toBeUndefined();
  });
});

/**
 * The sentence a surface shows for a proven membership. It must read as a fact,
 * say whose fact it is, and outrank whatever the classifier had concluded.
 */
describe('membershipSourceLine — a membership Okta answered about', () => {
  const lineFor = (answer: MemberRuleAttribution, membership: GroupMembership = guessed) =>
    membershipSourceLine(withMembershipProvenance(membership, answer));

  it('names the rules Okta named, crediting Okta for the answer', () => {
    const line = lineFor(namedByOkta);

    expect(sourceLineLabel(line)).toBe('Okta confirms: added by rule: HR sync');
    expect(line.proven).toBe(true);
  });

  it('counts a multi-rule answer instead of collapsing it to one', () => {
    const line = lineFor({
      state: 'rules',
      rules: [
        { id: '0prFAKEhr', name: 'HR sync' },
        { id: '0prFAKEeng', name: 'Eng feeder' },
      ],
    });

    expect(sourceLineLabel(line)).toBe(
      'Okta confirms: added by rule: HR sync, Eng feeder (2 rules)',
    );
  });

  it('states an authoritative manual add as a fact, not as an unresolved guess', () => {
    const line = lineFor({ state: 'no-rules' });

    expect(sourceLineLabel(line)).toBe('Okta confirms: added directly');
    expect(line.proven).toBe(true);
    expect(line.description).toMatch(/Okta answering rather than the classifier/);
  });

  it('outranks the classifier: Okta’s answer wins over the deduction it contradicts', () => {
    // The classifier guessed a rule; Okta says nobody's rule feeds this membership.
    expect(sourceLineLabel(lineFor({ state: 'no-rules' }))).not.toMatch(/Contractors/);
    // And the guess, unproven, still reads as a guess.
    expect(sourceLineLabel(membershipSourceLine(guessed))).toMatch(/^Possible rule:/);
  });

  it('leaves the hedged line in place when Okta said nothing', () => {
    const line = lineFor({ state: 'unknown' });

    expect(sourceLineLabel(line)).toBe('Possible rule: Contractors → VPN');
    expect(line.proven).toBe(false);
  });

  it('never lets an unclassified membership be proven into "added directly" by silence', () => {
    const unclassified: GroupMembership = {
      ...guessed,
      membershipType: 'UNKNOWN',
      rules: [],
    };

    expect(sourceLineLabel(lineFor({ state: 'unknown' }, unclassified))).toBe(
      'Source not determined',
    );
    // …but an actual Okta "no rule" answer does resolve it.
    expect(sourceLineLabel(lineFor({ state: 'no-rules' }, unclassified))).toBe(
      'Okta confirms: added directly',
    );
  });
});
