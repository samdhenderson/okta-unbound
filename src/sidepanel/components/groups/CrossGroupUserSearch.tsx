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
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Find User Across All Groups</h3>
        <p className="text-sm text-gray-600">
          Search for a user by email, name, or ID to see all groups they belong to.
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter email, name, or user ID..."
            disabled={searching}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 shadow-sm hover:shadow disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white rounded-lg hover:from-[#005a8f] hover:to-[#007dc1] transition-all duration-200 shadow-md hover:shadow-lg disabled:from-blue-300 disabled:to-blue-400 disabled:cursor-not-allowed"
          onClick={handleSearch}
          disabled={searching || !targetTabId}
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {searchResult && (
        <div className="space-y-5">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-50 to-blue-50/30 border-b border-gray-200 flex items-center justify-between">
              <h4 className="text-base font-semibold text-gray-900">
                {searchResult.user.profile.firstName} {searchResult.user.profile.lastName}
              </h4>
              {oktaOrigin && (
                <button
                  className="px-3 py-1.5 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm inline-flex items-center gap-2"
                  onClick={handleOpenUserInOkta}
                >
                  View in Okta
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              )}
            </div>
            <div className="p-5 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-gray-700 min-w-[80px]">Email:</span>
                <span className="text-gray-900">{searchResult.user.profile.email}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold text-gray-700 min-w-[80px]">Status:</span>
                <span
                  className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                    searchResult.user.status.toLowerCase() === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-gray-50 text-gray-700 border border-gray-200'
                  }`}
                >
                  {searchResult.user.status}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold text-gray-700 min-w-[80px]">User ID:</span>
                <code className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">{searchResult.user.id}</code>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 shadow-sm">
              <h4 className="text-base font-semibold text-gray-900">
                Group Memberships ({searchResult.groups?.length || 0})
              </h4>
              {searchResult.groups?.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="px-3 py-1.5 text-xs font-medium text-[#007dc1] hover:bg-blue-50 rounded-lg transition-all duration-200"
                    onClick={handleSelectAll}
                  >
                    Select All
                  </button>
                  <button
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
                    onClick={handleDeselectAll}
                  >
                    Deselect All
                  </button>
                  {selectedGroups.size > 0 && onRemoveFromGroups && (
                    <button
                      className="px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg"
                      onClick={handleRemoveFromSelected}
                    >
                      Remove from {selectedGroups.size} Group{selectedGroups.size !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              )}
            </div>

            {searchResult.groups?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">This user is not a member of any groups.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchResult.groups?.map((group: any) => (
                  <div
                    key={group.id}
                    className={`flex items-center gap-3 p-4 bg-white rounded-lg border transition-all duration-200 ${
                      selectedGroups.has(group.id)
                        ? 'border-[#007dc1] bg-blue-50/30 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroups.has(group.id)}
                      onChange={() => handleToggleGroup(group.id)}
                      className="w-4 h-4 rounded border-gray-300 text-[#007dc1] focus:ring-[#007dc1]/30 transition-all duration-200"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {group.profile?.name || group.id}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                            group.type === 'OKTA_GROUP'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {group.type?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    {oktaOrigin && (
                      <button
                        className="p-2 text-gray-400 hover:text-[#007dc1] hover:bg-blue-50 rounded-lg transition-all duration-200"
                        onClick={() => window.open(`${oktaOrigin}/admin/group/${group.id}`, '_blank')}
                        title="Open group in Okta"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
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
