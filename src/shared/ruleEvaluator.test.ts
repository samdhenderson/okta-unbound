import { describe, it, expect } from 'vitest';
import {
  canEvaluateClientSide,
  evaluateRuleExpression,
  tryEvaluateRuleExpression,
} from './ruleEvaluator';
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
      managerId: '456',
    },
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
    const expression =
      '(user.department == "Sales" or user.department == "Engineering") and user.city == "San Francisco"';
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
    console.warn = () => {};

    expect(evaluateRuleExpression(expression, mockUser)).toBe(false);

    console.warn = originalWarn;
  });

  it('should return false for invalid expression syntax', () => {
    const expression = 'user.department =='; // Syntax error
    const originalWarn = console.warn;
    console.warn = () => {};

    expect(evaluateRuleExpression(expression, mockUser)).toBe(false);

    console.warn = originalWarn;
  });

  it('should handle values with spaces', () => {
    const expression = 'user.city == "San Francisco"';
    expect(evaluateRuleExpression(expression, mockUser)).toBe(true);
  });
});

// ===========================================================================
// tryEvaluateRuleExpression — the three-outcome API. The load-bearing property
// is that it NEVER answers 'no-match' when it merely failed to understand the
// expression: membership classification turns 'no-match' into "manual add".
// ===========================================================================
describe('tryEvaluateRuleExpression', () => {
  const user: OktaUser = {
    id: '00uFAKE',
    status: 'ACTIVE',
    profile: {
      login: 'ada@example.com',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      department: 'Engineering',
      title: 'Developer',
      city: 'San Francisco',
      employeeNumber: 42,
    },
  } as unknown as OktaUser;

  describe('match', () => {
    it('returns match for a satisfied equality', () => {
      expect(tryEvaluateRuleExpression('user.department == "Engineering"', user)).toBe('match');
    });

    it('returns match for the eq/and word forms', () => {
      expect(
        tryEvaluateRuleExpression(
          'user.department eq "Engineering" and user.city eq "San Francisco"',
          user,
        ),
      ).toBe('match');
    });

    it('returns match for an allow-listed String function', () => {
      expect(tryEvaluateRuleExpression('String.startsWith(user.firstName, "Ad")', user)).toBe(
        'match',
      );
      expect(
        tryEvaluateRuleExpression('String.stringContains(user.email, "@example.com")', user),
      ).toBe('match');
      expect(
        tryEvaluateRuleExpression('String.toLowerCase(user.department) == "engineering"', user),
      ).toBe('match');
    });

    it('returns match for a satisfied numeric comparison', () => {
      expect(tryEvaluateRuleExpression('user.employeeNumber > 10', user)).toBe('match');
    });

    it('returns match for a negation of an unsatisfied condition', () => {
      expect(tryEvaluateRuleExpression('!(user.department == "Sales")', user)).toBe('match');
    });
  });

  describe('no-match — reserved for expressions that were fully understood', () => {
    it('returns no-match for an unsatisfied equality', () => {
      expect(tryEvaluateRuleExpression('user.department == "Sales"', user)).toBe('no-match');
    });

    it('returns no-match when one conjunct fails', () => {
      expect(
        tryEvaluateRuleExpression(
          'user.department == "Engineering" && user.city == "Berlin"',
          user,
        ),
      ).toBe('no-match');
    });

    it('returns no-match when an attribute is absent (null) rather than guessing', () => {
      expect(tryEvaluateRuleExpression('user.costCenter == "1234"', user)).toBe('no-match');
    });

    it('returns no-match for an unsatisfied String function', () => {
      expect(tryEvaluateRuleExpression('String.endsWith(user.email, "@other.example")', user)).toBe(
        'no-match',
      );
    });
  });

  describe('unevaluable — every distinct route', () => {
    it('is unevaluable for a grammar error, NEVER no-match', () => {
      const outcome = tryEvaluateRuleExpression('user.department ==', user);
      expect(outcome).toBe('unevaluable');
      expect(outcome).not.toBe('no-match');
    });

    it('is unevaluable for two expressions juxtaposed without an operator', () => {
      // jsep parses this as a Compound node — grammatical for JavaScript,
      // meaningless as a rule condition.
      expect(tryEvaluateRuleExpression('user.department == "Eng" user.city == "SF"', user)).toBe(
        'unevaluable',
      );
    });

    it('is unevaluable for an unbalanced parenthesis', () => {
      expect(tryEvaluateRuleExpression('(user.department == "Engineering"', user)).toBe(
        'unevaluable',
      );
    });

    it('is unevaluable when the gate rejects a group-membership function', () => {
      expect(canEvaluateClientSide('isMemberOfGroup("00gFAKE")')).toBe(false);
      expect(tryEvaluateRuleExpression('isMemberOfGroup("00gFAKE")', user)).toBe('unevaluable');
      expect(tryEvaluateRuleExpression('isMemberOfGroupName("Engineering")', user)).toBe(
        'unevaluable',
      );
      expect(tryEvaluateRuleExpression('isMemberOfAnyGroup("00gFAKE1", "00gFAKE2")', user)).toBe(
        'unevaluable',
      );
    });

    it('is unevaluable when a group-membership call is combined with a matching clause', () => {
      // Conservative on purpose: the gate rejects the whole expression rather
      // than resolving the half it understands.
      expect(
        tryEvaluateRuleExpression(
          'isMemberOfGroup("00gFAKE") || user.department == "Engineering"',
          user,
        ),
      ).toBe('unevaluable');
    });

    it('is unevaluable when the gate rejects app context', () => {
      expect(canEvaluateClientSide('app.clientId == "x"')).toBe(false);
      expect(tryEvaluateRuleExpression('app.clientId == "x"', user)).toBe('unevaluable');
    });

    it('is unevaluable for a function outside the allow-list', () => {
      expect(tryEvaluateRuleExpression('String.substring(user.email, 0, 3) == "ada"', user)).toBe(
        'unevaluable',
      );
      expect(tryEvaluateRuleExpression('Arrays.contains(user.department, "Eng")', user)).toBe(
        'unevaluable',
      );
      expect(tryEvaluateRuleExpression('Time.now() == "x"', user)).toBe('unevaluable');
    });

    it('is unevaluable for an allow-listed function called with the wrong arity', () => {
      expect(tryEvaluateRuleExpression('String.startsWith(user.firstName)', user)).toBe(
        'unevaluable',
      );
    });

    it('is unevaluable for an unsupported operator', () => {
      expect(tryEvaluateRuleExpression('user.department + "x" == "Engineeringx"', user)).toBe(
        'unevaluable',
      );
      expect(tryEvaluateRuleExpression('user.employeeNumber % 2 == 0', user)).toBe('unevaluable');
    });

    it('is unevaluable for an unsupported reference', () => {
      expect(tryEvaluateRuleExpression('session.amr == "pwd"', user)).toBe('unevaluable');
      expect(tryEvaluateRuleExpression('user["department"] == "Engineering"', user)).toBe(
        'unevaluable',
      );
    });

    it('is unevaluable for an empty or whitespace-only condition', () => {
      expect(tryEvaluateRuleExpression('', user)).toBe('unevaluable');
      expect(tryEvaluateRuleExpression('   ', user)).toBe('unevaluable');
    });

    it('is unevaluable for a condition that does not reduce to a boolean', () => {
      expect(tryEvaluateRuleExpression('user.department', user)).toBe('unevaluable');
      expect(tryEvaluateRuleExpression('"Engineering"', user)).toBe('unevaluable');
    });

    it('is unevaluable for an oversized expression rather than parsing it', () => {
      const huge = `user.department == "${'x'.repeat(5000)}"`;
      expect(tryEvaluateRuleExpression(huge, user)).toBe('unevaluable');
    });

    it('never evaluates code — an expression that would throw if executed is just unevaluable', () => {
      expect(tryEvaluateRuleExpression('user.constructor.constructor("return 1")()', user)).toBe(
        'unevaluable',
      );
      expect(tryEvaluateRuleExpression('this.foo == 1', user)).toBe('unevaluable');
    });
  });
});

