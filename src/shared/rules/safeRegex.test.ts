import { describe, it, expect } from 'vitest';

import {
  MAX_INPUT_LENGTH,
  MAX_NFA_STATES,
  MAX_PATTERN_LENGTH,
  MAX_SIMULATION_STEPS,
  SAFE_REGEX_LIMITS,
  compileSafeRegex,
  matchCompiled,
  matchSafeRegex,
  type SafeRegexDeclineReason,
} from './safeRegex';

/**
 * Wrap a pattern the way Java's `matches()` behaves, so `RegExp` can serve as an
 * oracle. Test-only: the fixture patterns here are ours, not tenant input.
 */
function oracle(pattern: string, input: string): boolean {
  return new RegExp(`^(?:${pattern})$`).test(input);
}

function expectMatched(pattern: string, input: string, expected: boolean): void {
  const result = matchSafeRegex(pattern, input);
  expect(result, `${pattern} vs ${JSON.stringify(input)}`).toEqual({
    kind: 'match',
    matched: expected,
  });
}

/** High-resolution clock, via globalThis so the lint env resolves it. */
function now(): number {
  return globalThis.performance.now();
}

function expectDeclined(pattern: string, reason: SafeRegexDeclineReason): void {
  expect(matchSafeRegex(pattern, 'anything'), pattern).toEqual({ kind: 'declined', reason });
}

describe('safeRegex — supported subset semantics', () => {
  /** [pattern, input, expected, oracleSafe] — `oracleSafe` false where JS and Java differ. */
  const cases: ReadonlyArray<readonly [string, string, boolean, boolean?]> = [
    // Literals
    ['abc', 'abc', true],
    ['abc', 'abd', false],
    ['abc', 'ab', false],
    ['', '', true],
    ['', 'a', false],

    // Dot
    ['a.c', 'abc', true],
    ['a.c', 'a-c', true],
    ['a.c', 'ac', false],
    ['.', '\n', false],
    ['a.c', 'a\nc', false],

    // Escapes
    ['a\\.c', 'a.c', true],
    ['a\\.c', 'abc', false],
    ['a\\\\c', 'a\\c', true],
    ['a\\-c', 'a-c', true],
    ['\\(x\\)', '(x)', true],
    ['\\[x\\]', '[x]', true],
    ['\\*\\+\\?', '*+?', true],
    ['a\\|b', 'a|b', true],
    ['\\^\\$', '^$', true],
    ['\\{2\\}', '{2}', true],

    // Shorthand classes
    ['\\d\\d', '42', true],
    ['\\d\\d', '4a', false],
    ['\\D', 'a', true],
    ['\\D', '4', false],
    ['\\w+', 'a_Z9', true],
    ['\\w+', 'a-b', false],
    ['\\W', '-', true],
    ['\\W', 'a', false],
    ['a\\sb', 'a b', true],
    ['a\\sb', 'a\tb', true],
    ['a\\sb', 'ab', false],
    ['\\S+', 'abc', true],
    ['\\S+', 'a c', false],

    // Character classes
    ['[abc]+', 'cab', true],
    ['[abc]+', 'cad', false],
    ['[a-z]+', 'hello', true],
    ['[a-z]+', 'Hello', false],
    ['[a-zA-Z0-9]+', 'Ok7a', true],
    ['[^abc]+', 'xyz', true],
    ['[^abc]+', 'xay', false],
    ['[-a]+', '-a-', true],
    ['[a-]+', 'a--', true],
    ['[\\d]+', '90', true],
    ['[\\D]+', 'ab', true],
    ['[\\D]+', 'a1', false],
    ['[^\\d]+', 'ab', true],
    ['[^\\D]+', '12', true],
    ['[\\]]', ']', true],
    ['[\\^]', '^', true],
    ['[a^]+', '^a', true],
    ['[.]', '.', true],
    ['[.]', 'x', false],

    // Quantifiers
    ['a*', '', true],
    ['a*', 'aaaa', true],
    ['a*', 'aaab', false],
    ['a+', '', false],
    ['a+', 'aaa', true],
    ['a?', '', true],
    ['a?', 'a', true],
    ['a?', 'aa', false],
    ['ab*c', 'ac', true],
    ['ab*c', 'abbbc', true],

    // Alternation and precedence
    ['ab|cd', 'ab', true],
    ['ab|cd', 'cd', true],
    ['ab|cd', 'abcd', false],
    ['a(b|c)d', 'abd', true],
    ['a(b|c)d', 'acd', true],
    ['a(b|c)d', 'ad', false],
    ['a|', 'a', true],
    ['a|', '', true],
    ['a|', 'b', false],
    ['|a', '', true],
    ['a||b', '', true],
    ['x(a|)y', 'xy', true],
    ['x(a|)y', 'xay', true],

    // Grouping, nesting, non-capturing form
    ['(?:abc)+', 'abcabc', true],
    ['(?:abc)+', 'abcab', false],
    ['((a|b)c)+', 'acbcac', true],
    ['((a|b)c)+', 'acbca', false],
    ['(a(b(c)))', 'abc', true],
    ['(a*)*', 'aaa', true],
    ['(a*)*', '', true],
    ['(a|b)*c', 'ababc', true],
    ['()', '', true],
    ['(|)', '', true],

    // Anchors are redundant under full-match semantics
    ['^abc$', 'abc', true],
    ['^abc$', 'xabc', false],
    ['^', '', true],
    ['$', '', true],
    ['^$', '', true],
    ['a|^b', 'b', true],
    ['a$|b', 'a', true],

    // Realistic group-name shapes
    ['SecOps-.*', 'SecOps-Alpha', true],
    ['SecOps-.*', 'X-SecOps-Alpha', false],
    ['^SecOps-.*', 'SecOps-Alpha', true],
    ['^SecOps-.*$', 'X-SecOps-Alpha', false],
    ['(APP|SVC)_[A-Z]+_(PROD|DEV)', 'APP_BILLING_PROD', true],
    ['(APP|SVC)_[A-Z]+_(PROD|DEV)', 'APP_BILLING_TEST', false],
  ];

  for (const [pattern, input, expected, oracleSafe] of cases) {
    it(`${JSON.stringify(pattern)} vs ${JSON.stringify(input)} → ${expected}`, () => {
      expectMatched(pattern, input, expected);
      // Cross-check the expectation itself against JS `RegExp`, full-match
      // wrapped, wherever the construct sits in the Java/JavaScript overlap.
      if (oracleSafe !== false) expect(oracle(pattern, input)).toBe(expected);
    });
  }
});

