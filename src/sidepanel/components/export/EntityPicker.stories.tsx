import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { z } from 'zod';
import EntityPicker from './EntityPicker';
import type { EntityExport } from '../../export/types';

/** Fake descriptors spanning a whole-org and a search-to-select entity. */
const descriptors: EntityExport[] = [
  {
    id: 'users',
    displayName: 'Users',
    icon: 'user',
    description: 'All users in the org with identity and profile attributes.',
    context: { kind: 'whole-org' },
    endpoint: '/api/v1/users',
    defaultQuery: {},
    schema: z.unknown(),
    columnCatalog: [],
    filter: { kind: 'none' },
  },
  {
    id: 'group-memberships',
    displayName: 'Group Memberships',
    icon: 'users',
    description: 'Members of a specific group you choose.',
    context: {
      kind: 'search-to-select',
      label: 'Group',
      placeholder: 'Search groups…',
      endpoint: (id) => `/api/v1/groups/${id}/users`,
    },
    defaultQuery: {},
    schema: z.unknown(),
    columnCatalog: [],
    filter: { kind: 'none' },
  },
];

/**
 * The Export tab's entity hub — a scrollable list of selectable entity cards
 * (icon + name + description), one per registered descriptor.
 */
const meta = {
  title: 'Export/EntityPicker',
  component: EntityPicker,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    descriptors,
    onSelect: fn(),
  },
} satisfies Meta<typeof EntityPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The populated hub. */
export const Default: Story = {};

/** No descriptors registered — the empty state. */
export const Empty: Story = {
  args: { descriptors: [] },
};
