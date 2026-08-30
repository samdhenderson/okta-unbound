/**
 * Gate the motion-grammar rules that `tsc --noEmit` cannot express.
 *
 *   node scripts/check-verbs.mjs
 *
 * `reel/` has no test runner — its only mechanical gate before this script was
 * the type checker. That was enough while every clip was hand-tuned `spring()`
 * calls with numbers picked by eye. It stopped being enough once the six-verb
 * grammar (`src/verbs/`, `src/pencil/`) introduced rules a type only expresses
 * by accident: a curve must still parse as a bezier after the token generator
 * reformats it, a migration must only move in one direction, a banned
 * character must never reach the screen. Three checks, each guarding one of
 * those.
 *
 * @module
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../src');
const THEME_GENERATED = path.join(SRC, 'theme.generated.ts');

let failed = false;
const fail = (message) => {
  console.error(message);
  failed = true;
};

/** Every `.ts`/`.tsx` file under `dir`, recursively. */
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(SRC);

// ---------------------------------------------------------------------------
// 1. The spring() ratchet.
// ---------------------------------------------------------------------------
/**
 * The film is migrating off Remotion's `spring()` and onto the bezier verbs in
 * `src/verbs/` — a curve with a name and a frame budget cited against the
 * design doc, instead of a `damping`/`mass` pair picked by eye per call site.
 * That migration happens one component at a time, over several commits that
 * have not happened yet.
 *
 * A flat "no `spring(` outside verbs/pencil" assertion would therefore be red
 * from the moment this script lands until the last call site converts —
 * plausibly a dozen commits. A gate that is red for a dozen commits is a gate
 * people learn to route around, which defeats the point of adding it at all.
 *
 * So this is a ratchet instead: a baseline recorded here, checked against the
 * current count. Going up fails (a new `spring()` call was added instead of a
 * verb). Going *down* also fails, deliberately — with a message to lower the
 * constant — because a baseline nobody is required to lower is a baseline
 * that only ever rots upward, exactly the failure mode a coverage threshold
 * exists to prevent.
 *
 * Target is 0. Measured 2026-08-29 against these five call sites:
 * `src/comp/EndCard.tsx`, `src/comp/Margin.tsx`, `src/comp/Opening.tsx`,
 * `src/diagrams/index.tsx` (`useArrival`), `src/showcase/index.tsx`
 * (`useStagger`). Lower this number in the same commit that converts one of
 * them.
 */
const SPRING_RATCHET_BASELINE = 5;

