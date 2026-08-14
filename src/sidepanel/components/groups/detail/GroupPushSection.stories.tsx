import type { Meta, StoryObj } from '@storybook/react-vite';
import GroupPushSection from './GroupPushSection';
import type { PushGroupMapping } from '../../../../shared/types';

/** Obviously fake mappings — no real org data ever ships in a story. */
const mappings: PushGroupMapping[] = [
  {
    mappingId: '0pgFAKE1',
    sourceUserGroupId: '00gFAKE1',
    appId: '0oaFAKE1',
    appName: 'Salesforce',
    targetGroupName: 'Engineering (SFDC)',
    priority: 1,
  },
  {
    mappingId: '0pgFAKE2',
    sourceUserGroupId: '00gFAKE1',
    appId: '0oaFAKE2',
    appName: 'Zoom',
    targetGroupName: 'engineering-all',
  },
  {
    // No app name resolved: the row falls back to the raw app id.
    mappingId: '0pgFAKE3',
    sourceUserGroupId: '00gFAKE1',
    appId: '0oaFAKE3',
    targetGroupName: 'Engineering — All',
    priority: 5,
  },
];

const meta = {
  title: 'Groups/GroupPushSection',
  component: GroupPushSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          "One row per app this group's membership is pushed out to, naming the target group each push writes into.\n\n" +
          'Deliberately carries **no activation status**: `GET /api/v1/apps/{appId}/groups` returns none, so an ACTIVE/INACTIVE pill here would be an inference dressed up as an Okta fact. `priority` is the real returned field and is labelled as a priority, never as a state.\n\n' +
          '"Not pushed anywhere" (an empty array — a loaded fact) and "push mappings were never loaded" (`undefined` — the enrichment is non-fatal and can be skipped) are two different sentences, so an unknown is never rendered as a zero.\n\n' +
          "Each row is the shared `ListRow` at `compact` density (ADR-0029); the chrome was previously a hand-copy of `RuleLinkRow`'s container string.",
      },
    },
  },
  argTypes: {
    mappings: {
      description:
        'The group\'s push mappings. `undefined` renders as unknown, not as "none"; `[]` renders as "not pushed anywhere".',
    },
  },
  args: { mappings },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GroupPushSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three mappings: one fully resolved with a priority, one without, one id-only. */
export const Default: Story = {};

/** A loaded fact: this group is pushed nowhere. */
export const NotPushed: Story = {
  args: { mappings: [] },
};

/** The enrichment never ran — said as an unknown rather than as a zero. */
export const NotLoaded: Story = {
  args: { mappings: undefined },
};
