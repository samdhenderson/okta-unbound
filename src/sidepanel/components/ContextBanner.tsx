import React from 'react';

type PageType = 'group' | 'user' | 'app' | 'admin' | 'unknown';

interface ContextBannerProps {
  pageType: PageType;
  entityName?: string;
  entityId?: string;
  isLoading: boolean;
  error: string | null;
}

const ContextBanner: React.FC<ContextBannerProps> = ({ pageType, entityName, entityId, isLoading, error }) => {
  const handleEditInOkta = () => {
    if (!entityId || !pageType || pageType === 'admin' || pageType === 'unknown') return;

    // Find the Okta tab and open the entity edit page
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const oktaTab = tabs.find(
        (tab) =>
          tab.url &&
          (tab.url.includes('okta.com') ||
            tab.url.includes('oktapreview.com') ||
            tab.url.includes('okta-emea.com'))
      );

      if (oktaTab && oktaTab.url) {
        const origin = new URL(oktaTab.url).origin;
        let entityUrl = '';

        switch (pageType) {
          case 'group':
            entityUrl = `${origin}/admin/group/${entityId}`;
            break;
          case 'user':
            entityUrl = `${origin}/admin/user/profile/view/${entityId}`;
            break;
          case 'app':
            entityUrl = `${origin}/admin/app/${entityId}/instance/${entityId}`;
            break;
        }

        if (entityUrl) {
          chrome.tabs.update(oktaTab.id!, { url: entityUrl, active: true });
        }
      }
    });
  };

  // Get display text based on page type
  const getDisplayName = () => {
    if (error) return 'Not Connected';
    if (isLoading) return 'Loading...';

    if (!entityName) {
      switch (pageType) {
        case 'group':
          return 'No Group Selected';
        case 'user':
          return 'No User Selected';
        case 'app':
          return 'No App Selected';
        case 'admin':
          return 'Okta Admin';
        default:
          return 'No Context';
      }
    }

    return entityName;
  };

  const getDisplayId = () => {
    if (error) return error;
    if (!entityId) {
      switch (pageType) {
        case 'group':
          return 'Navigate to a group page to see details';
        case 'user':
          return 'Navigate to a user page to see details';
        case 'app':
          return 'Navigate to an app page to see details';
        case 'admin':
          return 'Organization overview';
        default:
          return 'Navigate to a group, user, or app page';
      }
    }
    return `ID: ${entityId}`;
  };

  // Get color scheme based on page type
  const getColorScheme = () => {
    switch (pageType) {
      case 'group':
        return {
          primary: '#007dc1',
          secondary: '#3d9dd9',
          accent: 'cyan-400',
        };
      case 'user':
        return {
          primary: '#9333ea', // purple-600
          secondary: '#a855f7', // purple-500
          accent: 'purple-400',
        };
      case 'app':
        return {
          primary: '#059669', // emerald-600
          secondary: '#10b981', // emerald-500
          accent: 'emerald-400',
        };
      case 'admin':
        return {
          primary: '#6b7280', // gray-500
          secondary: '#9ca3af', // gray-400
          accent: 'gray-400',
        };
      default:
        return {
          primary: '#6b7280',
          secondary: '#9ca3af',
          accent: 'gray-400',
        };
    }
  };

  const colors = getColorScheme();
  const displayName = getDisplayName();
  const displayId = getDisplayId();
  const showEditButton = entityId && !error && pageType !== 'admin' && pageType !== 'unknown';

  return (
    <div className="relative bg-white border-b border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 z-40">
      <div className="px-6 py-5 flex items-center justify-between" style={{ fontFamily: 'var(--font-primary)' }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 animate-in slide-in-from-left-3 duration-500">
            {/* Status indicator with smooth transitions */}
            {isLoading && (
              <div className="relative animate-in zoom-in duration-300">
                <div
                  className="w-5 h-5 border-2 border-gray-200 rounded-full animate-spin"
                  style={{ borderTopColor: colors.primary }}
                />
                <div
                  className="absolute inset-0 w-5 h-5 border-2 border-transparent rounded-full animate-spin"
                  style={{
                    borderTopColor: colors.secondary,
                    animationDirection: 'reverse',
                    animationDuration: '1s'
                  }}
                />
              </div>
            )}
            {error && (
              <span className="text-rose-500 text-xl animate-in zoom-in duration-300">⚠</span>
            )}
            {!error && !isLoading && entityId && (
              <div className="relative">
                <span className="text-xl animate-in zoom-in duration-300" style={{ color: colors.primary }}>●</span>
                <div
                  className="absolute inset-0 rounded-full blur-md opacity-20 animate-pulse"
                  style={{ backgroundColor: colors.primary }}
                />
              </div>
            )}
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight truncate">
              {displayName}
            </h2>
          </div>
          {displayId && (
            <p className="mt-1.5 text-xs font-mono text-gray-500 tracking-wide truncate animate-in fade-in slide-in-from-left-2 duration-500 delay-100" style={{ fontFamily: 'var(--font-mono)' }}>
              {displayId}
            </p>
          )}
        </div>
        {showEditButton && (
          <button
            onClick={handleEditInOkta}
            title={`Open this ${pageType} in Okta admin`}
            className="ml-4 px-4 py-2.5 text-white text-sm font-semibold rounded-lg
                     transition-all duration-200
                     shadow-md hover:shadow-lg hover:-translate-y-0.5
                     flex items-center gap-2 whitespace-nowrap
                     animate-in slide-in-from-right-3 duration-500 delay-150"
            style={{
              background: `linear-gradient(to right, ${colors.primary}, ${colors.secondary})`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `linear-gradient(to right, ${colors.primary}dd, ${colors.primary})`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `linear-gradient(to right, ${colors.primary}, ${colors.secondary})`;
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>Edit in Okta</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ContextBanner;
