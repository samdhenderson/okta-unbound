import React, { useState, useMemo, useCallback } from 'react';
import Button from '../shared/Button';
import type { OktaUser } from '../../../shared/types';

interface CrossGroupSearchProps {
  groupMembersCache: Map<string, OktaUser[]>;
  groupNames: Map<string, string>;
  searchUserAcrossGroups: (
    query: string,
    cache: Map<string, OktaUser[]>,
    names: Map<string, string>
  ) => Array<{ groupId: string; groupName: string; user: OktaUser }>;
  onRemoveUserFromGroups: (userId: string, groupIds: string[]) => Promise<void>;
  onClose: () => void;
}

const CrossGroupSearch: React.FC<CrossGroupSearchProps> = ({
  groupMembersCache,
  groupNames,
  searchUserAcrossGroups,
  onRemoveUserFromGroups,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [selectedRemovals, setSelectedRemovals] = useState<Set<string>>(new Set()); // "userId_groupId"
  const [removing, setRemoving] = useState(false);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    return searchUserAcrossGroups(query, groupMembersCache, groupNames);
  }, [query, groupMembersCache, groupNames, searchUserAcrossGroups]);

  // Group results by user
  const groupedResults = useMemo(() => {
    const byUser = new Map<string, { user: OktaUser; groups: Array<{ groupId: string; groupName: string }> }>();
    for (const r of results) {
      if (!byUser.has(r.user.id)) {
        byUser.set(r.user.id, { user: r.user, groups: [] });
      }
      byUser.get(r.user.id)!.groups.push({ groupId: r.groupId, groupName: r.groupName });
    }
    return Array.from(byUser.values());
  }, [results]);

  const toggleRemoval = useCallback((userId: string, groupId: string) => {
    const key = `${userId}_${groupId}`;
    setSelectedRemovals((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleBulkRemove = useCallback(async () => {
    if (selectedRemovals.size === 0) return;
    setRemoving(true);

    // Group by userId for batch processing
    const byUser = new Map<string, string[]>();
    for (const key of selectedRemovals) {
      const [userId, groupId] = key.split('_');
      if (!byUser.has(userId)) byUser.set(userId, []);
      byUser.get(userId)!.push(groupId);
    }

    try {
      for (const [userId, groupIds] of byUser) {
        await onRemoveUserFromGroups(userId, groupIds);
      }
      setSelectedRemovals(new Set());
    } finally {
      setRemoving(false);
    }
  }, [selectedRemovals, onRemoveUserFromGroups]);

  const cachedGroupCount = groupMembersCache.size;

  return (
    <div className="border border-neutral-200 rounded-md bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-neutral-50 border-b border-neutral-200">
        <div>
          <h4 className="text-sm font-semibold text-neutral-900">Cross-Group User Search</h4>
          <p className="text-xs text-neutral-500 mt-0.5">
            Searching across {cachedGroupCount} cached group{cachedGroupCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-neutral-700 rounded-md hover:bg-neutral-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-neutral-100">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by name, email, or login..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-md bg-white placeholder-neutral-400 focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary"
            autoFocus
          />
        </div>
        {cachedGroupCount === 0 && (
          <p className="text-xs text-warning-text mt-2">
            No groups have been cached yet. Load members via group comparison or export to populate the cache.
          </p>
        )}
      </div>

      {/* Results */}
      {groupedResults.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto">
          {groupedResults.map(({ user, groups }) => (
            <div key={user.id} className="p-3 border-b border-neutral-100 last:border-b-0">
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-sm font-medium text-neutral-900">
                    {user.profile.firstName} {user.profile.lastName}
                  </span>
                  <span className="text-xs text-neutral-500 ml-2">{user.profile.email}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  user.status === 'ACTIVE' ? 'bg-success-light text-success-text' : 'bg-neutral-100 text-neutral-600'
                }`}>
                  {user.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {groups.map(({ groupId, groupName }) => {
                  const key = `${user.id}_${groupId}`;
                  const isSelected = selectedRemovals.has(key);
                  return (
                    <button
                      key={groupId}
                      onClick={() => toggleRemoval(user.id, groupId)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-danger-light text-danger-text border border-danger-light line-through'
                          : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400'
                      }`}
                      title={isSelected ? 'Click to keep in group' : 'Click to mark for removal'}
                    >
                      {groupName}
                      {isSelected && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {query.length >= 2 && groupedResults.length === 0 && (
        <div className="p-6 text-center text-sm text-neutral-500">
          No users found matching &ldquo;{query}&rdquo; in cached groups
        </div>
      )}

      {/* Footer Actions */}
      {selectedRemovals.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-danger-light border-t border-neutral-200">
          <span className="text-xs font-medium text-danger-text">
            {selectedRemovals.size} removal{selectedRemovals.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedRemovals(new Set())}>
              Clear
            </Button>
            <Button variant="danger" size="sm" loading={removing} onClick={handleBulkRemove}>
              Remove Selected
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossGroupSearch;
