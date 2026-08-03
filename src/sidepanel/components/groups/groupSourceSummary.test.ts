import { describe, it, expect } from 'vitest';
import {
  describeMemberSource,
  groupIdentityLine,
  groupRowFacts,
  groupTypeBadge,
  summarizeGroupRow,
} from './groupSourceSummary';
import type { GroupSummary } from '../../../shared/types';
import type { MemberSourceBreakdown } from '../../../shared/membership/groupSource';

const group = (over: Partial<GroupSummary> = {}): GroupSummary => ({
  id: '00gFAKEgroup0000001',
  name: 'Engineering',
  type: 'OKTA_GROUP',
  memberCount: 128,
  hasRules: false,
  ruleCount: 0,
  ...over,
});

const breakdown = (over: Partial<MemberSourceBreakdown> = {}): MemberSourceBreakdown => ({
  total: 0,
  direct: 0,
  ruleBased: 0,
  unattributed: 0,
  byRule: [],
  ...over,
});

describe('groupTypeBadge', () => {
  it('maps each Okta group type to its short badge', () => {
    expect(groupTypeBadge('OKTA_GROUP').label).toBe('OKTA');
    expect(groupTypeBadge('APP_GROUP').label).toBe('APP');
    expect(groupTypeBadge('BUILT_IN').label).toBe('BUILT-IN');
  });

  it('falls back to the built-in badge for an unrecognized type', () => {
    expect(groupTypeBadge('SOMETHING_NEW' as GroupSummary['type']).label).toBe('BUILT-IN');
  });

  it('carries token classes only — never a raw colour', () => {
    for (const type of ['OKTA_GROUP', 'APP_GROUP', 'BUILT_IN'] as const) {
      expect(groupTypeBadge(type).className).not.toMatch(/#[0-9a-f]{3,6}/i);
    }
  });
});

describe('groupIdentityLine', () => {
  it('uses the description when there is one', () => {
    const line = groupIdentityLine(group({ description: 'All engineering staff' }));
    expect(line).toMatchObject({ text: 'All engineering staff', kind: 'description' });
  });

  it('falls back to the group id for a blank or whitespace-only description', () => {
    for (const description of [undefined, '', '   ']) {
      const line = groupIdentityLine(group({ description }));
      expect(line.kind).toBe('id');
      expect(line.text).toBe('00gFAKEgroup0000001');
      expect(line.title).toContain('no description set');
    }
  });

  it('trims a padded description rather than rendering the padding', () => {
    expect(groupIdentityLine(group({ description: '  Contractors  ' })).text).toBe('Contractors');
  });
});

describe('groupRowFacts', () => {
  it('is empty for a group with no rule or push relationships', () => {
    expect(groupRowFacts(group())).toEqual([]);
  });

  it('keeps "fed by" and "used in" as separate facts, never a sum', () => {
    const facts = groupRowFacts(group({ ruleCount: 2, usedInRuleCount: 3 }));

    expect(facts.map((f) => f.label)).toEqual(['Fed by 2 rules', 'Used in 3 rules']);
    expect(facts.some((f) => f.label.includes('5'))).toBe(false);
  });

  it('treats an unknown usedInRuleCount as unknown, not zero', () => {
    expect(groupRowFacts(group({ ruleCount: 1 })).map((f) => f.key)).toEqual(['fedBy']);
    expect(groupRowFacts(group({ ruleCount: 1, usedInRuleCount: 0 })).map((f) => f.key)).toEqual([
      'fedBy',
    ]);
  });

  it('says that "used in" excludes name-based references, so the count is not overclaimed', () => {
    const [fact] = groupRowFacts(group({ usedInRuleCount: 1 }));
    expect(fact.title).toContain('by name are not counted');
  });

  it('pluralizes each fact', () => {
    const facts = groupRowFacts(group({ ruleCount: 1, usedInRuleCount: 1 }));
    expect(facts.map((f) => f.label)).toEqual(['Fed by 1 rule', 'Used in 1 rule']);
  });

  it('counts distinct push apps and lists their names in the tooltip', () => {
    const facts = groupRowFacts(
      group({
        pushMappings: [
          {
            mappingId: 'm1',
            sourceUserGroupId: 'g',
            targetGroupName: 'Mirror',
            appId: 'a1',
            appName: 'Slack',
          },
          {
            mappingId: 'm2',
            sourceUserGroupId: 'g',
            targetGroupName: 'Mirror',
            appId: 'a1',
            appName: 'Slack',
          },
          {
            mappingId: 'm3',
            sourceUserGroupId: 'g',
            targetGroupName: 'Mirror',
            appId: 'a2',
            appName: 'Workday',
          },
        ],
      }),
    );

    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      key: 'push',
      label: 'Pushed to 2 apps',
      title: 'Pushed to: Slack, Workday',
    });
  });

  it('falls back to the app id when a push mapping has no app name', () => {
    const facts = groupRowFacts(
      group({
        pushMappings: [
          {
            mappingId: 'm1',
            sourceUserGroupId: 'g',
            targetGroupName: 'Mirror',
            appId: '0oaFAKEapp',
          },
        ],
      }),
    );
    expect(facts[0].title).toBe('Pushed to: 0oaFAKEapp');
  });
});

