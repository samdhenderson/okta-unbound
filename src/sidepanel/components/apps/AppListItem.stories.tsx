import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import AppListItem from './AppListItem';
import type { AppAssignmentCounts } from '../../hooks/useOktaApi/appOperations';
import type { OktaAppListItem } from '../../../shared/schemas/okta';

const salesforce = {
  id: '0oaFAKE0001',
  name: 'salesforce',
  label: 'Salesforce',
  status: 'ACTIVE',
  signOnMode: 'SAML_2_0',
  created: '2026-01-15T09:00:00.000Z',
  lastUpdated: '2026-06-02T11:30:00.000Z',
} as OktaAppListItem;

/** A single expandable, read-only row in the Applications list. */
const meta = {
  title: 'Apps/AppListItem',
  component: AppListItem,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A single expandable, read-only row in the Applications list.\n\n' +
          'Collapsed it shows the display label, status badge, sign-on mode, app key, and ' +
          'created date. Expanding reveals the ids/dates, an "Open in Okta" deep link built ' +
          'from the validated org origin, and — fetched lazily only once the row is open, ' +
          "then cached by app id — the app's user/group assignment counts.",
      },
    },
  },
  argTypes: {
    app: { description: 'The app to render.' },
    oktaOrigin: {
      description: 'Okta org origin, enabling the "Open in Okta" deep link when present.',
    },
    fetchAssignmentCounts: {
      description:
        "Loads this app's assignment counts; called only once the row is expanded. Must be stable.",
    },
  },
  args: {
    app: salesforce,
    oktaOrigin: 'https://example.okta.com',
    fetchAssignmentCounts: fn(async (): Promise<AppAssignmentCounts | null> => ({
      users: 128,
      groups: 4,
    })),
  },
} satisfies Meta<typeof AppListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An active SAML app with a full set of metadata. */
export const Default: Story = {};

/**
 * Expanded — the detail grid, the copyable application id, and the lazily-fetched
 * assignment counts. The copy control is named after the app *and* its id
 * (`Copy application id for Salesforce (0oaFAKE0001)`) because several rows can
 * be open at once and two apps can share a display label (I-010).
 */
export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Expand Salesforce' }));
    await waitFor(() =>
      expect(
        canvas.getByRole('button', {
          name: `Copy application id for Salesforce (${salesforce.id})`,
        }),
      ).toBeInTheDocument(),
    );
    await waitFor(() => expect(canvas.getByText('128 users')).toBeInTheDocument());
  },
};

/**
 * Two rows sharing a display label, different ids — legitimate in Okta (e.g. two
 * app instances both labelled "Salesforce"). The copy control folds the id in, so
 * the two stay distinguishable by accessible name alone (I-010). The
 * Expand/Collapse control names the app but stops there (D-103) — which fixes
 * the every-row ambiguity a bare "Expand" had, and leaves this rarer
 * same-label case for `D-107` to disambiguate conditionally. Both toggles
 * below therefore still read "Expand Salesforce"; that is the current
 * contract, asserted deliberately rather than by accident.
 */
export const DuplicateLabelsStayDistinguishable: Story = {
  render: (args) => (
    <div className="space-y-2">
      <AppListItem {...args} app={{ ...salesforce, id: '0oaFAKE0001' }} />
      <AppListItem {...args} app={{ ...salesforce, id: '0oaFAKE0099' }} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggles = canvas.getAllByRole('button', { name: 'Expand Salesforce' });
    expect(toggles).toHaveLength(2);
    await userEvent.click(toggles[0]);
    await userEvent.click(toggles[1]);

    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Copy application id for Salesforce (0oaFAKE0001)' }),
      ).toBeInTheDocument(),
    );
    await expect(
      canvas.getByRole('button', { name: 'Copy application id for Salesforce (0oaFAKE0099)' }),
    ).toBeInTheDocument();
  },
};

/** An inactive app — neutral status badge. */
export const Inactive: Story = {
  args: {
    app: {
      id: '0oaFAKE0002',
      name: 'workday',
      label: 'Workday HR',
      status: 'INACTIVE',
      signOnMode: 'SAML_2_0',
      created: '2026-03-01T09:00:00.000Z',
    } as OktaAppListItem,
  },
};

/** A lenient row where Okta returned only the id — the label falls back to it. */
export const MinimalFields: Story = {
  args: { app: { id: '0oaFAKE0009' } as OktaAppListItem },
};

/** No org origin known yet — the "Open in Okta" link hides itself. */
export const NoOktaOrigin: Story = {
  args: { oktaOrigin: undefined },
};

/** Assignment counts are unavailable (the count walk failed). */
export const AssignmentCountsUnavailable: Story = {
  args: {
    app: { ...salesforce, id: '0oaFAKE0011' } as OktaAppListItem,
    fetchAssignmentCounts: fn(async (): Promise<AppAssignmentCounts | null> => null),
  },
};
