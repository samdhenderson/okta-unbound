/**
 * Toggle buttons for switching between chart view modes
 */

import React from 'react';

export type ViewMode = 'status' | 'rules';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ viewMode, onViewModeChange }) => {
  return (
    <div className="flex justify-center gap-2 mb-4">
      <button
        onClick={() => onViewModeChange('status')}
        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 shadow-sm ${
          viewMode === 'status'
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md hover:shadow-lg'
            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:shadow'
        }`}
      >
        User Status
      </button>
      <button
        onClick={() => onViewModeChange('rules')}
        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 shadow-sm ${
          viewMode === 'rules'
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md hover:shadow-lg'
            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:shadow'
        }`}
      >
        Membership Source
      </button>
    </div>
  );
};

export default ViewModeToggle;
