import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import JumpResultRow from './JumpResultRow';

const meta = {
  title: 'Home/JumpResultRow',
  component: JumpResultRow,
  parameters: {
    docs: {
      description: {
        component:
          'One row in the Home tab’s jump-bar results. The results list mixes kinds — a group, the ' +
          'rules that feed it, the user you searched for — so **every row names its destination on the ' +
          'right edge**. Pressing one is never a surprise.\n\n' +
          'A kind this build cannot navigate to does **not** render as a disabled row. A control that ' +
          'exists only to refuse is worse than no control (ADR-0039, "no verb without a wire"), so the ' +
          'row falls back to an `OpenInOktaLink` — a real, working route to the same entity. Today that ' +
          'is every app result, because `App.tsx` registers no `app` navigation handler. When one lands, ' +
          'the row upgrades itself with no change to this component.\n\n' +
          'A rule has no admin-console route of its own (it is only viewable inside its group), so an ' +
          'unreachable rule row shows no link rather than a fabricated one.',
      },
    },
  },
  argTypes: {
    result: { description: 'The resolved entity to render.' },
    onSelect: {
      description:
        'Open the entity on its owning tab. Omit to render the unreachable "Open in Okta" form.',
    },
    oktaOrigin: { description: 'Org origin for the Okta deep link. Fake in these stories.' },
  },
  args: {
    onSelect: fn(),
    oktaOrigin: 'https://example.okta.com',
    result: { kind: 'group', id: '00gFAKE0000000000001', name: 'Engineering' },
  },
} satisfies Meta<typeof JumpResultRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A reachable group: the right edge names the tab it opens. */
export const Group: Story = {};

/** A user, with the email carried on the secondary line. */
export const User: Story = {
  args: {
    result: {
      kind: 'user',
      id: '00uFAKE0000000000001',
      name: 'Ada Lovelace',
      secondary: 'ada@example.com',
    },
  },
};

/**
 * A rule resolved from the local snapshot, which carries its status for free —
 * the fact an admin looking up a rule most often wants.
 */
export const PausedRule: Story = {
  args: {
    result: {
      kind: 'rule',
      id: '0prFAKE0000000000001',
      name: 'Eng — All ICs',
      secondary: 'Paused',
    },
  },
};

/**
 * An app, which this build cannot open in-panel. The row degrades to a real Okta
 * link rather than to a dead or disabled control.
 */
export const UnreachableApp: Story = {
  args: {
    onSelect: undefined,
    result: { kind: 'app', id: '0oaFAKE0000000000001', name: 'Datadog' },
  },
};

/**
 * An unreachable rule. The admin console has no single-rule route, so the row
 * shows no link at all rather than inventing one.
 */
export const UnreachableRule: Story = {
  args: {
    onSelect: undefined,
    result: {
      kind: 'rule',
      id: '0prFAKE0000000000001',
      name: 'Eng — All ICs',
      secondary: 'Active',
    },
  },
};

/** Long names truncate rather than wrapping the row or pushing the mark off. */
export const LongName: Story = {
  args: {
    result: {
      kind: 'group',
      id: '00gFAKE0000000000002',
      name: 'Engineering — Platform — Identity and Access Management — On-call rotation',
      secondary: 'Every engineer carrying the identity pager, across all regions and time zones',
    },
  },
};
