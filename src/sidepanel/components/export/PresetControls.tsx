/**
 * @module sidepanel/components/export/PresetControls
 * @description Saved-preset controls for the Export tab.
 *
 * Apply a saved column selection via the shared {@link Select}, save the current
 * selection under a name (shared {@link Input} + {@link Button}), and delete the
 * active preset. All persistence is owned by the tab hook (via `useExportPresets`);
 * this component is presentational plus a local "name" field.
 *
 * Housed in a {@link CollapsibleSection}, open by default only once a preset
 * exists — presets are a power-user feature most admins never touch on their
 * first export, so it stays out of the way until it is relevant.
 */
import React, { useState } from 'react';
import { CollapsibleSection, Select, Input, Button } from '../shared';
import type { ExportPreset } from '../../../shared/storage/presetStore';

/** Props for {@link PresetControls}. */
interface PresetControlsProps {
  /** Saved presets for the active entity, newest first. */
  presets: ExportPreset[];
  /** Id of the currently applied preset, or `null`. */
  activePresetId: string | null;
  /** Apply a saved preset by id. */
  onApply: (id: string) => void;
  /** Save the current selection under a name. */
  onSave: (name: string) => void;
  /** Delete a saved preset by id. */
  onDelete: (id: string) => void;
  /** Whether saving is allowed (e.g. at least one column enabled). */
  canSave: boolean;
}

/**
 * Renders the apply / save / delete preset affordances for the current entity.
 */
const PresetControls: React.FC<PresetControlsProps> = ({
  presets,
  activePresetId,
  onApply,
  onSave,
  onDelete,
  canSave,
}) => {
  const [name, setName] = useState('');

  const options = [
    { value: '', label: 'Apply a preset…' },
    ...presets.map((preset) => ({ value: preset.id, label: preset.name })),
  ];

  const handleSave = () => {
    onSave(name);
    setName('');
  };

  return (
    <CollapsibleSection title="Presets" defaultOpen={presets.length > 0} itemCount={presets.length}>
      <div className="space-y-(--sp-field)">
        <div className="flex items-end gap-(--sp-field)">
          <div className="flex-1">
            <Select
              ariaLabel="Apply a saved preset"
              value={activePresetId ?? ''}
              onChange={(value) => value && onApply(value)}
              options={options}
              disabled={presets.length === 0}
            />
          </div>
          {activePresetId && (
            <Button
              variant="ghost"
              size="sm"
              icon="trash"
              onClick={() => onDelete(activePresetId)}
              title="Delete the applied preset"
            >
              Delete
            </Button>
          )}
        </div>

        <div className="flex items-end gap-(--sp-field)">
          <div className="flex-1">
            <Input
              value={name}
              onChange={setName}
              ariaLabel="Preset name"
              placeholder="Name this selection"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim() && canSave) handleSave();
              }}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSave}
            disabled={!name.trim() || !canSave}
          >
            Save
          </Button>
        </div>
      </div>
    </CollapsibleSection>
  );
};

export default PresetControls;
