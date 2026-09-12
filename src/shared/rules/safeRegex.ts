/**
 * @module shared/rules/safeRegex
 * @description A standalone, linear-time regular-expression matcher for
 * tenant-authored patterns — no `RegExp`, no backtracking, no catastrophe.
 *
 * ## Why this exists
 *
 * Okta group rules may call `isMemberOfGroupNameRegex("<pattern>")`. The pattern
 * is written by whoever administers the tenant, and this extension evaluates the
 * rule client-side against every group name it has loaded. Handing such a pattern
 * to `new RegExp` and calling `.test()` hands an untrusted author a
 * catastrophic-backtracking lever pointed at the side panel's single thread:
 * `(a+)+$` against a few dozen characters is enough to hang it. So this module
 * never constructs a `RegExp` from tenant input. It parses the pattern itself,
 * compiles it to a Thompson NFA, and runs a simultaneous-state (breadth-first)
 * simulation that visits each input character exactly once. Cost is
 * `O(states x input)` with a hard ceiling on both — there is no input, and no
 * pattern inside the supported subset, that can make it take super-linear time.
 *
 * ## Match semantics: Java `matches()`, i.e. full match
 *
 * Okta evaluates group-rule expressions server-side on the JVM, and
 * `isMemberOfGroupNameRegex` uses `java.util.regex.Matcher.matches()` — which
 * requires the **entire** group name to match the pattern, not a substring.
 * `matchSafeRegex('SecOps-.*', 'X-SecOps-Alpha')` is therefore `false`, exactly as
 * the Okta rule engine would decide. `^` and `$` are accepted and are simply
 * redundant under those semantics; they are still honoured positionally, so a
 * mid-pattern `^` (e.g. `a|^b`) asserts offset 0 rather than being ignored.
 *
 * ## Supported subset (Java-regex flavoured)
 *
 * ```text
 * alternation := concat ('|' concat)*
 * concat      := repeat*                       (* empty alternate is legal: "a|" *)
 * repeat      := atom ( '*' | '+' | '?' )?     (* exactly one quantifier *)
 * atom        := '(' alternation ')'
 *              | '(?:' alternation ')'
 *              | '[' '^'? classItem+ ']'
 *              | '.' | '^' | '$'
 *              | escape
 *              | literal
 * classItem   := classAtom '-' classAtom | classAtom
 * classAtom   := escape | literal
 * escape      := '\' ( 'd' | 'D' | 'w' | 'W' | 's' | 'S' )   (* shorthand class *)
 *              | '\' metacharacter                            (* literal *)
 * metacharacter := one of  . \ - ( ) [ ] { } * + ? | ^ $ /
 * ```
 *
 * Groups are non-capturing in effect: nothing in this engine captures, so `(...)`
 * and `(?:...)` compile identically.
 *
 * ## Deliberately declined (never guessed)
 *
 * Backreferences (`\1`), lookaround (`(?=`, `(?!`, `(?<=`, `(?<!`), bounded
 * repetition (`{n,m}`), inline flags (`(?i)`), named groups (`(?<n>)`), unicode
 * property escapes (`\p{L}`), lazy (`a*?`) and possessive (`a*+`) quantifiers,
 * character-class union/intersection (`[a[b]]`, `[a&&b]`), the empty class `[]`,
 * control escapes (`\n`, `\t`, `\b`, `\Q...\E`), and every other escape. Anything
 * outside the grammar above produces a structured decline. A decline is not a
 * "no match": callers must treat the two as different outcomes, because a
 * declined pattern is one this engine has no opinion about.
 *
 * ## Known, documented divergences from the JVM
 *
 * - `\s` follows Java's ASCII definition (space, tab, newline, vertical tab, form
 *   feed, carriage return), not JavaScript's Unicode-aware one. `\d` is `[0-9]`
 *   and `\w` is `[A-Za-z0-9_]`, which match both flavours.
 * - `.` excludes the Java line terminators: U+000A, U+000D, U+0085, U+2028, U+2029.
 * - Matching is code-point based, so `.` matches one astral character, as on the
 *   JVM (and unlike a non-unicode JavaScript `RegExp`).
 *
 * This module never throws and never logs: patterns and group names are tenant
 * data. Every failure is a value.
 */