describe('safeRegex — full-match (Java matches()) semantics', () => {
  it('does not match a substring', () => {
    expectMatched('SecOps-.*', 'SecOps-Alpha', true);
    expectMatched('SecOps-.*', 'X-SecOps-Alpha', false);
  });

  it('treats an explicit ^ as redundant, not additive', () => {
    for (const input of ['SecOps-Alpha', 'X-SecOps-Alpha', 'SecOps-']) {
      const bare = matchSafeRegex('SecOps-.*', input);
      const anchored = matchSafeRegex('^SecOps-.*', input);
      const both = matchSafeRegex('^SecOps-.*$', input);
      expect(anchored).toEqual(bare);
      expect(both).toEqual(bare);
    }
  });

  it('honours a mid-pattern anchor positionally', () => {
    expectMatched('a^b', 'ab', false);
    expectMatched('a$b', 'ab', false);
  });
});

describe('safeRegex — declines', () => {
  const unsupported: readonly string[] = [
    '(?=a)', // lookahead
    '(?!a)', // negative lookahead
    '(?<=a)', // lookbehind
    '(?<name>a)', // named group
    '(?i)abc', // inline flags
    'a{2,3}', // bounded repetition
    'a{2}', // bounded repetition
    '\\p{L}', // unicode property
    '\\1', // backreference
    '(a)\\1', // backreference
    '\\b', // word boundary
    '\\n', // control escape
    '\\t', // control escape
    '\\Qa\\E', // quoting
    '\\A', // input-start anchor
    'a*?', // lazy
    'a*+', // possessive
    'a+?', // lazy
    '[a[b]]', // class union
    '[a&&b]', // class intersection
  ];

  it.each(unsupported)('declines %s as unsupported-syntax', (pattern) => {
    expectDeclined(pattern, 'unsupported-syntax');
  });

  const malformed: readonly string[] = [
    '(', // unbalanced group
    '(abc', // unbalanced group
    'abc)', // stray close
    '[', // unbalanced class
    '[abc', // unbalanced class
    '[]', // empty class (a JVM error)
    '[^]', // empty negated class
    'a\\', // trailing backslash
    '[a\\', // trailing backslash in a class
    '*a', // nothing to repeat
    '+', // nothing to repeat
    '?abc', // nothing to repeat
    '[z-a]', // reversed range
    '[a-\\d]', // shorthand as a range bound
    '^*', // quantified anchor
  ];

  it.each(malformed)('declines %s as parse-error', (pattern) => {
    expectDeclined(pattern, 'parse-error');
  });

  it('declines a pattern over the length cap', () => {
    const tooLong = 'a'.repeat(MAX_PATTERN_LENGTH + 1);
    expect(matchSafeRegex(tooLong, 'a')).toEqual({
      kind: 'declined',
      reason: 'pattern-too-long',
    });
    expect(compileSafeRegex('a'.repeat(MAX_PATTERN_LENGTH)).kind).toBe('compiled');
  });

  it('declines an input over the length cap', () => {
    const tooLong = 'a'.repeat(MAX_INPUT_LENGTH + 1);
    expect(matchSafeRegex('a*', tooLong)).toEqual({ kind: 'declined', reason: 'input-too-long' });
    expect(matchSafeRegex('a*', 'a'.repeat(MAX_INPUT_LENGTH))).toEqual({
      kind: 'match',
      matched: true,
    });
  });

  it('declines a pattern that would need more states than the cap allows', () => {
    // A long concatenation of alternations — the densest state producer in the
    // grammar. Under the default caps the pattern-length ceiling already bounds
    // the state count well below MAX_NFA_STATES, so the guard is exercised with a
    // tightened ceiling; the same pattern compiles under the defaults.
    const dense = '(a|b)'.repeat(40);
    expect(dense.length).toBeLessThanOrEqual(MAX_PATTERN_LENGTH);
    expect(compileSafeRegex(dense, { maxNfaStates: 32 })).toEqual({
      kind: 'declined',
      reason: 'too-many-states',
    });
    const compiled = compileSafeRegex(dense);
    expect(compiled.kind).toBe('compiled');
    if (compiled.kind === 'compiled') {
      expect(compiled.stateCount).toBeLessThanOrEqual(MAX_NFA_STATES);
    }
  });

  it('declines when the simulation step budget runs out', () => {
    expect(matchSafeRegex('(a|b)*', 'ab'.repeat(64), { maxSimulationSteps: 50 })).toEqual({
      kind: 'declined',
      reason: 'step-budget-exceeded',
    });
  });

  it('keeps the worst legal workload inside the default step budget', () => {
    // 128 x `a*` is the densest simultaneously-active configuration the caps
    // permit; it must answer rather than hit the budget.
    const pattern = 'a*'.repeat(MAX_PATTERN_LENGTH / 2);
    const input = 'a'.repeat(MAX_INPUT_LENGTH);
    expect(matchSafeRegex(pattern, input)).toEqual({ kind: 'match', matched: true });
    expect(SAFE_REGEX_LIMITS.maxSimulationSteps).toBe(MAX_SIMULATION_STEPS);
  });
});

