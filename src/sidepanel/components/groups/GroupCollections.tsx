import React, { useState, useEffect, useCallback } from 'react';
import Button from '../shared/Button';
import type { GroupCollection, GroupSummary } from '../../../shared/types';

const COLLECTIONS_STORAGE_KEY = 'okta_unbound_group_collections';

interface GroupCollectionsProps {
  selectedGroupIds: Set<string>;
  groups: GroupSummary[];
  onLoadCollection: (groupIds: string[]) => void;
  onClose: () => void;
}

function generateId(): string {
  return `col_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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

  // Load collections from Chrome storage
  useEffect(() => {
    chrome.storage.local.get([COLLECTIONS_STORAGE_KEY], (result) => {
      if (result[COLLECTIONS_STORAGE_KEY]) {
        try {
          setCollections(JSON.parse(result[COLLECTIONS_STORAGE_KEY] as string));
        } catch (err) {
          console.error('Failed to parse collections:', err);
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

  const handleDelete = useCallback((id: string) => {
    saveCollections(collections.filter((c) => c.id !== id));
  }, [collections, saveCollections]);

  const handleRename = useCallback((id: string) => {
    if (!editName.trim()) return;
    saveCollections(
      collections.map((c) => c.id === id ? { ...c, name: editName.trim(), updatedAt: Date.now() } : c)
    );
    setEditingId(null);
    setEditName('');
  }, [editName, collections, saveCollections]);

  const handleUpdateGroupIds = useCallback((id: string) => {
    if (selectedGroupIds.size === 0) return;
    saveCollections(
      collections.map((c) =>
        c.id === id ? { ...c, groupIds: Array.from(selectedGroupIds), updatedAt: Date.now() } : c
      )
    );
  }, [selectedGroupIds, collections, saveCollections]);

  const getGroupName = useCallback((groupId: string) => {
    return groups.find((g) => g.id === groupId)?.name || groupId.slice(0, 12) + '...';
  }, [groups]);

  return (
    <div className="border border-neutral-200 rounded-md bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-neutral-50 border-b border-neutral-200">
        <div>
          <h4 className="text-sm font-semibold text-neutral-900">Group Collections</h4>
          <p className="text-xs text-neutral-500 mt-0.5">{collections.length} saved collection{collections.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="primary"
            size="sm"
            icon="plus"
            onClick={() => setShowCreate(true)}
            disabled={selectedGroupIds.size === 0}
            title={selectedGroupIds.size === 0 ? 'Select groups first' : 'Save current selection as collection'}
          >
            Save
          </Button>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-md hover:bg-neutral-100 transition-colors ml-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="p-3 border-b border-neutral-200 bg-primary-light space-y-2">
          <input
            type="text"
            placeholder="Collection name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md bg-white focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <input
            type="text"
            placeholder="Description (optional)..."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md bg-white focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-primary-text">{selectedGroupIds.size} groups will be saved</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setShowCreate(false); setNewName(''); setNewDescription(''); }}>
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
          <div key={col.id} className="p-3 border-b border-neutral-100 last:border-b-0">
            {editingId === col.id ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-neutral-200 rounded-md focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(col.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <Button variant="primary" size="sm" onClick={() => handleRename(col.id)}>Save</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-neutral-900">{col.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onLoadCollection(col.groupIds)}
                      className="p-1 text-primary-text hover:bg-primary-light rounded transition-colors"
                      title="Load this collection (select these groups)"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleUpdateGroupIds(col.id)}
                      className="p-1 text-neutral-400 hover:text-warning-text hover:bg-warning-light rounded transition-colors"
                      title="Update with current selection"
                      disabled={selectedGroupIds.size === 0}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setEditingId(col.id); setEditName(col.name); }}
                      className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
                      title="Rename"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(col.id)}
                      className="p-1 text-neutral-400 hover:text-danger-text hover:bg-danger-light rounded transition-colors"
                      title="Delete collection"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                {col.description && (
                  <p className="text-xs text-neutral-500 mb-1.5">{col.description}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {col.groupIds.slice(0, 5).map((gid) => (
                    <span key={gid} className="px-1.5 py-0.5 bg-neutral-50 text-xs text-neutral-600 rounded border border-neutral-200 truncate max-w-[150px]">
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
                  {col.groupIds.length} groups &middot; Updated {new Date(col.updatedAt).toLocaleDateString()}
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
