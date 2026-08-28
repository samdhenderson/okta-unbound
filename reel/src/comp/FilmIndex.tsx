/**
 * @module reel/comp/FilmIndex
 * @description The film's table of contents, standing beside the app's own navigation.
 *
 * ## Two rails, on purpose
 *
 * There are two rows of tab glyphs on screen and that is the design, not an
 * oversight. They are different objects answering different questions, and the
 * two cuts that had only one of them were each wrong in their own direction:
 *
 * - **The app's rail is the product.** It is inside the panel, at the panel's
 *   own scale, filmed rather than drawn, and it does what the extension does:
 *   the active tab's label unfurls inline. It is evidence.
 * - **This band is the presentation.** It is full-bleed across the top of the
 *   frame, on the film's dark backdrop, at nearly twice the size, and it says
 *   things the product never says: which chapter this is, how many there are,
 *   and whether the chapter is a tour stop or an argument. It is narration.
 *
 * The first cut had only this one, and cropped the app's `ContextBar` and rail
 * off every capture so the reconstruction could stand in their place. That was
 * a lie of a specific kind: the film was *rendering a piece of the product*, so
 * a viewer had no way to tell which of the things moving on screen the
 * extension draws and which the edit invented. The second cut deleted the
 * glyphs here instead, on the theory that two rows of the same icons must be a
 * duplication. It is not. Deleting them cost the band the one thing that made
 * it a table of *contents* rather than a caption: you could no longer see, at a
 * glance, which part of the product a chapter was about.
 *
 * So: the crop is gone, the product draws its own navigation on camera, and
 * this band draws the film's. What keeps them from reading as one duplicated
 * object is that they never agree about scale, register or content.
 *
 * ## What each element is for
 *
 * Three facts, none of which the others can carry:
 *
 * - **The glyph row** says which section of the product this chapter is about.
 *   `TAB_DEFS` is imported, not transcribed, so a renamed or reordered tab
 *   cannot silently desync the film's contents from the product's. That import
 *   is safe in both directions: `tabs.ts` pulls only a `type` from the icon
 *   registry, so no extension runtime comes with it.
 * - **The chapter title** says what is being argued. It is not the tab's label:
 *   seven chapters sit on four tabs, and three of them share Groups, so the
 *   glyph row alone would report the same position three times.
 * - **The counter and the progress rule** say how far into the film we are,
 *   which neither of the other two can, for the same reason.
 *
 * ## The font is set here, not inherited
 *
 * `Reel` draws one band across every chapter, which means it is mounted
 * *outside* any `Chapter`'s subtree, and the composition's `fontFamily` is set
 * on that subtree's root. So it inherited nothing and rendered in the browser's
 * default serif for an entire cut before anyone looked closely at a still.
 * Anything drawn at the film level has to name its own face.
 */
import React from 'react';
import { interpolate } from 'remotion';
import { TAB_DEFS } from '../../../src/sidepanel/tabs';
import Icon from '../../../src/sidepanel/components/shared/Icon';
import { INDEX } from '../layout';
import { FONT, INTER, STAGE, TYPE } from '../theme';

interface FilmIndexProps {
  /**
   * Which chapter is current, as a continuous index.
   *
   * Continuous rather than an integer so a chapter change can be a slide.
   * `Reel` feeds it a value easing between two chapters across the cut; a
   * standalone chapter feeds it a whole number and nothing moves.
   */
  at: number;
  /** Which tab that chapter films, as a continuous index into `TAB_DEFS`. */
  tab: number;
  /** How many chapters the film has, which is how many segments are drawn. */
  count: number;
  /** The film's name for the current chapter. */
  title: string;
  /** `deep` chapters announce themselves as an argument rather than as a stop. */
  kind: 'tour' | 'deep';
}

/* --- Metrics -----------------------------------------------------------------
 *
 * The app's rail is `text-xs` with `size="sm"` (16px) glyphs inside an 840px
 * panel drawn at 656. These are roughly twice that on screen, which is the
 * margin that keeps the two rows from reading as the same object.
 */
const GLYPH = 34;
const GAP = 16;
/** One chapter's segment in the progress rule. */
const SEG = { width: 56, gap: 12, height: 5 };

