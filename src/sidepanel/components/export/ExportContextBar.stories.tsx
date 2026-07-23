import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent, within } from 'storybook/test';
import ExportContextBar from './ExportContextBar';
import type { EntityContextOption } from '../../export/types';

/** Fake type-ahead over groups. */
const searchGroups = async (query: string): Promise<EntityContextOption[]> => {
  const all: EntityContextOption[] = [
    { id: '00gFAKE001', label: 'Engineering', sublabel: 'OKTA_GROUP' },
    { id: '00gFAKE002', label: 'Engineering Managers', sublabel: 'OKTA_GROUP' },
    { id: '00gFAKE003', label: 'Sales', sublabel: 'APP_GROUP' },
  ];
  return all.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
};

/**
 * Search-to-select context picker: the admin picks the parent entity (a group,
 * an app) off-page before its rows are fetched. Composes `useSearchWithDropdown`
 * with the shared `SearchDropdown`.
 */
const meta = {
  title: 'Export/ExportContextBar',
  component: ExportContextBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    // heading-order disabled: this picker is a page fragment rendered out of its
    // heading context (no surrounding app-shell headings), so axe flags it in isolation.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          'Search-to-select context picker for the Export tab.\n\n' +
          'For descriptors scoped to a parent entity (a group, an app), the admin first picks ' +
          'that entity off-page. Composes `useSearchWithDropdown` (debounced type-ahead, ' +
          'two-character minimum) with the shared `SearchDropdown`, cycling through an empty ' +
          'input, a searching spinner, a results dropdown, and a selected-item summary. The ' +
          'chosen option is handed up to the tab hook, which builds the list endpoint from its ' +
          'id; clearing reports `null`.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs)',
      },
    },
  },
  argTypes: {
    label: { description: 'Field label for the picker (e.g. `Group`).' },
    placeholder: { description: 'Placeholder for the search input.' },
    search: { description: 'Type-ahead search over candidate context entities.' },
    onSelect: {
      description: 'Called with the chosen entity, or `null` when the selection is cleared.',
    },
  },
  args: {
    label: 'Group',
    placeholder: 'Search groups…',
    search: searchGroups,
    onSelect: fn(),
  },
} satisfies Meta<typeof ExportContextBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty picker — type at least two characters to search. */
export const Default: Story = {};

/** After typing, the debounced type-ahead surfaces matching groups in the dropdown. */
export const WithResults: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('Search groups…');
    await userEvent.type(input, 'Eng');
    await canvas.findByText('Engineering Managers');
  },
};

/** App-scoped context — the same picker reused for a different parent entity. */
export const AppContext: Story = {
  args: {
    label: 'App',
    placeholder: 'Search apps…',
    search: async (query: string): Promise<EntityContextOption[]> =>
      [
        { id: '0oaFAKE001', label: 'Salesforce', sublabel: 'SAML 2.0' },
        { id: '0oaFAKE002', label: 'Slack', sublabel: 'OIDC' },
      ].filter((option) => option.label.toLowerCase().includes(query.toLowerCase())),
  },
};
