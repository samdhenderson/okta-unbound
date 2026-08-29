/**
 * @module reel/captures
 * @description The shot footage and its manifests, typed.
 *
 * Manifests are imported rather than fetched, so a chapter whose capture is
 * missing is a build error instead of a black rectangle at render time. Clips
 * are resolved with `staticFile`, which reads from the public dir — pointed at
 * `../captures` in `remotion.config.ts` so the composition reads the shoot's
 * output directly and nothing is copied.
 */
import { staticFile } from 'remotion';
import apps from '../../captures/apps.json';
import attributes from '../../captures/attributes.json';
import compare from '../../captures/compare.json';
import groups from '../../captures/groups.json';
import home from '../../captures/home.json';
import reporting from '../../captures/reporting.json';
import rules from '../../captures/rules.json';
import users from '../../captures/users.json';

/** The manifest schema this composition understands. Asserted, never branched on. */
export const SCHEMA = 4;

/** One recorded beat, in clip-local ms. */
export interface Beat {
  name: string;
  at: number;
  endAt: number;
  ok: boolean;
}

/** A commanded pointer event, in fractions of the panel. */
export interface PointerStep {
  kind: 'move' | 'click' | 'type';
  at: number;
  ms?: number;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  target?: string;
}

/** A figure read off the panel, with the clip time it was true at. */
export interface Figure<T = unknown> {
  value: T;
  at: number;
}

/** What `capture.mjs` writes beside each clip. */
export interface Manifest {
  schema: number;
  id: string;
  title: string;
  tab: string;
  kind: 'tour' | 'deep';
  file: string;
  ok: boolean;
  panel: { width: number; height: number };
  fps: number;
  /** How many times slower than life the app was filmed. The ramp's whole basis. */
  retime: number;
  durationMs: number;
  frames: number;
  realFrames: number;
  beats: Beat[];
  pointer: PointerStep[];
  figures: Record<string, Figure>;
}

const MANIFESTS = { home, users, groups, apps, rules, compare, attributes, reporting } as const;

/** A chapter id with footage behind it. */
export type CaptureId = keyof typeof MANIFESTS;

/**
 * Fetch a chapter's manifest, refusing anything this composition cannot trust.
 *
 * Three separate refusals, because all three have happened: a schema the
 * composition predates, a take whose walk threw partway (`ok: false` — the
 * manifest is written from a `finally`, so a failed chapter still leaves one),
 * and a beat that missed its mark inside an otherwise complete take.
 */
export function capture(id: CaptureId): Manifest {
  const manifest = MANIFESTS[id] as unknown as Manifest;
  if (manifest.schema !== SCHEMA) {
    throw new Error(
      `${id}: manifest schema ${manifest.schema}, composition expects ${SCHEMA}. Re-run \`npm run capture\`.`,
    );
  }
  if (!manifest.ok) {
    throw new Error(`${id}: the capture did not complete. Re-run \`npm run capture -- ${id}\`.`);
  }
  const failed = manifest.beats.filter((b) => !b.ok).map((b) => b.name);
  if (failed.length > 0) {
    throw new Error(`${id}: beats failed during capture: ${failed.join(', ')}`);
  }
  return manifest;
}

/** The clip for a chapter. */
export const clip = (id: CaptureId): string => staticFile(`${id}.mp4`);

/**
 * A figure read off the panel, or a thrown error naming what is missing.
 *
 * This is the house rule with teeth. Under the old system a caption fell back
 * to generic prose when its read-back missed, so a claim could quietly stop
 * being evidence and nothing went red. Here the render fails.
 */
export function figure<T>(manifest: Manifest, key: string): T {
  const found = manifest.figures[key];
  if (!found) {
    throw new Error(
      `${manifest.id}: no figure "${key}" was read during capture. ` +
        `Read: ${Object.keys(manifest.figures).join(', ') || '(none)'}`,
    );
  }
  return found.value as T;
}
