import React, { useState, useEffect } from 'react';
import type { GroupCollection } from '../../../shared/types';

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
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Load collections from storage
  useEffect(() => {
    chrome.storage.local.get([COLLECTIONS_KEY], (result) => {
      if (result[COLLECTIONS_KEY]) {
        const stored = JSON.parse(result[COLLECTIONS_KEY] as string);
        // Convert date strings back to Date objects
        const parsed = stored.map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          lastUsed: new Date(c.lastUsed),
        }));
        setCollections(parsed);
      }
    });
  }, []);

  // Save collections to storage
  const saveCollections = (updatedCollections: GroupCollection[]) => {
    chrome.storage.local.set({
      [COLLECTIONS_KEY]: JSON.stringify(updatedCollections),
    });
    setCollections(updatedCollections);
  };

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) {
      alert('Please enter a collection name');
      return;
    }

    if (selectedGroupIds.length === 0) {
      alert('Please select at least one group');
      return;
    }

    const newCollection: GroupCollection = {
      id: crypto.randomUUID(),
      name: newCollectionName,
      description: newCollectionDescription,
      groupIds: [...selectedGroupIds],
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    saveCollections([...collections, newCollection]);
    setNewCollectionName('');
    setNewCollectionDescription('');
    setShowCreateModal(false);
  };

  const handleLoadCollection = (collection: GroupCollection) => {
    // Update last used timestamp
    const updated = collections.map((c) =>
      c.id === collection.id ? { ...c, lastUsed: new Date() } : c
    );
    saveCollections(updated);
    onLoadCollection(collection.groupIds);
  };

  const handleDeleteCollection = (id: string) => {
    if (confirm('Are you sure you want to delete this collection?')) {
      saveCollections(collections.filter((c) => c.id !== id));
    }
  };

  const handleUpdateCollection = (id: string) => {
    if (selectedGroupIds.length === 0) {
      alert('Please select at least one group');
      return;
    }

    const updated = collections.map((c) =>
      c.id === id ? { ...c, groupIds: [...selectedGroupIds], lastUsed: new Date() } : c
    );
    saveCollections(updated);
    setEditingId(null);
  };

  return (
    <div className="group-collections">
      <div className="collections-header">
        <h3>Saved Collections</h3>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
          disabled={selectedGroupIds.length === 0}
          title={selectedGroupIds.length === 0 ? 'Select groups first' : 'Save current selection as collection'}
        >
          Save Selection ({selectedGroupIds.length})
        </button>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Collection</h3>
            <div className="form-group">
              <label>Collection Name:</label>
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="e.g., Sales Teams"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Description (optional):</label>
              <textarea
                value={newCollectionDescription}
                onChange={(e) => setNewCollectionDescription(e.target.value)}
                placeholder="e.g., All sales-related groups for quarterly cleanup"
                rows={3}
              />
            </div>
            <p className="info-text">
              This will save {selectedGroupIds.length} selected group{selectedGroupIds.length !== 1 ? 's' : ''}.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreateCollection}>
                Create Collection
              </button>
            </div>
          </div>
        </div>
      )}

      {collections.length === 0 ? (
        <p className="empty-state">
          No saved collections. Select groups and click &ldquo;Save Selection&rdquo; to create one.
        </p>
      ) : (
        <div className="collections-list">
          {collections
            .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
            .map((collection) => (
              <div key={collection.id} className="collection-item">
                <div className="collection-info">
                  <div className="collection-name">{collection.name}</div>
                  {collection.description && (
                    <div className="collection-description">{collection.description}</div>
                  )}
                  <div className="collection-meta">
                    {collection.groupIds.length} group{collection.groupIds.length !== 1 ? 's' : ''} •
                    Last used: {collection.lastUsed.toLocaleDateString()}
                  </div>
                </div>
                <div className="collection-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => handleLoadCollection(collection)}
                    title="Load these groups"
                  >
                    Load
                  </button>
                  {editingId === collection.id ? (
                    <button
                      className="btn-success"
                      onClick={() => handleUpdateCollection(collection.id)}
                      title="Update with current selection"
                    >
                      Update ({selectedGroupIds.length})
                    </button>
                  ) : (
                    <button
                      className="btn-icon"
                      onClick={() => setEditingId(collection.id)}
                      title="Update this collection"
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    className="btn-danger-outline"
                    onClick={() => handleDeleteCollection(collection.id)}
                    title="Delete collection"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default GroupCollections;