/* ── Limits ──────────────────────────────────────────────────────────────── */

/** Longest tenant pattern this engine will parse, in code units. */
export const MAX_PATTERN_LENGTH = 256;

/** Longest input (group name) this engine will match against, in code units. */
export const MAX_INPUT_LENGTH = 512;

/**
 * Ceiling on compiled NFA states.
 *
 * Thompson construction is linear in pattern length with a constant below 1.5
 * states per character, so {@link MAX_PATTERN_LENGTH} already implies well under
 * this figure. It is kept as an independent backstop: if the grammar ever grows a
 * construct with a worse expansion factor, this fires instead of the allocator.
 */
export const MAX_NFA_STATES = 512;

/**
 * Ceiling on simulation work units (one unit is roughly one state visit).
 *
 * The simulation is already `O(states x input)` with per-position deduplication,
 * which the two caps above bound at roughly 262k. This budget is belt and
 * braces — it makes the linear-time guarantee enforced rather than merely
 * argued.
 */
export const MAX_SIMULATION_STEPS = 250_000;

/** The four ceilings, as one overridable bundle. */
export interface SafeRegexLimits {
  /** @see {@link MAX_PATTERN_LENGTH} */
  readonly maxPatternLength: number;
  /** @see {@link MAX_NFA_STATES} */
  readonly maxNfaStates: number;
  /** @see {@link MAX_INPUT_LENGTH} */
  readonly maxInputLength: number;
  /** @see {@link MAX_SIMULATION_STEPS} */
  readonly maxSimulationSteps: number;
}

/** The default limits, built from the exported constants. */
export const SAFE_REGEX_LIMITS: SafeRegexLimits = {
  maxPatternLength: MAX_PATTERN_LENGTH,
  maxNfaStates: MAX_NFA_STATES,
  maxInputLength: MAX_INPUT_LENGTH,
  maxSimulationSteps: MAX_SIMULATION_STEPS,
};

function resolveLimits(overrides?: Partial<SafeRegexLimits>): SafeRegexLimits {
  if (!overrides) return SAFE_REGEX_LIMITS;
  // Overrides may only TIGHTEN a cap. The constants are the ReDoS guarantee;
  // a caller threading a config value through must not be able to raise them.
  return {
    maxPatternLength: Math.min(
      overrides.maxPatternLength ?? MAX_PATTERN_LENGTH,
      MAX_PATTERN_LENGTH,
    ),
    maxNfaStates: Math.min(overrides.maxNfaStates ?? MAX_NFA_STATES, MAX_NFA_STATES),
    maxInputLength: Math.min(overrides.maxInputLength ?? MAX_INPUT_LENGTH, MAX_INPUT_LENGTH),
    maxSimulationSteps: Math.min(
      overrides.maxSimulationSteps ?? MAX_SIMULATION_STEPS,
      MAX_SIMULATION_STEPS,
    ),
  };
}

/* ── Result types ────────────────────────────────────────────────────────── */

/**
 * Why the engine refused to answer.
 *
 * These are reason **codes**, not messages: a caller branches on the code and
 * renders its own copy, so wording can change without moving a gate.
 */
export type SafeRegexDeclineReason =
  /** The pattern is longer than {@link MAX_PATTERN_LENGTH}. */
  | 'pattern-too-long'
  /** The input is longer than {@link MAX_INPUT_LENGTH}. */
  | 'input-too-long'
  /** Valid regex syntax that this subset deliberately does not implement. */
  | 'unsupported-syntax'
  /** The pattern is malformed — unbalanced bracket, dangling quantifier, trailing backslash. */
  | 'parse-error'
  /** Compilation would exceed {@link MAX_NFA_STATES}. */
  | 'too-many-states'
  /** Simulation would exceed {@link MAX_SIMULATION_STEPS}. */
  | 'step-budget-exceeded'
  /** A defect inside the engine itself surfaced; the answer is withheld rather than guessed. */
  | 'internal-error';

