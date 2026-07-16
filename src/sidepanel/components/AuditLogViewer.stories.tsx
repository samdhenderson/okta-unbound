import type { Meta, StoryObj } from '@storybook/react-vite';
import AuditLogViewer from './AuditLogViewer';

/**
 * Read-only audit trail of extension actions, sourced from `chrome.storage`'s
 * undo history. Renders an expandable list of entries or an empty state.
 */
const meta = {
  title: 'Components/AuditLogViewer',
  component: AuditLogViewer,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AuditLogViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The `chrome.storage` fake used in Storybook always resolves to an empty
 * history, so this renders the "No audit history" empty state — the only
 * state reachable without a component/service mock.
 */
export const Default: Story = {};
