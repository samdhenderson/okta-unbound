import React from 'react';

interface GroupBannerProps {
  groupName: string;
  groupId: string;
  isLoading: boolean;
  error: string | null;
}

const GroupBanner: React.FC<GroupBannerProps> = ({ groupName, groupId, isLoading, error }) => {
  return (
    <div className="group-banner">
      <div className="group-banner-content">
        <h2 className="group-name">
          {error ? 'Not Connected' : isLoading ? 'Loading...' : groupName}
        </h2>
        <p className="group-id">{error || (groupId ? `ID: ${groupId}` : '')}</p>
      </div>
    </div>
  );
};

export default GroupBanner;
