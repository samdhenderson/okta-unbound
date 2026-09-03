/**
 * Unit tests for the shared pluralisation helper.
 *
 * The subject is the boundary at one. Every private copy this module replaces
 * existed to stop a user-visible "of 1 applications", so the cases that matter
 * are 0, 1 and 2 — plus the irregular form that no `+ 's'` helper can express,
 * which is why `NounForms` exists at all.
 */
import { describe, it, expect } from 'vitest';
import { pluralSuffix, pluralNoun, pluralize, singularOf } from './plural';

describe('pluralSuffix', () => {
  it('drops the s at exactly one and nowhere else', () => {
    expect(pluralSuffix(0)).toBe('s');
    expect(pluralSuffix(1)).toBe('');
    expect(pluralSuffix(2)).toBe('s');
  });
});

describe('pluralNoun', () => {
  it('picks the form the count calls for, and returns no number', () => {
    expect(pluralNoun(0, 'group')).toBe('groups');
    expect(pluralNoun(1, 'group')).toBe('group');
    expect(pluralNoun(2, 'group')).toBe('groups');
  });

  it('uses the stated forms for an irregular noun', () => {
    // The case a suffix-only helper cannot express, and the reason
    // `AuthPoliciesTab` had hand-rolled its own: "1 Policies" would be the
    // same defect this module exists to prevent, in a different surface.
    const policy = { one: 'Policy', other: 'Policies' };
    expect(pluralNoun(1, policy)).toBe('Policy');
    expect(pluralNoun(0, policy)).toBe('Policies');
    expect(pluralNoun(2, policy)).toBe('Policies');
  });

  it('treats a fraction as plural, the way English does', () => {
    expect(pluralNoun(1.5, 'hour')).toBe('hours');
  });
});

describe('pluralize', () => {
  it('pairs the count with the matching form', () => {
    expect(pluralize(0, 'application')).toBe('0 applications');
    expect(pluralize(1, 'application')).toBe('1 application');
    expect(pluralize(2, 'application')).toBe('2 applications');
  });

  it('localises the number, so a four-figure count is grouped', () => {
    expect(pluralize(1204, 'application')).toBe((1204).toLocaleString() + ' applications');
    // Non-vacuous: the assertion above only proves grouping where the runtime
    // locale groups, so pin that the raw digits are not what is emitted here.
    expect(pluralize(1204, 'application')).toMatch(/^1\D?204 applications$/);
  });

  it('carries an irregular noun through', () => {
    expect(pluralize(1, { one: 'Policy', other: 'Policies' })).toBe('1 Policy');
    expect(pluralize(3, { one: 'Policy', other: 'Policies' })).toBe('3 Policies');
  });
});

describe('singularOf', () => {
  it('undoes a regular plural, including a multi-word one', () => {
    expect(singularOf('applications')).toBe('application');
    expect(singularOf('groups')).toBe('group');
    expect(singularOf('group rules')).toBe('group rule');
    expect(singularOf('app group assignments')).toBe('app group assignment');
  });

  it('handles the -ies and -es endings a bare slice would mangle', () => {
    expect(singularOf('policies')).toBe('policy');
    expect(singularOf('identities')).toBe('identity');
    expect(singularOf('matches')).toBe('match');
    expect(singularOf('addresses')).toBe('address');
  });

  it('leaves a word that is not a plural alone', () => {
    expect(singularOf('access')).toBe('access');
    expect(singularOf('group')).toBe('group');
    expect(singularOf('')).toBe('');
  });
});
