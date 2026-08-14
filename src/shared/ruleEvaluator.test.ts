import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import {
  checkRuleNodeSupport,
  evaluateParsedRule,
  evaluateRuleNode,
  parseRuleExpression,
  tryEvaluateRuleExpression,
  tryEvaluateRuleExpressionDetailed,
  RULE_CONNECTIVE_OPERATORS,
  type RuleNodeEvaluation,
} from './ruleEvaluator';
import type { OktaUser } from './types';

/**
 * The whole-expression grammar gate, rebuilt from the two live entry points that
 * replaced the retired `canEvaluateClientSide` wrapper (ADR-0025).
 *
 * `checkRuleNodeSupport(ast, {})` runs the identical allow-list walk on the
 * identical memoised parse, so every assertion below is unchanged in meaning —
 * only the surface it goes through moved.
 */
const gateAccepts = (expression: string): boolean => {
  const parsed = parseRuleExpression(expression);
  return parsed.ok && checkRuleNodeSupport(parsed.ast).supported;
};

/**
 * The three-valued walk with **no grammar gate in front of it** — what the
 * retired boolean API exposed, minus its lossy `false`.
 *
 * `tryEvaluateRuleExpression` gates first, so it answers `unevaluable` for every
 * expression the ungated blocks below use and the Kleene core stops being
 * observable through it. `evaluateRuleNode` is that core, and it reports
 * "could not resolve" separately from "resolved to false".
 */
