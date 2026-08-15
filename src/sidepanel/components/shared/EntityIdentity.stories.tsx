import type { Meta, StoryObj } from '@storybook/react-vite';
import EntityIdentity from './EntityIdentity';

/**
 * The metadata lines of the header's expanded identity region. Built by a per-entity
 * descriptor function (`groupIdentity`, `userIdentity`) rather than hand-written at a call
 * site, so every entity kind speaks the same vocabulary.
 */
const meta = {
  title: 'Shared/EntityIdentity',
  component: EntityIdentity,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Renders the `lines` of an `EntityIdentityDescriptor` to the secondary-text contract in the design system: `text-xs text-neutral-600`, with a `metric`’s value emphasised so the number reads before its unit.\n\n' +
          'It renders **lines only**. The entity’s name and badge belong to the header’s title row and its Okta link to the header’s actions slot — which is what keeps all three on screen when the header is collapsed.\n\n' +
          '**Related internals:** [Components](?path=/docs/internals-components--docs)',
      },
    },
  },
  argTypes: {
    lines: { description: 'The descriptor’s metadata lines, in render order.' },
  },
} satisfies Meta<typeof EntityIdentity>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A group: one counted fact. */
export const Group: Story = {
  args: {
    lines: [{ kind: 'metric', icon: 'users', value: '1,284', label: 'members' }],
  },
};

/** Singular label — the builder decides `member` vs `members`, not this component. */
export const SingleMember: Story = {
  args: {
    lines: [{ kind: 'metric', icon: 'users', value: '1', label: 'member' }],
  },
};

/** A user rung. */
export const User: Story = {
  args: {
    lines: [{ kind: 'metric', icon: 'users', value: '42', label: 'groups' }],
  },
};

/** Both line kinds together, for when a descriptor grows a second fact. */
export const MetricAndText: Story = {
  args: {
    lines: [
      { kind: 'metric', icon: 'users', value: '1,284', label: 'members' },
      { kind: 'text', icon: 'app', text: 'Sourced from Workday' },
    ],
  },
};

/** A long text line truncates rather than pushing the header wider. */
export const LongText: Story = {
  args: {
    lines: [
      {
        kind: 'text',
        icon: 'app',
        text: 'Sourced from Workday Human Capital Management — Production tenant (EMEA)',
      },
    ],
  },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};

/** No lines: renders nothing, so the header's region collapses to zero height. */
export const Empty: Story = {
  args: { lines: [] },
};
