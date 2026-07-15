/**
 * @module sidepanel/components/ContextBanner
 * @description Banner summarising the Okta entity detected on the active tab.
 *
 * Shows the current group/user/app name, its id (or contextual guidance when
 * absent), a loading/connected/error status indicator, and an "Edit in Okta"
 * button that navigates the Okta tab to the entity's admin page. Colour scheme is
 * derived from the page type using Odyssey tokens.
 */
import React from 'react';
import { isOktaUrl } from '@/shared/utils/oktaUrl';

/** Kind of Okta page the side panel has detected for the active tab. */
type PageType = 'group' | 'user' | 'app' | 'admin' | 'unknown';

interface ContextBannerProps {
  /** Detected page type; drives labels, colour scheme, and the edit target URL. */
  pageType: PageType;
  /** Display name of the detected entity, if resolved. */
  entityName?: string;
  /** Okta id of the detected entity; presence gates the "Edit in Okta" button. */
  entityId?: string;
  /** Whether page context is still being resolved. */
  isLoading: boolean;
  /** Connection/context error message, or `null` when healthy. */
  error: string | null;
}

/**
 * Renders the contextual header banner for the currently detected Okta entity,
 * including a deep-link button into the Okta admin console for that entity.
 */
const ContextBanner: React.FC<ContextBannerProps> = ({
  pageType,
  entityName,
  entityId,
  isLoading,
  error,
}) => {
  const handleEditInOkta = () => {
    if (!entityId || !pageType || pageType === 'admin' || pageType === 'unknown') return;

    // Find the Okta tab and open the entity edit page
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const oktaTab = tabs.find((tab) => isOktaUrl(tab.url));

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

  // Get color scheme based on page type using Odyssey tokens
  const getColorScheme = () => {
    switch (pageType) {
      case 'group':
        return {
          primary: 'var(--color-primary)',
          dark: 'var(--color-primary-dark)',
        };
      case 'user':
        return {
          primary: 'var(--color-accent)',
          dark: 'var(--color-accent-dark)',
        };
      case 'app':
        return {
          primary: 'var(--color-success)',
          dark: 'var(--color-success-text)',
        };
      case 'admin':
        return {
          primary: 'var(--color-neutral-500)',
          dark: 'var(--color-neutral-700)',
        };
      default:
        return {
          primary: 'var(--color-neutral-500)',
          dark: 'var(--color-neutral-700)',
        };
    }
  };

  const colors = getColorScheme();
  const displayName = getDisplayName();
  const displayId = getDisplayId();
  const showEditButton = entityId && !error && pageType !== 'admin' && pageType !== 'unknown';

  return (
    <div className="relative bg-white border-b border-neutral-200 animate-in fade-in slide-in-from-top-4 duration-100 z-40">
      <div
        className="px-6 py-5 flex items-center justify-between"
        style={{ fontFamily: 'var(--font-primary)' }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 animate-in slide-in-from-left-3 duration-100">
            {/* Status indicator with smooth transitions */}
            {isLoading && (
              <div className="relative animate-in zoom-in duration-100">
                <div
                  className="w-5 h-5 border-2 border-neutral-200 rounded-full animate-spin"
                  style={{ borderTopColor: colors.primary }}
                />
              </div>
            )}
            {error && (
              <span className="text-danger-text text-xl animate-in zoom-in duration-100">⚠</span>
            )}
            {!error && !isLoading && entityId && (
              <div className="relative">
                <span
                  className="text-xl animate-in zoom-in duration-100"
                  style={{ color: colors.primary }}
                >
                  ●
                </span>
                <div
                  className="absolute inset-0 rounded-full blur-md opacity-20 animate-pulse"
                  style={{ backgroundColor: colors.primary }}
                />
              </div>
            )}
            <h2 className="text-lg font-semibold text-neutral-900 tracking-tight truncate">
              {displayName}
            </h2>
          </div>
          {displayId && (
            <p
              className="mt-1.5 text-xs font-mono text-neutral-500 tracking-wide truncate animate-in fade-in slide-in-from-left-2 duration-100 delay-100"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {displayId}
            </p>
          )}
        </div>
        {showEditButton && (
          <button
            onClick={handleEditInOkta}
            title={`Open this ${pageType} in Okta admin`}
            className="ml-4 px-4 py-2.5 text-white text-sm font-semibold rounded-md
                     transition-all duration-100
                     flex items-center gap-2 whitespace-nowrap
                     animate-in slide-in-from-right-3 delay-150"
            style={{
              backgroundColor: colors.primary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.dark;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.primary;
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            <span>Edit in Okta</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ContextBanner;
