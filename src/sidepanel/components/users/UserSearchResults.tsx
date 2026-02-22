import React from 'react';
import type { OktaUser } from '../../../shared/types';

interface UserSearchResultsProps {
  results: OktaUser[];
  onSelectUser: (user: OktaUser) => void;
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'badge badge-success';
    case 'DEPROVISIONED':
      return 'badge badge-error';
    case 'SUSPENDED':
    case 'LOCKED_OUT':
      return 'badge badge-warning';
    default:
      return 'badge badge-info';
  }
};

/**
 * Displays a list of user search results.
 */
const UserSearchResults: React.FC<UserSearchResultsProps> = ({
  results,
  onSelectUser,
}) => {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-900">Search Results</h3>
        <span className="px-3 py-1 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-full">
          {results.length} {results.length === 1 ? 'user' : 'users'}
        </span>
      </div>
      <div className="space-y-3">
        {results.map(user => (
          <div
            key={user.id}
            className="group bg-white rounded-md border border-neutral-200 p-5 cursor-pointer transition-all duration-100 hover:border-neutral-500"
            onClick={() => onSelectUser(user)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-neutral-900 mb-1 group-hover:text-primary-text transition-colors">
                  {user.profile.firstName} {user.profile.lastName}
                </h4>
                <p className="text-sm text-neutral-600 mb-1">{user.profile.email}</p>
                <p className="text-xs text-neutral-500 font-mono">Login: {user.profile.login}</p>
              </div>
              <span className={getStatusBadgeClass(user.status)}>{user.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserSearchResults;