/** A decline: the engine has no opinion, and says which guard stopped it. */
export interface SafeRegexDeclined {
  readonly kind: 'declined';
  readonly reason: SafeRegexDeclineReason;
}

/** An answer: the pattern ran, and either did or did not match the whole input. */
export interface SafeRegexMatch {
  readonly kind: 'match';
  readonly matched: boolean;
}

/** The three-valued outcome of a match attempt: matched, did not match, or declined. */
export type SafeRegexResult = SafeRegexMatch | SafeRegexDeclined;

/** A compiled pattern, reusable across many inputs. Opaque to callers. */
export interface CompiledSafeRegex {
  readonly kind: 'compiled';
  /** The pattern this program was compiled from, for cache keying. */
  readonly pattern: string;
  /** How many NFA states it occupies — the figure {@link MAX_NFA_STATES} bounds. */
  readonly stateCount: number;
  /** @internal The NFA itself. */
  readonly states: readonly NfaState[];
  /** @internal Index of the entry state. */
  readonly start: number;
}

/** Either a reusable program or the decline that stopped compilation. */
export type SafeRegexCompileResult = CompiledSafeRegex | SafeRegexDeclined;

function declined(reason: SafeRegexDeclineReason): SafeRegexDeclined {
  return { kind: 'declined', reason };
}

/* ── Character sets ──────────────────────────────────────────────────────── */

const CODE_POINT_MAX = 0x10ffff;

/** An inclusive code-point range. */
type Range = readonly [number, number];

/**
 * A set of code points: a sorted, merged range list, optionally complemented.
 * Negation is carried rather than folded so `[^...]` composes with `\D` cleanly.
 */
interface CharSet {
  readonly negated: boolean;
  readonly ranges: readonly Range[];
}

function normalise(ranges: readonly Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const [lo, hi] of sorted) {
    const last = merged[merged.length - 1];
    if (last && lo <= last[1] + 1) {
      if (hi > last[1]) merged[merged.length - 1] = [last[0], hi];
    } else {
      merged.push([lo, hi]);
    }
  }
  return merged;
}

function complement(ranges: readonly Range[]): Range[] {
  const merged = normalise(ranges);
  const out: Range[] = [];
  let cursor = 0;
  for (const [lo, hi] of merged) {
    if (lo > cursor) out.push([cursor, lo - 1]);
    cursor = hi + 1;
  }
  if (cursor <= CODE_POINT_MAX) out.push([cursor, CODE_POINT_MAX]);
  return out;
}

function set(ranges: readonly Range[]): CharSet {
  return { negated: false, ranges: normalise(ranges) };
}

const DIGIT_RANGES: Range[] = [[0x30, 0x39]];
const WORD_RANGES: Range[] = [
  [0x30, 0x39],
  [0x41, 0x5a],
  [0x5f, 0x5f],
  [0x61, 0x7a],
];
/** Java's `\s`: space, tab, newline, vertical tab, form feed, carriage return. */
const SPACE_RANGES: Range[] = [
  [0x09, 0x0d],
  [0x20, 0x20],
];
/** Java's line terminators, which `.` excludes. */
const LINE_TERMINATORS: Range[] = [
  [0x0a, 0x0a],
  [0x0d, 0x0d],
  [0x85, 0x85],
  [0x2028, 0x2029],
];

const SHORTHANDS: Readonly<Record<string, readonly Range[]>> = {
  d: DIGIT_RANGES,
  D: complement(DIGIT_RANGES),
  w: WORD_RANGES,
  W: complement(WORD_RANGES),
  s: SPACE_RANGES,
  S: complement(SPACE_RANGES),
};

const DOT: CharSet = { negated: true, ranges: normalise(LINE_TERMINATORS) };