const walkUngated = (expression: string, user: OktaUser): RuleNodeEvaluation => {
  const parsed = parseRuleExpression(expression);
  if (!parsed.ok) return { resolved: false, reasonCode: parsed.reasonCode };
  return evaluateRuleNode(parsed.ast, { user });
};

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

    // The three cases below were the only ones the retired boolean API's suite
    // covered that this table did not — ported here rather than dropped
    // (ADR-0025). Each now states which of `no-match`/`unevaluable` it is not,
    // which the boolean form could not express.
    it('returns match when only the second disjunct of an `or` holds', () => {
      expect(
        tryEvaluateRuleExpression('user.department == "Sales" or user.title == "Developer"', user),
      ).toBe('match');
    });

    it('returns match for a parenthesised disjunction conjoined with a further clause', () => {
      expect(
        tryEvaluateRuleExpression(
          '(user.department == "Sales" or user.department == "Engineering") and user.city == "San Francisco"',
          user,
        ),
      ).toBe('match');
    });

    it('returns match for an absent attribute compared against null', () => {
      // Distinct from the no-match row below: an absent attribute reads as null,
      // so `== null` is a satisfied condition, not an unresolvable one.
      expect(tryEvaluateRuleExpression('user.division == null', user)).toBe('match');
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
      expect(gateAccepts('isMemberOfGroup("00gFAKE")')).toBe(false);
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
      expect(gateAccepts('app.clientId == "x"')).toBe(false);
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

describe('the grammar gate, over whole expressions', () => {
  it('accepts the supported subset', () => {
    expect(gateAccepts('user.department == "Engineering"')).toBe(true);
    expect(gateAccepts('user.a eq "x" or user.b ne "y"')).toBe(true);
    expect(gateAccepts('String.stringContains(user.email, "@example.com")')).toBe(true);
  });

  it('rejects group-membership and app-context expressions (historical contract)', () => {
    expect(gateAccepts('isMemberOfGroupName("Eng")')).toBe(false);
    expect(gateAccepts('app.id == "0oaFAKE"')).toBe(false);
  });

  it('rejects expressions that parse but use unsupported grammar', () => {
    // The substring-scan gate this replaced returned true here, letting the
    // evaluator throw internally and report a misleading `false`.
    expect(gateAccepts('user.department + "x" == "y"')).toBe(false);
    expect(gateAccepts('String.substring(user.email, 0, 3) == "ada"')).toBe(false);
  });

  it('rejects unparseable and empty input', () => {
    expect(gateAccepts('user.department ==')).toBe(false);
    expect(gateAccepts('')).toBe(false);
  });

  it('accepts boolean and numeric literals', () => {
    expect(gateAccepts('user.active == true')).toBe(true);
    expect(gateAccepts('user.employeeNumber >= 10')).toBe(true);
  });
});

// ===========================================================================
// The operator/function allow-list. Allow-listed expressions go through the
// gated API; the ungated three-valued core is observed through `evaluateRuleNode`,
// which is the same walk without the grammar gate in front of it.
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
      tryEvaluateRuleExpression('String.toUpperCase(user.department) == "ENGINEERING"', user),
    ).toBe('match');
    expect(tryEvaluateRuleExpression('String.len(user.firstName) == 3', user)).toBe('match');
    expect(tryEvaluateRuleExpression('String.append(user.firstName, " L") == "Ada L"', user)).toBe(
      'match',
    );
    expect(tryEvaluateRuleExpression('String.endsWith(user.email, "example.com")', user)).toBe(
      'match',
    );
  });

  it('rejects a String function applied to a non-string attribute', () => {
    expect(tryEvaluateRuleExpression('String.startsWith(user.employeeNumber, "4")', user)).toBe(
      'unevaluable',
    );
  });

  it('supports the numeric ordering operators, and only on numbers', () => {
    expect(tryEvaluateRuleExpression('user.employeeNumber < 100', user)).toBe('match');
    expect(tryEvaluateRuleExpression('user.employeeNumber <= 42', user)).toBe('match');
    expect(tryEvaluateRuleExpression('user.employeeNumber >= 43', user)).toBe('no-match');
    expect(tryEvaluateRuleExpression('user.department > "A"', user)).toBe('unevaluable');
  });

  it('supports inequality and boolean attributes', () => {
    expect(tryEvaluateRuleExpression('user.department != "Sales"', user)).toBe('match');
    expect(tryEvaluateRuleExpression('user.active == true', user)).toBe('match');
    expect(tryEvaluateRuleExpression('!user.active', user)).toBe('no-match');
  });

  it('stringifies a non-scalar profile value rather than failing', () => {
    expect(tryEvaluateRuleExpression('user.roles == "admin,dev"', user)).toBe('match');
  });

  // The Kleene core, observed through `evaluateRuleNode` — the same walk the
  // gated API runs, minus the grammar gate that would answer `unevaluable` for
  // every expression here before the walk ever started. These assertions were
  // previously made through the retired boolean API, which collapsed "resolved
  // to false" and "could not resolve" into one `false`; the two are now
  // distinguished, which is the whole point of the three-valued core (ADR-0025).
  describe('three-valued logic', () => {
    it('resolves an OR whose other side is true', () => {
      expect(
        walkUngated('isMemberOfGroup("00gFAKE") || user.department == "Engineering"', user),
      ).toEqual({ resolved: true, value: true });
    });

    it('resolves an AND whose other side is false', () => {
      expect(walkUngated('isMemberOfGroup("00gFAKE") && user.department == "Sales"', user)).toEqual(
        { resolved: true, value: false },
      );
    });

    it('stays unresolved when the known side cannot decide it', () => {
      // The case the boolean API could not tell apart from the one above.
      expect(
        walkUngated('isMemberOfGroup("00gFAKE") && user.department == "Engineering"', user)
          .resolved,
      ).toBe(false);
    });

    it('propagates an unresolved argument out of a supported call', () => {
      expect(walkUngated('String.startsWith(isMemberOfGroup("00gFAKE"), "a")', user).resolved).toBe(
        false,
      );
    });
  });

  describe('rejections reachable only through the ungated walk', () => {
    it('rejects computed and non-user member access', () => {
      expect(walkUngated('user["department"] == "Engineering"', user).resolved).toBe(false);
      expect(walkUngated('app.id == "0oaFAKE"', user).resolved).toBe(false);
      expect(walkUngated('user.a.b == 1', user).resolved).toBe(false);
    });

    it('rejects a nested callee, an unsupported operator and a bare identifier', () => {
      expect(walkUngated('user.a.b("x") == 1', user).resolved).toBe(false);
      expect(walkUngated('user.employeeNumber % 2 == 0', user).resolved).toBe(false);
      expect(walkUngated('department == "Engineering"', user).resolved).toBe(false);
    });

    it('rejects a wrong-arity call and a non-"!" unary operator', () => {
      expect(walkUngated('String.startsWith(user.firstName)', user).resolved).toBe(false);
      expect(walkUngated('-user.employeeNumber == -42', user).resolved).toBe(false);
    });
  });
});

