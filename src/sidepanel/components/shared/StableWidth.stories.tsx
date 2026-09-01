import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import StableWidth from './StableWidth';

/** Reserve the width a readout will need, so its neighbours are laid out once. */
const meta = {
  title: 'Shared/StableWidth',
  component: StableWidth,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'ADR-0044 names the defect this removes, and `D-053` filed it in seven places: an element changes size after mount — a chip whose label swaps, a badge that only appears once a fetch resolves, a button whose label runs through three lengths — while sitting in a flex row beside text that is `min-w-0` and therefore free to absorb the difference. The neighbour re-truncates, re-wraps or changes its line count, and the row visibly re-lays-out under the reader’s eye.\n\n' +
          '**Why a hidden twin rather than a `min-w-[…]`.** A hard-coded width is a guess about a font the panel does not control, and one that has to be re-made every time the copy changes — which is how the reflow got in. Rendering the widest state invisibly in the same grid cell makes the browser measure it, in the reader’s own font at the reader’s own zoom.\n\n' +
          '**The twin is not part of the page.** It is `aria-hidden`, `invisible` and `select-none`, and it carries `data-reserve-width` — which `src/test/setup.ts` and `.storybook/preview.tsx` both add to Testing Library’s `defaultIgnore`, the same mechanism that already hides `<script>` and `<style>`. A text query sees exactly what a reader sees.\n\n' +
          '**It reserves the box; it does not stabilise the digits.** `11%` and `88%` are different widths in a proportional font, so a numeric readout carries `tabular-nums` as well. Most call sites want both — that is the second half of the convention.',
      },
    },
  },
  argTypes: {
    reserve: {
      description:
        'The widest state this slot will ever hold. Too narrow and the row can still move; too wide and it holds unused space. Neither breaks anything.',
    },
    children: { description: 'What is actually shown.' },
    align: {
      description:
        'How the live child sits in the reserved box. `start` (default) for a label, `end` for a right-aligned number, `center` for a chip.',
    },
    className: { description: 'Extra classes for the outer box — layout only.' },
  },
  args: {
    reserve: 'Not evaluated',
    children: 'Pass',
  },
} satisfies Meta<typeof StableWidth>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The shortest of three labels, holding the width of the longest. The box does not
 * change when the label does — which is the whole contract.
 */
export const Default: Story = {};

/**
 * The row the component exists for, in both states. The left column is
 * `min-w-0` and wraps; the right one changes label. Without the reserve the
 * sentence re-wraps as the chip swaps, and every row below it moves.
 *
 * Both rows here render the same reserved width, so the two sentences break at the
 * same point — the check is that the paragraphs line up, not what the chips say.
 */
export const HoldsTheRowStill: Story = {
  render: () => (
    <div className="max-w-[360px] space-y-2">
      {['Pass', 'Not evaluated'].map((label) => (
        <div key={label} className="flex items-start gap-3 rounded-md border p-2">
          <p className="min-w-0 flex-1 font-mono text-xs break-words">
            user.department == &quot;Engineering&quot; AND isMemberOfAnyGroup(&quot;00gFAKE&quot;)
          </p>
          <StableWidth reserve="Not evaluated" align="end">
            <span className="rounded-md border px-2 py-0.5 text-xs whitespace-nowrap">{label}</span>
          </StableWidth>
        </div>
      ))}
    </div>
  ),
};

/**
 * A slot held open for a value that has not arrived. The badge is absent, the space
 * it will occupy is not — so its arrival changes what is in the box and moves
 * nothing beside it.
 */
export const ReservedBeforeTheValueArrives: Story = {
  args: { reserve: '00', children: null, align: 'center' },
};

/**
 * A right-aligned percentage reserving `100%`, with `tabular-nums` so the digits
 * do not twitch inside the reserved box either.
 */
export const NumericReadout: Story = {
  args: {
    reserve: '100%',
    align: 'end',
    children: <span className="font-mono text-sm font-bold tabular-nums">7%</span>,
  },
};

/**
 * The twin is invisible to a text query, exactly as it is to a reader: `Not
 * evaluated` is reserved here and appears once in the DOM, but the only match is
 * the live child.
 */
export const TheTwinIsNotQueryable: Story = {
  args: { reserve: 'Not evaluated', children: 'Pass' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Pass')).toBeInTheDocument();
    await expect(canvas.queryByText('Not evaluated')).not.toBeInTheDocument();
  },
};