/** Metacharacters a backslash may legally escape into a literal. */
const ESCAPABLE = new Set([
  '.',
  '\\',
  '-',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '*',
  '+',
  '?',
  '|',
  '^',
  '$',
  '/',
]);

function inSet(charSet: CharSet, codePoint: number): boolean {
  let hit = false;
  for (const [lo, hi] of charSet.ranges) {
    if (codePoint < lo) break;
    if (codePoint <= hi) {
      hit = true;
      break;
    }
  }
  return hit !== charSet.negated;
}

/* ── AST ─────────────────────────────────────────────────────────────────── */

type Node =
  | { readonly kind: 'empty' }
  | { readonly kind: 'char'; readonly set: CharSet }
  | { readonly kind: 'assert'; readonly at: 'start' | 'end' }
  | { readonly kind: 'concat'; readonly parts: readonly Node[] }
  | { readonly kind: 'alt'; readonly parts: readonly Node[] }
  | { readonly kind: 'repeat'; readonly op: '*' | '+' | '?'; readonly body: Node };

/** Internal control flow for parse/compile failure. Never escapes the module. */
class Refusal {
  constructor(readonly reason: SafeRegexDeclineReason) {}
}

function refuse(reason: SafeRegexDeclineReason): never {
  throw new Refusal(reason);
}

/* ── Parser ──────────────────────────────────────────────────────────────── */

/**
 * Recursive-descent parser over the pattern's code points.
 *
 * It only ever moves forward, so parsing is linear in pattern length; the
 * recursion depth is bounded by nesting depth, itself bounded by
 * {@link MAX_PATTERN_LENGTH}.
 */
class Parser {
  private index = 0;
  private readonly chars: string[];

  constructor(pattern: string) {
    this.chars = Array.from(pattern);
  }

  parse(): Node {
    const node = this.parseAlternation();
    // Only an unmatched ')' can stop the top-level alternation early.
    if (this.index < this.chars.length) refuse('parse-error');
    return node;
  }

  private peek(offset = 0): string | undefined {
    return this.chars[this.index + offset];
  }

  private next(): string {
    const ch = this.chars[this.index];
    if (ch === undefined) refuse('parse-error');
    this.index += 1;
    return ch;
  }

  private parseAlternation(): Node {
    const parts: Node[] = [this.parseConcat()];
    while (this.peek() === '|') {
      this.index += 1;
      parts.push(this.parseConcat());
    }
    return parts.length === 1 ? parts[0] : { kind: 'alt', parts };
  }

  private parseConcat(): Node {
    const parts: Node[] = [];
    for (;;) {
      const ch = this.peek();
      if (ch === undefined || ch === '|' || ch === ')') break;
      parts.push(this.parseRepeat());
    }
    if (parts.length === 0) return { kind: 'empty' };
    return parts.length === 1 ? parts[0] : { kind: 'concat', parts };
  }

  private parseRepeat(): Node {
    const atom = this.parseAtom();
    const ch = this.peek();
    if (ch !== '*' && ch !== '+' && ch !== '?') return atom;
    this.index += 1;
    if (atom.kind === 'assert') refuse('parse-error'); // `^*` — nothing to repeat
    const following = this.peek();
    // `a*?` (lazy) and `a*+` (possessive) are outside the subset. Lazy happens to
    // be acceptance-equivalent and possessive is not; both are declined rather
    // than silently reinterpreted.
    if (following === '?' || following === '+' || following === '*') refuse('unsupported-syntax');
    return { kind: 'repeat', op: ch, body: atom };
  }

  private parseAtom(): Node {
    const ch = this.next();
    switch (ch) {
      case '(':
        return this.parseGroup();
      case '[':
        return { kind: 'char', set: this.parseClass() };
      case '.':
        return { kind: 'char', set: DOT };
      case '^':
        return { kind: 'assert', at: 'start' };
      case '$':
        return { kind: 'assert', at: 'end' };
      case '*':
      case '+':
      case '?':
        return refuse('parse-error'); // quantifier with nothing to repeat
      case '{':
        return refuse('unsupported-syntax'); // bounded repetition
      case '\\':
        return this.parseEscapeNode();
      default:
        return literalNode(ch);
    }
  }

