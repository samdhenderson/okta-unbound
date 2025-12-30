import React, { useState, useCallback } from 'react';
import PageHeader from './shared/PageHeader';
import AlertMessage, { type AlertMessageData } from './shared/AlertMessage';
import { useOktaApi } from '../hooks/useOktaApi';

// Import sub-tab components
import BrowseSubTab from './apps/BrowseSubTab';
import ConverterSubTab from './apps/ConverterSubTab';
import BulkAssignSubTab from './apps/BulkAssignSubTab';

interface AppsTabProps {
  groupId: string | undefined;
  groupName: string | undefined;
  targetTabId: number | null;
  oktaOrigin?: string;
}

type AppSubTab = 'browse' | 'converter' | 'bulk';

const subTabs: { id: AppSubTab; label: string }[] = [
  { id: 'browse', label: 'Browse' },
  { id: 'converter', label: 'Convert & Copy' },
  { id: 'bulk', label: 'Bulk Assign' },
];

/**
 * App Assignment Management tab.
 * Contains sub-tabs for converting, analyzing, and bulk-assigning app assignments.
 */
const AppsTab: React.FC<AppsTabProps> = ({ groupId, groupName, targetTabId, oktaOrigin }) => {
  const [activeSubTab, setActiveSubTab] = useState<AppSubTab>('browse');
  const [resultMessage, setResultMessage] = useState<AlertMessageData | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });

  // Handle result messages from sub-tabs
  const handleResult = useCallback((message: AlertMessageData) => {
    setResultMessage(message);
  }, []);

  // Handle progress updates from sub-tabs
  const handleProgress = useCallback((current: number, total: number, message: string) => {
    setProgress({ current, total, message });
  }, []);

  const oktaApi = useOktaApi({
    targetTabId,
    onResult: (message, type) => {
      setResultMessage({ text: message, type });
    },
    onProgress: handleProgress,
  });

  return (
    <div className="tab-content active">
      <PageHeader
        title="App Assignment Management"
        subtitle="Convert, analyze, and optimize app assignments"
        icon="app"
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Sub-tab navigation - pill button style matching GroupsTab */}
        <div className="flex gap-2 flex-wrap">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              className={`
                px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200
                ${activeSubTab === tab.id
                  ? 'bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }
              `}
              onClick={() => setActiveSubTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Result message */}
        {resultMessage && (
          <AlertMessage
            message={resultMessage}
            onDismiss={() => setResultMessage(null)}
          />
        )}

        {/* Progress indicator */}
        {progress.total > 0 && (
          <div className="space-y-2">
            <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              {progress.message} ({progress.current}/{progress.total})
            </p>
          </div>
        )}

        {/* Sub-tab content */}
        {activeSubTab === 'browse' && (
          <BrowseSubTab
            oktaApi={oktaApi}
            onResult={handleResult}
            oktaOrigin={oktaOrigin}
          />
        )}

        {activeSubTab === 'converter' && (
          <ConverterSubTab
            groupId={groupId}
            groupName={groupName}
            oktaApi={oktaApi}
            onResult={handleResult}
            onProgress={handleProgress}
          />
        )}

        {activeSubTab === 'bulk' && (
          <BulkAssignSubTab
            groupId={groupId}
            groupName={groupName}
            oktaApi={oktaApi}
            onResult={handleResult}
          />
        )}
      </div>
    </div>
  );
};

export default AppsTab;
