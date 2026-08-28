/**
 * @module reel/layout
 * @description Where everything stands, and what part of the panel we are looking at.
 *
 * Two independent ideas, kept apart on purpose:
 *
 * - a **stage** places the three things that can be on screen at once: the
 *   panel, the margin's copy, and the plot a diagram or a showcase draws into;
 * - a **crop** is which part of the 840x980 capture fills the panel's rectangle.
 *
 * Separating them is what makes an emphatic move cheap. "Push in on the filter
 * chips" is a crop change with the stage held; "get out of the way, the diagram
 * is talking" is a stage change with the crop held.
 *
 * ## The panel moves; it never shrinks
 *
 * The first cut had an `aside` pose that solved "the diagram needs room" by
 * scaling the panel down to 430x502 and tucking it into a corner. It made room
 * and cost the point: at that size the product is a thumbnail, and a chapter
 * arguing about what the panel *shows* was showing something illegible while it
 * argued. The capture is 840x980 of real pixels and no more, so there was never
 * anything to gain by scaling either way.
 *
 * So every stage holds the panel at the same size, and room is made by removing
 * it. When it leaves, what takes its place is a showcase drawn at frame
 * resolution rather than a shrunken photograph of one.
 */

/** A rectangle in frame pixels. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A column of copy: it grows downward, so it has no height. */
export interface Box {
  x: number;
  y: number;
  width: number;
}

/** A region of the captured panel, in panel pixels. */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The panel's native capture size. Asserted against each manifest at render. */
export const PANEL = { width: 840, height: 980 } as const;

/**
 * The film's own index band, across the top of the frame.
 *
 * Spans the whole frame rather than sitting in the panel's column, and that is
 * the entire point of where it is. An earlier cut cropped the app's context bar
 * and rail off the top of every capture and drew a replacement in the panel's
 * column, at the panel's scale, out of the product's own icon registry. It was
 * a good-looking lie: the film was rendering a piece of the product, so a
 * viewer could not tell which parts of what they were watching the extension
 * actually draws.
 *
 * The product draws its own navigation now, on camera, uncropped, and this band
 * stands beside it rather than in its place. Both are on screen on purpose: the
 * app's rail is evidence, this is narration. What keeps them from reading as one
 * duplicated object is that they never agree about scale, register or content.
 * `reel/comp/FilmIndex` carries the argument in full.
 */
export const INDEX = { x: 76, y: 44, width: 1768 } as const;

/**
 * The panel's rectangle: the whole capture, drawn at its own aspect.
 *
 * **Nothing is cropped off the top any more.** The capture is the panel's full
 * 840x980, context bar and rail included, and the composition shows all of it.
 *
 * Narrower than it used to be (656 from 800), which under a fixed aspect ratio
 * is the same decision as shorter. Those two pull against each other and the
 * width is what gives: "the full height of the app" means every row the app
 * drew is on screen, not that the panel reaches the top and bottom of a 16:9
 * frame. It cannot do both, because the panel is 6:7.
 *
 * Held below 1:1 (656 drawn from 840 captured), so the footage is downsampled
 * rather than magnified. Emphasis comes from the vector overlays, which are
 * drawn at frame resolution.
 */
export const PANEL_RECT: Rect = {
  x: INDEX.x,
  y: 240,
  width: 656,
  height: Math.round((656 * PANEL.height) / PANEL.width),
};

/** The default crop: the whole capture. */
export const FULL_CROP: Crop = { x: 0, y: 0, width: PANEL.width, height: PANEL.height };

/** What is where, for one arrangement of the frame. */
export interface Stage {
  /**
   * Is the panel on screen at all?
   *
   * Not a position, because the panel has exactly one. It leaves by fading and
   * settling a little, not by travelling: an earlier version slid it 976px off
   * the near edge, which crossed the very column the argument was arriving in
   * and left a frame of nothing but a white sliver at the edge. A fade has no
   * path, so nothing can be in its way.
   */
  showsPanel: boolean;
  /** Where the margin's copy hangs. */
  margin: Box;
  /** Where a diagram or a showcase draws. */
  plot: Rect;
}

/**
 * Two arrangements. The panel is in one of them and absent from the other.
 *
 * **The panel has one home and never moves within the frame.** An earlier cut
 * had four stages and swapped sides whenever the argument wanted the other
 * half; watched end to end it never let the eye settle, because the largest
 * object on screen was travelling 950px every few seconds and the viewer spent
 * the move re-finding the thing they were reading. Legibility of a *sequence*
 * is a different problem from legibility of a frame, and mobility loses it.
 *
 * So the only thing that ever changes is whether the panel is there. It sits at
 * `home`, or it has gone and a showcase has the frame. Both are absolutes, so
 * there is nothing to track between them.
 */
export const STAGES = {
  /** The panel in its column, the argument to its right. */
  home: {
    showsPanel: true,
    margin: { x: 816, y: 260, width: 1028 },
    plot: { x: 816, y: 620, width: 1028, height: 385 },
  },
  /** The panel gone, and a showcase in its place. */
  focus: {
    showsPanel: false,
    margin: { x: INDEX.x, y: 280, width: 548 },
    plot: { x: 672, y: 220, width: 1172, height: 816 },
  },
} as const satisfies Record<string, Stage>;

/** A stage's name. */
export type StageName = keyof typeof STAGES;

/** Where a chapter starts unless its first mark says otherwise. */
export const WORKING_STAGE: StageName = 'home';

/** Interpolate between two rects. */
export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  width: a.width + (b.width - a.width) * t,
  height: a.height + (b.height - a.height) * t,
});

/**
 * A crop that keeps the panel's aspect ratio inside its rectangle.
 *
 * A crop whose ratio differs from the panel's would letterbox or distort.
 * Rather than allow either, a requested region is grown along whichever axis is
 * short until it matches, and then clamped back inside the panel. So a walk can
 * ask for "the filter row" as a loose box and get a framed shot.
 */
export function fitCrop(region: Crop, panel: Rect): Crop {
  const want = panel.width / panel.height;
  let { x, y, width, height } = region;
  if (width / height < want) {
    const grown = height * want;
    x -= (grown - width) / 2;
    width = grown;
  } else {
    const grown = width / want;
    y -= (grown - height) / 2;
    height = grown;
  }
  // Clamp inside the capture. A crop hanging off the edge shows backdrop
  // through the panel, which reads as a rendering fault rather than a choice.
  const scale = Math.min(1, PANEL.width / width, PANEL.height / height);
  width *= scale;
  height *= scale;
  x = Math.min(Math.max(x, 0), PANEL.width - width);
  y = Math.min(Math.max(y, 0), PANEL.height - height);
  return { x, y, width, height };
}
