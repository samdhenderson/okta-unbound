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
  parameters: { layout: 'centered' },
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
export const NoPresets: Story = {
  args: { presets: [] },
};

/** Saving is blocked (e.g. no columns enabled). */
export const CannotSave: Story = {
  args: { canSave: false },
};
