import { describe, it, expect } from 'vitest';
import { evaluateRuleExpression } from './ruleEvaluator';
import type { OktaUser } from './types';

describe('ruleEvaluator', () => {
    const mockUser: OktaUser = {
        id: '123',
        status: 'ACTIVE',
        profile: {
            login: 'test@example.com',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            department: 'Engineering',
            title: 'Developer',
            city: 'San Francisco',
            managerId: '456'
        }
    };

    it('should match simple equality string comparison', () => {
        const expression = 'user.department == "Engineering"';
        expect(evaluateRuleExpression(expression, mockUser)).toBe(true);
    });

    it('should fail simple equality mismatch', () => {
        const expression = 'user.department == "Sales"';
        expect(evaluateRuleExpression(expression, mockUser)).toBe(false);
    });

    it('should match "eq" operator', () => {
        const expression = 'user.department eq "Engineering"';
        expect(evaluateRuleExpression(expression, mockUser)).toBe(true);
    });

    it('should match AND logic', () => {
        const expression = 'user.department == "Engineering" and user.title == "Developer"';
        expect(evaluateRuleExpression(expression, mockUser)).toBe(true);
    });

    it('should match OR logic', () => {
        const expression = 'user.department == "Sales" or user.title == "Developer"';
        expect(evaluateRuleExpression(expression, mockUser)).toBe(true);
    });

    it('should handle parenthesis', () => {
        const expression = '(user.department == "Sales" or user.department == "Engineering") and user.city == "San Francisco"';
        expect(evaluateRuleExpression(expression, mockUser)).toBe(true);
    });

    it('should handle missing attributes (treat as null)', () => {
        const expression = 'user.division == null';
        expect(evaluateRuleExpression(expression, mockUser)).toBe(true);
    });

    it('should return false for unsupported group functions for now', () => {
        const expression = 'isMemberOfGroup("00g123")';
        // Mock console.warn to suppress output during test
        const originalWarn = console.warn;
        console.warn = () => { };

        expect(evaluateRuleExpression(expression, mockUser)).toBe(false);

        console.warn = originalWarn;
    });

    it('should return false for invalid expression syntax', () => {
        const expression = 'user.department =='; // Syntax error
        const originalWarn = console.warn;
        console.warn = () => { };

        expect(evaluateRuleExpression(expression, mockUser)).toBe(false);

        console.warn = originalWarn;
    });

    it('should handle values with spaces', () => {
        const expression = 'user.city == "San Francisco"';
        expect(evaluateRuleExpression(expression, mockUser)).toBe(true);
    });
});