  private parseGroup(): Node {
    if (this.peek() === '?') {
      // `(?:` is the only supported prefix; `(?=`, `(?!`, `(?<`, `(?i)` are not.
      if (this.peek(1) !== ':') refuse('unsupported-syntax');
      this.index += 2;
    }
    const body = this.parseAlternation();
    if (this.peek() !== ')') refuse('parse-error'); // unbalanced '('
    this.index += 1;
    return body;
  }

  /** Parse one escape sequence outside a character class, as an AST node. */
  private parseEscapeNode(): Node {
    const resolved = this.parseEscape();
    return typeof resolved === 'number'
      ? { kind: 'char', set: set([[resolved, resolved]]) }
      : { kind: 'char', set: resolved };
  }

  /**
   * Resolve `\x` to either a single code point (a literal) or a shorthand set.
   * Shared by the top-level and in-class parsers so both agree on the subset.
   */
  private parseEscape(): number | CharSet {
    if (this.index >= this.chars.length) refuse('parse-error'); // trailing backslash
    const ch = this.next();
    const shorthand = Object.prototype.hasOwnProperty.call(SHORTHANDS, ch)
      ? SHORTHANDS[ch]
      : undefined;
    if (shorthand) return set(shorthand);
    if (ESCAPABLE.has(ch)) {
      const cp = ch.codePointAt(0);
      if (cp === undefined) refuse('parse-error');
      return cp;
    }
    // `\1` backreference, `\p{L}` property, `\b` boundary, `\n` control, ...
    return refuse('unsupported-syntax');
  }

  private parseClass(): CharSet {
    const negated = this.peek() === '^';
    if (negated) this.index += 1;
    if (this.peek() === ']') refuse('parse-error'); // `[]` / `[^]` — an error on the JVM
    const ranges: Range[] = [];
    for (;;) {
      const ch = this.peek();
      if (ch === undefined) refuse('parse-error'); // unbalanced '['
      if (ch === ']') break;
      if (ch === '[') refuse('unsupported-syntax'); // class union
      if (ch === '&' && this.peek(1) === '&') refuse('unsupported-syntax'); // intersection
      const lo = this.parseClassAtom();
      if (typeof lo !== 'number') {
        ranges.push(...lo.ranges);
        continue;
      }
      if (this.peek() === '-' && this.peek(1) !== undefined && this.peek(1) !== ']') {
        this.index += 1;
        const hi = this.parseClassAtom();
        if (typeof hi !== 'number') refuse('parse-error'); // `[a-\d]`
        if (hi < lo) refuse('parse-error'); // reversed range
        ranges.push([lo, hi]);
      } else {
        ranges.push([lo, lo]);
      }
    }
    this.index += 1; // consume ']'
    return { negated, ranges: normalise(ranges) };
  }

  private parseClassAtom(): number | CharSet {
    const ch = this.next();
    if (ch === '\\') return this.parseEscape();
    const cp = ch.codePointAt(0);
    if (cp === undefined) refuse('parse-error');
    return cp;
  }
}

function literalNode(ch: string): Node {
  const cp = ch.codePointAt(0);
  if (cp === undefined) refuse('parse-error');
  return { kind: 'char', set: set([[cp, cp]]) };
}

/* ── NFA ─────────────────────────────────────────────────────────────────── */

/**
 * One Thompson NFA state.
 *
 * `char` consumes a code point; `split` is a two-way epsilon branch; the two
 * `assert-*` kinds are position-conditional epsilons; `match` accepts.
 */
interface NfaState {
  readonly kind: 'char' | 'split' | 'assert-start' | 'assert-end' | 'match';
  readonly set?: CharSet;
  next: number;
  alt: number;
}