describe('canEvaluateClientSide', () => {
  it('accepts the supported subset', () => {
    expect(canEvaluateClientSide('user.department == "Engineering"')).toBe(true);
    expect(canEvaluateClientSide('user.a eq "x" or user.b ne "y"')).toBe(true);
    expect(canEvaluateClientSide('String.stringContains(user.email, "@example.com")')).toBe(true);
  });

  it('rejects group-membership and app-context expressions (historical contract)', () => {
    expect(canEvaluateClientSide('isMemberOfGroupName("Eng")')).toBe(false);
    expect(canEvaluateClientSide('app.id == "0oaFAKE"')).toBe(false);
  });

  it('rejects expressions that parse but use unsupported grammar', () => {
    // The substring-scan gate this replaced returned true here, letting the
    // evaluator throw internally and report a misleading `false`.
    expect(canEvaluateClientSide('user.department + "x" == "y"')).toBe(false);
    expect(canEvaluateClientSide('String.substring(user.email, 0, 3) == "ada"')).toBe(false);
  });

  it('rejects unparseable and empty input', () => {
    expect(canEvaluateClientSide('user.department ==')).toBe(false);
    expect(canEvaluateClientSide('')).toBe(false);
  });

  it('accepts boolean and numeric literals', () => {
    expect(canEvaluateClientSide('user.active == true')).toBe(true);
    expect(canEvaluateClientSide('user.employeeNumber >= 10')).toBe(true);
  });
});

