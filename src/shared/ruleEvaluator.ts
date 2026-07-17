/**
 * @module shared/ruleEvaluator
 * @description Best-effort client-side evaluator for Okta group-rule expressions.
 *
 * Parses the supported subset of Okta Expression Language (profile-attribute
 * comparisons joined by AND/OR) with a small recursive-descent parser and
 * evaluates it against a user profile — no dynamic code generation. Rule
 * expressions come from the Okta API and are untrusted input; they must never
 * reach `eval`/`new Function` (which the MV3 extension CSP forbids anyway).
 * Group-membership and app-context expressions cannot be resolved client-side —
 * gate calls with {@link canEvaluateClientSide} first.
 *
 * @see {@link evaluateRuleExpression}
 * @see {@link canEvaluateClientSide}
 */

import { createLogger } from './utils/logger';
import type { OktaUser } from './types';

const log = createLogger('RuleEvaluator');

/** A value an expression operand can resolve to. */
type ExprValue = string | number | boolean | null;

/** Thrown for any lexical or grammatical error; callers treat it as "no match". */
class ExpressionError extends Error {}

type Token =
  | { type: 'lparen' | 'rparen' | 'and' | 'or' | 'eq' | 'ne' }
  | { type: 'value'; value: ExprValue }
  | { type: 'attr'; name: string }
  | { type: 'func'; name: string };

/**
 * Tokenize a rule expression into the closed set of tokens the evaluator
 * understands. Anything outside that set is a hard {@link ExpressionError} —
 * unknown input is rejected, never executed.
 */
function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  const n = expression.length;
  let i = 0;

  const readString = (from: number, quote: string): { value: string; end: number } => {
    let out = '';
    let j = from;
    while (j < n && expression[j] !== quote) {
      if (expression[j] === '\\' && j + 1 < n) {
        out += expression[j + 1];
        j += 2;
      } else {
        out += expression[j];
        j++;
      }
    }
    if (j >= n) throw new ExpressionError('Unterminated string literal');
    return { value: out, end: j + 1 };
  };

  while (i < n) {
    const ch = expression[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (expression.startsWith('&&', i)) {
      tokens.push({ type: 'and' });
      i += 2;
      continue;
    }
    if (expression.startsWith('||', i)) {
      tokens.push({ type: 'or' });
      i += 2;
      continue;
    }
    if (expression.startsWith('===', i)) {
      tokens.push({ type: 'eq' });
      i += 3;
      continue;
    }
    if (expression.startsWith('!==', i)) {
      tokens.push({ type: 'ne' });
      i += 3;
      continue;
    }
    if (expression.startsWith('==', i)) {
      tokens.push({ type: 'eq' });
      i += 2;
      continue;
    }
    if (expression.startsWith('!=', i)) {
      tokens.push({ type: 'ne' });
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const { value, end } = readString(i + 1, ch);
      tokens.push({ type: 'value', value });
      i = end;
      continue;
    }

    const numMatch = /^-?\d+(\.\d+)?/.exec(expression.slice(i));
    if (numMatch) {
      tokens.push({ type: 'value', value: Number(numMatch[0]) });
      i += numMatch[0].length;
      continue;
    }

    const wordMatch = /^[a-zA-Z_][a-zA-Z0-9_.]*/.exec(expression.slice(i));
    if (wordMatch) {
      const word = wordMatch[0];
      const lower = word.toLowerCase();
      i += word.length;

      if (lower === 'and') tokens.push({ type: 'and' });
      else if (lower === 'or') tokens.push({ type: 'or' });
      else if (lower === 'eq') tokens.push({ type: 'eq' });
      else if (lower === 'ne') tokens.push({ type: 'ne' });
      else if (lower === 'null') tokens.push({ type: 'value', value: null });
      else if (lower === 'true') tokens.push({ type: 'value', value: true });
      else if (lower === 'false') tokens.push({ type: 'value', value: false });
      else if (word.startsWith('user.')) tokens.push({ type: 'attr', name: word.slice(5) });
      else {
        // A function call such as isMemberOfGroup("00g…"). Consume its argument
        // list (strings may contain parentheses) and keep only the name — the
        // parser resolves unsupported functions to `false`.
        while (i < n && /\s/.test(expression[i])) i++;
        if (expression[i] !== '(') {
          throw new ExpressionError(`Unsupported identifier: ${word}`);
        }
        let depth = 0;
        while (i < n) {
          const c = expression[i];
          if (c === '"' || c === "'") {
            i = readString(i + 1, c).end;
            continue;
          }
          if (c === '(') depth++;
          if (c === ')') depth--;
          i++;
          if (depth === 0) break;
        }
        if (depth !== 0) throw new ExpressionError('Unterminated function call');
        tokens.push({ type: 'func', name: word });
      }
      continue;
    }

    throw new ExpressionError(`Unexpected character: ${ch}`);
  }

  return tokens;
}

