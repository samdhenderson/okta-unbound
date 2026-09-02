import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractUserAttributes,
  assignToSameGroups,
  checkRuleOverlap,
  detectConflicts,
  formatRuleForDisplay,
  timeAgo,
  filterRules,
  expressionText,
  ruleStatusBadge,
} from './ruleUtils';
import type { OktaGroupRule, FormattedRule } from './types';

describe('ruleUtils', () => {
  describe('extractUserAttributes', () => {
    it('should extract single user attribute', () => {
      const rule: OktaGroupRule = {
        id: 'rule1',
        name: 'Test Rule',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Engineering'",
            type: 'urn:okta:expression:1.0',
          },
        },
      };

      const attributes = extractUserAttributes(rule);
      expect(attributes).toEqual(['department']);
    });

    it('should extract multiple user attributes', () => {
      const rule: OktaGroupRule = {
        id: 'rule1',
        name: 'Test Rule',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Engineering' AND user.title == 'Manager'",
            type: 'urn:okta:expression:1.0',
          },
        },
      };

      const attributes = extractUserAttributes(rule);
      expect(attributes).toEqual(expect.arrayContaining(['department', 'title']));
      expect(attributes).toHaveLength(2);
    });

    it('should extract duplicate attributes only once', () => {
      const rule: OktaGroupRule = {
        id: 'rule1',
        name: 'Test Rule',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Engineering' OR user.department == 'Sales'",
            type: 'urn:okta:expression:1.0',
          },
        },
      };

      const attributes = extractUserAttributes(rule);
      expect(attributes).toEqual(['department']);
    });

    it('should return empty array for rule without expression', () => {
      const rule: OktaGroupRule = {
        id: 'rule1',
        name: 'Test Rule',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
      };

      const attributes = extractUserAttributes(rule);
      expect(attributes).toEqual([]);
    });

    it('should return empty array for empty expression', () => {
      const rule: OktaGroupRule = {
        id: 'rule1',
        name: 'Test Rule',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: '',
            type: 'urn:okta:expression:1.0',
          },
        },
      };

      const attributes = extractUserAttributes(rule);
      expect(attributes).toEqual([]);
    });

    it('should handle special characters in attribute names', () => {
      const rule: OktaGroupRule = {
        id: 'rule1',
        name: 'Test Rule',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.customAttribute123 == 'test'",
            type: 'urn:okta:expression:1.0',
          },
        },
      };

      const attributes = extractUserAttributes(rule);
      expect(attributes).toEqual(['customAttribute123']);
    });
  });

  describe('assignToSameGroups', () => {
    it('should find shared groups', () => {
      const rule1: OktaGroupRule = {
        id: 'rule1',
        name: 'Rule 1',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        actions: {
          assignUserToGroups: {
            groupIds: ['group1', 'group2', 'group3'],
          },
        },
      };

      const rule2: OktaGroupRule = {
        id: 'rule2',
        name: 'Rule 2',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        actions: {
          assignUserToGroups: {
            groupIds: ['group2', 'group3', 'group4'],
          },
        },
      };

      const shared = assignToSameGroups(rule1, rule2);
      expect(shared).toEqual(expect.arrayContaining(['group2', 'group3']));
      expect(shared).toHaveLength(2);
    });

    it('should return empty array when no shared groups', () => {
      const rule1: OktaGroupRule = {
        id: 'rule1',
        name: 'Rule 1',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        actions: {
          assignUserToGroups: {
            groupIds: ['group1', 'group2'],
          },
        },
      };

      const rule2: OktaGroupRule = {
        id: 'rule2',
        name: 'Rule 2',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        actions: {
          assignUserToGroups: {
            groupIds: ['group3', 'group4'],
          },
        },
      };

      const shared = assignToSameGroups(rule1, rule2);
      expect(shared).toEqual([]);
    });

    it('should handle rules without actions', () => {
      const rule1: OktaGroupRule = {
        id: 'rule1',
        name: 'Rule 1',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
      };

      const rule2: OktaGroupRule = {
        id: 'rule2',
        name: 'Rule 2',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        actions: {
          assignUserToGroups: {
            groupIds: ['group1'],
          },
        },
      };

      const shared = assignToSameGroups(rule1, rule2);
      expect(shared).toEqual([]);
    });
  });

  describe('checkRuleOverlap', () => {
    it('should detect conflict with low severity for 1 shared group', () => {
      const rule1: OktaGroupRule = {
        id: 'rule1',
        name: 'Rule 1',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Engineering'",
            type: 'urn:okta:expression:1.0',
          },
        },
        actions: {
          assignUserToGroups: {
            groupIds: ['group1'],
          },
        },
      };

      const rule2: OktaGroupRule = {
        id: 'rule2',
        name: 'Rule 2',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Sales'",
            type: 'urn:okta:expression:1.0',
          },
        },
        actions: {
          assignUserToGroups: {
            groupIds: ['group1'],
          },
        },
      };

      const conflict = checkRuleOverlap(rule1, rule2);
      expect(conflict).toBeTruthy();
      expect(conflict?.severity).toBe('low');
      expect(conflict?.affectedGroups).toEqual(['group1']);
    });

    it('should detect conflict with medium severity for 2 shared groups', () => {
      const rule1: OktaGroupRule = {
        id: 'rule1',
        name: 'Rule 1',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Engineering'",
            type: 'urn:okta:expression:1.0',
          },
        },
        actions: {
          assignUserToGroups: {
            groupIds: ['group1', 'group2'],
          },
        },
      };

      const rule2: OktaGroupRule = {
        id: 'rule2',
        name: 'Rule 2',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Sales'",
            type: 'urn:okta:expression:1.0',
          },
        },
        actions: {
          assignUserToGroups: {
            groupIds: ['group1', 'group2'],
          },
        },
      };

      const conflict = checkRuleOverlap(rule1, rule2);
      expect(conflict).toBeTruthy();
      expect(conflict?.severity).toBe('medium');
    });

    it('should detect conflict with high severity for 3+ shared groups', () => {
      const rule1: OktaGroupRule = {
        id: 'rule1',
        name: 'Rule 1',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Engineering'",
            type: 'urn:okta:expression:1.0',
          },
        },
        actions: {
          assignUserToGroups: {
            groupIds: ['group1', 'group2', 'group3'],
          },
        },
      };

      const rule2: OktaGroupRule = {
        id: 'rule2',
        name: 'Rule 2',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Sales'",
            type: 'urn:okta:expression:1.0',
          },
        },
        actions: {
          assignUserToGroups: {
            groupIds: ['group1', 'group2', 'group3'],
          },
        },
      };

      const conflict = checkRuleOverlap(rule1, rule2);
      expect(conflict).toBeTruthy();
      expect(conflict?.severity).toBe('high');
      expect(conflict?.affectedGroups).toHaveLength(3);
    });

    it('should return null when one rule is inactive', () => {
      const rule1: OktaGroupRule = {
        id: 'rule1',
        name: 'Rule 1',
        status: 'INACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Engineering'",
            type: 'urn:okta:expression:1.0',
          },
        },
        actions: {
          assignUserToGroups: {
            groupIds: ['group1'],
          },
        },
      };

      const rule2: OktaGroupRule = {
        id: 'rule2',
        name: 'Rule 2',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Sales'",
            type: 'urn:okta:expression:1.0',
          },
        },
        actions: {
          assignUserToGroups: {
            groupIds: ['group1'],
          },
        },
      };

      const conflict = checkRuleOverlap(rule1, rule2);
      expect(conflict).toBeNull();
    });

    it('should return null when no shared groups', () => {
      const rule1: OktaGroupRule = {
        id: 'rule1',
        name: 'Rule 1',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Engineering'",
            type: 'urn:okta:expression:1.0',
          },
        },
        actions: {
          assignUserToGroups: {
            groupIds: ['group1'],
          },
        },
      };

      const rule2: OktaGroupRule = {
        id: 'rule2',
        name: 'Rule 2',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Sales'",
            type: 'urn:okta:expression:1.0',
          },
        },
        actions: {
          assignUserToGroups: {
            groupIds: ['group2'],
          },
        },
      };

      const conflict = checkRuleOverlap(rule1, rule2);
      expect(conflict).toBeNull();
    });

    it('should return null when no common attributes', () => {
      const rule1: OktaGroupRule = {
        id: 'rule1',
        name: 'Rule 1',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Engineering'",
            type: 'urn:okta:expression:1.0',
          },
        },
        actions: {
          assignUserToGroups: {
            groupIds: ['group1'],
          },
        },
      };

      const rule2: OktaGroupRule = {
        id: 'rule2',
        name: 'Rule 2',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "user.title == 'Manager'",
            type: 'urn:okta:expression:1.0',
          },
        },
        actions: {
          assignUserToGroups: {
            groupIds: ['group1'],
          },
        },
      };

      const conflict = checkRuleOverlap(rule1, rule2);
      expect(conflict).toBeNull();
    });
  });

  describe('detectConflicts', () => {
    it('should detect all conflicts in a set of rules', () => {
      const rules: OktaGroupRule[] = [
        {
          id: 'rule1',
          name: 'Rule 1',
          status: 'ACTIVE',
          type: 'group_rule',
          created: '2024-01-01T00:00:00Z',
          lastUpdated: '2024-01-01T00:00:00Z',
          conditions: {
            expression: {
              value: "user.department == 'Engineering'",
              type: 'urn:okta:expression:1.0',
            },
          },
          actions: {
            assignUserToGroups: {
              groupIds: ['group1'],
            },
          },
        },
        {
          id: 'rule2',
          name: 'Rule 2',
          status: 'ACTIVE',
          type: 'group_rule',
          created: '2024-01-01T00:00:00Z',
          lastUpdated: '2024-01-01T00:00:00Z',
          conditions: {
            expression: {
              value: "user.department == 'Sales'",
              type: 'urn:okta:expression:1.0',
            },
          },
          actions: {
            assignUserToGroups: {
              groupIds: ['group1'],
            },
          },
        },
        {
          id: 'rule3',
          name: 'Rule 3',
          status: 'ACTIVE',
          type: 'group_rule',
          created: '2024-01-01T00:00:00Z',
          lastUpdated: '2024-01-01T00:00:00Z',
          conditions: {
            expression: {
              value: "user.department == 'Marketing'",
              type: 'urn:okta:expression:1.0',
            },
          },
          actions: {
            assignUserToGroups: {
              groupIds: ['group1'],
            },
          },
        },
      ];

      const conflicts = detectConflicts(rules);
      expect(conflicts).toHaveLength(3); // 3 pairs of conflicts
    });

    it('should return empty array for no conflicts', () => {
      const rules: OktaGroupRule[] = [
        {
          id: 'rule1',
          name: 'Rule 1',
          status: 'ACTIVE',
          type: 'group_rule',
          created: '2024-01-01T00:00:00Z',
          lastUpdated: '2024-01-01T00:00:00Z',
          conditions: {
            expression: {
              value: "user.department == 'Engineering'",
              type: 'urn:okta:expression:1.0',
            },
          },
          actions: {
            assignUserToGroups: {
              groupIds: ['group1'],
            },
          },
        },
        {
          id: 'rule2',
          name: 'Rule 2',
          status: 'ACTIVE',
          type: 'group_rule',
          created: '2024-01-01T00:00:00Z',
          lastUpdated: '2024-01-01T00:00:00Z',
          conditions: {
            expression: {
              value: "user.title == 'Manager'",
              type: 'urn:okta:expression:1.0',
            },
          },
          actions: {
            assignUserToGroups: {
              groupIds: ['group2'],
            },
          },
        },
      ];

      const conflicts = detectConflicts(rules);
      expect(conflicts).toEqual([]);
    });

    it('should handle empty array', () => {
      const conflicts = detectConflicts([]);
      expect(conflicts).toEqual([]);
    });

    it('should handle single rule', () => {
      const rules: OktaGroupRule[] = [
        {
          id: 'rule1',
          name: 'Rule 1',
          status: 'ACTIVE',
          type: 'group_rule',
          created: '2024-01-01T00:00:00Z',
          lastUpdated: '2024-01-01T00:00:00Z',
          conditions: {
            expression: {
              value: "user.department == 'Engineering'",
              type: 'urn:okta:expression:1.0',
            },
          },
          actions: {
            assignUserToGroups: {
              groupIds: ['group1'],
            },
          },
        },
      ];

      const conflicts = detectConflicts(rules);
      expect(conflicts).toEqual([]);
    });
  });

  describe('formatRuleForDisplay', () => {
    it('should format rule with simplified condition', () => {
      const rule: OktaGroupRule = {
        id: 'rule1',
        name: 'Engineering Rule',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-02T00:00:00Z',
        conditions: {
          expression: {
            value: "user.department == 'Engineering'",
            type: 'urn:okta:expression:1.0',
          },
        },
        actions: {
          assignUserToGroups: {
            groupIds: ['group1', 'group2'],
          },
        },
      };

      const formatted = formatRuleForDisplay(rule);
      expect(formatted.id).toBe('rule1');
      expect(formatted.name).toBe('Engineering Rule');
      expect(formatted.status).toBe('ACTIVE');
      expect(formatted.condition).toBe("department == 'Engineering'");
      expect(formatted.conditionExpression).toBe("user.department == 'Engineering'");
      expect(formatted.groupIds).toEqual(['group1', 'group2']);
      expect(formatted.userAttributes).toEqual(['department']);
    });

    it('should mark rule affecting current group', () => {
      const rule: OktaGroupRule = {
        id: 'rule1',
        name: 'Test Rule',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        actions: {
          assignUserToGroups: {
            groupIds: ['group1', 'group2'],
          },
        },
      };

      const formatted = formatRuleForDisplay(rule, 'group1');
      expect(formatted.affectsCurrentGroup).toBe(true);
    });

    it('should not mark rule not affecting current group', () => {
      const rule: OktaGroupRule = {
        id: 'rule1',
        name: 'Test Rule',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        actions: {
          assignUserToGroups: {
            groupIds: ['group1', 'group2'],
          },
        },
      };

      const formatted = formatRuleForDisplay(rule, 'group3');
      expect(formatted.affectsCurrentGroup).toBe(false);
    });

    it('should include rule conflicts', () => {
      const rule: OktaGroupRule = {
        id: 'rule1',
        name: 'Test Rule',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        actions: {
          assignUserToGroups: {
            groupIds: ['group1'],
          },
        },
      };

      const conflicts = [
        {
          rule1: { id: 'rule1', name: 'Rule 1' },
          rule2: { id: 'rule2', name: 'Rule 2' },
          reason: 'Test conflict',
          severity: 'high' as const,
          affectedGroups: ['group1'],
        },
      ];

      const formatted = formatRuleForDisplay(rule, undefined, conflicts);
      expect(formatted.conflicts).toEqual(conflicts);
    });

    it('should simplify isMemberOfGroup expressions', () => {
      const rule: OktaGroupRule = {
        id: 'rule1',
        name: 'Test Rule',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
        conditions: {
          expression: {
            value: "isMemberOfAnyGroup('group1', 'group2')",
            type: 'urn:okta:expression:1.0',
          },
        },
      };

      const formatted = formatRuleForDisplay(rule);
      expect(formatted.condition).toContain('is member of group');
    });

    // D-055: this function is exported and takes a bare `OktaGroupRule`, so
    // nothing in its signature requires the caller to have parsed that row at an
    // Okta boundary. Every rules path in `src/` does validate as of D-065, which
    // makes this belt-and-braces rather than dead — the guarantee is a property
    // of the function, not an audit of today's callers (D-088).
    // `conditions.expression.value` is end-user-controllable (`docs/security.md`),
    // and every caller formats a whole page inside a `.map`, so a throw on one
    // row is a whole-surface outage. The guarantee: a non-string expression
    // degrades that one field exactly as a missing one does, and never throws.
    describe('a non-string condition expression (D-055)', () => {
      /** A rule whose `conditions.expression.value` is not a string. */
      const poisonedRule = (value: unknown): OktaGroupRule =>
        ({
          id: 'rBAD',
          name: 'Bad Rule',
          status: 'ACTIVE',
          type: 'group_rule',
          created: '2024-01-01T00:00:00Z',
          lastUpdated: '2024-01-01T00:00:00Z',
          conditions: { expression: { value, type: 'urn:okta:expression:1.0' } },
          actions: { assignUserToGroups: { groupIds: ['group1'] } },
        }) as unknown as OktaGroupRule;

      it.each([
        ['a number', 42],
        ['an object', { $ne: 1 }],
        ['an array', ['user.department']],
        ['null', null],
        ['a boolean', true],
      ])('degrades rather than throwing when the expression is %s', (_label, value) => {
        const formatted = formatRuleForDisplay(poisonedRule(value));

        expect(formatted.condition).toBe('No condition specified');
        expect(formatted.conditionExpression).toBe('No condition specified');
        expect(formatted.userAttributes).toEqual([]);
        // Everything the row does carry still comes through.
        expect(formatted.id).toBe('rBAD');
        expect(formatted.groupIds).toEqual(['group1']);
      });

      it('costs one row, not the whole page, when formatted in a map', () => {
        const good: OktaGroupRule = {
          id: 'rOK',
          name: 'Good Rule',
          status: 'ACTIVE',
          type: 'group_rule',
          created: '2024-01-01T00:00:00Z',
          lastUpdated: '2024-01-01T00:00:00Z',
          conditions: {
            expression: {
              value: "user.department == 'Engineering'",
              type: 'urn:okta:expression:1.0',
            },
          },
        };

        const page = [poisonedRule(42), good];
        const formatted = page.map((rule) => formatRuleForDisplay(rule, undefined, []));

        expect(formatted.map((r) => r.id)).toEqual(['rBAD', 'rOK']);
        expect(formatted[1].condition).toBe("department == 'Engineering'");
        expect(formatted[1].userAttributes).toEqual(['department']);
      });
    });
  });

  describe('timeAgo', () => {
    beforeEach(() => {
      // Mock current time
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    it('should return "just now" for very recent dates', () => {
      const result = timeAgo('2024-01-15T11:59:30Z');
      expect(result).toBe('just now');
    });

    it('should return minutes for recent dates', () => {
      const result = timeAgo('2024-01-15T11:45:00Z');
      expect(result).toBe('15 mins ago');
    });

    it('should return single minute correctly', () => {
      const result = timeAgo('2024-01-15T11:59:00Z');
      expect(result).toBe('1 min ago');
    });

    it('should return hours for same day', () => {
      const result = timeAgo('2024-01-15T10:00:00Z');
      expect(result).toBe('2 hours ago');
    });

    it('should return single hour correctly', () => {
      const result = timeAgo('2024-01-15T11:00:00Z');
      expect(result).toBe('1 hour ago');
    });

    it('should return days for recent dates', () => {
      const result = timeAgo('2024-01-10T12:00:00Z');
      expect(result).toBe('5 days ago');
    });

    it('should return single day correctly', () => {
      const result = timeAgo('2024-01-14T12:00:00Z');
      expect(result).toBe('1 day ago');
    });

    it('should return months for older dates', () => {
      const result = timeAgo('2023-11-15T12:00:00Z');
      expect(result).toBe('2 months ago');
    });

    it('should return years for very old dates', () => {
      const result = timeAgo('2022-01-15T12:00:00Z');
      expect(result).toBe('2 years ago');
    });

    it('should return single year correctly', () => {
      const result = timeAgo('2023-01-15T12:00:00Z');
      expect(result).toBe('1 year ago');
    });
  });

  describe('filterRules', () => {
    const sampleRules: FormattedRule[] = [
      {
        id: 'rule1',
        name: 'Engineering Department Rule',
        status: 'ACTIVE',
        condition: "department == 'Engineering'",
        conditionExpression: "user.department == 'Engineering'",
        groupIds: ['group1'],
        userAttributes: ['department'],
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
      },
      {
        id: 'rule2',
        name: 'Sales Manager Rule',
        status: 'ACTIVE',
        condition: "department == 'Sales' AND title == 'Manager'",
        conditionExpression: "user.department == 'Sales' AND user.title == 'Manager'",
        groupIds: ['group2'],
        userAttributes: ['department', 'title'],
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
      },
      {
        id: 'rule3',
        name: 'Marketing Team',
        status: 'INACTIVE',
        condition: "department == 'Marketing'",
        conditionExpression: "user.department == 'Marketing'",
        groupIds: ['group3'],
        userAttributes: ['department'],
        created: '2024-01-01T00:00:00Z',
        lastUpdated: '2024-01-01T00:00:00Z',
      },
    ];

    it('should filter by rule name', () => {
      const filtered = filterRules(sampleRules, 'engineering');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('rule1');
    });

    it('should filter by rule ID', () => {
      const filtered = filterRules(sampleRules, 'rule2');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('rule2');
    });

    it('should filter by condition', () => {
      const filtered = filterRules(sampleRules, 'manager');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('rule2');
    });

    it('should filter by user attribute', () => {
      const filtered = filterRules(sampleRules, 'title');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('rule2');
    });

    it('should be case insensitive', () => {
      const filtered = filterRules(sampleRules, 'ENGINEERING');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('rule1');
    });

    it('should return all rules for empty query', () => {
      const filtered = filterRules(sampleRules, '');
      expect(filtered).toHaveLength(3);
    });

    it('should return all rules for whitespace query', () => {
      const filtered = filterRules(sampleRules, '   ');
      expect(filtered).toHaveLength(3);
    });

    it('should return empty array for no matches', () => {
      const filtered = filterRules(sampleRules, 'nonexistent');
      expect(filtered).toEqual([]);
    });

    it('should match partial strings', () => {
      const filtered = filterRules(sampleRules, 'depart');
      expect(filtered.length).toBeGreaterThan(0);
    });
  });
});

