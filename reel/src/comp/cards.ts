/**
 * @module reel/comp/cards
 * @description The film's furniture, and the registry `Root.tsx` reaches it
 * through.
 *
 * A **card** is everything the film draws that is neither footage nor a set
 * piece: the overture, the premise card, the drawn title, the seam between two
 * chapters, the panel's ink treatment. Unlike a piece, a card is never named
 * from `script.ts` - the script describes what the film *argues*, and none of
 * this is an argument. `Reel.tsx` and `Chapter.tsx` place cards directly.
 *
 * So this registry exists for exactly one consumer: `Root.tsx`, which needs a
 * preview composition per card so a card can be worked on without scrubbing
 * the film to find it.
 *
 * ## Why a table and not a list in `Root.tsx`
 *
 * `Root.tsx` used to hand-list its preview compositions as tuples. `PIECES`
 * registered four pieces and that list named two of them, because a list
 * mirroring a registry falls behind the registry - that is what hand-mirrored
 * lists do, and it had already happened. Pieces are now derived from `PIECES`;
 * cards had no registry to derive from, so this is it.
 *
 * The shape deliberately matches `PIECES`: an id, what to render, how long it
 * runs. `Root.tsx` maps over both with the same code. (ADR-0074 §2, §3.)
 *
 * A card's length lives in the card's own module, never here - same rule as a
 * piece's, and for a plainer reason: the number belongs beside the beat sheet
 * it was chosen against.
 */
import type { FC } from 'react';
import { DrawnTitlePreview, DRAWN_TITLE_FRAMES } from './TitleCard';
import { PremiseCardPreview, PREMISE_CARD_FRAMES } from './PremiseCard';
import { SeamPreview, SEAM_PREVIEW_FRAMES } from './Seam';
import { OverturePreview, OVERTURE_FRAMES } from './Overture';
import { PanelInkPreview, PANEL_INK_FRAMES } from './PanelInk';

/** One entry: a props-free preview component, and how long to run it. */
export interface Card {
  /**
   * Props-free by contract. Remotion serialises `defaultProps` to JSON and
   * silently drops functions, so a component needing real props could not be
   * registered as a composition at all - the same constraint that makes
   * `PIECES` an id registry.
   */
  component: FC;
  /** Frames. A literal from the card's own module. */
  frames: number;
}

/** Every card with a preview composition. The id is the composition id. */
export const CARDS = {
  overture: { component: OverturePreview, frames: OVERTURE_FRAMES },
  'card-premise': { component: PremiseCardPreview, frames: PREMISE_CARD_FRAMES },
  'card-title': { component: DrawnTitlePreview, frames: DRAWN_TITLE_FRAMES },
  seam: { component: SeamPreview, frames: SEAM_PREVIEW_FRAMES },
  'panel-ink': { component: PanelInkPreview, frames: PANEL_INK_FRAMES },
} as const satisfies Record<string, Card>;

/** A card's id, which is also its composition id. */
export type CardId = keyof typeof CARDS;