describe('safeRegex — never throws, always a value', () => {
  const hostile: readonly string[] = ['', '\\', '[[[[', '((((', ')))', '|||', '***', '(?', '[^'];

  it.each(hostile)('returns a result for %j', (pattern) => {
    const result = matchSafeRegex(pattern, 'abc');
    expect(['match', 'declined']).toContain(result.kind);
  });
});

describe('safeRegex — adversarial (ReDoS) patterns run in linear time', () => {
  const start = now();

  it('handles nested quantifiers without backtracking', () => {
    const input = `${'a'.repeat(MAX_INPUT_LENGTH - 1)}b`;
    const worstStart = now();
    expect(matchSafeRegex('(a+)+', input)).toEqual({ kind: 'match', matched: false });
    expect(matchSafeRegex('(a+)+$', input)).toEqual({ kind: 'match', matched: false });
    expect(matchSafeRegex('(a+)+', 'a'.repeat(MAX_INPUT_LENGTH))).toEqual({
      kind: 'match',
      matched: true,
    });
    expect(now() - worstStart).toBeLessThan(500);
  });

  it('handles the ambiguous-alternation family', () => {
    const input = `${'a'.repeat(MAX_INPUT_LENGTH - 1)}b`;
    for (const pattern of ['(a|a)*', '(a|aa)+', '(a*)*', '([ac]+)*', '(a|a?)+']) {
      expect(matchSafeRegex(pattern, input), pattern).toEqual({ kind: 'match', matched: false });
    }
    // The same shape with a class that does admit the trailing 'b' must answer
    // true — the guard is linear time, not a blanket refusal to match.
    expect(matchSafeRegex('([a-zA-Z]+)*', input)).toEqual({ kind: 'match', matched: true });
  });

  it('scales linearly, not exponentially, in input length', () => {
    const time = (length: number): number => {
      const input = `${'a'.repeat(length - 1)}b`;
      const t0 = now();
      matchSafeRegex('(a+)+', input);
      return now() - t0;
    };
    // A backtracking engine would take ~2^n here; even a loose bound catches it.
    time(64);
    expect(time(512)).toBeLessThan(500);
  });

  it('completes the whole adversarial block promptly', () => {
    expect(now() - start).toBeLessThan(500);
  });
});

