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
import { MAX_INPUT_LENGTH, MAX_PATTERN_LENGTH } from './rules/safeRegex';
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
      // Present and explicitly `null`. The absent/null distinction is the whole
      // subject of two tests below, so the fixture has to carry both states —
      // `division` and `costCenter` are deliberately NOT here.
      nullable: null,
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

    it('returns match for an attribute present and explicitly null', () => {
      // The counterpart of the absent-attribute case below, and the reason the
      // two must not be one branch: a value the org actually holds licenses a
      // comparison, and `null == null` is a satisfied condition.
      expect(tryEvaluateRuleExpression('user.nullable == null', user)).toBe('match');
    });

    it('resolves a top-level user field, not just the profile', () => {
      // `user.status` is an ordinary thing to write in a rule, and it lives on
      // the user rather than in `profile`. Reading only `profile` made this
      // `null == "ACTIVE"` → a confident `no-match` for every user in the org
      // (D-114).
      expect(tryEvaluateRuleExpression('user.status == "ACTIVE"', user)).toBe('match');
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

    it('returns no-match for an unsatisfied top-level user field', () => {
      expect(tryEvaluateRuleExpression('user.status == "SUSPENDED"', user)).toBe('no-match');
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

    it('is unevaluable for an attribute the profile does not carry', () => {
      // Not `no-match`. The evaluator did not understand the expression; it did
      // not establish that the user fails it (D-114).
      expect(tryEvaluateRuleExpression('user.costCenter == "1234"', user)).toBe('unevaluable');
      expect(tryEvaluateRuleExpression('user.division == null', user)).toBe('unevaluable');
    });

    it('is unevaluable for a function outside the allow-list', () => {
      // `String.replaceFirst` takes a regex in the language Okta's EL is built
      // on, so it is refused rather than approximated; `Arrays.flatten` returns a
      // collection rather than answering anything.
      expect(
        tryEvaluateRuleExpression('String.replaceFirst(user.email, "a", "b") == "x"', user),
      ).toBe('unevaluable');
      expect(tryEvaluateRuleExpression('Arrays.flatten(user.roles) == "Eng"', user)).toBe(
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
      // A non-literal computed key stays unsupported; a string-literal one now
      // resolves — see "computed member access" below.
      expect(tryEvaluateRuleExpression('user[user.department] == "Engineering"', user)).toBe(
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
    expect(gateAccepts('String.replaceFirst(user.email, "a", "b") == "x"')).toBe(false);
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
      // A negative numeric attribute, for the unary-minus relational tests.
      floor: -1,
      // A custom attribute whose name is not a valid bare identifier, so only
      // computed access can reach it.
      'cost center': 'CC-9',
      // An object-valued attribute, so the refusal to read `[object Object]` has
      // something real to refuse, and an attribute whose name begins with a word
      // operator, for the boundary check.
      manager: { id: '00uFAKEMANAGER' },
      notes: null,
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

  it('refuses to compare a multi-valued attribute to its joined string', () => {
    // This used to answer `match`, on the strength of `String(['admin','dev'])`.
    // A rule author writing `== "admin,dev"` is not asking about the array, and
    // an org where the joined form coincides would have been told the wrong
    // thing with confidence.
    expect(tryEvaluateRuleExpression('user.roles == "admin,dev"', user)).toBe('unevaluable');
  });

  it('answers a multi-valued attribute through the Arrays helpers instead', () => {
    expect(tryEvaluateRuleExpression('Arrays.contains(user.roles, "admin")', user)).toBe('match');
    expect(tryEvaluateRuleExpression('Arrays.contains(user.roles, "auditor")', user)).toBe(
      'no-match',
    );
    expect(tryEvaluateRuleExpression('Arrays.size(user.roles) == 2', user)).toBe('match');
  });

  it('refuses an object-valued attribute rather than reading [object Object]', () => {
    expect(tryEvaluateRuleExpression('user.manager == "[object Object]"', user)).toBe(
      'unevaluable',
    );
  });

  // `String.stringSwitch` — see docs/adr/0003-stringswitch-matched-cases.md. Okta's
  // own documented examples pin *every* branch: a key matches by substring
  // containment (not equality), pairs are tried in the order supplied so the
  // first contained key wins even when a later key also matches, and the
  // required `defaultString` argument (not an optional third slot) is the
  // answer when no pair matches — so there is no branch left to guess at.
  describe('String.stringSwitch', () => {
    it('returns the value of the first pair whose key is contained in the input', () => {
      expect(
        tryEvaluateRuleExpression(
          'String.stringSwitch(user.department, "Other", "Engineering", "Eng") == "Eng"',
          user,
        ),
      ).toBe('match');
    });

    it('matches by substring containment, not equality', () => {
      // "Engineering" contains "Eng" but is not equal to it.
      expect(
        tryEvaluateRuleExpression(
          'String.stringSwitch(user.department, "Other", "Eng", "short") == "short"',
          user,
        ),
      ).toBe('match');
    });

    it('picks the first pair listed even when a later pair also matches', () => {
      // Mirrors Okta's own worked example: order of the pairs decides, not the
      // position of the match inside the string.
      expect(
        tryEvaluateRuleExpression(
          'String.stringSwitch(user.department, "Other", "Eng", "first", "Engineering", "second") == "first"',
          user,
        ),
      ).toBe('match');
    });

    it('falls through to the required default when no pair matches', () => {
      expect(
        tryEvaluateRuleExpression(
          'String.stringSwitch(user.department, "Other", "Sales", "S") == "Other"',
          user,
        ),
      ).toBe('match');
    });

    it('returns the default with zero key-value pairs supplied', () => {
      expect(
        tryEvaluateRuleExpression('String.stringSwitch(user.department, "Other") == "Other"', user),
      ).toBe('match');
    });

    it('rejects a non-string input as operand-type, never a guess', () => {
      expect(
        tryEvaluateRuleExpression(
          'String.stringSwitch(user.employeeNumber, "Other", "4", "x")',
          user,
        ),
      ).toBe('unevaluable');
    });

    it('rejects too few arguments (no default) as fn-arity', () => {
      expect(tryEvaluateRuleExpression('String.stringSwitch(user.department)', user)).toBe(
        'unevaluable',
      );
    });

    it('rejects an unpaired trailing key as fn-arity', () => {
      expect(
        tryEvaluateRuleExpression('String.stringSwitch(user.department, "Other", "Eng")', user),
      ).toBe('unevaluable');
    });

    it('composes with the connectives and a conditional, same as any other call', () => {
      expect(
        tryEvaluateRuleExpression(
          'String.stringSwitch(user.department, "Other", "Eng", "yes") == "yes" && user.firstName == "Ada"',
          user,
        ),
      ).toBe('match');
      expect(
        tryEvaluateRuleExpression(
          'user.employeeNumber > 0 ? String.stringSwitch(user.department, "Other", "Eng", "yes") : "n/a"',
          user,
        ),
      ).toBe('unevaluable'); // resolves to "yes", a string — not a boolean condition on its own.
    });
  });

  it('negates with the NOT word form as well as with !', () => {
    expect(tryEvaluateRuleExpression('NOT user.active', user)).toBe('no-match');
    expect(tryEvaluateRuleExpression('not user.active', user)).toBe('no-match');
    // The identifier boundary check keeps an attribute starting with `not` whole.
    expect(tryEvaluateRuleExpression('user.notes == null', user)).toBe('match');
  });

  describe('unary minus on a numeric literal', () => {
    it('negates a positive literal against a negative attribute', () => {
      expect(tryEvaluateRuleExpression('user.floor >= -1', user)).toBe('match');
      expect(tryEvaluateRuleExpression('user.floor > -1', user)).toBe('no-match');
    });

    it('folds a fractional literal', () => {
      expect(tryEvaluateRuleExpression('user.employeeNumber >= -0.5', user)).toBe('match');
    });

    it('stays unevaluable when the operand is not a numeric literal', () => {
      // `-user.x`, `-(expr)` and `-"a"` are not group-rule conditions Okta's own
      // syntax produces — only `-<number literal>` folds.
      expect(tryEvaluateRuleExpression('user.employeeNumber >= -user.floor', user)).toBe(
        'unevaluable',
      );
      // `(1 + 1)` is a BinaryExpression, not a Literal — jsep drops parentheses
      // that wrap a single literal, so `-(1)` alone would (correctly) fold the
      // same as `-1` and isn't a useful negative case here.
      expect(tryEvaluateRuleExpression('user.employeeNumber >= -(1 + 1)', user)).toBe(
        'unevaluable',
      );
      expect(tryEvaluateRuleExpression('user.department == -"a"', user)).toBe('unevaluable');
    });
  });

  describe('computed member access with a string-literal key', () => {
    it('resolves the same as the dotted form would, were the name a valid identifier', () => {
      expect(tryEvaluateRuleExpression('user["cost center"] == "CC-9"', user)).toBe('match');
      expect(tryEvaluateRuleExpression('user["cost center"] == "CC-1"', user)).toBe('no-match');
    });

    it('reports attribute-absent for a computed key the profile does not carry', () => {
      expect(tryEvaluateRuleExpression('user["cost centre"] == "CC-9"', user)).toBe('unevaluable');
    });

    it('stays unevaluable for a non-literal or nested computed key', () => {
      expect(tryEvaluateRuleExpression('user[user.department] == "Engineering"', user)).toBe(
        'unevaluable',
      );
      expect(tryEvaluateRuleExpression('user["cost center"]["nested"] == "x"', user)).toBe(
        'unevaluable',
      );
    });
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
    it('rejects a non-literal computed key and non-user member access', () => {
      // A string-literal computed key now resolves the same as its dotted form
      // — see "computed member access" below.
      expect(walkUngated('user[user.department] == "Engineering"', user).resolved).toBe(false);
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
      // A multi-valued attribute, so the `operand-type` row below is refusing an
      // array rather than reporting one that is simply absent.
      roles: ['admin', 'dev'],
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
    { expression: 'Arrays.flatten(user.roles)', reasonCode: 'unknown-fn' },
    { expression: 'Arrays.contains(user.department, "Eng")', reasonCode: 'operand-type' },
    { expression: 'user.costCenter == "1234"', reasonCode: 'attribute-absent' },
    { expression: 'user.roles == "admin,dev"', reasonCode: 'operand-type' },
    { expression: 'String.startsWith(user.firstName)', reasonCode: 'fn-arity' },
    { expression: 'app.clientId == "x"', reasonCode: 'unsupported-node' },
    // A non-literal computed key stays unsupported — only a string-literal key
    // (`user["department"]`) is modelled, and that case now resolves rather
    // than being rejected: see "computed member access" below.
    { expression: 'user[foo] == "Engineering"', reasonCode: 'unsupported-node' },
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

// ===========================================================================
// Conditional expressions (`test ? consequent : alternate`). Okta EL accepts
// them and jsep has always parsed them; the evaluator used to decline the node
// outright, so a rule written in the ternary form came back `unevaluable`
// however ordinary its parts were.
// ===========================================================================
describe('conditional expressions', () => {
  const user: OktaUser = {
    id: '00uFAKE',
    status: 'ACTIVE',
    profile: {
      login: 'ada@example.com',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      department: 'Engineering',
      userType: 'EMPLOYEE',
      region: 'EU',
      division: 'EMEA',
      contractor: false,
      roles: ['admin', 'dev'],
      // `missingAttr` is deliberately absent: reading it is how a test operand
      // is made UNRESOLVED rather than false.
    },
  } as unknown as OktaUser;

  /** The same user, with the attributes an individual case needs changed. */
  const userWith = (profile: Record<string, unknown>): OktaUser =>
    ({ ...user, profile: { ...user.profile, ...profile } }) as unknown as OktaUser;

  const groupsWithStaff = [{ id: '00gFAKE1', name: 'Staff' }];
  const groupsWithoutStaff = [{ id: '00gFAKE2', name: 'Interns' }];

  describe('a resolved test selects its branch', () => {
    const expression =
      'user.userType == "EMPLOYEE" ? isMemberOfGroupName("Staff") : user.contractor == true';

    it('takes the consequent when the test is true', () => {
      expect(tryEvaluateRuleExpression(expression, user, groupsWithStaff)).toBe('match');
    });

    it('reports no-match when the chosen consequent resolves to false', () => {
      expect(tryEvaluateRuleExpression(expression, user, groupsWithoutStaff)).toBe('no-match');
    });

    it('takes the alternate when the test is false', () => {
      const contractor = userWith({ userType: 'CONTRACTOR', contractor: true });
      expect(tryEvaluateRuleExpression(expression, contractor, groupsWithoutStaff)).toBe('match');
    });
  });

  describe('a conditional that produces a value, inside a comparison', () => {
    const expression = '(user.region == "EU" ? "EMEA" : "AMER") == user.division';

    it('matches when the selected branch equals the compared attribute', () => {
      expect(tryEvaluateRuleExpression(expression, user)).toBe('match');
    });

    it('reports no-match when it does not', () => {
      expect(tryEvaluateRuleExpression(expression, userWith({ division: 'AMER' }))).toBe(
        'no-match',
      );
    });

    it('follows the alternate branch for a false test', () => {
      const amer = userWith({ region: 'US', division: 'AMER' });
      expect(tryEvaluateRuleExpression(expression, amer)).toBe('match');
    });
  });

  describe('an unresolved test', () => {
    it('still resolves when both branches are the same value', () => {
      expect(tryEvaluateRuleExpression('(user.missingAttr ? "X" : "X") == "X"', user)).toBe(
        'match',
      );
    });

    it('stays unevaluable when the branches differ', () => {
      expect(tryEvaluateRuleExpression('(user.missingAttr ? "X" : "Y") == "X"', user)).toBe(
        'unevaluable',
      );
    });

    it('stays unevaluable for array branches, which are never the same value', () => {
      expect(walkUngated('user.missingAttr ? user.roles : user.roles', user).resolved).toBe(false);
    });

    it('stays unevaluable when a branch is itself unresolved', () => {
      expect(
        walkUngated('user.missingAttr ? user.department : user.alsoMissing', user).resolved,
      ).toBe(false);
    });
  });

  describe('the chosen branch carries the answer', () => {
    // `>` is allow-listed, so the grammar gate passes, but it gives up unless
    // both operands are numbers — that branch resolves to nothing.
    const expression = 'user.userType == "EMPLOYEE" ? user.department > "A" : false';

    it('is unevaluable when the chosen branch does not resolve', () => {
      expect(tryEvaluateRuleExpression(expression, user)).toBe('unevaluable');
    });

    it('is unaffected by an unresolved branch it did not choose', () => {
      expect(tryEvaluateRuleExpression(expression, userWith({ userType: 'CONTRACTOR' }))).toBe(
        'no-match',
      );
    });
  });

  describe('nested conditionals', () => {
    const expression =
      '(user.userType == "EMPLOYEE" ? (user.region == "EU" ? "EMEA" : "AMER") : "EXTERNAL") == user.division';

    it('resolves through the inner conditional', () => {
      expect(tryEvaluateRuleExpression(expression, user)).toBe('match');
      expect(tryEvaluateRuleExpression(expression, userWith({ region: 'US' }))).toBe('no-match');
    });

    it('resolves through the outer alternate', () => {
      const external = userWith({ userType: 'CONTRACTOR', division: 'EXTERNAL' });
      expect(tryEvaluateRuleExpression(expression, external)).toBe('match');
    });
  });

  it('is accepted by the grammar gate only when every part is supported', () => {
    expect(gateAccepts('user.userType == "EMPLOYEE" ? "a" : "b"')).toBe(true);
    // The alternate is a bare identifier — not a shape this module models.
    expect(gateAccepts('user.userType == "EMPLOYEE" ? "a" : department')).toBe(false);
    // The test is an array literal.
    expect(gateAccepts('["a"] ? "a" : "b"')).toBe(false);
  });
});

// ===========================================================================
// isMemberOfGroupNameRegex — answered by the linear-time engine, not refused.
//
// This function was a standing refusal, under a reason code of its own, for the
// module's whole life, because a `RegExp` built from a tenant pattern is a backtracking
// lever pointed at the panel's only thread. ADR-0002 kept that ban and removed
// the refusal: `shared/rules/safeRegex` runs the pattern in linear time, and
// says so explicitly when it will not run one.
// ===========================================================================

describe('isMemberOfGroupNameRegex', () => {
  const user: OktaUser = {
    id: '00uFAKEuser00001',
    status: 'ACTIVE',
    profile: {
      login: 'ada@example.com',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      department: 'Engineering',
    },
  };

  /** The user's complete membership set, as the group-context option requires. */
  const groups = [
    { id: '00gFAKEgroup0001', name: 'SecOps-Alpha' },
    { id: '00gFAKEgroup0002', name: 'Engineering' },
    { id: '00gFAKEgroup0003', name: 'VPN — Standard' },
  ];

  it('answers match when a group name satisfies the pattern', () => {
    expect(
      tryEvaluateRuleExpressionDetailed('isMemberOfGroupNameRegex("^SecOps-.*")', user, groups),
    ).toEqual({ outcome: 'match' });
  });

  it('answers no-match when none does', () => {
    expect(
      tryEvaluateRuleExpressionDetailed('isMemberOfGroupNameRegex("^Finance-.*")', user, groups),
    ).toEqual({ outcome: 'no-match' });
  });

  it('requires the whole name to match, as Okta does server-side', () => {
    // Java's `matches()`, not `find()`: "X-SecOps-Alpha" is not a member of
    // `SecOps-.*` even though it contains a substring that is.
    const shifted = [{ id: '00gFAKEgroup0009', name: 'X-SecOps-Alpha' }];
    expect(tryEvaluateRuleExpression('isMemberOfGroupNameRegex("SecOps-.*")', user, shifted)).toBe(
      'no-match',
    );
    expect(
      tryEvaluateRuleExpression('isMemberOfGroupNameRegex(".*SecOps-.*")', user, shifted),
    ).toBe('match');
  });

  it('negates cleanly', () => {
    expect(tryEvaluateRuleExpression('!isMemberOfGroupNameRegex("^SecOps-.*")', user, groups)).toBe(
      'no-match',
    );
    expect(
      tryEvaluateRuleExpression('!isMemberOfGroupNameRegex("^Finance-.*")', user, groups),
    ).toBe('match');
  });

  it('declines syntax the safe engine does not implement', () => {
    expect(
      tryEvaluateRuleExpressionDetailed('isMemberOfGroupNameRegex("(?=x)SecOps")', user, groups),
    ).toEqual({ outcome: 'unevaluable', reasonCode: 'regex-unsupported-syntax' });
  });

  it('declines a malformed pattern rather than guessing at it', () => {
    expect(
      tryEvaluateRuleExpressionDetailed('isMemberOfGroupNameRegex("[")', user, groups),
    ).toEqual({ outcome: 'unevaluable', reasonCode: 'regex-unsupported-syntax' });
  });

  it('declines a pattern past the engine’s size cap', () => {
    const overlong = `"${'a'.repeat(MAX_PATTERN_LENGTH + 1)}"`;
    expect(
      tryEvaluateRuleExpressionDetailed(`isMemberOfGroupNameRegex(${overlong})`, user, groups),
    ).toEqual({ outcome: 'unevaluable', reasonCode: 'regex-too-complex' });
  });

  it('stays group-membership-fn without a group list, like its siblings', () => {
    expect(
      tryEvaluateRuleExpressionDetailed('isMemberOfGroupNameRegex("^SecOps-.*")', user),
    ).toEqual({ outcome: 'unevaluable', reasonCode: 'group-membership-fn' });
  });

  describe('a group name the engine cannot read', () => {
    /** Past `MAX_INPUT_LENGTH`, so matching it declines rather than answering. */
    const overCap = { id: '00gFAKEgroup0004', name: 'Z'.repeat(MAX_INPUT_LENGTH + 1) };

    it('still answers match when another name matched', () => {
      // Eager Kleene: a found match is a found match, whatever the rest of the
      // list did.
      expect(
        tryEvaluateRuleExpression('isMemberOfGroupNameRegex("^SecOps-.*")', user, [
          ...groups,
          overCap,
        ]),
      ).toBe('match');
    });

    it('never answers no-match when a name went unchecked', () => {
      // A definite "none of them" is only claimable when every name evaluated.
      expect(
        tryEvaluateRuleExpressionDetailed('isMemberOfGroupNameRegex("^Finance-.*")', user, [
          ...groups,
          overCap,
        ]),
      ).toEqual({ outcome: 'unevaluable', reasonCode: 'regex-too-complex' });
    });
  });
});
