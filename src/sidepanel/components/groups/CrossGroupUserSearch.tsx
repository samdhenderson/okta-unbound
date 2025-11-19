import React, { useState } from 'react';

interface CrossGroupUserSearchProps {
  targetTabId: number | null;
  onFindUser: (query: string) => Promise<any>;
  onRemoveFromGroups?: (userId: string, groupIds: string[]) => Promise<void>;
  oktaOrigin?: string;
}

const CrossGroupUserSearch: React.FC<CrossGroupUserSearchProps> = ({
  targetTabId,
  onFindUser,
  onRemoveFromGroups,
  oktaOrigin,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    setSearching(true);
    setError(null);
    setSearchResult(null);
    setSelectedGroups(new Set());

    try {
      const result = await onFindUser(searchQuery);
      setSearchResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find user');
    } finally {
      setSearching(false);
    }
  };

  const handleToggleGroup = (groupId: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const handleSelectAll = () => {
    if (searchResult?.groups) {
      setSelectedGroups(new Set(searchResult.groups.map((g: any) => g.id)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedGroups(new Set());
  };

  const handleRemoveFromSelected = async () => {
    if (!searchResult?.user || selectedGroups.size === 0) return;

    if (!confirm(`Remove ${searchResult.user.profile.email} from ${selectedGroups.size} group(s)?`)) {
      return;
    }

    if (onRemoveFromGroups) {
      try {
        await onRemoveFromGroups(searchResult.user.id, Array.from(selectedGroups));
        // Refresh search results
        handleSearch();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove user from groups');
      }
    }
  };

  const handleOpenUserInOkta = () => {
    if (oktaOrigin && searchResult?.user) {
      window.open(`${oktaOrigin}/admin/user/profile/view/${searchResult.user.id}`, '_blank');
    }
  };

  return (
    <div className="cross-group-user-search">
      <h3>Find User Across All Groups</h3>
      <p className="section-description">
        Search for a user by email, name, or ID to see all groups they belong to.
      </p>

      <div className="search-box">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Enter email, name, or user ID..."
          disabled={searching}
        />
        <button
          className="btn-primary"
          onClick={handleSearch}
          disabled={searching || !targetTabId}
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {searchResult && (
        <div className="search-results">
          <div className="user-info-card">
            <div className="user-info-header">
              <h4>
                {searchResult.user.profile.firstName} {searchResult.user.profile.lastName}
              </h4>
              {oktaOrigin && (
                <button className="btn-secondary" onClick={handleOpenUserInOkta}>
                  View in Okta ↗
                </button>
              )}
            </div>
            <div className="user-info-details">
              <div><strong>Email:</strong> {searchResult.user.profile.email}</div>
              <div><strong>Status:</strong> <span className={`status-badge ${searchResult.user.status.toLowerCase()}`}>{searchResult.user.status}</span></div>
              <div><strong>User ID:</strong> <code>{searchResult.user.id}</code></div>
            </div>
          </div>

          <div className="user-groups-section">
            <div className="user-groups-header">
              <h4>Group Memberships ({searchResult.groups?.length || 0})</h4>
              {searchResult.groups?.length > 0 && (
                <div className="bulk-actions">
                  <button className="btn-link" onClick={handleSelectAll}>
                    Select All
                  </button>
                  <button className="btn-link" onClick={handleDeselectAll}>
                    Deselect All
                  </button>
                  {selectedGroups.size > 0 && onRemoveFromGroups && (
                    <button
                      className="btn-danger"
                      onClick={handleRemoveFromSelected}
                    >
                      Remove from {selectedGroups.size} Group{selectedGroups.size !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              )}
            </div>

            {searchResult.groups?.length === 0 ? (
              <p className="empty-state">This user is not a member of any groups.</p>
            ) : (
              <div className="groups-list">
                {searchResult.groups?.map((group: any) => (
                  <div
                    key={group.id}
                    className={`group-item ${selectedGroups.has(group.id) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroups.has(group.id)}
                      onChange={() => handleToggleGroup(group.id)}
                    />
                    <div className="group-item-info">
                      <div className="group-item-name">{group.profile?.name || group.id}</div>
                      <div className="group-item-meta">
                        <span className={`badge ${group.type === 'OKTA_GROUP' ? 'badge-primary' : 'badge-warning'}`}>
                          {group.type?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    {oktaOrigin && (
                      <button
                        className="btn-icon"
                        onClick={() => window.open(`${oktaOrigin}/admin/group/${group.id}`, '_blank')}
                        title="Open group in Okta"
                      >
                        ↗
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossGroupUserSearch;
