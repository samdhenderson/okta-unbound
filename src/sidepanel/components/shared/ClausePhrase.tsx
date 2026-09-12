/**
 * @module sidepanel/components/shared/ClausePhrase
 * @description One leaf clause stated as a sentence — **department**
 * (lowercased) equals `"sales"` — instead of as the Okta expression it came
 * from, `String.toLowerCase(user.department) == "sales"`.
 *
 * ## The wording lives here; the decision lives in the type
 *
 * Everything this module renders is composed from a
 * {@link module:shared/rules/explainExpression.LeafPredicate}: a closed set of
 * forms, operators and transforms recognised syntactically off the clause's own
 * AST. No copy is parsed, and nothing branches on a display string
 * (`docs/claims.md`), so the wording below can be rewritten without moving a
 * gate — and a predicate the explainer could not state exactly is simply absent,
 * at which point the caller prints the clause text instead.
 *
 * ## It asserts, it does not hedge
 *
 * Every phrase states what the rule asks. There is no "probably", no "≈", and no
 * `?`-suffixed label: the predicate is an exact reading of the clause or it does
 * not exist. The clause's *outcome* is the chip beside it, never a qualifier
 * inside the sentence.
 *
 * ## Security
 *
 * The attribute path and every operand are untrusted, end-user-controllable
 * tenant data (rule text and profile values). They are rendered as React text,
 * escaped — never `dangerouslySetInnerHTML`, never a hand-built HTML string —
 * and never logged; this module logs nothing.
 */
import React from 'react';
import type {
  ComparisonOperator,
  LeafPredicate,
  SubjectDescription,
  SubjectTransform,
} from '../../../shared/rules/explainExpression';
import type { RuleExprValue } from '../../../shared/ruleEvaluator';
import { formatRuleValue } from './ruleValueText';

/**
 * Transforms that read as a parenthetical after the attribute name —
 * **department** (lowercased).
 */
const TRANSFORM_PARENTHETICAL: Partial<Record<SubjectTransform, string>> = {
  toLowerCase: 'lowercased',
  toUpperCase: 'uppercased',
  removeSpaces: 'spaces removed',
  toCsvString: 'joined as text',
};

/**
 * Transforms that read as a prefix instead, because they change *what the
 * sentence is about*: `String.len(user.x) > 3` asks about the length, not about
 * `x`.
 */
const TRANSFORM_PREFIX: Partial<Record<SubjectTransform, string>> = {
  len: 'length of',
  size: 'count of',
};

/** Comparison → the words for it. The only vocabulary; no synonyms elsewhere. */
const OPERATOR_WORDS: Record<ComparisonOperator, string> = {
  eq: 'equals',
  ne: 'does not equal',
  lt: 'is less than',
  lte: 'is at most',
  gt: 'is greater than',
  gte: 'is at least',
};

/**
 * The attribute's name as a reader says it: `user.department` → `department`,
 * `user["cost center"]` → `cost center`.
 *
 * The `user.` prefix is dropped because the subject of every sentence here *is*
 * the user; the evidence line under the clause still prints the full path, so
 * nothing is lost. A path in neither normalised shape is printed verbatim
 * rather than trimmed by guesswork.
 */
function attributeDisplayName(path: string): string {
  const dotted = /^user\.(.+)$/.exec(path);
  if (dotted?.[1]) return dotted[1];
  const computed = /^user\[(".*")\]$/.exec(path);
  if (computed?.[1]) {
    try {
      const parsed: unknown = JSON.parse(computed[1]);
      if (typeof parsed === 'string') return parsed;
    } catch {
      // Fall through: an unparseable key is printed as written rather than guessed at.
    }
  }
  return path;
}

/** One operand, in the same mono treatment the evidence lines use. */
const OperandText: React.FC<{ value: RuleExprValue }> = ({ value }) => (
  <span className="font-mono text-xs text-neutral-700">{formatRuleValue(value)}</span>
);