/**
 * Compile the AST backwards from a known exit state.
 *
 * Building with an explicit continuation removes the patch lists of the classic
 * formulation, and makes the state count exactly the sum of the per-construct
 * costs: one state per literal or class, one split per quantifier, and `n - 1`
 * splits for an `n`-way alternation. Groups cost nothing.
 */
class Builder {
  readonly states: NfaState[] = [];

  constructor(private readonly maxStates: number) {}

  private add(state: NfaState): number {
    if (this.states.length >= this.maxStates) refuse('too-many-states');
    this.states.push(state);
    return this.states.length - 1;
  }

  emit(node: Node, next: number): number {
    switch (node.kind) {
      case 'empty':
        return next;
      case 'char':
        return this.add({ kind: 'char', set: node.set, next, alt: -1 });
      case 'assert':
        return this.add({
          kind: node.at === 'start' ? 'assert-start' : 'assert-end',
          next,
          alt: -1,
        });
      case 'concat': {
        let entry = next;
        for (let i = node.parts.length - 1; i >= 0; i -= 1) {
          entry = this.emit(node.parts[i], entry);
        }
        return entry;
      }
      case 'alt': {
        let entry = this.emit(node.parts[node.parts.length - 1], next);
        for (let i = node.parts.length - 2; i >= 0; i -= 1) {
          const branch = this.emit(node.parts[i], next);
          entry = this.add({ kind: 'split', next: branch, alt: entry });
        }
        return entry;
      }
      case 'repeat':
        return this.emitRepeat(node.op, node.body, next);
    }
  }

