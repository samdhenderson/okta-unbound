import type { Meta, StoryObj } from '@storybook/react-vite';
import GroupMetadataSection from './GroupMetadataSection';

const meta = {
  title: 'Groups/GroupMetadataSection',
  component: GroupMetadataSection,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "The group's own reference facts: description, id, and Okta's `created`/`lastUpdated` " +
          'timestamps. Body-only — no section chrome of its own — so its one caller, ' +
          '`GroupHealthPane`, folds it into a `CollapsibleSection` titled "About this group" ' +
          '(default closed) rather than rendering an always-visible card.',
      },
    },
  },
  argTypes: {
    groupId: { description: "The group's Okta id." },
    description: { description: "The group's Okta description, if it has one." },
    created: { description: 'When Okta created the group, if the payload carried it.' },
    lastUpdated: {
      description: 'When Okta last updated the group profile, if the payload carried it.',
    },
  },
  args: {
    groupId: '00gFAKEgroup00001',
    description: 'Engineering team — full-time and contract.',
    created: new Date('2022-03-01T12:00:00Z'),
    lastUpdated: new Date('2025-11-14T09:30:00Z'),
  },
} satisfies Meta<typeof GroupMetadataSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every field populated by Okta. */
export const Default: Story = {};

/** No description, and neither timestamp reported by Okta. */
export const Minimal: Story = {
  args: { description: undefined, created: undefined, lastUpdated: undefined },
};
