/**
 * Read `SCRIPT`'s shape out of `src/script.ts`, as data, without evaluating it.
 *
 * `script.ts` is the edit script and its marks carry real closures (`diagram`,
 * the function-valued `points`). That is exactly the thing a build script
 * must never execute, and exactly what makes `import()`ing it unworkable
 * anyway (Node's ESM loader cannot resolve its extensionless relative imports
 * without a custom loader; see `balanced.mjs`'s module doc). What every VO
 * script actually needs is data plain object literals already carry: scene
 * ids, act order, which capture or piece each act plays, and, for a film act,
 * its beat plan. None of that lives inside a `marks` array, so this parser
 * never looks past `plan:` for a film act and never opens `marks:` at all.
 *
 * This is a purpose-built reader for `script.ts`'s own shape, not a general
 * TypeScript parser. That is the same trade this repo already made for
 * `sync-theme.mjs`'s CSS custom-property regex and `check-verbs.mjs`'s dash
 * scanner. It breaks the moment `script.ts` stops being a flat list of scene
 * and act object literals; that is an acceptable trade for staying
 * dependency-free.
 *
 * @module
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findMatch, splitTopLevel } from './balanced.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SCRIPT_TS = path.resolve(HERE, '../../src/script.ts');

/** Pull a quoted string field (`key: 'value'`) out of a text blob, or `undefined`. */
function stringField(text, key) {
  const match = text.match(new RegExp(`(?:^|[{,\\s])${key}\\s*:\\s*'([^']*)'`));
  return match?.[1];
}

/** Pull a numeric field (`key: 123`) out of a text blob, or `undefined`. */
function numberField(text, key) {
  const match = text.match(new RegExp(`(?:^|[{,\\s])${key}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
  return match ? Number(match[1]) : undefined;
}

/** Parse one `BeatPlan` object literal's text into its plain fields. */
function parseBeatPlan(text) {
  const beat = stringField(text, 'beat');
  if (!beat) {
    throw new Error(`parse-script: a plan entry has no "beat" field: ${text.slice(0, 80)}`);
  }
  const speed = stringField(text, 'speed');
  if (!speed) {
    throw new Error(`parse-script: plan entry "${beat}" has no "speed" field`);
  }
  const out = { beat, speed };
  const easeMs = numberField(text, 'easeMs');
  const holdMs = numberField(text, 'holdMs');
  const tailMs = numberField(text, 'tailMs');
  if (easeMs !== undefined) out.easeMs = easeMs;
  if (holdMs !== undefined) out.holdMs = holdMs;
  if (tailMs !== undefined) out.tailMs = tailMs;
  return out;
}

/** Parse one act object literal's text into a `{ kind: 'film' | 'piece', ... }` shape. */
function parseAct(text) {
  if (/(?:^|[{,\s])kind\s*:\s*'piece'/.test(text)) {
    const piece = stringField(text, 'piece');
    const from = stringField(text, 'from');
    if (!piece || !from) {
      throw new Error(`parse-script: a piece act is missing "piece" or "from": ${text.slice(0, 80)}`);
    }
    return { kind: 'piece', piece, from };
  }

  // A film act. Only the text before `plan:` is searched for `capture`/`label`.
  // `marks` sits after `plan` and its point functions are free to use
  // whatever field names they like without this parser mistaking them for the
  // act's own.
  const planKeyIndex = text.indexOf('plan:');
  if (planKeyIndex < 0) {
    throw new Error(`parse-script: act has no "plan" field: ${text.slice(0, 80)}`);
  }
  const head = text.slice(0, planKeyIndex);
  const capture = stringField(head, 'capture');
  if (!capture) {
    throw new Error(`parse-script: film act has no "capture" field: ${text.slice(0, 80)}`);
  }
  const label = stringField(head, 'label');

  const openBracket = text.indexOf('[', planKeyIndex);
  const closeBracket = findMatch(text, openBracket);
  const planEntries = splitTopLevel(text.slice(openBracket + 1, closeBracket)).map(parseBeatPlan);

  return { kind: 'film', capture, label, plan: planEntries };
}

/** Parse one scene object literal's text into `{ id, title, acts }`. */
function parseScene(text) {
  const id = stringField(text, 'id');
  const title = stringField(text, 'title');
  if (!id || !title) {
    throw new Error(`parse-script: scene missing "id" or "title": ${text.slice(0, 80)}`);
  }
  const actsKeyIndex = text.indexOf('acts:');
  if (actsKeyIndex < 0) {
    throw new Error(`parse-script: scene "${id}" has no "acts" field`);
  }
  const openBracket = text.indexOf('[', actsKeyIndex);
  const closeBracket = findMatch(text, openBracket);
  const acts = splitTopLevel(text.slice(openBracket + 1, closeBracket)).map((actText, index) => {
    const act = parseAct(actText);
    return { index, key: actKey(act, index), ...act };
  });
  return { id, title, acts };
}

/**
 * A stable key for an act within its chapter: the filename an actor's WAV is
 * named after.
 *
 * Mirrors `actKey` in `src/comp/Chapter.tsx` exactly (that function is not
 * exported, so this is a deliberate, documented duplicate. Same reasoning as
 * `ramp-lite.mjs` porting `buildRamp`: keep it in sync by hand if `Chapter.tsx`
 * ever changes the formula).
 */
export function actKey(act, index) {
  return `${act.kind === 'piece' ? `piece-${act.piece}` : act.capture}-${index}`;
}

/** Which capture an act's figures and footage come from: `capture` or `from`. */
export function actCaptureId(act) {
  return act.kind === 'piece' ? act.from : act.capture;
}

/**
 * Read `SCRIPT` out of `script.ts`, as plain data.
 *
 * @returns {{ id: string, title: string, acts: object[] }[]}
 */
export function readScript() {
  const source = readFileSync(SCRIPT_TS, 'utf8');
  const declIndex = source.indexOf('export const SCRIPT');
  if (declIndex < 0) {
    throw new Error(`parse-script: no "export const SCRIPT" found in ${SCRIPT_TS}`);
  }
  // Skip past the type annotation (`: Scene[]`) to the `=`, or its own `[`
  // would be mistaken for the array literal's opening bracket.
  const equalsIndex = source.indexOf('=', declIndex);
  const openBracket = source.indexOf('[', equalsIndex);
  const closeBracket = findMatch(source, openBracket);
  const sceneTexts = splitTopLevel(source.slice(openBracket + 1, closeBracket));
  return sceneTexts.map(parseScene);
}

/** Every act across every scene, each carrying its scene's id and title. */
export function readActs() {
  return readScript().flatMap((scene) =>
    scene.acts.map((act) => ({ sceneId: scene.id, sceneTitle: scene.title, ...act })),
  );
}
