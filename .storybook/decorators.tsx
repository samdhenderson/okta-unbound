import type { Decorator } from '@storybook/react-vite';

/**
 * Contains bottom-anchored `position: fixed` chrome — the ActivityBar — within a
 * bounded, side-panel-sized frame so it renders IN VIEW inside the story canvas
 * and the autodocs preview block, instead of escaping to the bottom of an
 * otherwise-blank page (where it reads as empty until you scroll).
 *
 * The trick: a non-`none` `transform` on the wrapper establishes a containing
 * block, so any descendant positioned `fixed` anchors to THIS frame rather than
 * the viewport. A muted placeholder body sits above so the bar reads as the
 * footer it is, in a representative panel context.
 *
 * Tokens (not raw hex) per the design-system rule — the classes resolve because
 * `preview.tsx` imports the Odyssey token stylesheet.
 */
export const inSidePanelFrame: Decorator = (Story) => (
  <div className="relative h-48 w-full overflow-hidden border-b border-neutral-200 bg-canvas [transform:translateZ(0)]">
    <div className="space-y-2 p-4">
      <div className="text-xs font-semibold text-neutral-500">Side-panel content</div>
      <div className="h-2 w-2/3 rounded bg-neutral-200" />
      <div className="h-2 w-1/2 rounded bg-neutral-200" />
    </div>
    <Story />
  </div>
);
