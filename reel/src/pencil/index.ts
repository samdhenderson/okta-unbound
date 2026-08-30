/**
 * @module reel/pencil
 * @description Barrel for the pencil drawing primitives - the hand-drawn
 * graphite treatment the opening title solidifies out of.
 *
 * This module is a library commit only: it ports and fixes the primitives
 * from `DesignDocs/design_handoff_title_animation/`'s two reference builds,
 * but does not assemble the title card or the console doodle those
 * primitives are meant for. A later commit consumes this barrel to build
 * those; nothing here should be imported piecemeal from outside it.
 *
 * See each module's own doc for the reasoning behind it:
 * - `wobble.ts` - the deterministic hash, and the geometry wobble that
 *   replaces the reference's animated SVG filter.
 * - `Stroke.tsx` - the draw-on line every shape here is built from.
 * - `SketchBox.tsx` - a rectangle as four sequenced strokes.
 * - `Written.tsx` - a self-writing word, with namespaced clip ids and real
 *   text measurement in place of the reference's two defects.
 * - `draw.ts` - the seventh verb, and the rule for when it may be used.
 * - `convert.tsx` - the graphite-to-ink wipe, replacing the reference's
 *   crossfade.
 */
export { GRAPHITE } from './colors';
export { wob, wobblePoints, pathLength, pathFromPoints } from './wobble';
export type { WobblePoint } from './wobble';
export { Stroke } from './Stroke';
export type { StrokeProps } from './Stroke';
export { SketchBox } from './SketchBox';
export type { SketchBoxProps } from './SketchBox';
export { Written } from './Written';
export type { WrittenProps } from './Written';
export { draw, easeInOutSine, PENCIL_FRAMES } from './draw';
export { Convert } from './convert';
export type { ConvertProps, ConvertDirection } from './convert';