/**
 * The subject of a phrase: the attribute name in bold, its prefix transforms
 * outermost-first before it, and its parenthetical transforms innermost-first
 * after it.
 */
const SubjectText: React.FC<{ subject: SubjectDescription }> = ({ subject }) => {
  // `transforms` is innermost-first, so the outermost prefix — the one the
  // sentence leads with — is the last entry.
  const prefixes = [...subject.transforms]
    .reverse()
    .map((transform) => TRANSFORM_PREFIX[transform])
    .filter((word): word is string => word !== undefined);
  const parentheticals = subject.transforms
    .map((transform) => TRANSFORM_PARENTHETICAL[transform])
    .filter((word): word is string => word !== undefined);

  return (
    <>
      {prefixes.length > 0 && `${prefixes.join(' ')} `}
      <b className="font-semibold">{attributeDisplayName(subject.path)}</b>
      {parentheticals.length > 0 && ` (${parentheticals.join(', ')})`}
    </>
  );
};

/** The verb of the three substring forms and of `Arrays.contains`, with its polarity. */
function membershipVerb(form: LeafPredicate['form'], negated: boolean): string {
  switch (form) {
    case 'starts-with':
      return negated ? 'does not start with' : 'starts with';
    case 'ends-with':
      return negated ? 'does not end with' : 'ends with';
    case 'array-contains':
      return negated ? 'does not include' : 'includes';
    default:
      return negated ? 'does not contain' : 'contains';
  }
}

/** The sentence for one predicate. */
const PhraseBody: React.FC<{ predicate: LeafPredicate }> = ({ predicate }) => {
  switch (predicate.form) {
    case 'compare':
      return (
        <>
          <SubjectText subject={predicate.subject} /> {OPERATOR_WORDS[predicate.operator]}{' '}
          <OperandText value={predicate.operand} />
        </>
      );
    case 'compare-subjects':
      return (
        <>
          <SubjectText subject={predicate.left} /> {OPERATOR_WORDS[predicate.operator]}{' '}
          <SubjectText subject={predicate.right} />
        </>
      );
    case 'contains':
    case 'starts-with':
    case 'ends-with':
    case 'array-contains':
      return (
        <>
          <SubjectText subject={predicate.subject} />{' '}
          {membershipVerb(predicate.form, predicate.negated)}{' '}
          <OperandText value={predicate.operand} />
        </>
      );
    case 'empty':
      return (
        <>
          <SubjectText subject={predicate.subject} />{' '}
          {predicate.negated ? 'is not empty' : 'is empty'}
        </>
      );
    case 'boolean-attribute':
      // The evaluator resolves a bare-attribute clause only when the attribute
      // really is a boolean, so "is true"/"is false" is exact rather than a
      // reading of truthiness.
      return (
        <>
          <SubjectText subject={predicate.subject} /> {predicate.negated ? 'is false' : 'is true'}
        </>
      );
  }
};

/** Props for {@link ClausePhrase}. */
export interface ClausePhraseProps {
  /** The structured description to state in words. */
  predicate: LeafPredicate;
  /** Layout classes only — spacing and min-width. The type treatment is this component's. */
  className?: string;
}

/**
 * One leaf clause as a sentence, composed from its
 * {@link module:shared/rules/explainExpression.LeafPredicate}.
 *
 * Every form it can state has a story of its own; {@link ClauseLedgerClause} —
 * its only caller — shows the same sentences inside a clause row, beside the
 * outcome chip and the evidence.
 *
 * @param props - See {@link ClausePhraseProps}.
 *
 * @example
 * // predicate: { form: 'compare', subject: { path: 'user.department',
 * //   transforms: ['toLowerCase'] }, operator: 'eq', operand: 'sales' }
 * // renders:   department (lowercased) equals "sales"
 */
const ClausePhrase: React.FC<ClausePhraseProps> = ({ predicate, className = '' }) => (
  <span className={`text-xs break-words text-neutral-900 ${className}`.trim()}>
    <PhraseBody predicate={predicate} />
  </span>
);

export default ClausePhrase;
