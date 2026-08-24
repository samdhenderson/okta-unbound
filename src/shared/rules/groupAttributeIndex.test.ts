/**
 * @module shared/rules/groupAttributeIndex.test
 * @description Unit tests for the pure attribute→rules reverse index.
 */
import { describe, it, expect } from 'vitest';
import { indexRulesByAttribute } from './groupAttributeIndex';

/** Minimal rule factory (only the fields the index reads). */
function rule(id: string, userAttributes?: string[]) {
  return { id, name: `Rule ${id}`, status: 'ACTIVE', userAttributes };
}

describe('indexRulesByAttribute', () => {
  it('returns an empty map for an empty rule list', () => {
    const index = indexRulesByAttribute([]);
    expect(index.size).toBe(0);
  });

  it('indexes a rule with multiple attributes under each attribute', () => {
    const index = indexRulesByAttribute([rule('r1', ['department', 'title'])]);

    expect(index.get('department')).toEqual([{ ruleId: 'r1', ruleName: 'Rule r1' }]);
    expect(index.get('title')).toEqual([{ ruleId: 'r1', ruleName: 'Rule r1' }]);
  });

  it('collects multiple rules referencing the same attribute under one key', () => {
    const index = indexRulesByAttribute([rule('r1', ['department']), rule('r2', ['department'])]);

    expect(index.get('department')).toEqual([
      { ruleId: 'r1', ruleName: 'Rule r1' },
      { ruleId: 'r2', ruleName: 'Rule r2' },
    ]);
  });

  it('contributes nothing for a rule whose userAttributes field is absent', () => {
    const index = indexRulesByAttribute([rule('r1', undefined)]);
    expect(index.size).toBe(0);
  });

  it('contributes nothing for a rule with an empty userAttributes array', () => {
    const index = indexRulesByAttribute([rule('r1', [])]);
    expect(index.size).toBe(0);
  });

  it('dedupes a rule that references the same attribute twice', () => {
    const index = indexRulesByAttribute([rule('r1', ['department', 'department'])]);
    expect(index.get('department')).toEqual([{ ruleId: 'r1', ruleName: 'Rule r1' }]);
  });

  it('does not let one attribute-less rule suppress the entries of another rule', () => {
    const index = indexRulesByAttribute([rule('r1', []), rule('r2', ['title'])]);
    expect(index.has('title')).toBe(true);
    expect(index.get('title')).toEqual([{ ruleId: 'r2', ruleName: 'Rule r2' }]);
  });
});
