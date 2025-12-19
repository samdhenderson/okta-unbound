import React from 'react';

interface GroupBannerProps {
  groupName: string;
  groupId: string;
  isLoading: boolean;
  error: string | null;
}

const GroupBanner: React.FC<GroupBannerProps> = ({ groupName, groupId, isLoading, error }) => {
  const handleEditInOkta = () => {
    if (!groupId) return;

    // Find the Okta tab and open the group edit page
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
        const groupUrl = `${origin}/admin/group/${groupId}`;

        chrome.tabs.update(oktaTab.id!, { url: groupUrl, active: true });
      }
    });
  };

  const displayName = error ? 'Not Connected' : isLoading ? 'Loading...' : (groupName || 'No Group Selected');
  const displayId = error ? error : (groupId ? `ID: ${groupId}` : 'Navigate to a group page to see details');

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-white via-gray-50/30 to-white border-b border-gray-200/60 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 z-40">
      {/* Subtle decorative gradient with animation */}
      <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-[#007dc1]/[0.04] via-[#3d9dd9]/[0.02] to-transparent pointer-events-none transition-opacity duration-700" />
      <div className="absolute bottom-0 left-0 w-80 h-full bg-gradient-to-r from-cyan-400/[0.03] via-transparent to-transparent pointer-events-none" />

      {/* Animated edge highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

      <div className="relative px-6 py-5 flex items-center justify-between" style={{ fontFamily: 'var(--font-primary)' }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 animate-in slide-in-from-left-3 duration-500">
            {/* Status indicator with smooth transitions */}
            {isLoading && (
              <div className="relative animate-in zoom-in duration-300">
                <div className="w-5 h-5 border-2 border-gray-200 border-t-[#007dc1] rounded-full animate-spin" />
                <div className="absolute inset-0 w-5 h-5 border-2 border-transparent border-t-[#3d9dd9] rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1s' }} />
              </div>
            )}
            {error && (
              <span className="text-rose-500 text-xl animate-in zoom-in duration-300">⚠</span>
            )}
            {!error && !isLoading && groupId && (
              <div className="relative">
                <span className="text-[#007dc1] text-xl animate-in zoom-in duration-300">●</span>
                <div className="absolute inset-0 bg-[#007dc1] rounded-full blur-md opacity-20 animate-pulse" />
              </div>
            )}
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight truncate">
              {displayName}
            </h2>
          </div>
          <p className="mt-1.5 text-xs font-mono text-gray-500 tracking-wide truncate animate-in fade-in slide-in-from-left-2 duration-500 delay-100" style={{ fontFamily: 'var(--font-mono)' }}>
            {displayId}
          </p>
        </div>
        {groupId && !error && (
          <button
            onClick={handleEditInOkta}
            title="Open this group in Okta admin"
            className="ml-4 px-4 py-2.5 bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white text-sm font-semibold rounded-lg
                     hover:from-[#005a8f] hover:to-[#007dc1] transition-all duration-200
                     shadow-md hover:shadow-lg hover:-translate-y-0.5
                     flex items-center gap-2 whitespace-nowrap
                     animate-in slide-in-from-right-3 duration-500 delay-150"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>Edit in Okta</span>
          </button>
        )}
      </div>

      {/* Bottom edge highlight */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#007dc1]/20 to-transparent" />
    </div>
  );
};

export default GroupBanner;
