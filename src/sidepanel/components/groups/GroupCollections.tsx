/**
 * @module sidepanel/components/groups/GroupCollections
 * @description Save, load, rename, and delete named sets of group ids ("collections")
 * persisted in `chrome.storage.local`.
 *
 * A collection captures the current selection so it can be re-selected later or
 * exported. Storage is local-only (no Okta API involved). Deleting a collection
 * slides its row out (`.animate-collapse-out`) before closing the gap, rather than
 * removing it from the array immediately.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Button, IconButton, Input } from '../shared';
import Icon from '../shared/Icon';
import type { GroupCollection, GroupSummary } from '../../../shared/types';
import { createLogger } from '../../../shared/utils/logger';
import { formatDateShort } from '../../../shared/utils/dateFormat';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const log = createLogger('GroupCollections');

/** `chrome.storage.local` key under which the collections array is persisted. */
const COLLECTIONS_STORAGE_KEY = 'okta_unbound_group_collections';

/**
 * Upper bound on the delete exit hold, in milliseconds. Mirrors `--dur-quick`
 * (140ms), the duration of `animate-collapse-out` in `tailwind.css` — keep the two
 * in step if that token moves. Only a fallback: the hold is normally released by
 * the row's own `animationend`.
 */
const DELETE_EXIT_MS = 140;

interface GroupCollectionsProps {
  /** Currently selected group ids — the payload saved into a new/updated collection. */
  selectedGroupIds: Set<string>;
  /** All loaded groups, used to resolve ids to display names. */
  groups: GroupSummary[];
  /** Applies a saved collection by selecting its group ids. */
  onLoadCollection: (groupIds: string[]) => void;
  /** Dismisses the panel. */
  onClose: () => void;
}

