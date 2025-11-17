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
    <div className="group-banner">
      <div className="group-banner-content">
        <div>
          <h2 className="group-name">{displayName}</h2>
          <p className="group-id">{displayId}</p>
        </div>
        {groupId && !error && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleEditInOkta}
            title="Open this group in Okta admin"
          >
            Edit in Okta
          </button>
        )}
      </div>
    </div>
  );
};

export default GroupBanner;