// ===========================================================================
// The operator/function allow-list, exercised through the ungated legacy API so
// the three-valued core is observable end to end.
// ===========================================================================
describe('supported subset', () => {
  const user: OktaUser = {
    id: '00uFAKE',
    status: 'ACTIVE',
    profile: {
      login: 'ada@example.com',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      department: 'Engineering',
      employeeNumber: 42,
      active: true,
      roles: ['admin', 'dev'],
    },
  } as unknown as OktaUser;

  it('implements the allow-listed String functions', () => {
    expect(
      evaluateRuleExpression('String.toUpperCase(user.department) == "ENGINEERING"', user),
    ).toBe(true);
    expect(evaluateRuleExpression('String.len(user.firstName) == 3', user)).toBe(true);
    expect(evaluateRuleExpression('String.append(user.firstName, " L") == "Ada L"', user)).toBe(
      true,
    );
    expect(evaluateRuleExpression('String.endsWith(user.email, "example.com")', user)).toBe(true);
  });

  it('rejects a String function applied to a non-string attribute', () => {
    expect(tryEvaluateRuleExpression('String.startsWith(user.employeeNumber, "4")', user)).toBe(
      'unevaluable',
    );
  });

  it('supports the numeric ordering operators, and only on numbers', () => {
    expect(evaluateRuleExpression('user.employeeNumber < 100', user)).toBe(true);
    expect(evaluateRuleExpression('user.employeeNumber <= 42', user)).toBe(true);
    expect(evaluateRuleExpression('user.employeeNumber >= 43', user)).toBe(false);
    expect(tryEvaluateRuleExpression('user.department > "A"', user)).toBe('unevaluable');
  });

  it('supports inequality and boolean attributes', () => {
    expect(evaluateRuleExpression('user.department != "Sales"', user)).toBe(true);
    expect(evaluateRuleExpression('user.active == true', user)).toBe(true);
    expect(evaluateRuleExpression('!user.active', user)).toBe(false);
  });

  it('stringifies a non-scalar profile value rather than failing', () => {
    expect(evaluateRuleExpression('user.roles == "admin,dev"', user)).toBe(true);
  });

  describe('three-valued logic (legacy API coerces "unresolved" to false)', () => {
    it('resolves an OR whose other side is true', () => {
      expect(
        evaluateRuleExpression(
          'isMemberOfGroup("00gFAKE") || user.department == "Engineering"',
          user,
        ),
      ).toBe(true);
    });

    it('resolves an AND whose other side is false', () => {
      expect(
        evaluateRuleExpression('isMemberOfGroup("00gFAKE") && user.department == "Sales"', user),
      ).toBe(false);
    });

    it('stays unresolved (→ false) when the known side cannot decide it', () => {
      expect(
        evaluateRuleExpression(
          'isMemberOfGroup("00gFAKE") && user.department == "Engineering"',
          user,
        ),
      ).toBe(false);
    });

    it('propagates an unresolved argument out of a supported call', () => {
      expect(
        evaluateRuleExpression('String.startsWith(isMemberOfGroup("00gFAKE"), "a")', user),
      ).toBe(false);
    });
  });

  describe('rejections reachable only through the ungated API', () => {
    it('rejects computed and non-user member access', () => {
      expect(evaluateRuleExpression('user["department"] == "Engineering"', user)).toBe(false);
      expect(evaluateRuleExpression('app.id == "0oaFAKE"', user)).toBe(false);
      expect(evaluateRuleExpression('user.a.b == 1', user)).toBe(false);
    });

    it('rejects a nested callee, an unsupported operator and a bare identifier', () => {
      expect(evaluateRuleExpression('user.a.b("x") == 1', user)).toBe(false);
      expect(evaluateRuleExpression('user.employeeNumber % 2 == 0', user)).toBe(false);
      expect(evaluateRuleExpression('department == "Engineering"', user)).toBe(false);
    });

    it('rejects a wrong-arity call and a non-"!" unary operator', () => {
      expect(evaluateRuleExpression('String.startsWith(user.firstName)', user)).toBe(false);
      expect(evaluateRuleExpression('-user.employeeNumber == -42', user)).toBe(false);
    });
  });
});
