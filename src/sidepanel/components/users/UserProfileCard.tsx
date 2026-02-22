import React, { useState } from 'react';
import type { OktaUser } from '../../../shared/types';
import CollapsibleSection from '../shared/CollapsibleSection';

interface UserProfileCardProps {
  user: OktaUser;
  groupCount?: number;
  showCollapsibleSections?: boolean;
  oktaOrigin?: string | null;
}

/**
 * Shared user profile card component used in both UsersTab and UserOverview.
 * Displays user details with avatar, status badge, metadata, and optional collapsible sections.
 */
const UserProfileCard: React.FC<UserProfileCardProps> = ({
  user,
  groupCount = 0,
  showCollapsibleSections = true,
  oktaOrigin,
}) => {
  const [idCopied, setIdCopied] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id).then(() => {
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1500);
    });
  };

  const getStatusBadgeClass = (status: string): string => {
    const baseClasses = 'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm';
    switch (status) {
      case 'ACTIVE':
        return `${baseClasses} bg-emerald-50 text-emerald-700 border border-emerald-200`;
      case 'PROVISIONED':
        return `${baseClasses} bg-blue-50 text-blue-700 border border-blue-200`;
      case 'STAGED':
        return `${baseClasses} bg-neutral-100 text-neutral-700 border border-neutral-300`;
      case 'SUSPENDED':
        return `${baseClasses} bg-amber-50 text-amber-700 border border-amber-200`;
      case 'RECOVERY':
        return `${baseClasses} bg-purple-50 text-purple-700 border border-purple-200`;
      case 'PASSWORD_EXPIRED':
        return `${baseClasses} bg-orange-50 text-orange-700 border border-orange-200`;
      case 'LOCKED_OUT':
        return `${baseClasses} bg-rose-50 text-rose-700 border border-rose-200`;
      case 'DEPROVISIONED':
        return `${baseClasses} bg-red-50 text-red-700 border border-red-200`;
      default:
        return `${baseClasses} bg-neutral-100 text-neutral-700 border border-neutral-300`;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const getRelativeTime = (dateString: string): string | null => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch {
      return null;
    }
  };

  const hasOrgInfo = user.profile.title ||
    user.profile.department ||
    user.profile.division ||
    user.profile.organization ||
    user.profile.manager ||
    user.profile.costCenter ||
    user.profile.employeeNumber ||
    user.profile.userType;

  const hasContactInfo = user.profile.mobilePhone ||
    user.profile.primaryPhone ||
    user.profile.streetAddress ||
    user.profile.city ||
    user.profile.state ||
    user.profile.zipCode ||
    user.profile.countryCode;

  return (
    <div className="space-y-4">
      {/* Premium User ID Card */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-6 bg-white">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="shrink-0 w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold shadow-sm ring-4 ring-primary-highlight">
              {user.profile.firstName?.[0]?.toUpperCase() || '?'}
              {user.profile.lastName?.[0]?.toUpperCase() || ''}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-neutral-900 mb-1">
                {user.profile.firstName} {user.profile.lastName}
              </h2>
              {(user.profile.title || user.profile.department) && (
                <div className="text-sm text-neutral-600 mb-2 flex items-center gap-2">
                  {user.profile.title && <span>{user.profile.title}</span>}
                  {user.profile.title && user.profile.department && (
                    <span className="text-neutral-400">|</span>
                  )}
                  {user.profile.department && <span>{user.profile.department}</span>}
                </div>
              )}
              <div className="text-sm text-neutral-700 mb-1">{user.profile.email}</div>
              {user.profile.genderPronouns && (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-md border border-purple-200 mt-2">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  {user.profile.genderPronouns}
                </div>
              )}
            </div>

            {/* Status Badge + Admin Console Link */}
            <div className="shrink-0 flex flex-col items-end gap-2">
              <span className={getStatusBadgeClass(user.status)}>
                {user.status}
              </span>
              {oktaOrigin && (
                <a
                  href={`${oktaOrigin}/admin/user/profile/view/${user.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-white text-neutral-700 border border-neutral-200 rounded-md hover:bg-neutral-50 hover:border-neutral-500 transition-colors duration-100"
                  title="Open this user in the Okta Admin Console"
                >
                  <span>Open in Okta</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Metadata Footer */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 grid grid-cols-3 gap-4 text-sm">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-neutral-600 mb-1">Last Login</span>
            <span className="text-neutral-900 font-medium">
              {user.lastLogin
                ? getRelativeTime(user.lastLogin) || formatDate(user.lastLogin)
                : 'Never'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-neutral-600 mb-1">Created</span>
            <span className="text-neutral-900 font-medium">
              {user.created
                ? getRelativeTime(user.created) || formatDate(user.created)
                : 'Unknown'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-neutral-600 mb-1">Groups</span>
            <span className="text-neutral-900 font-medium">{groupCount}</span>
          </div>
        </div>
      </div>

      {/* Collapsible Detail Sections */}
      {showCollapsibleSections && (
        <div className="space-y-4">
          {/* Account Details */}
          <CollapsibleSection title="Account Details" defaultOpen={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-white rounded-md border border-neutral-200">
                <span className="text-xs font-semibold text-neutral-600 mb-1 block">Login</span>
                <span className="text-sm text-neutral-900 block">{user.profile.login}</span>
              </div>
              <div className="p-3 bg-white rounded-md border border-neutral-200">
                <span className="text-xs font-semibold text-neutral-600 mb-1 block">User ID</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-neutral-900 truncate">{user.id}</span>
                  <button
                    onClick={handleCopyId}
                    className="shrink-0 p-0.5 text-neutral-400 hover:text-primary-text rounded transition-colors duration-100"
                    title={idCopied ? 'Copied!' : 'Copy ID'}
                  >
                    {idCopied ? (
                      <svg className="w-3.5 h-3.5 text-success-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M8 5a2 2 0 002 2h4a2 2 0 002-2M8 5a2 2 0 012-2h4a2 2 0 012 2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              {user.profile.secondEmail && (
                <div className="p-3 bg-white rounded-md border border-neutral-200">
                  <span className="text-xs font-semibold text-neutral-600 mb-1 block">Secondary Email</span>
                  <span className="text-sm text-neutral-900 block">{user.profile.secondEmail}</span>
                </div>
              )}
              {user.activated && (
                <div className="p-3 bg-white rounded-md border border-neutral-200">
                  <span className="text-xs font-semibold text-neutral-600 mb-1 block">Activated</span>
                  <span className="text-sm text-neutral-900 block">{formatDate(user.activated)}</span>
                </div>
              )}
              {user.statusChanged && (
                <div className="p-3 bg-white rounded-md border border-neutral-200">
                  <span className="text-xs font-semibold text-neutral-600 mb-1 block">Status Changed</span>
                  <span className="text-sm text-neutral-900 block">{formatDate(user.statusChanged)}</span>
                </div>
              )}
              {user.passwordChanged && (
                <div className="p-3 bg-white rounded-md border border-neutral-200">
                  <span className="text-xs font-semibold text-neutral-600 mb-1 block">Password Changed</span>
                  <span className="text-sm text-neutral-900 block">{formatDate(user.passwordChanged)}</span>
                </div>
              )}
              {user.lastUpdated && (
                <div className="p-3 bg-white rounded-md border border-neutral-200">
                  <span className="text-xs font-semibold text-neutral-600 mb-1 block">Profile Updated</span>
                  <span className="text-sm text-neutral-900 block">{formatDate(user.lastUpdated)}</span>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Organization - only show if any org fields exist */}
          {hasOrgInfo && (
            <CollapsibleSection title="Organization" defaultOpen={false}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {user.profile.title && (
                  <div className="p-3 bg-white rounded-md border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-600 mb-1 block">Title</span>
                    <span className="text-sm text-neutral-900 block">{user.profile.title}</span>
                  </div>
                )}
                {user.profile.department && (
                  <div className="p-3 bg-white rounded-md border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-600 mb-1 block">Department</span>
                    <span className="text-sm text-neutral-900 block">{user.profile.department}</span>
                  </div>
                )}
                {user.profile.division && (
                  <div className="p-3 bg-white rounded-md border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-600 mb-1 block">Division</span>
                    <span className="text-sm text-neutral-900 block">{user.profile.division}</span>
                  </div>
                )}
                {user.profile.organization && (
                  <div className="p-3 bg-white rounded-md border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-600 mb-1 block">Organization</span>
                    <span className="text-sm text-neutral-900 block">{user.profile.organization}</span>
                  </div>
                )}
                {user.profile.manager && (
                  <div className="p-3 bg-white rounded-md border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-600 mb-1 block">Manager</span>
                    <span className="text-sm text-neutral-900 block">{user.profile.manager}</span>
                  </div>
                )}
                {user.profile.costCenter && (
                  <div className="p-3 bg-white rounded-md border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-600 mb-1 block">Cost Center</span>
                    <span className="text-sm text-neutral-900 block">{user.profile.costCenter}</span>
                  </div>
                )}
                {user.profile.employeeNumber && (
                  <div className="p-3 bg-white rounded-md border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-600 mb-1 block">Employee #</span>
                    <span className="text-sm text-neutral-900 block">{user.profile.employeeNumber}</span>
                  </div>
                )}
                {user.profile.userType && (
                  <div className="p-3 bg-white rounded-md border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-600 mb-1 block">User Type</span>
                    <span className="text-sm text-neutral-900 block">{user.profile.userType}</span>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Contact - only show if any contact fields exist */}
          {hasContactInfo && (
            <CollapsibleSection title="Contact" defaultOpen={false}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {user.profile.primaryPhone && (
                  <div className="p-3 bg-white rounded-md border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-600 mb-1 block">Phone</span>
                    <span className="text-sm text-neutral-900 block">{user.profile.primaryPhone}</span>
                  </div>
                )}
                {user.profile.mobilePhone && (
                  <div className="p-3 bg-white rounded-md border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-600 mb-1 block">Mobile</span>
                    <span className="text-sm text-neutral-900 block">{user.profile.mobilePhone}</span>
                  </div>
                )}
                {(user.profile.streetAddress || user.profile.city || user.profile.state || user.profile.zipCode) && (
                  <div className="p-3 bg-white rounded-md border border-neutral-200 md:col-span-2">
                    <span className="text-xs font-semibold text-neutral-600 mb-1 block">Address</span>
                    <span className="text-sm text-neutral-900 block">
                      {[
                        user.profile.streetAddress,
                        user.profile.city,
                        user.profile.state,
                        user.profile.zipCode,
                        user.profile.countryCode
                      ].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
};

export default UserProfileCard;
