/**
 * @module sidepanel/components/groups/CrossGroupSearch
 * @description Finds a user across all locally-cached group memberships and lets you
 * bulk-remove them from selected groups.
 *
 * Operates purely over the in-memory member cache (no API fetch to search); matches
 * are grouped by user, and the admin toggles per-group removals before committing.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Button, IconButton, Input } from '../shared';
import Icon from '../overview/shared/Icon';
import type { OktaUser } from '../../../shared/types';

interface CrossGroupSearchProps {
  /** Cached members keyed by group id — the corpus searched. */
  groupMembersCache: Map<string, OktaUser[]>;
  /** Group id → display name, used to label matches. */
  groupNames: Map<string, string>;
  /** Returns every (group, user) match for the query against the cache. */
  searchUserAcrossGroups: (
    query: string,
    cache: Map<string, OktaUser[]>,
    names: Map<string, string>,
  ) => Array<{ groupId: string; groupName: string; user: OktaUser }>;
  /** Removes a user from the given groups (called per user during bulk remove). */
  onRemoveUserFromGroups: (userId: string, groupIds: string[]) => Promise<void>;
  /** Dismisses the panel. */
  onClose: () => void;
}

/** Search-and-bulk-remove panel operating over cached group memberships. */
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
    const byUser = new Map<
      string,
      { user: OktaUser; groups: Array<{ groupId: string; groupName: string }> }
    >();
    for (const r of results) {
      const existing = byUser.get(r.user.id);
      if (existing) {
        existing.groups.push({ groupId: r.groupId, groupName: r.groupName });
      } else {
        byUser.set(r.user.id, {
          user: r.user,
          groups: [{ groupId: r.groupId, groupName: r.groupName }],
        });
      }
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
      const existing = byUser.get(userId);
      if (existing) {
        existing.push(groupId);
      } else {
        byUser.set(userId, [groupId]);
      }
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
        <IconButton label="Close" onClick={onClose} variant="ghost" size="sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </IconButton>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-neutral-100">
        <Input
          type="search"
          placeholder="Search by name, email, or login..."
          value={query}
          onChange={setQuery}
          icon={<Icon type="search" size="sm" />}
          autoFocus
        />
        {cachedGroupCount === 0 && (
          <p className="text-xs text-warning-text mt-2">
            No groups have been cached yet. Load members via group comparison or export to populate
            the cache.
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
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    user.status === 'ACTIVE'
                      ? 'bg-success-light text-success-text'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
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
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
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
