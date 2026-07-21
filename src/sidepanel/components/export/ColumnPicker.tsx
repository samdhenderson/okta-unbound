/**
 * @module sidepanel/components/export/ColumnPicker
 * @description Inline collapsible column selector for the Export tab.
 *
 * A {@link CollapsibleSection} titled "Columns" whose body groups the descriptor's
 * catalog into `base | profile | custom` buckets (empty buckets skipped) and
 * renders each column as a {@link FilterPill} toggle chip. Fully controlled — the
 * enabled set and toggling are owned by the Export tab hook.
 */
import React from 'react';
import { CollapsibleSection, FilterPill } from '../shared';
import type { ColumnGroup, ExportColumn } from '../../export/types';

/** Props for {@link ColumnPicker}. */
interface ColumnPickerProps {
  /** The descriptor's full column catalog (grouped and rendered as chips). */
  catalog: ExportColumn<unknown>[];
  /** Ids of the currently enabled columns. */
  enabled: Set<string>;
  /** Toggle a single column on/off by id. */
  onToggle: (id: string) => void;
}

/** Display order + heading for each catalog bucket. */
const GROUP_ORDER: { key: ColumnGroup; label: string }[] = [
  { key: 'base', label: 'Identity' },
  { key: 'profile', label: 'Profile' },
  { key: 'custom', label: 'Custom' },
];

/**
 * Renders the grouped, chip-based column picker inside a collapsible panel. The
 * header badge shows how many columns are currently enabled.
 */
const ColumnPicker: React.FC<ColumnPickerProps> = ({ catalog, enabled, onToggle }) => {
  return (
    <CollapsibleSection title="Columns" defaultOpen itemCount={enabled.size}>
      <div className="space-y-4">
        {GROUP_ORDER.map(({ key, label }) => {
          const columns = catalog.filter((column) => column.group === key);
          if (columns.length === 0) return null;
          return (
            <div key={key} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {label}
              </div>
              <div className="flex flex-wrap gap-2">
                {columns.map((column) => (
                  <FilterPill
                    key={column.id}
                    active={enabled.has(column.id)}
                    onClick={() => onToggle(column.id)}
                    title={column.description}
                  >
                    {column.label}
                  </FilterPill>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
};

export default ColumnPicker;
