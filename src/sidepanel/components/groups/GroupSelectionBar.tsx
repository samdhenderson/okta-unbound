import React from 'react';
import Button from '../shared/Button';

export type ActivePanel = 'none' | 'bulk' | 'crossSearch' | 'collections';

interface GroupSelectionBarProps {
  selectedCount: number;
  filteredCount: number;
  activePanel: ActivePanel;
  /** groupMembersCache.size — shown as the Cross-Search badge when > 0. */
  crossSearchBadge: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCompare: () => void;
  onTogglePanel: (panel: ActivePanel) => void;
  onExportSelection: () => void;
  onExportGroupsList: () => void;
}

/**
 * The "N of M selected" bar and its action buttons. Compare shows only for 2–5
 * selections; Bulk Actions and Export(N) only above 0; Export List is always present
 * but disabled at zero filtered rows.
 */
const GroupSelectionBar: React.FC<GroupSelectionBarProps> = ({
  selectedCount,
  filteredCount,
  activePanel,
  crossSearchBadge,
  onSelectAll,
  onDeselectAll,
  onCompare,
  onTogglePanel,
  onExportSelection,
  onExportGroupsList,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 rounded-md border border-neutral-200">
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-neutral-700">
        {selectedCount} of {filteredCount} selected
      </span>
      <Button variant="ghost" size="sm" onClick={onSelectAll}>
        Select All
      </Button>
      <Button variant="ghost" size="sm" onClick={onDeselectAll}>
        Deselect All
      </Button>
    </div>
    <div className="flex items-center gap-2 flex-wrap">
      {/* Compare Button */}
      {selectedCount >= 2 && selectedCount <= 5 && (
        <Button variant="secondary" size="sm" icon="chart" onClick={onCompare}>
          Compare ({selectedCount})
        </Button>
      )}

      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <Button
          variant="secondary"
          size="sm"
          icon="list"
          onClick={() => onTogglePanel('bulk')}
          className={activePanel === 'bulk' ? 'ring-2 ring-primary/20' : ''}
        >
          Bulk Actions
        </Button>
      )}

      {/* Cross-Group Search */}
      <Button
        variant="secondary"
        size="sm"
        icon="search"
        onClick={() => onTogglePanel('crossSearch')}
        className={activePanel === 'crossSearch' ? 'ring-2 ring-primary/20' : ''}
        badge={crossSearchBadge > 0 ? String(crossSearchBadge) : undefined}
      >
        Cross-Search
      </Button>

      {/* Collections */}
      <Button
        variant="secondary"
        size="sm"
        icon="clipboard"
        onClick={() => onTogglePanel('collections')}
        className={activePanel === 'collections' ? 'ring-2 ring-primary/20' : ''}
      >
        Collections
      </Button>

      {/* Export buttons */}
      {selectedCount > 0 && (
        <Button variant="secondary" size="sm" icon="download" onClick={onExportSelection}>
          Export ({selectedCount})
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        icon="download"
        onClick={onExportGroupsList}
        disabled={filteredCount === 0}
        title="Export the current groups list as CSV"
      >
        Export List
      </Button>
    </div>
  </div>
);

export default GroupSelectionBar;