  private emitRepeat(op: '*' | '+' | '?', body: Node, next: number): number {
    if (op === '?') {
      const branch = this.emit(body, next);
      return this.add({ kind: 'split', next: branch, alt: next });
    }
    // `*` and `+` share one split whose body loops back to it; the difference is
    // only whether the split or the body is the entry point.
    const split = this.add({ kind: 'split', next: -1, alt: next });
    const entry = this.emit(body, split);
    this.states[split].next = entry;
    return op === '*' ? split : entry;
  }
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Parse and compile a tenant pattern into a reusable NFA program.
 *
 * Compile once, match many: one group rule's pattern is tested against every
 * group name on screen, and compilation is the expensive half.
 *
 * @param pattern - The tenant-authored pattern, unanchored (full-match semantics
 *   are applied by the matcher, not by rewriting the pattern).
 * @param limits - Optional overrides for {@link SAFE_REGEX_LIMITS}. Callers
 *   normally omit this; tightening the caps is supported so a caller with a
 *   smaller budget can enforce it.
 * @returns A {@link CompiledSafeRegex}, or a {@link SafeRegexDeclined} naming the
 *   guard that stopped it. Never throws.
 *
 * @example
 * const program = compileSafeRegex('SecOps-.*');
 * if (program.kind === 'compiled') matchCompiled(program, 'SecOps-Alpha');
 */
export function compileSafeRegex(
  pattern: string,
  limits?: Partial<SafeRegexLimits>,
): SafeRegexCompileResult {
  const resolved = resolveLimits(limits);
  if (pattern.length > resolved.maxPatternLength) return declined('pattern-too-long');
  try {
    const ast = new Parser(pattern).parse();
    const builder = new Builder(resolved.maxNfaStates);
    const accept = builder.states.length;
    builder.states.push({ kind: 'match', next: -1, alt: -1 });
    const start = builder.emit(ast, accept);
    return {
      kind: 'compiled',
      pattern,
      stateCount: builder.states.length,
      states: builder.states,
      start,
    };
  } catch (error) {
    return declined(error instanceof Refusal ? error.reason : 'parse-error');
  }
}

/**
 * Run a compiled program against one input, with Java `matches()` semantics.
 *
 * The simulation advances a deduplicated set of active states one input code
 * point at a time. No state is visited twice per position, so the work is
 * bounded by `states x input` regardless of how the pattern nests its
 * quantifiers — `(a+)+` costs the same as `a+`.
 *
 * @param program - A program from {@link compileSafeRegex}.
 * @param input - The string to match in full (a group name).
 * @param limits - Optional overrides for {@link SAFE_REGEX_LIMITS}.
 * @returns `{ kind: 'match', matched }` when the engine has an answer, or a
 *   decline. Never throws.
 */
export function matchCompiled(
  program: CompiledSafeRegex,
  input: string,
  limits?: Partial<SafeRegexLimits>,
): SafeRegexResult {
  // Belt-and-braces: the simulation is index-safe by construction, but the
  // never-throws contract must not depend on that invariant surviving edits.
  try {
    return simulate(program, input, limits);
  } catch {
    return declined('internal-error');
  }
}

function simulate(
  program: CompiledSafeRegex,
  input: string,
  limits?: Partial<SafeRegexLimits>,
): SafeRegexResult {
  const resolved = resolveLimits(limits);
  if (input.length > resolved.maxInputLength) return declined('input-too-long');

  const codePoints: number[] = [];
  for (const ch of input) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined) codePoints.push(cp);
  }

  const { states } = program;
  const marks = new Int32Array(states.length).fill(-1);
  const stack: number[] = [];
  let steps = 0;
  let generation = 0;
  let budgetExceeded = false;

  /** Add a state and its epsilon closure to `list`, deduplicated per position. */
  const addState = (list: number[], entry: number, position: number): void => {
    stack.length = 0;
    stack.push(entry);
    while (stack.length > 0) {
      const index = stack.pop() as number;
      if (marks[index] === generation) continue;
      marks[index] = generation;
      steps += 1;
      if (steps > resolved.maxSimulationSteps) {
        budgetExceeded = true;
        return;
      }
      const state = states[index];
      switch (state.kind) {
        case 'split':
          stack.push(state.alt, state.next);
          break;
        case 'assert-start':
          if (position === 0) stack.push(state.next);
          break;
        case 'assert-end':
          if (position === codePoints.length) stack.push(state.next);
          break;
        default:
          list.push(index);
          break;
      }
    }
  };

  let current: number[] = [];
  let pending: number[] = [];
  addState(current, program.start, 0);
  if (budgetExceeded) return declined('step-budget-exceeded');

  for (let i = 0; i < codePoints.length; i += 1) {
    if (current.length === 0) break;
    const cp = codePoints[i];
    generation += 1;
    pending.length = 0;
    for (const index of current) {
      const state = states[index];
      steps += 1;
      if (steps > resolved.maxSimulationSteps) return declined('step-budget-exceeded');
      if (state.kind !== 'char' || state.set === undefined) continue;
      if (!inSet(state.set, cp)) continue;
      addState(pending, state.next, i + 1);
      if (budgetExceeded) return declined('step-budget-exceeded');
    }
    const swap = current;
    current = pending;
    pending = swap;
  }

  const matched = current.some((index) => states[index].kind === 'match');
  return { kind: 'match', matched };
}

/**
 * Match a tenant pattern against one input, compiling it on the way.
 *
 * Convenience composition of {@link compileSafeRegex} and {@link matchCompiled}
 * for one-shot use. Matching many names against one pattern should compile once
 * instead.
 *
 * @param pattern - The tenant-authored pattern.
 * @param input - The string to match in full (a group name).
 * @param limits - Optional overrides for {@link SAFE_REGEX_LIMITS}.
 * @returns A matched/not-matched answer, or a structured decline. Never throws.
 *
 * @example
 * matchSafeRegex('SecOps-.*', 'SecOps-Alpha');   // { kind: 'match', matched: true }
 * matchSafeRegex('SecOps-.*', 'X-SecOps-Alpha'); // { kind: 'match', matched: false }
 * matchSafeRegex('(a)\\1', 'aa');                // { kind: 'declined', reason: 'unsupported-syntax' }
 */
export function matchSafeRegex(
  pattern: string,
  input: string,
  limits?: Partial<SafeRegexLimits>,
): SafeRegexResult {
  const program = compileSafeRegex(pattern, limits);
  if (program.kind === 'declined') return program;
  return matchCompiled(program, input, limits);
}
