/**
 * @module sidepanel/hooks/useOktaApi/groupAnalysis.staleness.test
 * @description Pins the "No group rules" staleness factor to actual rule knowledge.
 */
import { describe, it, expect } from 'vitest';
import { createGroupAnalysisOperations } from './groupAnalysis';
import type { GroupSummary } from '../../../shared/types';

const { calculateStaleness } = createGroupAnalysisOperations(async () => []);

/** A recently-updated, described group so only the rules factor is in play. */
function group(over: Partial<GroupSummary> = {}): GroupSummary {
  return {
    id: 'g1',
    name: 'Team',
    type: 'OKTA_GROUP',
    memberCount: 20,
    description: 'A real team',
    lastUpdated: new Date(),
    hasRules: false,
    ruleCount: 0,
    ...over,
  };
}

describe('calculateStaleness — rule attribution', () => {
  it('flags "No group rules" when rules are known and the group has none', () => {
    const { factors } = calculateStaleness(group(), true);
    expect(factors).toContain('No group rules');
  });

  it('does NOT flag "No group rules" when rule data is unknown', () => {
    // hasRules/ruleCount are still defaults here — without the rules payload we
    // must not assert the group is rule-less (that was the inaccurate note).
    const { factors } = calculateStaleness(group(), false);
    expect(factors).not.toContain('No group rules');
  });

  it('does NOT flag "No group rules" for a group a rule actually feeds', () => {
    const { factors } = calculateStaleness(group({ hasRules: true, ruleCount: 2 }), true);
    expect(factors).not.toContain('No group rules');
  });

  it('defaults rulesKnown to true (backward compatible)', () => {
    const { factors } = calculateStaleness(group());
    expect(factors).toContain('No group rules');
  });
});
