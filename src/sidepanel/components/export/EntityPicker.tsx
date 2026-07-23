/**
 * @module sidepanel/components/export/EntityPicker
 * @description The Export tab's entity hub — a scrollable list of exportable entities.
 *
 * Purely descriptor-driven: renders one selectable row (icon + name + description)
 * per {@link module:sidepanel/export/types.EntityExport}. Selecting a row hands its
 * id back to the tab, which enters the `configure` phase.
 */
import React from 'react';
import { ScrollableList, EmptyState } from '../shared';
import Icon from '../overview/shared/Icon';
import type { EntityExport } from '../../export/types';

/** Props for {@link EntityPicker}. */
interface EntityPickerProps {
  /** Ordered descriptors to offer, one selectable row each. */
  descriptors: EntityExport[];
  /** Invoked with the chosen descriptor id when a row is clicked. */
  onSelect: (id: string) => void;
}

/**
 * Renders the list of exportable entities. Shows an {@link EmptyState} when no
 * descriptors are registered.
 */
const EntityPicker: React.FC<EntityPickerProps> = ({ descriptors, onSelect }) => {
  if (descriptors.length === 0) {
    return (
      <EmptyState
        icon="download"
        title="No exports available"
        description="Connect to an Okta org to see the entities you can export."
      />
    );
  }

  return (
    <ScrollableList fillAvailable={false}>
      {descriptors.map((descriptor) => (
        // §3 raw-control exception: a selectable icon+title+description entity card;
        // no shared card primitive fits, and the shared Button is a centered CTA.
        // Kept keyboard-accessible via role="button" + Enter/Space handling.
        <div
          key={descriptor.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(descriptor.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(descriptor.id);
            }
          }}
          className="group flex items-start gap-4 bg-white rounded-md border border-neutral-200 p-5 cursor-pointer transition-all duration-100 hover:border-neutral-500 focus:outline-2 focus:outline-offset-2 focus:outline-primary"
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-primary-light text-primary-text shrink-0">
            <Icon type={descriptor.icon} size="md" />
          </div>
          <div className="flex-1 min-w-0">
            {/* h2: one level below the Export tab's PageHeader <h1>, matching the
                configure-phase section heading — avoids an h1→h4 heading-order skip. */}
            <h2 className="font-semibold text-neutral-900 group-hover:text-primary-text transition-colors duration-100">
              {descriptor.displayName}
            </h2>
            <p className="mt-0.5 text-sm text-neutral-600">{descriptor.description}</p>
          </div>
        </div>
      ))}
    </ScrollableList>
  );
};

export default EntityPicker;
