import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import AddToGroupModal from './AddToGroupModal';
import type { GroupSearchResult } from '../../hooks/useAddToGroup';

const groups: GroupSearchResult[] = [
  { id: 'g1', name: 'Engineering', description: 'Eng team', type: 'OKTA_GROUP' },
  { id: 'g2', name: 'Design', description: 'Product design', type: 'OKTA_GROUP' },
  { id: 'g3', name: 'Salesforce', description: 'App-assigned', type: 'APP_GROUP' },
];

/** The Users tab's Add-to-Group modal: a debounced group type-ahead over the shared Modal. */
const meta = {
  title: 'Users/AddToGroupModal',
  component: AddToGroupModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "The Users tab's Add-to-Group modal: a debounced group type-ahead over the shared Modal.\n\n" +
          'Fully controlled: the parent (via useAddToGroup) owns the query, the debounced results, the open/searching flags, and the selected group. Renders the type-ahead dropdown, an inline search spinner, the chosen-group chip, and a confirm button that stays disabled until a group is picked and shows its own spinner while the add is in flight.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), [Scheduler & messaging](?path=/docs/internals-scheduler-messaging--docs)',
      },
    },
  },
  args: {
    isOpen: true,
    userFirstName: 'Ada',
    groupSearchQuery: '',
    onGroupSearchQueryChange: fn(),
    groupSearchResults: [],
    isSearchingGroups: false,
    showGroupDropdown: false,
    selectedGroup: null,
    onSelectGroup: fn(),
    onClearSelectedGroup: fn(),
    isAddingToGroup: false,
    onClose: fn(),
    onConfirm: fn(),
  },
  argTypes: {
    isOpen: { description: 'Whether the modal is open.' },
    userFirstName: {
      description:
        'First name of the user being added; the title falls back to "User" when absent.',
    },
    groupSearchQuery: { description: 'Controlled group type-ahead query.' },
    onGroupSearchQueryChange: {
      description: 'Called with the new query string on each keystroke.',
    },
    groupSearchResults: { description: 'Current group search results shown in the dropdown.' },
    isSearchingGroups: {
      description: 'True while a debounced group search is in flight (shows the inline spinner).',
    },
    showGroupDropdown: { description: 'Whether the results dropdown should be shown.' },
    selectedGroup: { description: 'The chosen group, or null when none is selected yet.' },
    onSelectGroup: { description: 'Choose a group from the dropdown.' },
    onClearSelectedGroup: {
      description: 'Clear the chosen group (the selected-group "Clear" button).',
    },
    isAddingToGroup: {
      description: 'True while the add request is in flight (drives the confirm button spinner).',
    },
    onClose: { description: 'Close the modal (Cancel, Escape, overlay click, or header close).' },
    onConfirm: { description: 'Confirm the add of the selected group.' },
  },
} satisfies Meta<typeof AddToGroupModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty type-ahead; the confirm button is disabled until a group is chosen. */
export const Default: Story = {};

/** A query with an open results dropdown to pick from. */
export const WithResults: Story = {
  args: {
    groupSearchQuery: 'e',
    groupSearchResults: groups,
    showGroupDropdown: true,
  },
};

/** The debounced search is in flight — the inline spinner shows. */
export const Searching: Story = {
  args: {
    groupSearchQuery: 'eng',
    isSearchingGroups: true,
  },
};

/** A group has been chosen; the confirm button is enabled and shows the chip. */
export const GroupSelected: Story = {
  args: {
    selectedGroup: groups[0],
  },
};

/** The add request is in flight — the confirm button shows its loading spinner. */
export const Adding: Story = {
  args: {
    selectedGroup: groups[0],
    isAddingToGroup: true,
  },
};