describe('describeMemberSource', () => {
  it('reports an empty group rather than an empty meter', () => {
    expect(describeMemberSource(0, null).kind).toBe('no-members');
    expect(describeMemberSource(0, breakdown()).kind).toBe('no-members');
  });

  it('says the source is unanalyzed when nothing has been computed', () => {
    const state = describeMemberSource(128, null);
    expect(state.kind).toBe('unknown');
    expect(state.summary).toBe('Source not analyzed');
    expect(state.title).toContain('reads every member');
  });

  it('projects a computed breakdown onto non-empty segments only', () => {
    const state = describeMemberSource(128, breakdown({ total: 128, direct: 32, ruleBased: 96 }));

    expect(state.kind).toBe('computed');
    if (state.kind !== 'computed') throw new Error('unreachable');
    expect(state.segments.map((s) => s.key)).toEqual(['ruleBased', 'direct']);
    expect(state.summary).toBe('Rule-managed 96 · Manual 32');
  });

  it('never double-counts unattributed members, which are a subset of ruleBased', () => {
    const state = describeMemberSource(
      10,
      breakdown({ total: 10, direct: 4, ruleBased: 6, unattributed: 2 }),
    );

    if (state.kind !== 'computed') throw new Error('unreachable');
    expect(state.segments.map((s) => s.count)).toEqual([4, 4, 2]);
    expect(state.segments.reduce((sum, s) => sum + s.count, 0)).toBe(10);
  });
});

describe('summarizeGroupRow', () => {
  it('assembles the whole row model, pluralizing the member noun', () => {
    const model = summarizeGroupRow(
      group({ description: 'All engineering staff', ruleCount: 1 }),
      null,
    );

    expect(model).toMatchObject({
      memberCount: 128,
      memberNoun: 'members',
      sourceApp: null,
    });
    expect(model.typeBadge.label).toBe('OKTA');
    expect(model.identity.kind).toBe('description');
    expect(model.facts.map((f) => f.key)).toEqual(['fedBy']);
    expect(model.source.kind).toBe('unknown');
  });

  it('surfaces the source app only for an app group', () => {
    expect(
      summarizeGroupRow(group({ type: 'APP_GROUP', sourceAppName: 'Okta' }), null).sourceApp,
    ).toBe('Okta');
    expect(
      summarizeGroupRow(group({ type: 'OKTA_GROUP', sourceAppName: 'Okta' }), null).sourceApp,
    ).toBeNull();
    expect(summarizeGroupRow(group({ type: 'APP_GROUP' }), null).sourceApp).toBeNull();
  });

  it('uses the singular member noun for a group of one', () => {
    expect(summarizeGroupRow(group({ memberCount: 1 }), null).memberNoun).toBe('member');
  });
});
