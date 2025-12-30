import React, { useState, useEffect, useCallback } from 'react';
import type { GroupCollection } from '../../../shared/types';
import Modal from '../shared/Modal';

interface GroupCollectionsProps {
  selectedGroupIds: string[];
  onLoadCollection: (groupIds: string[]) => void;
}

const COLLECTIONS_KEY = 'okta_unbound_group_collections';

const GroupCollections: React.FC<GroupCollectionsProps> = ({
  selectedGroupIds,
  onLoadCollection,
}) => {
  const [collections, setCollections] = useState<GroupCollection[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load collections from storage
  useEffect(() => {
    chrome.storage.local.get([COLLECTIONS_KEY], (result) => {
      if (result[COLLECTIONS_KEY]) {
        const stored = JSON.parse(result[COLLECTIONS_KEY] as string);
        // Convert date strings back to Date objects
        const parsed = stored.map((c: GroupCollection) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          lastUsed: new Date(c.lastUsed),
        }));
        setCollections(parsed);
      }
    });
  }, []);

  // Save collections to storage
  const saveCollections = useCallback((updatedCollections: GroupCollection[]) => {
    chrome.storage.local.set({
      [COLLECTIONS_KEY]: JSON.stringify(updatedCollections),
    });
    setCollections(updatedCollections);
  }, []);

  const handleCreateCollection = useCallback(() => {
    if (!newCollectionName.trim()) {
      return;
    }

    if (selectedGroupIds.length === 0) {
      return;
    }

    const newCollection: GroupCollection = {
      id: crypto.randomUUID(),
      name: newCollectionName.trim(),
      description: newCollectionDescription.trim(),
      groupIds: [...selectedGroupIds],
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    saveCollections([...collections, newCollection]);
    setNewCollectionName('');
    setNewCollectionDescription('');
    setShowCreateModal(false);
  }, [newCollectionName, newCollectionDescription, selectedGroupIds, collections, saveCollections]);

  const handleLoadCollection = useCallback((collection: GroupCollection) => {
    // Update last used timestamp
    const updated = collections.map((c) =>
      c.id === collection.id ? { ...c, lastUsed: new Date() } : c
    );
    saveCollections(updated);
    onLoadCollection(collection.groupIds);
  }, [collections, saveCollections, onLoadCollection]);

  const handleDeleteCollection = useCallback((id: string) => {
    saveCollections(collections.filter((c) => c.id !== id));
    setShowDeleteConfirm(null);
  }, [collections, saveCollections]);

  const handleUpdateCollection = useCallback((id: string) => {
    if (selectedGroupIds.length === 0) {
      return;
    }

    const updated = collections.map((c) =>
      c.id === id ? { ...c, groupIds: [...selectedGroupIds], lastUsed: new Date() } : c
    );
    saveCollections(updated);
    setEditingId(null);
  }, [selectedGroupIds, collections, saveCollections]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const sortedCollections = [...collections].sort(
    (a, b) => b.lastUsed.getTime() - a.lastUsed.getTime()
  );

  return (
    <div
      className="mt-6 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
      style={{ fontFamily: 'var(--font-primary)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-[#007dc1] to-[#3d9dd9] rounded-lg shadow-sm">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Saved Collections</h3>
            <p className="text-xs text-gray-500">
              {collections.length === 0
                ? 'Save group selections for quick access'
                : `${collections.length} collection${collections.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateModal(true);
            }}
            disabled={selectedGroupIds.length === 0}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
              flex items-center gap-2
              ${selectedGroupIds.length > 0
                ? 'bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white shadow-sm hover:shadow-md hover:from-[#006aa3] hover:to-[#3589c4]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
            title={selectedGroupIds.length === 0 ? 'Select groups first' : 'Save current selection as collection'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Save Selection
            {selectedGroupIds.length > 0 && (
              <span className="px-1.5 py-0.5 bg-white/20 rounded text-xs font-bold">
                {selectedGroupIds.length}
              </span>
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
            aria-label={isCollapsed ? 'Expand collections' : 'Collapse collections'}
          >
            <svg
              className={`w-5 h-5 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-5">
          {collections.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">No saved collections</p>
              <p className="text-xs text-gray-500">
                Select groups above and click "Save Selection" to create a collection
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedCollections.map((collection) => (
                <div
                  key={collection.id}
                  className={`
                    group relative overflow-hidden rounded-xl border transition-all duration-200
                    ${editingId === collection.id
                      ? 'border-[#007dc1] ring-2 ring-[#007dc1]/20 bg-blue-50/30'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                    }
                  `}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* Collection Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-gray-900 truncate">
                            {collection.name}
                          </h4>
                          {editingId === collection.id && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                              Editing
                            </span>
                          )}
                        </div>

                        {collection.description && (
                          <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                            {collection.description}
                          </p>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="font-medium text-gray-700">{collection.groupIds.length}</span>
                            group{collection.groupIds.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-gray-300">|</span>
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Used {formatDate(collection.lastUsed)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {editingId === collection.id ? (
                          <>
                            <button
                              onClick={() => handleUpdateCollection(collection.id)}
                              disabled={selectedGroupIds.length === 0}
                              className={`
                                px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200
                                flex items-center gap-1.5
                                ${selectedGroupIds.length > 0
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }
                              `}
                              title={selectedGroupIds.length === 0 ? 'Select groups first' : 'Update with current selection'}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Save ({selectedGroupIds.length})
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleLoadCollection(collection)}
                              className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white rounded-lg hover:shadow-md transition-all duration-200 flex items-center gap-1.5"
                              title="Load this collection"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              Load
                            </button>
                            <button
                              onClick={() => setEditingId(collection.id)}
                              className="p-1.5 text-gray-400 hover:text-[#007dc1] hover:bg-blue-50 rounded-lg transition-all duration-200"
                              title="Edit this collection"
                              aria-label="Edit collection"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(collection.id)}
                              className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all duration-200"
                              title="Delete this collection"
                              aria-label="Delete collection"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Collection Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewCollectionName('');
          setNewCollectionDescription('');
        }}
        title="Create Collection"
        size="md"
        footer={
          <>
            <button
              onClick={() => {
                setShowCreateModal(false);
                setNewCollectionName('');
                setNewCollectionDescription('');
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCollection}
              disabled={!newCollectionName.trim() || selectedGroupIds.length === 0}
              className={`
                px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                ${newCollectionName.trim() && selectedGroupIds.length > 0
                  ? 'bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white hover:shadow-md'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              Create Collection
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Collection Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="e.g., Sales Teams"
              autoFocus
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200"
            />
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={newCollectionDescription}
              onChange={(e) => setNewCollectionDescription(e.target.value)}
              placeholder="e.g., All sales-related groups for quarterly cleanup"
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 resize-none"
            />
          </div>

          {/* Selection Info */}
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-800">
              This will save <span className="font-semibold">{selectedGroupIds.length}</span> selected group{selectedGroupIds.length !== 1 ? 's' : ''}.
            </p>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Delete Collection"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={() => showDeleteConfirm && handleDeleteCollection(showDeleteConfirm)}
              className="px-4 py-2 text-sm font-medium bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-all duration-200"
            >
              Delete
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-rose-100 rounded-full flex-shrink-0">
            <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-700">
              Are you sure you want to delete this collection? This action cannot be undone.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GroupCollections;
