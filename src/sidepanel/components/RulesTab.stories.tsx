import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import RulesTab from './RulesTab';

/**
 * Rules tab shell: browse, search, filter, and manage group rules (rules load
 * on demand via the "Load Rules" button — nothing is fetched automatically).
 */
const meta = {
  title: 'Components/RulesTab',
  component: RulesTab,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Rules tab shell: browse, search, filter, and manage group rules.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Contexts](?path=/docs/internals-contexts--docs), ' +
          '[Rules engine](?path=/docs/internals-rules-engine--docs), ' +
          '[Scheduler & messaging](?path=/docs/internals-scheduler-messaging--docs)',
      },
    },
  },
  args: {
    targetTabId: 1,
    currentGroupId: undefined,
    oktaOrigin: 'https://example.okta.com',
    selectedRuleId: null,
    onRuleSelected: fn(),
    onNavigateToGroup: fn(),
  },
} satisfies Meta<typeof RulesTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Connected Okta tab, no rules loaded yet — shows the header and empty list panel. */
export const Default: Story = {};

/** No Okta tab connected — "Load Rules" will report a connection error. */
export const Disconnected: Story = {
  args: { targetTabId: undefined },
};

/** A group is detected on the page, enabling the "Current Group" filter once rules load. */
export const WithCurrentGroup: Story = {
  args: { currentGroupId: 'group123' },
};

/** Deep-linked from another tab to a specific rule id before any rules are loaded. */
export const DeepLinkedRule: Story = {
  args: { selectedRuleId: 'rule1' },
};
