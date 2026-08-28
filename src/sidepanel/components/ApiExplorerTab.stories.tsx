import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import ApiExplorerTab from './ApiExplorerTab';
import { useOktaApi, makeUseOktaApiValue } from '../../../.storybook/mocks/useOktaApi.mock';

/**
 * API Explorer tab: a locked-to-GET request bar and a response viewer that
 * switches between a values-free Shape outline, a redacted value tree, and the
 * raw response.
 */
const meta = {
  title: 'ApiExplorer/ApiExplorerTab',
  component: ApiExplorerTab,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    // heading-order disabled: this story renders the tab as a page fragment out of
    // its heading context (no surrounding app shell), so axe flags the isolated heading.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          "A dev-tool surface for discovering what an Okta endpoint's response actually " +
          'contains. GET-only by design: it reuses `makeApiRequest` exactly as every other ' +
          'feature does (same same-origin-path guard, same method allow-list, same scheduler), ' +
          'with no new message action and no write surface.\n\n' +
          'The response viewer defaults to the values-free Shape view; Redacted and Raw are ' +
          'one click away.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Scheduler & messaging](?path=/docs/internals-scheduler-messaging--docs)',
      },
    },
  },
  argTypes: {
    targetTabId: {
      description: 'Chrome tab id of the connected Okta tab; sending is disabled when null.',
    },
    oktaOrigin: {
      description: 'Okta org origin, used to redact it out of embedded response URLs.',
    },
  },
  args: {
    targetTabId: 1,
    oktaOrigin: 'https://example.okta.com',
  },
  beforeEach: () => {
    useOktaApi.mockReturnValue(makeUseOktaApiValue());
  },
} satisfies Meta<typeof ApiExplorerTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No request sent yet — the empty state names the affordance. */
export const Default: Story = {};

/** A GET fired and answered — the Shape view over a populated response. */
export const Sent: Story = {
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        makeApiRequest: fn(async () => ({
          success: true,
          status: 200,
          data: {
            id: '00uFAKE000000000001',
            status: 'ACTIVE',
            profile: { login: 'ada@example.com' },
          },
        })),
      }),
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'API path' });
    await userEvent.type(input, '/api/v1/users/00uFAKE000000000001');
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(canvas.getByText('200')).toBeInTheDocument());
  },
};

/** The request failed — a dismissible `danger` banner above the untouched empty state. */
export const ErrorState: Story = {
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        makeApiRequest: fn(async () => ({ success: false, error: 'Endpoint not found' })),
      }),
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'API path' });
    await userEvent.type(input, '/api/v1/nope');
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(canvas.getByText('Endpoint not found')).toBeInTheDocument());
  },
};

/** No Okta tab connected — Send stays disabled regardless of path. */
export const Disconnected: Story = {
  args: { targetTabId: null },
};