/**
 * Basic Okta Expression Language Evaluator (Client-Side)
 *
 * Takes a user object and a condition expression and returns whether the user matches.
 *
 * LIMITATIONS (Due to Okta Platform Constraints):
 * ─────────────────────────────────────────────────
 *
 * ❌ NOT SUPPORTED - These expressions CANNOT be evaluated client-side:
 *
 * 1. isMemberOfGroup() / isMemberOfAnyGroup() - Group membership checks
 *    WHY: Requires additional API calls per user to fetch their groups.
 *         Rate limits (600 req/min) make this impractical for large groups.
 *         USE canEvaluateClientSide() to detect these expressions.
 *
 * 2. app.* attributes - Application context
 *    WHY: App context is only available during authentication flows,
 *         not when evaluating group rules from the admin console.
 *
 * 3. Complex nested expressions or custom functions
 *    WHY: This is a simplified parser, not a full Okta EL implementation.
 *
 * ✅ SUPPORTED patterns:
 * - user.attribute == "value" or user.attribute eq "value"
 * - user.attribute != "value"
 * - Logical operators: AND, OR, parentheses
 * - Common profile attributes: department, title, userType, etc.
 */
export function evaluateRuleExpression(expression: string, user: OktaUser): boolean {
  if (!expression || !expression.trim()) return false;

  try {
    const tokens = tokenize(expression.trim());
    if (tokens.length === 0) return false;

    let pos = 0;
    const peek = (): Token | undefined => tokens[pos];
    const next = (): Token | undefined => tokens[pos++];

    const parseOr = (): ExprValue => {
      let left = parseAnd();
      while (peek()?.type === 'or') {
        next();
        const right = parseAnd();
        left = Boolean(left) || Boolean(right);
      }
      return left;
    };

    const parseAnd = (): ExprValue => {
      let left = parseComparison();
      while (peek()?.type === 'and') {
        next();
        const right = parseComparison();
        left = Boolean(left) && Boolean(right);
      }
      return left;
    };

    const parseComparison = (): ExprValue => {
      const left = parseOperand();
      const t = peek();
      if (t && (t.type === 'eq' || t.type === 'ne')) {
        next();
        const right = parseOperand();
        const equal = left === right;
        return t.type === 'eq' ? equal : !equal;
      }
      return left;
    };

    const parseOperand = (): ExprValue => {
      const t = next();
      if (!t) throw new ExpressionError('Unexpected end of expression');
      switch (t.type) {
        case 'lparen': {
          const value = parseOr();
          if (next()?.type !== 'rparen') throw new ExpressionError('Expected closing parenthesis');
          return value;
        }
        case 'value':
          return t.value;
        case 'attr': {
          const raw = user.profile[t.name];
          if (raw === undefined || raw === null) return null;
          if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
            return raw;
          }
          return String(raw);
        }
        case 'func':
          // Group-membership (and any other) functions need server context; treat
          // as non-matching rather than guessing.
          log.warn(
            `${t.name} is not fully supported in client-side evaluation without group list context`,
          );
          return false;
        default:
          throw new ExpressionError(`Unexpected token: ${t.type}`);
      }
    };

    const result = parseOr();
    if (pos !== tokens.length) throw new ExpressionError('Unexpected trailing tokens');
    return Boolean(result);
  } catch (err) {
    log.warn(`Failed to evaluate expression: "${expression}"`, err);
    return false;
  }
}

/**
 * Pre-validates if an expression can be safely evaluated client-side.
 *
 * Use this BEFORE calling evaluateRuleExpression() to avoid misleading results.
 * If this returns false, the UI should show "Cannot evaluate" rather than
 * showing incorrect match/no-match results.
 *
 * @returns true if the expression only uses supported patterns (user.* attributes)
 * @returns false if the expression uses unsupported patterns that would give wrong results
 */
export function canEvaluateClientSide(expression: string): boolean {
  if (!expression) return false;

  // Group membership checks require fetching user's groups - not available
  if (expression.includes('isMemberOf')) return false;

  // App context is only available during authentication, not admin operations
  if (expression.includes('app.')) return false;

  return true;
}