describe('safeRegex — compile once, match many', () => {
  it('reuses one program across inputs with no cross-talk', () => {
    const program = compileSafeRegex('(dev|prod)-[a-z]+');
    expect(program.kind).toBe('compiled');
    if (program.kind !== 'compiled') return;
    expect(program.pattern).toBe('(dev|prod)-[a-z]+');
    const answers = ['dev-billing', 'prod-billing', 'stage-billing', 'dev-'].map((name) =>
      matchCompiled(program, name),
    );
    expect(answers).toEqual([
      { kind: 'match', matched: true },
      { kind: 'match', matched: true },
      { kind: 'match', matched: false },
      { kind: 'match', matched: false },
    ]);
    // Re-running the first input still agrees — no state leaked between runs.
    expect(matchCompiled(program, 'dev-billing')).toEqual({ kind: 'match', matched: true });
  });

  it('surfaces the compile decline from the one-shot helper unchanged', () => {
    expect(compileSafeRegex('a{2}')).toEqual({ kind: 'declined', reason: 'unsupported-syntax' });
    expect(matchSafeRegex('a{2}', 'aa')).toEqual({
      kind: 'declined',
      reason: 'unsupported-syntax',
    });
  });
});

describe('safeRegex — property sweep against the RegExp oracle', () => {
  /** Deterministic 32-bit PRNG, so a failure is reproducible. */
  function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };
  }

  // Deliberately ASCII and whitespace-free: Java and JavaScript agree on `\d`,
  // `\w` and `\s` over this alphabet, so the oracle is a fair judge.
  const ALPHABET = 'abc01_-';

  function randomPattern(random: () => number, depth: number): string {
    const pick = <T>(options: readonly T[]): T => options[Math.floor(random() * options.length)];
    const atom = (): string => {
      const roll = random();
      if (roll < 0.34) return pick([...ALPHABET].map((c) => (c === '-' ? '\\-' : c)));
      if (roll < 0.5) return pick(['\\d', '\\w', '\\D', '\\W', '.']);
      if (roll < 0.66) return pick(['[abc]', '[a-c0-9]', '[^ab]', '[b-c_]', '[\\d_]']);
      if (roll < 0.8 && depth < 3) return `(${randomPattern(random, depth + 1)})`;
      if (roll < 0.88 && depth < 3) return `(?:${randomPattern(random, depth + 1)})`;
      return pick([...ALPHABET].map((c) => (c === '-' ? '\\-' : c)));
    };
    const piece = (): string => {
      const base = atom();
      const roll = random();
      if (roll < 0.2) return `${base}*`;
      if (roll < 0.35) return `${base}+`;
      if (roll < 0.45) return `${base}?`;
      return base;
    };
    const branch = (): string => {
      const count = 1 + Math.floor(random() * 4);
      return Array.from({ length: count }, piece).join('');
    };
    const branches = 1 + Math.floor(random() * 3);
    return Array.from({ length: branches }, branch).join('|');
  }

  function randomInput(random: () => number): string {
    const length = Math.floor(random() * 10);
    return Array.from({ length }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join('');
  }

  it('agrees with RegExp on 400 random pattern/input pairs', () => {
    const random = makeRandom(0x0c7a_1234);
    let checked = 0;
    for (let i = 0; i < 400; i += 1) {
      const pattern = randomPattern(random, 0);
      if (pattern.length > MAX_PATTERN_LENGTH) continue;
      const input = randomInput(random);
      const actual = matchSafeRegex(pattern, input);
      expect(actual.kind, `${pattern} vs ${JSON.stringify(input)}`).toBe('match');
      if (actual.kind !== 'match') continue;
      expect(actual.matched, `${pattern} vs ${JSON.stringify(input)}`).toBe(oracle(pattern, input));
      checked += 1;
    }
    expect(checked).toBeGreaterThan(350);
  });
});
