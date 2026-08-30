import { describe, it, expect } from 'vitest';
import { toGroupSummary, liveSearchToGroupSummary, type RawOktaGroup } from './groupSummary';

const base: RawOktaGroup = { id: 'g1', type: 'OKTA_GROUP', profile: { name: 'Engineering' } };

describe('toGroupSummary', () => {
  it('reads memberCount from _embedded.stats.usersCount, defaulting to 0', () => {
    expect(toGroupSummary({ ...base, _embedded: { stats: { usersCount: 42 } } }).memberCount).toBe(
      42,
    );
    expect(toGroupSummary(base).memberCount).toBe(0);
  });

  it('falls back to the id when the profile name is missing', () => {
    expect(toGroupSummary({ id: 'g9', type: 'OKTA_GROUP' }).name).toBe('g9');
    expect(toGroupSummary(base).name).toBe('Engineering');
  });

  it('passes the description through and sets the fixed hasRules/ruleCount/selected fields', () => {
    const s = toGroupSummary({ ...base, profile: { name: 'Eng', description: 'the eng group' } });
    expect(s.description).toBe('the eng group');
    expect(s).toMatchObject({ hasRules: false, ruleCount: 0, selected: false });
  });

  it('revives lastUpdated/created/lastMembershipUpdated ISO strings into Date instances', () => {
    const s = toGroupSummary({
      ...base,
      lastUpdated: '2026-01-02T03:04:05Z',
      created: '2025-01-01T00:00:00Z',
      lastMembershipUpdated: '2026-02-03T04:05:06Z',
    });
    expect(s.lastUpdated).toBeInstanceOf(Date);
    expect(s.created).toBeInstanceOf(Date);
    expect(s.lastMembershipUpdated).toBeInstanceOf(Date);
    expect(s.lastUpdated?.toISOString()).toBe('2026-01-02T03:04:05.000Z');
    expect(s.lastMembershipUpdated?.toISOString()).toBe('2026-02-03T04:05:06.000Z');
  });

  it('keeps the two update clocks separate rather than aliasing one to the other', () => {
    // The regression this pins: `lastMembershipUpdated` was never mapped at all,
    // so every consumer saw `undefined` and the app concluded Okta did not send
    // it. A group's profile clock and roster clock move independently and the
    // mapper must carry both, distinctly.
    const s = toGroupSummary({
      ...base,
      lastUpdated: '2026-08-01T00:00:00Z',
      lastMembershipUpdated: '2023-01-01T00:00:00Z',
    });
    expect(s.lastUpdated?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(s.lastMembershipUpdated?.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });

  it('leaves the date fields undefined when absent', () => {
    const s = toGroupSummary(base);
    expect(s.lastUpdated).toBeUndefined();
    expect(s.created).toBeUndefined();
    // Absent rather than defaulted: a snapshot synced before this field was
    // parsed carries no value, and inventing one would date a roster that was
    // never reported.
    expect(s.lastMembershipUpdated).toBeUndefined();
  });

  it('for APP_GROUP: derives sourceAppId from the _links.apps href', () => {
    const s = toGroupSummary({
      id: 'g2',
      type: 'APP_GROUP',
      profile: { name: 'App Group' },
      _links: { apps: { href: 'https://x.okta.com/api/v1/apps/0oaABC/groups' } },
    });
    expect(s.sourceAppId).toBe('0oaABC');
    expect(s.sourceAppName).toBeUndefined();
  });

  it('for APP_GROUP: source.id overrides the href-derived id, and source.name surfaces only when it differs', () => {
    const withName = toGroupSummary({
      id: 'g2',
      type: 'APP_GROUP',
      profile: { name: 'App Group' },
      _links: { apps: { href: '/api/v1/apps/hrefId/groups' } },
      source: { id: 'srcId', name: 'Salesforce' },
    });
    expect(withName.sourceAppId).toBe('srcId');
    expect(withName.sourceAppName).toBe('Salesforce');

    const nameEqualsId = toGroupSummary({
      id: 'g2',
      type: 'APP_GROUP',
      profile: { name: 'App Group' },
      source: { id: 'srcId', name: 'srcId' },
    });
    expect(nameEqualsId.sourceAppId).toBe('srcId');
    expect(nameEqualsId.sourceAppName).toBeUndefined();
  });

  it('ignores _links/source for non-APP_GROUP types', () => {
    const s = toGroupSummary({
      id: 'g3',
      type: 'OKTA_GROUP',
      _links: { apps: { href: '/api/v1/apps/nope/groups' } },
      source: { id: 'nope' },
    });
    expect(s.sourceAppId).toBeUndefined();
    expect(s.sourceAppName).toBeUndefined();
  });
});

describe('liveSearchToGroupSummary', () => {
  it('maps the shared fields like toGroupSummary', () => {
    const s = liveSearchToGroupSummary({
      ...base,
      _embedded: { stats: { usersCount: 7 } },
      lastUpdated: '2026-01-02T00:00:00Z',
      lastMembershipUpdated: '2026-03-04T00:00:00Z',
    });
    expect(s).toMatchObject({
      id: 'g1',
      name: 'Engineering',
      memberCount: 7,
      hasRules: false,
      ruleCount: 0,
      selected: false,
    });
    expect(s.lastUpdated).toBeInstanceOf(Date);
    // The live-search mapper is narrower than `toGroupSummary` by design, but not
    // on the timestamps — a live hit must carry the roster clock too.
    expect(s.lastMembershipUpdated?.toISOString()).toBe('2026-03-04T00:00:00.000Z');
  });

  it('never populates sourceAppId/sourceAppName even for an APP_GROUP', () => {
    const s = liveSearchToGroupSummary({
      id: 'g2',
      type: 'APP_GROUP',
      profile: { name: 'App Group' },
      _links: { apps: { href: '/api/v1/apps/0oaABC/groups' } },
      source: { id: 'srcId', name: 'Salesforce' },
    });
    expect(s.sourceAppId).toBeUndefined();
    expect(s.sourceAppName).toBeUndefined();
  });
});
