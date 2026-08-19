import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ActionBar from './ActionBar';
import Button from './Button';
import DetailSection from './DetailSection';
import EntityIdentity from './EntityIdentity';
import PageHeader from './PageHeader';

/**
 * The page-level action strip of a detail view: one primary verb, the rest
 * secondary, pinned to the top of the scroller while the page moves under it.
 */
const meta = {
  title: 'Shared/ActionBar',
  component: ActionBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The rule this enforces: **a verb whose object is the whole page belongs here; a verb scoped to one section's data belongs in that section's `DetailSection.actions` slot.**\n\n" +
          'Before this existed, "Compare" sat in the group-memberships card header — structurally indistinguishable from "Add to group", which acts on that card alone — so the page\'s most important action read as a property of one section.\n\n' +
          '**Why it sticks:** the side panel has exactly one scroller, the `overflow-y-auto` app root, which `TabPanel` shares and which the Users tab does not shadow with a scroll box of its own. The strip is the third band of the sticky stack (ADR-0032), parking below the tab rail and the page header rather than at the top of the scroller, and it carries an opaque background so rows never show through it.\n\n' +
          '**Why it merges:** reaching its parking spot is not the same as looking parked — a strip that stays a rounded, inset card once pinned reads as "a card stopped moving". Over the first `--merge-range` of scroll it bleeds to the panel edges, flattens, covers the header\'s bottom seam and grows a shadow, so header and strip become one continuous surface. Driven by a CSS scroll-driven animation, so it tracks the scroll position with no per-frame JavaScript on the shared scroller.\n\n' +
          'Related internals: `shared/DetailSection`, `shared/PageHeader`.',
      },
    },
  },
  argTypes: {
    children: {
      description:
        'The actions, as shared `Button`s. Exactly one `variant="primary"`; the rest `secondary`. Buttons wrap rather than shrink, so a 360px panel never produces a squeezed label.',
    },
    ariaLabel: {
      description:
        'Accessible name for the group, e.g. `"Actions for Jane Doe"`. Required — a bare group of buttons announces nothing about what it acts on.',
    },
    sticky: {
      description:
        'Pin below the tab rail and the page header while the page scrolls under it, merging into the header as it docks. Defaults to `true`; pass `false` in an already-fixed region, which also opts out of the merge.',
    },
    className: { description: 'Extra classes merged after the layout classes.' },
    testId: { description: 'Optional test handle.' },
  },
  args: {
    ariaLabel: 'Actions for Jane Doe',
    sticky: false,
    children: (
      <>
        <Button variant="primary" size="sm" icon="users" onClick={fn()}>
          Compare
        </Button>
        <Button variant="secondary" size="sm" icon="plus" onClick={fn()}>
          Add to group
        </Button>
        <Button variant="secondary" size="sm" icon="download" onClick={fn()}>
          Export
        </Button>
      </>
    ),
  },
} satisfies Meta<typeof ActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The user-detail set: compare, add to group, export. */
export const Default: Story = {};

/** A single verb — the group-detail case. */
export const SingleAction: Story = {
  args: {
    ariaLabel: 'Actions for Sales — West',
    children: (
      <Button variant="primary" size="sm" icon="download" onClick={fn()}>
        Export members
      </Button>
    ),
  },
};

/** At 360px — the panel's real width — the buttons wrap rather than squeeze. */
export const AtPanelWidth: Story = {
  render: (args) => (
    <div className="w-[360px] bg-canvas p-3">
      <ActionBar {...args} />
    </div>
  ),
};

/**
 * The real detail-rung composition: a sticky `PageHeader` above, the strip below it, sections
 * scrolling underneath. Scroll the frame to watch the strip **merge into the header** — over
 * the first `--merge-range` of scroll it bleeds out to the panel edges, drops its radius and
 * its top/side borders, covers the header's bottom seam and grows a shadow, so the two become
 * one continuous pinned surface. The buttons do not move: only the chrome behind them does.
 *
 * A motion showcase, so it opts back into motion (`parameters: { motion: 'on' }`) — there is
 * nothing to see with `data-motion="off"`. That off state is not a rendering artefact: a
 * scroll-driven animation cannot be shortened to `1ms` the way a timed one can, so reduced
 * motion clears its `animation-name` instead and the strip simply keeps its resting geometry.
 * Flip the toolbar's motion control to see exactly what a `prefers-reduced-motion` user gets.
 */
export const StickyInAScroller: Story = {
  parameters: { motion: 'on' },
  args: { sticky: true },
  render: (args) => (
    // `[overflow-anchor:none]` mirrors the app's scroll root (`App.tsx`). Without it,
    // Chrome's scroll anchoring fights the pinned header's identity collapse and drags
    // `scrollTop` back to 0 on every small scroll — see ADR-0032.
    <div
      data-header-scope
      className="h-96 w-[360px] overflow-y-auto [overflow-anchor:none] bg-canvas"
    >
      <PageHeader
        sticky
        title="Jane Doe"
        badge={{ text: 'Active', variant: 'success' }}
        identityKey="00uFAKE1a2b3c4d5e6"
        identity={
          <EntityIdentity
            rows={[
              [{ kind: 'text', text: 'jane.doe@example.com' }],
              [{ kind: 'id', value: '00uFAKE1a2b3c4d5e6', copyLabel: 'Copy user id' }],
              [{ kind: 'metric', icon: 'users', value: '14', label: 'groups' }],
            ]}
          />
        }
      />
      <div className="space-y-3 px-6 py-6">
        <ActionBar {...args} />
        {['Membership source', 'Rules', 'Grants access to', 'App push', 'Metadata'].map((title) => (
          <DetailSection key={title} title={title}>
            <p className="text-sm text-neutral-600">
              Body content, tall enough that the strip above has something to hold against.
            </p>
          </DetailSection>
        ))}
      </div>
    </div>
  ),
};