// ===========================================================================
// Bounded parse memo. The cache itself is module-private and deliberately not
// exported — its keys are expression text, which can carry tenant PII. These
// tests therefore observe it through the one signal the parser already emits:
// `parseExpression` logs exactly one `parse-error` reason code per REAL parse
// attempt that throws, and nothing at all on a cache hit. Counting those lines
// counts parses without a test-only export and without mocking jsep.
// ===========================================================================
describe('parse memoisation', () => {
  const user: OktaUser = {
    id: '00uFAKE',
    status: 'ACTIVE',
    profile: {
      login: 'ada@example.com',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      department: 'Engineering',
      city: 'San Francisco',
    },
  } as unknown as OktaUser;

  /** Cap and eviction policy mirrored from `PARSE_CACHE_LIMIT` (module-private). */
  const PARSE_CACHE_LIMIT = 128;

  let debugSpy: MockInstance;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
  });

  /** How many times jsep was actually invoked on an ungrammatical expression. */
  const parseAttempts = (): number =>
    debugSpy.mock.calls.filter(
      (args) =>
        args[1] === 'Rule expression rejected' &&
        (args[2] as { reason?: string } | undefined)?.reason === 'parse-error',
    ).length;

  /**
   * A distinct ungrammatical expression per test: the memo is module state that
   * outlives an individual test, so tests must not share cache keys.
   */
  const ungrammatical = (tag: string): string => `user.${tag} ==`;
  /** A distinct grammatical expression, used only to occupy a cache slot. */
  const filler = (tag: string, index: number): string => `user.${tag}${index} == "x"`;

  it('caches a parse failure so an ungrammatical expression is not re-parsed', () => {
    const bad = ungrammatical('memoFailureCached');

    expect(gateAccepts(bad)).toBe(false);
    expect(parseAttempts()).toBe(1);

    // Repeat through every entry point: a cached `undefined` must read as a hit
    // (`cache.has`), not as a miss via a truthiness check.
    expect(gateAccepts(bad)).toBe(false);
    expect(tryEvaluateRuleExpression(bad, user)).toBe('unevaluable');
    expect(tryEvaluateRuleExpressionDetailed(bad, user).outcome).toBe('unevaluable');
    expect(parseAttempts()).toBe(1);
  });

  it(`evicts the oldest entry only once a ${PARSE_CACHE_LIMIT + 1}th expression arrives`, () => {
    const victim = ungrammatical('memoEviction');

    // Fill the cache to exactly its cap first, so the victim's position in the
    // FIFO queue is deterministic regardless of what earlier tests cached.
    for (let i = 0; i < PARSE_CACHE_LIMIT; i++) gateAccepts(filler('pre', i));

    gateAccepts(victim); // newest of PARSE_CACHE_LIMIT entries
    expect(parseAttempts()).toBe(1);

    // One short of the cap: the victim is now the oldest entry, but still cached.
    for (let i = 0; i < PARSE_CACHE_LIMIT - 1; i++) gateAccepts(filler('post', i));
    expect(gateAccepts(victim)).toBe(false);
    expect(parseAttempts()).toBe(1);

    // The entry that takes the cache one over the cap evicts it.
    gateAccepts(filler('post', PARSE_CACHE_LIMIT - 1));
    expect(gateAccepts(victim)).toBe(false);
    expect(parseAttempts()).toBe(2);
  });

  it('never lets a shared cached AST drift between calls, users, or entry points', () => {
    // One expression, one cached AST, walked by both the allow-list gate and
    // the evaluator, for two different users. Every answer must be reproducible:
    // it would not be if either walk annotated or rewrote the shared nodes.
    const expression =
      'String.toUpperCase(user.department) == "ENGINEERING" and user.city == "San Francisco"';
    const otherUser: OktaUser = {
      ...user,
      profile: { ...user.profile, department: 'Sales' },
    } as unknown as OktaUser;

    expect(gateAccepts(expression)).toBe(true);
    expect(tryEvaluateRuleExpression(expression, user)).toBe('match');
    expect(tryEvaluateRuleExpression(expression, otherUser)).toBe('no-match');
    expect(tryEvaluateRuleExpressionDetailed(expression, user)).toEqual({ outcome: 'match' });

    expect(tryEvaluateRuleExpression(expression, user)).toBe('match');
    expect(tryEvaluateRuleExpression(expression, otherUser)).toBe('no-match');
    expect(gateAccepts(expression)).toBe(true);
  });
});

