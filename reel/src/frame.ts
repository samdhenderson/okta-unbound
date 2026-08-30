/**
 * @module reel/frame
 * @description The film's own dimensions, in their own module.
 *
 * `FRAME` used to live directly in `theme.ts`. It moved here so `verbs/ease.ts`
 * can derive frame counts from `FRAME.fps` without creating an import cycle:
 * `theme.ts` is the front door that re-exports `verbs/ease`'s parsed tokens, and
 * a module that both feeds and is fed by the front door cannot live inside it.
 * `theme.ts` still re-exports `FRAME` from here, so no existing import of
 * `FRAME` from `theme.ts` changes.
 */

/** The frame. 1080p because that is what every surface this gets posted to wants. */
export const FRAME = { width: 1920, height: 1080, fps: 60 } as const;
