/**
 * @module reel/ad-entry
 * @description Remotion's entry point for the store page advertisement.
 *
 * Separate from `index.ts` on purpose: see `AdRoot.tsx`'s module doc. The film's
 * entry evaluates every capture at module scope; the ad has none and should not
 * inherit that failure mode.
 */
import { registerRoot } from 'remotion';
import { AdRoot } from './AdRoot';

registerRoot(AdRoot);