// ===========================================================================
// The reason-code payload. `RuleMatchOutcome` stays a bare 3-string union (it is
// pinned everywhere); `RuleMatchResult` carries WHY an answer was `unevaluable`,
// which previously existed only as a `log.debug` line — a no-op in production.
// ===========================================================================
describe('tryEvaluateRuleExpressionDetailed', () => {
  const user: OktaUser = {
    id: '00uFAKE',
    status: 'ACTIVE',
    profile: {
      login: 'ada@example.com',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      department: 'Engineering',
      city: 'San Francisco',
      employeeNumber: 42,
    },
  } as unknown as OktaUser;

  /** Every expression the two APIs are asserted to agree on. */
  const expressions = [
    'user.department == "Engineering"',
    'user.department == "Sales"',
    'user.department eq "Engineering" and user.city eq "San Francisco"',
    'String.startsWith(user.firstName, "Ad")',
    '!(user.department == "Sales")',
    'user.employeeNumber > 10',
    '',
    '   ',
    'user.department ==',
    '(user.department == "Engineering"',
    'isMemberOfGroup("00gFAKE")',
    'isMemberOfGroup("00gFAKE") || user.department == "Engineering"',
    'app.clientId == "x"',
    'session.amr == "pwd"',
    'user["department"] == "Engineering"',
    'String.substring(user.email, 0, 3) == "ada"',
    'String.startsWith(user.firstName)',
    'user.department + "x" == "Engineeringx"',
    'user.department > "A"',
    'user.department',
    '"Engineering"',
    'this.foo == 1',
    `user.department == "${'x'.repeat(5000)}"`,
  ];

  it.each(expressions)(
    'returns the same outcome as tryEvaluateRuleExpression for %s',
    (expression) => {
      expect(tryEvaluateRuleExpressionDetailed(expression, user).outcome).toBe(
        tryEvaluateRuleExpression(expression, user),
      );
    },
  );

  it('carries no reason code on a decided answer', () => {
    expect(tryEvaluateRuleExpressionDetailed('user.department == "Engineering"', user)).toEqual({
      outcome: 'match',
    });
    expect(tryEvaluateRuleExpressionDetailed('user.department == "Sales"', user)).toEqual({
      outcome: 'no-match',
    });
  });

  it.each([
    { expression: '', reasonCode: 'empty' },
    { expression: '   ', reasonCode: 'empty' },
    { expression: `user.department == "${'x'.repeat(5000)}"`, reasonCode: 'too-long' },
    { expression: 'user.department ==', reasonCode: 'parse-error' },
    { expression: 'user.department + "x" == "Engineeringx"', reasonCode: 'unsupported-operator' },
    { expression: 'isMemberOfGroupName("Eng")', reasonCode: 'group-membership-fn' },
    { expression: 'Arrays.contains(user.department, "Eng")', reasonCode: 'unknown-fn' },
    { expression: 'String.startsWith(user.firstName)', reasonCode: 'fn-arity' },
    { expression: 'app.clientId == "x"', reasonCode: 'unsupported-node' },
    { expression: 'user["department"] == "Engineering"', reasonCode: 'unsupported-node' },
    { expression: 'user.department > "A"', reasonCode: 'operand-type' },
    { expression: 'String.startsWith(user.employeeNumber, "4")', reasonCode: 'operand-type' },
    { expression: 'user.department', reasonCode: 'not-a-boolean' },
    { expression: '"Engineering"', reasonCode: 'not-a-boolean' },
  ])('attributes $reasonCode to $expression', ({ expression, reasonCode }) => {
    expect(tryEvaluateRuleExpressionDetailed(expression, user)).toEqual({
      outcome: 'unevaluable',
      reasonCode,
    });
  });
});

