/**
 * @module shared/utils/oktaId.test
 * @description Unit tests for the Okta id classifier.
 *
 * All ids here are fake (`00gFAKE…`), per the repo's no-secrets rule.
 */
import { describe, it, expect } from 'vitest';
import { oktaIdKind, isOktaId, RECOGNISED_ID_PREFIXES } from './oktaId';
import { redactJson } from './redact';

/** Builds a shape-valid fake id: a 3-char prefix + exactly 17 alphanumerics. */
const fakeId = (prefix: string, filler = 'FAKE00000000000') => `${prefix}${filler}01`;

describe('oktaIdKind', () => {
  it('classifies each reachable entity kind by its prefix', () => {
    expect(oktaIdKind(fakeId('00g'))).toBe('group');
    expect(oktaIdKind(fakeId('00u'))).toBe('user');
    expect(oktaIdKind(fakeId('0oa'))).toBe('app');
    expect(oktaIdKind(fakeId('0pr'))).toBe('rule');
  });

  it('trims surrounding whitespace, because ids arrive by paste', () => {
    expect(oktaIdKind(`  ${fakeId('00g')}\n`)).toBe('group');
  });

  it('does not lowercase — Okta ids are case-sensitive', () => {
    // Same id with the body case flipped is a *different* id, not the same one.
    // Both are shape-valid, so both classify; the point is that neither is
    // normalised into the other.
    const upper = fakeId('00g');
    const lower = upper.slice(0, 3) + upper.slice(3).toLowerCase();
    expect(oktaIdKind(upper)).toBe('group');
    expect(oktaIdKind(lower)).toBe('group');
    expect(lower).not.toBe(upper);
  });

  describe('returns null rather than guessing', () => {
    it('for a policy id — the prefix is real but has no destination tab', () => {
      // Both prefixes this repo's POLICY_ID_PATTERN accepts.
      expect(oktaIdKind(fakeId('00p'))).toBeNull();
      expect(oktaIdKind(fakeId('rst'))).toBeNull();
    });

    it('for an authorization-server id — nothing in this app browses them', () => {
      expect(oktaIdKind(fakeId('aus'))).toBeNull();
    });

    it('for a known prefix with the wrong body length', () => {
      expect(oktaIdKind('00gFAKE')).toBeNull(); // too short
      expect(oktaIdKind(`${fakeId('00g')}X`)).toBeNull(); // too long
    });

    it('for a known prefix with a non-alphanumeric body', () => {
      expect(oktaIdKind('00gFAKE-0000-0000-01')).toBeNull();
    });

    it('for names and emails, which are what the caller searches instead', () => {
      expect(oktaIdKind('Engineering')).toBeNull();
      expect(oktaIdKind('ada@example.com')).toBeNull();
      expect(oktaIdKind('')).toBeNull();
      expect(oktaIdKind('   ')).toBeNull();
    });

    it('for an id embedded in a longer string — the match is anchored', () => {
      // A jump bar resolves what was pasted, not whatever it can find inside it.
      expect(oktaIdKind(`group ${fakeId('00g')} please`)).toBeNull();
    });
  });
});

describe('isOktaId', () => {
  it('agrees with oktaIdKind on every input', () => {
    const cases = [
      fakeId('00g'),
      fakeId('00u'),
      fakeId('0oa'),
      fakeId('0pr'),
      fakeId('00p'),
      'Engineering',
      '',
    ];
    for (const candidate of cases) {
      expect(isOktaId(candidate)).toBe(oktaIdKind(candidate) !== null);
    }
  });
});

describe('agreement with the redaction prefix table', () => {
  // `redact.ts` keeps its own prefix table, for the opposite purpose: hiding ids
  // rather than reaching them. The two lists deliberately differ — redaction
  // covers kinds this app cannot browse, and this module covers `0pr`, which
  // redaction does not. What must NOT drift is the id *shape* both assume, and
  // the classification of the prefixes they share. Asserted behaviourally so
  // neither module has to import the other.

  it.each(['00g', '00u', '0oa'])(
    'treats %s as an id in the same shape redaction recognises',
    (prefix) => {
      const id = fakeId(prefix);
      expect(oktaIdKind(id)).not.toBeNull();
      expect(redactJson({ id }).redactedCount).toBe(1);
    },
  );

  it('documents the one prefix redaction does not cover', () => {
    // Group rule ids are reachable but not redacted. That is not a leak — the
    // logging rule permits identifiers — but if `redact.ts` ever gains `0pr`,
    // this expectation flips and the reader is told to reconcile the two tables.
    const ruleId = fakeId('0pr');
    expect(oktaIdKind(ruleId)).toBe('rule');
    expect(redactJson({ id: ruleId }).redactedCount).toBe(0);
  });

  it('exposes exactly the four reachable prefixes', () => {
    expect([...RECOGNISED_ID_PREFIXES].sort()).toEqual(['00g', '00u', '0oa', '0pr']);
  });
});