// D-066: `fetchGroupRulesRequest.groupIdsReferencedBy` carried a byte-identical
// copy of the falsy-only `expression.value || ''` read that D-055 fixed here.
// The guard is exported rather than duplicated a fourth time, so this pins the
// contract the other module now depends on.
describe('expressionText (D-055 / D-066)', () => {
  /** A rule whose `conditions.expression.value` is whatever the case supplies. */
  const withExpression = (value: unknown): OktaGroupRule =>
    ({
      id: '0prFAKE000000000001',
      name: 'Rule',
      status: 'ACTIVE',
      type: 'group_rule',
      created: '2024-01-01T00:00:00Z',
      lastUpdated: '2024-01-01T00:00:00Z',
      conditions: { expression: { value, type: 'urn:okta:expression:1.0' } },
    }) as unknown as OktaGroupRule;

  it('returns the expression when it is a string', () => {
    expect(expressionText(withExpression('user.department == "Eng"'))).toBe(
      'user.department == "Eng"',
    );
  });

  it.each([[42], [null], [{ value: 'x' }], [['a']], [true]])(
    'degrades a non-string expression (%s) to "" instead of throwing',
    (value) => {
      expect(expressionText(withExpression(value))).toBe('');
    },
  );

  it('returns "" when the rule has no conditions at all', () => {
    expect(
      expressionText({
        id: '0prFAKE000000000002',
        name: 'Rule',
        status: 'ACTIVE',
      } as unknown as OktaGroupRule),
    ).toBe('');
  });
});

