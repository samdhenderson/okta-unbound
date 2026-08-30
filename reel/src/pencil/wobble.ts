/**
 * @module reel/pencil/wobble
 * @description The deterministic hash the whole pencil layer is built on, and
 * the geometry helper that replaces the reference implementation's SVG filter.
 *
 * ## Why not `feTurbulence` + `feDisplacementMap`
 *
 * The reference (`DesignDocs/design_handoff_title_animation/panel-only/
 * TitleCardPencilPiece.jsx`) wraps its pencil layer in an SVG filter and
 * animates the displacement `scale` from 7 to 0 to "solidify" it. That is
 * exactly the kind of filter Chrome cannot cache: the `feTurbulence` node has
 * to be re-evaluated per frame across the whole filter region, and Remotion's
 * renderer drives that same recomputation once per exported frame rather than
 * once per visible second. The console build in that handoff runs two such
 * filters at once for 12.3s of a 60fps export - that is the shape of render
 * that looks fine in the studio's live preview (a handful of frames a second)
 * and then appears to hang during `remotion render` (every frame, full cost).
 * It also has a second, subtler cost even when it does finish: a 1px hairline
 * dashed through a displacement map crawls sub-pixel from frame to frame
 * instead of holding still, because the noise field doesn't step in phase
 * with dash length.
 *
 * The fix is to move the wobble out of the raster pipeline entirely and into
 * the geometry `Stroke` already builds. A line that "wobbles" is a handful of
 * points nudged off the straight path by a bounded, deterministic amount;
 * emitting that as a `<path>` costs nothing GPU-side, cannot crawl (each
 * frame's points are an exact function of that frame's amplitude, not of a
 * noise field's phase), and isn't clipped by a filter region's `-5%/110%`
 * margins. See `Stroke.tsx`'s `amplitude` prop.
 */

/**
 * The deterministic wobble hash, verbatim from the reference implementation.
 *
 * This is not a "good" hash by cryptographic or even statistical standards -
 * it is a cheap `Math.sin` scramble that happens to look like hand-jitter at
 * the amplitudes this module uses it at. It must stay *exactly* this
 * function: Remotion re-renders any single frame independently (scrubbing
 * the studio timeline, exporting frame 900 without ever exporting frame 899),
 * so every caller needs the same input `i` to always produce the same
 * output - a `Math.random()` here would make a re-rendered frame visibly
 * different from the first time it was seen.
 */
export function wob(i: number, k = 1): number {
  return ((Math.sin(i * 12.9898) * 43758.5453) % 1) * k;
}

/** A 2D point, used only inside this module's path-building helpers. */
export interface WobblePoint {
  x: number;
  y: number;
}

/**
 * Subdivide the segment from `(x1,y1)` to `(x2,y2)` into `segments` pieces and
 * displace each interior point perpendicular to the segment's direction by
 * `wob(seed + i) * amplitude`.
 *
 * The two endpoints are returned undisturbed - `Stroke` has already jittered
 * them (its own `over`-shoot + endpoint `wob` calls), so this only adds the
 * "shaky hand" wobble along the line's *middle*, which is where the reference
 * SVG filter's displacement was visually doing its work. Displacing
 * perpendicular to the line rather than in raw `x`/`y` (which is what the
 * reference's endpoint jitter does) is a deliberate choice for this
 * multi-point case: an x/y jitter on a long run of points reads as noise,
 * a perpendicular jitter reads as an unsteady line - which is the effect
 * being ported.
 *
 * `segments` of 6-10 is the range the brief specifies; below that the wobble
 * looks like a broken line rather than a shaky one, above it the extra points
 * cost more to draw for a visually identical result at this line length.
 */
export function wobblePoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  amplitude: number,
  seed: number,
  segments = 8,
): WobblePoint[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  // The unit normal (perpendicular to the segment's own direction).
  const nx = -dy / len;
  const ny = dx / len;

  const points: WobblePoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    if (i === 0 || i === segments || amplitude === 0) {
      points.push({ x: px, y: py });
      continue;
    }
    const offset = wob(seed + i) * amplitude;
    points.push({ x: px + nx * offset, y: py + ny * offset });
  }
  return points;
}

/** Total length of the polyline through `points`, for dash-array/offset math. */
export function pathLength(points: readonly WobblePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

/** Render `points` as an SVG path `d` string of straight segments. */
export function pathFromPoints(points: readonly WobblePoint[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(' ');
}
