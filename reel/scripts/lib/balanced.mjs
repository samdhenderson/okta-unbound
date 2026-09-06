/**
 * A hand-rolled bracket/string/comment scanner for TypeScript source text.
 *
 * Every reel build script that needs data out of a `.ts` file reads it as
 * text rather than importing it. See the module docs on `sync-theme.mjs` and
 * `check-verbs.mjs`: Node's ESM loader cannot resolve `script.ts`'s
 * extensionless relative imports (`from './captures'`) without a custom
 * loader, and this repo's script tooling stays loader-free and dependency-free
 * on purpose (`check-verbs.mjs`: "reel's dependency list is deliberately
 * minimal and a parser needs an ADR to add").
 *
 * `vo-budget.mjs` and `check-vo.mjs` both need to pull the shape of `SCRIPT`
 * (scene ids, act order, capture ids, beat plans) out of `script.ts` without
 * evaluating it (the file's marks carry real functions, and JSX-free or not,
 * this is still "don't eval a repo file to build a report"). That needs
 * finding where one bracket ends and splitting a comma list at its own
 * nesting depth, which a plain regex cannot do reliably once strings or
 * nested arrays are involved. This is the minimum scanner that gets that
 * right: it tracks whether it is inside a line comment, a block comment, a
 * quoted string, or a template literal, and only counts brackets and commas
 * while in plain code. `script.ts` is a `.ts` file with no JSX (marks build
 * elements with `React.createElement`, never `<Foo />`), so unlike
 * `check-verbs.mjs`'s dash scanner this one does not need to tell a JSX tag
 * apart from a `<` operator.
 *
 * @module
 */

const OPEN = { '{': '}', '[': ']', '(': ')' };
const CLOSE = new Set(Object.values(OPEN));

/**
 * Find the index of the bracket that closes the one at `openIndex`.
 *
 * @param {string} text
 * @param {number} openIndex Index of a `{`, `[` or `(` in `text`.
 * @returns {number} Index of the matching closing bracket.
 * @throws when the bracket never closes. That is a sign this file's shape
 *   changed underneath the scanner, rather than a bug in the caller's index.
 */
export function findMatch(text, openIndex) {
  const wants = OPEN[text[openIndex]];
  if (!wants) {
    throw new Error(`findMatch: text[${openIndex}] is "${text[openIndex]}", not an opening bracket`);
  }
  let depth = 0;
  let mode = 'code';
  let quote = null;

  for (let i = openIndex; i < text.length; i += 1) {
    const c = text[i];
    const two = text.slice(i, i + 2);

    if (mode === 'line-comment') {
      if (c === '\n') mode = 'code';
      continue;
    }
    if (mode === 'block-comment') {
      if (two === '*/') {
        i += 1;
        mode = 'code';
      }
      continue;
    }
    if (mode === 'string') {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if (c === quote) mode = 'code';
      continue;
    }

    // mode === 'code'
    if (two === '//') {
      mode = 'line-comment';
      i += 1;
      continue;
    }
    if (two === '/*') {
      mode = 'block-comment';
      i += 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      mode = 'string';
      quote = c;
      continue;
    }
    if (c in OPEN) {
      depth += 1;
      continue;
    }
    if (CLOSE.has(c)) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error(`findMatch: bracket opened at ${openIndex} never closed`);
}

/**
 * Split `text` on commas that sit at nesting depth 0 and outside any string
 * or comment. `text` is the *inner* content of a `[...]` or `{...}`, no
 * surrounding brackets.
 *
 * @param {string} text
 * @returns {string[]} Trimmed, non-empty segments, in order.
 */
export function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let mode = 'code';
  let quote = null;
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const two = text.slice(i, i + 2);

    if (mode === 'line-comment') {
      if (c === '\n') mode = 'code';
      continue;
    }
    if (mode === 'block-comment') {
      if (two === '*/') {
        i += 1;
        mode = 'code';
      }
      continue;
    }
    if (mode === 'string') {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if (c === quote) mode = 'code';
      continue;
    }

    if (two === '//') {
      mode = 'line-comment';
      i += 1;
      continue;
    }
    if (two === '/*') {
      mode = 'block-comment';
      i += 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      mode = 'string';
      quote = c;
      continue;
    }
    if (c in OPEN) {
      depth += 1;
      continue;
    }
    if (CLOSE.has(c)) {
      depth -= 1;
      continue;
    }
    if (c === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  const last = text.slice(start);
  return [...parts, last].map((s) => s.trim()).filter((s) => s.length > 0);
}
