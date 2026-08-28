/**
 * What counts as a violation, in one place.
 *
 * Shared by `check.mjs` and by the fixture that proves `check.mjs` works. That
 * sharing is the point: a fixture that plants its own hard-coded 40px shift
 * keeps passing after somebody raises the threshold to 50, and the suite then
 * reports a working detector that can no longer detect anything. Importing the
 * numbers means a threshold change either keeps the controls valid or breaks
 * them loudly.
 *
 * @module
 */

/** A scroll offset moving by less than this is sub-pixel noise, not a jump. */
export const SCROLL_EPS_PX = 2;

/** How many frames at the head of a clip must not be blank. */
export const OPEN_FRAMES = 4;

/**
 * A frame whose luma range is below this is uniform: all white, all black, or
 * a loading overlay. Measured on real captures, whose first frames run 180+.
 */
export const OPEN_RANGE_MIN = 30;
