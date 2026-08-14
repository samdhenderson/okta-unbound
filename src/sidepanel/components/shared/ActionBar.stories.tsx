import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ActionBar from './ActionBar';
import Button from './Button';
import DetailSection from './DetailSection';

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
          '**Why it sticks:** the side panel has exactly one scroller, the `overflow-y-auto` app root, which `TabPanel` shares and which the Users tab does not shadow with a scroll box of its own. `sticky top-0` therefore pins against that root. `PageHeader` lives in the same scroller and scrolls away above the strip, so the strip carries an opaque background and its own border — pinned, it is the only chrome on screen and must not let rows show through.\n\n' +
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
        'Pin to the top of the scroller while the page scrolls under it. Defaults to `true`; pass `false` in a story or a already-fixed region.',
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
 * Pinned, with content scrolling beneath it. Scroll the frame to see the strip
 * hold position while the sections move under its opaque background.
 */
export const StickyInAScroller: Story = {
  args: { sticky: true },
  render: (args) => (
    <div className="h-80 w-[360px] overflow-y-auto bg-canvas p-3">
      <div className="space-y-3">
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