// D-085: the status mark is an exhaustive map over Okta's three-state
// `GroupRuleStatus`, not a two-arm ternary that quietly files `INVALID` under
// "not active". A broken rule and a paused rule are different facts and must not
// share a mark.
describe('ruleStatusBadge (D-085)', () => {
  it('marks an ACTIVE rule as in force', () => {
    expect(ruleStatusBadge('ACTIVE')).toMatchObject({ text: 'ACTIVE', variant: 'success' });
  });

  it('marks an INACTIVE rule neutrally — a pause is not a failure', () => {
    expect(ruleStatusBadge('INACTIVE')).toMatchObject({ text: 'INACTIVE', variant: 'neutral' });
  });

  it('marks an INVALID rule as Broken, in danger', () => {
    expect(ruleStatusBadge('INVALID')).toMatchObject({ text: 'Broken', variant: 'danger' });
  });

  it('gives every status a distinct label, treatment and explanation', () => {
    const marks = (['ACTIVE', 'INACTIVE', 'INVALID'] as const).map(ruleStatusBadge);
    expect(new Set(marks.map((m) => m.text)).size).toBe(3);
    expect(new Set(marks.map((m) => m.variant)).size).toBe(3);
    expect(new Set(marks.map((m) => m.title)).size).toBe(3);
  });
});
