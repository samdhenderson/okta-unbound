import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
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
  parameters: { layout: 'centered' },
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