/** Generate a locally-unique collection id (`col_<time>_<rand>`). */
function generateId(): string {
  return `col_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Panel for managing saved collections of group selections. */
const GroupCollections: React.FC<GroupCollectionsProps> = ({
  selectedGroupIds,
  groups,
  onLoadCollection,
  onClose,
}) => {
  const [collections, setCollections] = useState<GroupCollection[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  // Id of the collection currently sliding out on delete, or null. Deletion is a
  // JS mount-hold (mirrors `Modal`'s exit pattern): the row stays in the list
  // wearing `.animate-collapse-out` until the animation ends (or the fallback
  // timeout fires), then the id is actually removed — so the row slides away and
  // the list closes the gap behind it, rather than snapping upward under the cursor.
  const [exitingId, setExitingId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  // Load collections from Chrome storage
  useEffect(() => {
    chrome.storage.local.get([COLLECTIONS_STORAGE_KEY], (result) => {
      if (result[COLLECTIONS_STORAGE_KEY]) {
        try {
          setCollections(JSON.parse(result[COLLECTIONS_STORAGE_KEY] as string));
        } catch (err) {
          log.error('Failed to parse collections:', err);
        }
      }
    });
  }, []);

  const saveCollections = useCallback((updated: GroupCollection[]) => {
    setCollections(updated);
    chrome.storage.local.set({ [COLLECTIONS_STORAGE_KEY]: JSON.stringify(updated) });
  }, []);

  const handleCreate = useCallback(() => {
    if (!newName.trim() || selectedGroupIds.size === 0) return;

    const collection: GroupCollection = {
      id: generateId(),
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      groupIds: Array.from(selectedGroupIds),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveCollections([collection, ...collections]);
    setNewName('');
    setNewDescription('');
    setShowCreate(false);
  }, [newName, newDescription, selectedGroupIds, collections, saveCollections]);

  // Actually removes the collection — called once the exit animation has run its
  // course (or immediately, under reduced motion). Reads `collections` via the
  // functional updater so it stays correct even if the exit hold outlives a
  // create/rename that changed the array in the meantime.
  const commitDelete = useCallback((id: string) => {
    setCollections((prev) => {
      const next = prev.filter((c) => c.id !== id);
      chrome.storage.local.set({ [COLLECTIONS_STORAGE_KEY]: JSON.stringify(next) });
      return next;
    });
    setExitingId((prev) => (prev === id ? null : prev));
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if (reducedMotion) {
        commitDelete(id);
        return;
      }
      setExitingId(id);
    },
    [reducedMotion, commitDelete],
  );

  // Fallback release for the exit hold: the row's own `animationend` normally
  // fires first, but this guarantees the delete still completes if the row is
  // unmounted some other way or the animation never dispatches (jsdom, tests).
  useEffect(() => {
    if (!exitingId) return;
    const id = exitingId;
    const timer = window.setTimeout(() => commitDelete(id), DELETE_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [exitingId, commitDelete]);

  const handleRename = useCallback(
    (id: string) => {
      if (!editName.trim()) return;
      saveCollections(
        collections.map((c) =>
          c.id === id ? { ...c, name: editName.trim(), updatedAt: Date.now() } : c,
        ),
      );
      setEditingId(null);
      setEditName('');
    },
    [editName, collections, saveCollections],
  );

  const handleUpdateGroupIds = useCallback(
    (id: string) => {
      if (selectedGroupIds.size === 0) return;
      saveCollections(
        collections.map((c) =>
          c.id === id ? { ...c, groupIds: Array.from(selectedGroupIds), updatedAt: Date.now() } : c,
        ),
      );
    },
    [selectedGroupIds, collections, saveCollections],
  );

  const getGroupName = useCallback(
    (groupId: string) => {
      return groups.find((g) => g.id === groupId)?.name || groupId.slice(0, 12) + '...';
    },
    [groups],
  );

  return (
    <div className="border border-neutral-200 rounded-md bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-(--sp-card)">
        <div>
          <h4 className="text-sm font-semibold text-neutral-900">Group Collections</h4>
          <p className="text-xs text-neutral-500 mt-0.5">
            {collections.length} saved collection{collections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="primary"
            size="sm"
            icon="plus"
            onClick={() => setShowCreate(true)}
            disabled={selectedGroupIds.size === 0}
            title={
              selectedGroupIds.size === 0
                ? 'Select groups first'
                : 'Save current selection as collection'
            }
          >
            Save
          </Button>
          <IconButton label="Close" onClick={onClose} variant="ghost" size="sm" className="ml-1">
            <Icon type="close" size="sm" />
          </IconButton>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="p-(--sp-card) border-b border-neutral-200 bg-primary-light space-y-(--sp-field)">
          <Input
            placeholder="Collection name..."
            value={newName}
            onChange={setNewName}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Input
            placeholder="Description (optional)..."
            value={newDescription}
            onChange={setNewDescription}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-primary-text">
              {selectedGroupIds.size} groups will be saved
            </span>
            <div className="flex gap-(--sp-field)">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreate(false);
                  setNewName('');
                  setNewDescription('');
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleCreate} disabled={!newName.trim()}>
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Collections List */}
      <div className="max-h-[300px] overflow-y-auto">
        {collections.length === 0 && !showCreate && (
          <div className="p-6 text-center text-sm text-neutral-500">
            No collections saved yet. Select groups and click Save to create one.
          </div>
        )}

        {collections.map((col) => (
          <div
            key={col.id}
            className={`p-(--sp-card) border-b border-neutral-100 last:border-b-0 ${
              col.id === exitingId ? 'pointer-events-none animate-collapse-out' : ''
            }`}
            onAnimationEnd={() => {
              if (col.id === exitingId) commitDelete(col.id);
            }}
          >
            {editingId === col.id ? (
              <div className="flex gap-(--sp-field)">
                <Input
                  value={editName}
                  onChange={setEditName}
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(col.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <Button variant="primary" size="sm" onClick={() => handleRename(col.id)}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-neutral-900">{col.name}</span>
                  <div className="flex items-center gap-1">
                    <IconButton
                      label="Load this collection (select these groups)"
                      onClick={() => onLoadCollection(col.groupIds)}
                      variant="ghost"
                      size="sm"
                    >
                      <Icon type="upload" size="sm" />
                    </IconButton>
                    <IconButton
                      label="Update with current selection"
                      onClick={() => handleUpdateGroupIds(col.id)}
                      variant="ghost"
                      size="sm"
                      disabled={selectedGroupIds.size === 0}
                    >
                      <Icon type="refresh" size="sm" />
                    </IconButton>
                    <IconButton
                      label="Rename"
                      onClick={() => {
                        setEditingId(col.id);
                        setEditName(col.name);
                      }}
                      variant="ghost"
                      size="sm"
                    >
                      <Icon type="pencil" size="sm" />
                    </IconButton>
                    <IconButton
                      label="Delete collection"
                      onClick={() => handleDelete(col.id)}
                      variant="danger"
                      size="sm"
                    >
                      <Icon type="trash" size="sm" />
                    </IconButton>
                  </div>
                </div>
                {col.description && (
                  <p className="text-xs text-neutral-500 mb-1.5">{col.description}</p>
                )}
                <div className="flex flex-wrap gap-(--sp-inline)">
                  {col.groupIds.slice(0, 5).map((gid) => (
                    <span
                      key={gid}
                      className="px-1.5 py-0.5 bg-neutral-50 text-xs text-neutral-600 rounded border border-neutral-200 truncate max-w-[150px]"
                    >
                      {getGroupName(gid)}
                    </span>
                  ))}
                  {col.groupIds.length > 5 && (
                    <span className="px-1.5 py-0.5 bg-neutral-50 text-xs text-neutral-500 rounded border border-neutral-200">
                      +{col.groupIds.length - 5} more
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-400 mt-1.5">
                  {col.groupIds.length} groups &middot; Updated {formatDateShort(col.updatedAt)}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GroupCollections;
