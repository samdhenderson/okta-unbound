import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import PresetControls from './PresetControls';
import type { ExportPreset } from '../../../shared/storage/presetStore';

/** Fake saved presets for the active entity. */
const presets: ExportPreset[] = [
  {
    id: 'p-1',
    entityId: 'users',
    name: 'Offboarding audit',
    enabledColumnIds: ['id', 'status', 'email'],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    version: 1,
  },
  {
    id: 'p-2',
    entityId: 'users',
    name: 'Full profile',
    enabledColumnIds: ['id', 'email', 'firstName', 'lastName', 'department'],
    filterText: 'status eq "ACTIVE"',
    createdAt: new Date('2026-02-01T00:00:00Z'),
    version: 1,
  },
];

/**
 * Saved-preset controls: apply a preset via the shared `Select`, save the current
 * selection under a name, and delete the applied preset.
 */
const meta = {
  title: 'Export/PresetControls',
  component: PresetControls,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Saved-preset controls for the Export tab.\n\n' +
          'Apply a saved column selection via the shared `Select`, save the current selection ' +
          'under a name (shared `Input` + `Button`), and delete the active preset. The apply ' +
          'dropdown is disabled when no presets exist; the delete affordance only appears once ' +
          'a preset is applied; saving is gated on `canSave` and a non-empty name. Persistence ' +
          'is owned by the tab hook — this component is presentational plus a local name field.',
      },
    },
  },
  argTypes: {
    presets: { description: 'Saved presets for the active entity, newest first.' },
    activePresetId: { description: 'Id of the currently applied preset, or `null`.' },
    onApply: { description: 'Apply a saved preset by id.' },
    onSave: { description: 'Save the current selection under a name.' },
    onDelete: { description: 'Delete a saved preset by id.' },
    canSave: { description: 'Whether saving is allowed (e.g. at least one column enabled).' },
  },
  args: {
    presets,
    activePresetId: null,
    onApply: fn(),
    onSave: fn(),
    onDelete: fn(),
    canSave: true,
  },
} satisfies Meta<typeof PresetControls>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Presets available; none applied yet. */
export const Default: Story = {};

/** A preset is applied — the delete affordance appears. */
export const PresetApplied: Story = {
  args: { activePresetId: 'p-1' },
};

/** No presets saved yet — the apply dropdown is disabled. */
export const Empty: Story = {
  args: { presets: [] },
};

/** Saving is blocked (e.g. no columns enabled). */
export const CannotSave: Story = {
  args: { canSave: false },
};
