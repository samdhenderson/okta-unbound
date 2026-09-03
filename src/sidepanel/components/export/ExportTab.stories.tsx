import type { Meta, StoryObj } from '@storybook/react-vite';
import ExportTab from './ExportTab';
import { OrgEntityIndexProvider } from '../../contexts/OrgEntityIndexContext';

/**
 * The Export tab: a descriptor-driven hub for downloading Okta reports. The `pick`
 * phase lists exportable entities; selecting one enters the `configure` phase
 * (context picker, filter box, column picker, presets, preview + download).
 */
const meta = {
  title: 'Export/ExportTab',
  component: ExportTab,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Descriptor-driven Export tab. Consumes the Export Engine via `useOktaApi` ' +
          'and orchestrates the flow through `useExportTab`.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Scheduler & messaging](?path=/docs/internals-scheduler-messaging--docs), ' +
          '[Shared utilities](?path=/docs/internals-shared-utilities--docs)',
      },
    },
  },
  // The tab reads the shell's org snapshot for its report descriptors
  // (ADR-0065), so a story has to mount the same provider the shell does. With
  // a null origin it reads nothing and syncs nothing, which is the state a
  // disconnected panel is in — exactly what these stories want.
  decorators: [
    (Story) => (
      <OrgEntityIndexProvider oktaOrigin={null} targetTabId={null} enabled={false}>
        <Story />
      </OrgEntityIndexProvider>
    ),
  ],
  argTypes: {
    targetTabId: {
      description:
        'Chrome tab id of the connected Okta tab; export/preview are disabled when absent.',
    },
    oktaOrigin: { description: 'Okta org origin used to build per-row deep links in the preview.' },
  },
  args: {
    targetTabId: 42,
    oktaOrigin: 'https://example.okta.com',
  },
} satisfies Meta<typeof ExportTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Connected to an Okta tab, showing the entity hub. */
export const Default: Story = {};

/** No Okta tab connected — a banner explains export is disabled. */
export const Disconnected: Story = {
  args: { targetTabId: undefined },
};
