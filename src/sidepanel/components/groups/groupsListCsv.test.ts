import { describe, it, expect } from 'vitest';
import { buildGroupsListCsv } from './groupsListCsv';
import type { GroupSummary } from '../../../shared/types';

function makeGroup(overrides: Partial<GroupSummary> = {}): GroupSummary {
  return {
    id: '00gFAKE00000000000001',
    name: 'Engineering',
    description: 'the eng group',
    type: 'OKTA_GROUP',
    memberCount: 3,
    hasRules: false,
    ruleCount: 0,
    ...overrides,
  };
}

function dataRow(csv: string, index = 0): string {
  return csv.split('\n')[index + 1];
}

describe('buildGroupsListCsv', () => {
  it('emits the expected header row', () => {
    const csv = buildGroupsListCsv([]);
    expect(csv.split('\n')[0]).toBe(
      '"ID","Name","Description","Type","Member Count","Staleness Score","Push Status"',
    );
  });

  it('neutralizes a formula-injection group name starting with =', () => {
    const csv = buildGroupsListCsv([makeGroup({ name: '=SUM(A1)' })]);
    // The single-quote prefix stops spreadsheets from executing the cell.
    expect(dataRow(csv)).toContain(`"'=SUM(A1)"`);
    expect(dataRow(csv)).not.toContain('"=SUM(A1)"');
  });

  it.each([
    ['+cmd|calc', `"'+cmd|calc"`],
    ['-2+3', `"'-2+3"`],
    ['@SUM(A1)', `"'@SUM(A1)"`],
    ['\tvalue', `"'\tvalue"`],
  ])('neutralizes a name starting with a formula trigger: %j', (name, expected) => {
    const csv = buildGroupsListCsv([makeGroup({ name })]);
    expect(dataRow(csv)).toContain(expected);
  });

  it('doubles embedded quotes and keeps comma-containing cells intact', () => {
    const csv = buildGroupsListCsv([
      makeGroup({ name: 'Sales, EMEA', description: 'the "best" team' }),
    ]);
    const row = dataRow(csv);
    expect(row).toContain('"Sales, EMEA"');
    expect(row).toContain('"the ""best"" team"');
  });

  it('keeps newline-containing cells inside one quoted field', () => {
    const csv = buildGroupsListCsv([makeGroup({ description: 'line one\nline two' })]);
    expect(csv).toContain('"line one\nline two"');
  });

  it('handles an empty description as an empty quoted field', () => {
    const csv = buildGroupsListCsv([makeGroup({ description: undefined })]);
    expect(dataRow(csv)).toBe(
      '"00gFAKE00000000000001","Engineering","","OKTA_GROUP","3","","Not Pushed"',
    );
  });

  it('renders staleness score and push status when present', () => {
    const csv = buildGroupsListCsv([
      makeGroup({
        staleness: { score: 87, factors: [] },
        pushMappings: [
          {
            mappingId: 'm1',
            sourceUserGroupId: '00gFAKE00000000000001',
            targetGroupName: 'App One Group',
            status: 'ACTIVE',
            appId: '0oaFAKE0000000000001',
          },
          {
            mappingId: 'm2',
            sourceUserGroupId: '00gFAKE00000000000001',
            targetGroupName: 'App Two Group',
            status: 'ACTIVE',
            appId: '0oaFAKE0000000000002',
          },
        ],
      }),
    ]);
    const row = dataRow(csv);
    expect(row).toContain('"87"');
    expect(row).toContain('"Pushed (2)"');
  });

  it('emits one row per group in order', () => {
    const csv = buildGroupsListCsv([
      makeGroup({ id: '00gFAKE00000000000001', name: 'A' }),
      makeGroup({ id: '00gFAKE00000000000002', name: 'B' }),
    ]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"00gFAKE00000000000001"');
    expect(lines[2]).toContain('"00gFAKE00000000000002"');
  });
});
