/*
 * The union row model behind the parity list.
 *
 * The buckets answer "what differs" by putting rows in three boxes; a parity row
 * answers it on the row itself. These pin the projection between them — and the
 * ordering, which is what lets ONE list serve the whole tab: the rows an admin can
 * act on rise to the top on their own, so the filter is a convenience rather than
 * the only way to find them.
 *
 * Fixtures use obviously fake placeholders only.
 */
import { describe, it, expect } from 'vitest';
import { groupParityRows, appParityRows } from './comparisonAnalytics';
import type { GroupMembership } from '../../../../shared/types';

const membership = (id: string, name: string): GroupMembership => ({
  group: { id, type: 'OKTA_GROUP', profile: { name } },
  membershipType: 'RULE_BASED',
  rules: [],
  attribution: 'exact',
});

describe('groupParityRows', () => {
  it('states which side holds each group, on the row itself', () => {
    const rows = groupParityRows({
      onlyCompared: [membership('g1', 'Only Compared')],
      shared: [membership('g2', 'Shared')],
      onlyContext: [membership('g3', 'Only Context')],
    });

    expect(rows.map((r) => [r.label, r.inContext, r.inCompared])).toEqual([
      ['Only Compared', false, true],
      ['Only Context', true, false],
      ['Shared', true, true],
    ]);
  });

  it('puts the differences first, then sorts alphabetically within each part', () => {
    const rows = groupParityRows({
      onlyCompared: [membership('g1', 'Zulu')],
      shared: [membership('g2', 'Alpha'), membership('g3', 'Charlie')],
      onlyContext: [membership('g4', 'Bravo')],
    });

    expect(rows.map((r) => r.label)).toEqual(['Bravo', 'Zulu', 'Alpha', 'Charlie']);
  });

  it('carries the whole membership, so a row can say WHY the group is held', () => {
    const held = membership('g1', 'VPN Access');
    const [row] = groupParityRows({ onlyCompared: [held], shared: [], onlyContext: [] });

    expect(row.membership).toBe(held);
  });

  it('produces no rows when neither user is in anything', () => {
    expect(groupParityRows({ onlyCompared: [], shared: [], onlyContext: [] })).toEqual([]);
  });
});

describe('appParityRows', () => {
  it('projects app entries the same way, with no membership on any row', () => {
    const rows = appParityRows({
      onlyCompared: [{ id: 'a1', label: 'Salesforce', scope: 'USER' }],
      shared: [{ id: 'a2', label: 'Slack' }],
      onlyContext: [{ id: 'a3', label: 'Figma', scope: 'GROUP' }],
    });

    expect(rows.map((r) => r.label)).toEqual(['Figma', 'Salesforce', 'Slack']);
    expect(rows.every((r) => r.membership === undefined)).toBe(true);
  });
});