// ===========================================================================
// The AST seam the clause-level explainer builds on. It must expose the SAME
// parse (memoised) and the SAME allow-list — never a second one.
// ===========================================================================
describe('AST seam', () => {
  const user: OktaUser = {
    id: '00uFAKE',
    status: 'ACTIVE',
    profile: {
      login: 'ada@example.com',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      department: 'Engineering',
    },
  } as unknown as OktaUser;

  it('hands back the memoised AST rather than a fresh parse', () => {
    const expression = 'user.department == "Engineering" && user.firstName == "Ada"';
    const first = parseRuleExpression(expression);
    const second = parseRuleExpression(expression);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // Same object identity: one parse, shared (and therefore read-only) tree.
    if (first.ok && second.ok) expect(second.ast).toBe(first.ast);
  });

  it('classifies why an expression never became an AST', () => {
    expect(parseRuleExpression('')).toEqual({ ok: false, reasonCode: 'empty' });
    expect(parseRuleExpression('user.department ==')).toEqual({
      ok: false,
      reasonCode: 'parse-error',
    });
    expect(parseRuleExpression(`user.department == "${'x'.repeat(5000)}"`)).toEqual({
      ok: false,
      reasonCode: 'too-long',
    });
  });

  it('gates a sub-tree with the same allow-list as a whole expression', () => {
    const parsed = parseRuleExpression('isMemberOfGroup("00gFAKE") && user.department == "Eng"');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const binary = parsed.ast as unknown as { left: never; right: never };
    expect(checkRuleNodeSupport(parsed.ast)).toEqual({
      supported: false,
      reasonCode: 'group-membership-fn',
    });
    expect(checkRuleNodeSupport(binary.left)).toEqual({
      supported: false,
      reasonCode: 'group-membership-fn',
    });
    expect(checkRuleNodeSupport(binary.right)).toEqual({ supported: true });
  });

  it('surfaces the UNRESOLVED sentinel as a reason code instead of a value', () => {
    const resolved = parseRuleExpression('user.department');
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(evaluateRuleNode(resolved.ast, { user })).toEqual({
        resolved: true,
        value: 'Engineering',
      });
    }

    const unresolvable = parseRuleExpression('isMemberOfGroup("00gFAKE")');
    expect(unresolvable.ok).toBe(true);
    if (unresolvable.ok) {
      expect(evaluateRuleNode(unresolvable.ast, { user })).toEqual({
        resolved: false,
        reasonCode: 'group-membership-fn',
      });
    }
  });

  it('evaluates an already-parsed condition without re-parsing it', () => {
    const parsed = parseRuleExpression('user.department == "Engineering"');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(evaluateParsedRule(parsed.ast, { user })).toEqual({ outcome: 'match' });
  });

  it('exposes the connective set the clause splitter descends through', () => {
    expect([...RULE_CONNECTIVE_OPERATORS].sort()).toEqual(
      ['&&', 'AND', 'OR', '||', 'and', 'or'].sort(),
    );
  });
});
