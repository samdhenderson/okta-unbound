import type { Meta, StoryObj } from '@storybook/react-vite';
import EntityIdentity from './EntityIdentity';

/**
 * The fact rows of the header's expanded identity region. Built by a per-entity descriptor
 * function (`groupIdentity`, `userIdentity`) rather than hand-written at a call site, so
 * every entity kind speaks the same vocabulary.
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
          'Renders the `rows` of an `EntityIdentityDescriptor` to the secondary-text contract in the design system: `text-xs text-neutral-600`, with a `metric`’s value emphasised so the number reads before its unit, and an `id` through the shared `CopyableId`.\n\n' +
          'Facts inside a row wrap together and are separated by a middot. An **empty row is dropped** rather than rendered as blank space — that is how "Okta has not told us yet" collapses out of the layout instead of showing a zero.\n\n' +
          'It renders rows only. The entity’s name, badge and Okta link belong to the header’s title row, which is what keeps all three on screen when the header is pinned and this region is collapsed.\n\n' +
          '**Related internals:** [Components](?path=/docs/internals-components--docs)',
      },
    },
  },
  argTypes: {
    rows: { description: 'The descriptor’s fact rows, in render order. Empty rows are dropped.' },
  },
} satisfies Meta<typeof EntityIdentity>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A group with everything Okta reported: id, counts, both timestamps. */
export const Group: Story = {
  args: {
    rows: [
      [{ kind: 'id', value: '00gFAKE1a2b3c4d5e6', copyLabel: 'Copy group id' }],
      [
        { kind: 'metric', icon: 'users', value: '1,284', label: 'members' },
        { kind: 'metric', icon: 'bolt', value: '2', label: 'rules' },
        { kind: 'metric', icon: 'link', value: '3', label: 'references' },
      ],
      [
        { kind: 'text', icon: 'clock', text: 'Created 12 Mar 2021' },
        { kind: 'text', text: 'Updated 4 days ago' },
      ],
    ],
  },
};

/**
 * The same group before its rules have loaded. The rule facts are absent rather than zero,
 * and the row shrinks to what is actually known.
 */
export const GroupBeforeRulesLoad: Story = {
  args: {
    rows: [
      [{ kind: 'id', value: '00gFAKE1a2b3c4d5e6', copyLabel: 'Copy group id' }],
      [{ kind: 'metric', icon: 'users', value: '1,284', label: 'members' }],
      [{ kind: 'text', icon: 'clock', text: 'Created 12 Mar 2021' }],
    ],
  },
};

/** Singular labels — the builder decides `member` vs `members`, not this component. */
export const SingleMember: Story = {
  args: {
    rows: [
      [{ kind: 'id', value: '00gFAKE1a2b3c4d5e6', copyLabel: 'Copy group id' }],
      [{ kind: 'metric', icon: 'users', value: '1', label: 'member' }],
    ],
  },
};

/** A user rung: the same vocabulary, a different builder. */
export const User: Story = {
  args: {
    rows: [
      [{ kind: 'id', value: '00uFAKE9z8y7x6w5v', copyLabel: 'Copy user id' }],
      [
        { kind: 'metric', icon: 'users', value: '42', label: 'groups' },
        { kind: 'metric', icon: 'bolt', value: '3', label: 'rules' },
      ],
      [
        { kind: 'text', icon: 'clock', text: 'Last login 2 days ago' },
        { kind: 'text', text: 'Created 2 Feb 2022' },
      ],
    ],
  },
};

/** A user who has never signed in — a stated answer, not a missing one. */
export const NeverSignedIn: Story = {
  args: {
    rows: [
      [{ kind: 'id', value: '00uFAKE9z8y7x6w5v', copyLabel: 'Copy user id' }],
      [{ kind: 'metric', icon: 'users', value: '0', label: 'groups' }],
      [{ kind: 'text', icon: 'clock', text: 'Last login never' }],
    ],
  },
};

/** At 360px the facts wrap within their rows rather than pushing the panel sideways. */
export const Narrow: Story = {
  args: Group.args,
  parameters: { viewport: { value: 'sidepanelCompact' } },
};

/** Every row empty: renders nothing, so the header's region collapses to zero height. */
export const Empty: Story = {
  args: { rows: [[], []] },
};