export const FilmIndex: React.FC<FilmIndexProps> = ({ at, tab, count, title, kind }) => {
  // Whole for all but the half second of a chapter change, so the title is
  // simply in place rather than perpetually animating.
  const settle = 1 - Math.min(1, Math.abs(at - Math.round(at)) * 2);
  const shown = Math.round(at) + 1;

  const left = (i: number) => i * (GLYPH + GAP);
  // The indicator spans one glyph and slides on the continuous tab index, so a
  // chapter change reads as a move rather than a cut.
  const lower = Math.floor(tab);
  const upper = Math.min(TAB_DEFS.length - 1, Math.ceil(tab));
  const indicatorLeft = left(lower) + (left(upper) - left(lower)) * (tab - lower);

  const run = count * SEG.width + (count - 1) * SEG.gap;

  return (
    <div
      style={{
        position: 'absolute',
        left: INDEX.x,
        top: INDEX.y,
        width: INDEX.width,
        // See the module note: drawn outside any chapter, so it cannot inherit
        // a face. `FONT.heading` is the app's own token; `INTER` is the loaded
        // file that token names.
        fontFamily: `${INTER}, ${FONT.heading}`,
      }}
    >
      {/* Sizing override for the product's own SVGs: `Icon` sizes through
          Tailwind classes and there is no Tailwind here. The paths stay the
          product's; only the box is ours. */}
      <style>{`.reel-glyph svg { width: 100%; height: 100%; }`}</style>

      {TAB_DEFS.map((def, i) => {
        const lit = interpolate(Math.abs(i - tab), [0, 1], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={def.id}
            className="reel-glyph"
            style={{
              position: 'absolute',
              left: left(i),
              top: 0,
              width: GLYPH,
              height: GLYPH,
              color: STAGE.accent,
              // Inactive glyphs sit back rather than compete. The product dims
              // them with `text-neutral-600` on white; on a dark stage the same
              // relationship is opacity, and the lit one needs no other
              // treatment because it is the only thing at full strength.
              opacity: 0.22 + lit * 0.78,
            }}
          >
            <Icon type={def.icon} />
          </div>
        );
      })}

      {/* `bottom-0 h-0.5 rounded-full bg-primary`, scaled. There is no rule
          across the band under it: the app's `border-b` separates its rail from
          panel content directly beneath, and here there is backdrop instead, so
          a hairline would be drawing a box with nothing in it. */}
      <div
        style={{
          position: 'absolute',
          left: indicatorLeft,
          top: GLYPH + 12,
          width: GLYPH,
          height: 4,
          borderRadius: 2,
          background: STAGE.accent,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: GLYPH + 34,
          // Rises into place rather than crossfading. Two chapter names
          // dissolving through each other are unreadable at this size, and the
          // indicator is already carrying the continuity.
          transform: `translateY(${(1 - settle) * 14}px)`,
          opacity: settle,
          fontSize: 52,
          fontWeight: 700,
          letterSpacing: -1.6,
          color: STAGE.ink,
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </div>

      {/* The counter and the scrubber, right-aligned against the far edge of
          the frame. Deliberately the far end from the glyphs: these are the two
          things the product's own rail could never say, so they sit as far from
          it as the band allows. */}
      <div style={{ position: 'absolute', right: 0, top: 0, textAlign: 'right' }}>
        <div
          style={{
            fontSize: TYPE.unit - 2,
            letterSpacing: 3,
            textTransform: 'uppercase',
            fontWeight: 700,
            color: STAGE.inkDim,
            whiteSpace: 'nowrap',
          }}
        >
          {`Chapter ${shown} of ${count}`}
          <span style={{ color: STAGE.accent, paddingLeft: 14 }}>
            {kind === 'deep' ? 'In depth' : 'The tour'}
          </span>
        </div>
        <div style={{ position: 'relative', marginTop: 14, height: SEG.height, width: run }}>
          {Array.from({ length: count }, (_, i) => {
            const lit = interpolate(Math.abs(i - at), [0, 1], [1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            // Chapters already played stay part lit: the rule says how far in
            // we are, not only where we are.
            const base = i < at - 0.5 ? 0.4 : 0.12;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: i * (SEG.width + SEG.gap),
                  top: 0,
                  width: SEG.width,
                  height: SEG.height,
                  borderRadius: SEG.height / 2,
                  background: STAGE.accent,
                  opacity: base + lit * (1 - base),
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