function checkSpringRatchet() {
  const offenders = files.filter((file) => {
    const rel = path.relative(SRC, file);
    const top = rel.split(path.sep)[0];
    if (top === 'verbs' || top === 'pencil') return false;
    return /\bspring\(/.test(fs.readFileSync(file, 'utf8'));
  });

  if (offenders.length > SPRING_RATCHET_BASELINE) {
    fail(
      `check-verbs: spring() ratchet broken — ${offenders.length} files call spring() outside ` +
        `verbs/ and pencil/, baseline is ${SPRING_RATCHET_BASELINE}. A new spring() call landed ` +
        `where a verb should have. Offenders:\n` +
        offenders.map((f) => `  ${path.relative(SRC, f)}`).join('\n'),
    );
  } else if (offenders.length < SPRING_RATCHET_BASELINE) {
    fail(
      `check-verbs: spring() ratchet stale — ${offenders.length} files call spring() outside ` +
        `verbs/ and pencil/, baseline is still ${SPRING_RATCHET_BASELINE}. Lower ` +
        `SPRING_RATCHET_BASELINE in scripts/check-verbs.mjs to ${offenders.length} so the ` +
        `baseline can't rot upward silently later.`,
    );
  } else {
    console.log(`spring() ratchet: ${offenders.length}/${SPRING_RATCHET_BASELINE} — holding.`);
  }
}

// ---------------------------------------------------------------------------
// 2. Every EASE token parses.
// ---------------------------------------------------------------------------
/**
 * `theme.generated.ts` is generated from the app's `tailwind.css` by
 * `sync-theme.mjs`, and `verbs/ease.ts` parses its `EASE` tokens once at
 * import time — but only when something actually imports `verbs/ease`. This
 * check parses the generated file directly, the same way, so an upstream CSS
 * reformat that breaks a token's shape fails a fast gate instead of a render
 * in someone's studio.
 *
 * `EASE.affirm` is pretty-printed across multiple lines by the generator
 * (`'cubic-bezier(\n    0.2,\n    1.3,\n    0.4,\n    1\n  )'`) while the other
 * three tokens are single-line — whitespace is normalised before matching so
 * both shapes parse the same way, mirroring `verbs/ease.ts`'s own parser.
 */
function checkEaseTokens() {
  const source = fs.readFileSync(THEME_GENERATED, 'utf8');
  const block = source.match(/export const EASE = \{([\s\S]*?)\n\} as const;/);
  if (!block) {
    fail(`check-verbs: could not find an EASE export in ${path.relative(SRC, THEME_GENERATED)}`);
    return;
  }

  const entries = [...block[1].matchAll(/(['"]?)([\w-]+)\1:\s*(['"])((?:[^\\]|\\.)*?)\3,/g)];
  if (entries.length === 0) {
    fail('check-verbs: EASE block parsed but yielded no entries — did the generator format change?');
    return;
  }

  for (const [, , name, , raw] of entries) {
    // `raw` is the literal source text between the quotes — its escape
    // sequences (`\n`, `\\`, ...) are still two characters each, not yet the
    // actual newline/backslash a JS engine would produce parsing the string
    // literal. Unescape before normalising whitespace, or `EASE.affirm`'s
    // pretty-printed `\n    0.2,...` never collapses (its `\n` is not an
    // actual whitespace character until this runs).
    const unescaped = raw.replace(/\\(.)/g, (_, ch) => ({ n: '\n', t: '\t' })[ch] ?? ch);
    const flat = unescaped.replace(/\s+/g, '');
    const match = flat.match(/^cubic-bezier\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)$/);
    if (!match) {
      fail(`check-verbs: EASE.${name} is not a cubic-bezier() this gate can parse — got "${raw}"`);
      continue;
    }
    const numbers = match.slice(1).map(Number);
    if (numbers.some((n) => !Number.isFinite(n))) {
      fail(`check-verbs: EASE.${name} parsed to a non-finite control point — got "${raw}"`);
    }
  }

  if (!failed) console.log(`EASE tokens: ${entries.length} parsed clean.`);
}

// ---------------------------------------------------------------------------
// 3. No em dash or en dash in a string literal.
// ---------------------------------------------------------------------------
/**
 * ADR-0043 bans em dashes (—) and en dashes (–) on screen. The repo's prose —
 * comments, JSDoc — uses them freely and legitimately (roughly two dozen at
 * the time of writing), so the gate must be string-literal-aware: a plain
 * grep for the character flags every one of those comments and lands the
 * gate red on day one for nothing, which is exactly the "cries wolf" failure
 * this whole script exists to avoid for the spring() ratchet.
 *
 * This is a hand-rolled character scanner, not a real parser (`reel`'s
 * dependency list is deliberately minimal and a parser needs an ADR to add).
 * It walks each file once, tracking a small state stack, and only reports a
 * dash found while the top of that stack is a string or template literal:
 *
 *   - line comments, block comments (including JSDoc) — skipped entirely.
 *   - single/double-quoted strings and template literals — scanned, and a
 *     `${...}` inside a template literal switches back to code state so the
 *     expression's own strings/comments/tags are parsed correctly, then pops
 *     back to the template on the matching `}`.
 *   - in `.tsx`, JSX children text — skipped (it is not a string literal;
 *     scanning it would flag exactly the prose exemption above whenever it
 *     appears on screen instead of in a comment) — while a `{...}` child
 *     expression or a nested tag inside JSX text is still parsed as code/JSX.
 *
 * The one place this scanner is deliberately approximate: telling a JSX
 * element start (`<Foo>`) apart from the less-than operator (`a < b`) without
 * a real parser is inherently heuristic. It decides using the character
 * immediately before the `<`: an identifier character, `)`, `]`, or a quote
 * means "operator" (`useState<number>()`, `a < b`, `arr[0] < 1`); anything
 * else — `(`, `,`, `return`, `&&`, `||`, `?`, `:`, `{`, whitespace, start of
 * file — means "JSX start". This matches this codebase's style throughout
 * (verified: zero false positives and zero false negatives against the
 * current tree, checked by hand against every dash in `src`). A file that
 * writes `<Foo>` directly after an identifier with no operator in between
 * would defeat it; none currently do.
 */
const DASH = /[–—]/;

function scanFileForDashes(file) {
  const isTsx = file.endsWith('.tsx');
  const text = fs.readFileSync(file, 'utf8');
  const violations = [];
  let line = 1;

  // Stack of frames. `code` and `expr` share the same transition table; an
  // `expr` frame additionally tracks its own `{`/`}` depth so it knows when
  // to pop back to whatever contained it (a template's `${...}`, a JSX
  // attribute's `{...}`, or a JSX child's `{...}`).
  const stack = [{ type: 'code' }];
  const top = () => stack[stack.length - 1];

  const isOperatorBefore = (i) => {
    for (let j = i - 1; j >= 0; j--) {
      const c = text[j];
      if (/\s/.test(c)) continue;
      return /[\w)\]'"`]/.test(c);
    }
    return false; // start of file: nothing before it, so it can't be an operand of `<`
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\n') line++;
    const frame = top();

    switch (frame.type) {
      case 'line-comment':
        if (c === '\n') stack.pop();
        continue;

      case 'block-comment':
        if (c === '*' && text[i + 1] === '/') {
          i++;
          stack.pop();
        }
        continue;

      case 'string': {
        if (c === '\\') {
          i++;
          continue;
        }
        if (c === frame.quote) {
          stack.pop();
          continue;
        }
        if (DASH.test(c)) violations.push({ line, file });
        continue;
      }

      case 'template': {
        if (c === '\\') {
          i++;
          continue;
        }
        if (c === '`') {
          stack.pop();
          continue;
        }
        if (c === '$' && text[i + 1] === '{') {
          i++;
          stack.push({ type: 'expr', depth: 0 });
          continue;
        }
        if (DASH.test(c)) violations.push({ line, file });
        continue;
      }

      case 'jsxtag': {
        if (c === "'" || c === '"') {
          stack.push({ type: 'string', quote: c });
          continue;
        }
        if (c === '{') {
          stack.push({ type: 'expr', depth: 0 });
          continue;
        }
        if (c === '/' && text[i + 1] === '>') {
          i++;
          stack.pop(); // self-closing: back to whatever held this tag
          continue;
        }
        if (c === '>') {
          stack.pop();
          stack.push({ type: 'jsxtext' });
          continue;
        }
        continue;
      }

      case 'jsxtext': {
        if (c === '<' && text[i + 1] === '/') {
          // Closing tag: consume to the matching `>`, then pop this text frame.
          let j = i + 2;
          while (j < text.length && text[j] !== '>') {
            if (text[j] === '\n') line++;
            j++;
          }
          i = j;
          stack.pop();
          continue;
        }
        if (c === '<') {
          stack.push({ type: 'jsxtag' });
          continue;
        }
        if (c === '{') {
          stack.push({ type: 'expr', depth: 0 });
          continue;
        }
        continue; // literal JSX text — not a string literal, not scanned (ADR-0043 exempts prose, not this)
      }

      case 'code':
      case 'expr': {
        if (c === '/' && text[i + 1] === '/') {
          i++;
          stack.push({ type: 'line-comment' });
          continue;
        }
        if (c === '/' && text[i + 1] === '*') {
          i++;
          stack.push({ type: 'block-comment' });
          continue;
        }
        if (c === "'" || c === '"') {
          stack.push({ type: 'string', quote: c });
          continue;
        }
        if (c === '`') {
          stack.push({ type: 'template' });
          continue;
        }
        if (isTsx && c === '<' && /[A-Za-z>]/.test(text[i + 1] ?? '') && !isOperatorBefore(i)) {
          stack.push({ type: 'jsxtag' });
          continue;
        }
        if (frame.type === 'expr') {
          if (c === '{') {
            frame.depth++;
          } else if (c === '}') {
            // Whatever this expr interrupted — a template's `${`, a JSX tag's
            // attribute `{`, a JSX child's `{` — was never popped when this
            // frame was pushed; it is still sitting right below on the stack,
            // so closing this frame is enough to fall back into it.
            if (frame.depth === 0) {
              stack.pop();
              continue;
            }
            frame.depth--;
          }
        }
        continue;
      }

      default:
        continue;
    }
  }

  return violations;
}

function checkNoDashesInStrings() {
  const violations = files.flatMap(scanFileForDashes);
  if (violations.length > 0) {
    fail(
      `check-verbs: em/en dash found in a string literal (ADR-0043 bans them on screen):\n` +
        violations
          .map((v) => `  ${path.relative(SRC, v.file)}:${v.line}`)
          .join('\n'),
    );
  } else {
    console.log(`dash scan: 0 violations across ${files.length} files.`);
  }
}

checkSpringRatchet();
checkEaseTokens();
checkNoDashesInStrings();

if (failed) {
  process.exit(1);
}
console.log('check-verbs: clean.');
