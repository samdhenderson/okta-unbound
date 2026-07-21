/**
 * @module sidepanel/export/descriptors/groupRules.test
 * @description Unit coverage for the Group Rules export descriptor: identity,
 * no-filter contract, schema acceptance of a representative rule, and the two
 * derived columns (condition expression + joined assigned-group ids).
 */

import { describe, it, expect } from 'vitest';
import { oktaGroupRuleSchema } from '@/shared/schemas/okta';
import rulesDescriptor from './groupRules';

const representativeRule = {
  id: '0prFAKE1',
  name: 'Sales auto-assign',
  status: 'ACTIVE' as const,
  type: 'group_rule',
  conditions: {
    expression: { value: 'user.department == "Sales"', type: 'urn:okta:expression:1.0' },
  },
  actions: {
    assignUserToGroups: { groupIds: ['g1', 'g2'] },
  },
};

describe('groupRules descriptor', () => {
  it('declares stable identity, endpoint, and no filter', () => {
    expect(rulesDescriptor.id).toBe('group-rules');
    expect(rulesDescriptor.endpoint).toBe('/api/v1/groups/rules');
    expect(rulesDescriptor.filter.kind).toBe('none');
  });

  it('accepts a representative rule via the shared schema', () => {
    expect(() => oktaGroupRuleSchema.parse(representativeRule)).not.toThrow();
  });

  it('expression accessor pulls conditions.expression.value', () => {
    const parsed = oktaGroupRuleSchema.parse(representativeRule);
    const col = rulesDescriptor.columnCatalog.find((c) => c.id === 'expression');
    expect(col).toBeDefined();
    expect(col!.accessor(parsed)).toBe('user.department == "Sales"');
  });

  it('assignedGroups format joins groupIds with "; "', () => {
    const parsed = oktaGroupRuleSchema.parse({
      id: '0prFAKE1',
      name: 'r',
      status: 'ACTIVE',
      actions: { assignUserToGroups: { groupIds: ['g1', 'g2'] } },
    });
    const col = rulesDescriptor.columnCatalog.find((c) => c.id === 'assignedGroups');
    expect(col).toBeDefined();
    const raw = col!.accessor(parsed);
    expect(col!.format!(raw, parsed)).toBe('g1; g2');
  });
});
