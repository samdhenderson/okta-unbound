/**
 * @module reel/pencil/colors
 * @description Tokens for the pencil layer: the graphite the world is drawn in,
 * before anything solidifies into the film's own `STAGE` palette.
 *
 * `STAGE` (`reel/theme.ts`) already carries the film's ink side - backdrop,
 * plate, hairline, ink, accent. Those are reused here, not retyped: a pencil
 * drawing that solidifies into `STAGE.ink` must solidify into the *same*
 * `STAGE.ink`, not a copy that could drift from it. What is added here is only
 * the graphite side, which has no counterpart in `STAGE` because nothing else
 * in the film is ever drawn in pencil.
 */

/**
 * The graphite palette, lifted verbatim from
 * `DesignDocs/design_handoff_title_animation/README.md`'s "Colours and type"
 * section (the one part of that handoff explicitly marked settled, not
 * provisional).
 */
export const GRAPHITE = {
  /** The first pass: the line as the hand lays it down. */
  primary: '#a6a8bd',
  /** The second, lighter pass: the hand going over its own line. */
  second: '#6c7196',
  /**
   * The inert-mark variant.
   *
   * The two design handoffs disagree on this value:
   * `design_handoff_title_animation/README.md` lists `#1d2138`;
   * `design_handoff_reveal_language` (the reel's existing six-verb bundle)
   * uses `#3a4270`. Per instruction, the reel's existing bundle wins - `#3a4270`
   * is what ships here. Flagging the disagreement rather than silently picking
   * one, since a future pencil consumer reading only the title-animation
   * handoff will otherwise go looking for `#1d2138` and not find it.
   */
  inertMark: '#3a4270',
} as const;
