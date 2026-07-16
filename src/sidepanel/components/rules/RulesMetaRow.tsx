/**
 * @module sidepanel/components/rules/RulesMetaRow
 * @description Small metadata chips above the Rules list: API cost + cache time.
 */
import React from 'react';

interface RulesMetaRowProps {
  /** API requests the last load cost, or null when unknown. */
  apiCost: number | null;
  /** ISO timestamp of the last successful load, or null. */
  lastFetchTime: string | null;
  /** Whether any rules are loaded (gates the cache chip). */
  hasRules: boolean;
}

/**
 * Renders the API-request-count and cached-time chips. Returns null when there is
 * nothing to show (matches the tab's original conditional).
 */
const RulesMetaRow: React.FC<RulesMetaRowProps> = ({ apiCost, lastFetchTime, hasRules }) => {
  if (apiCost === null && !(lastFetchTime && hasRules)) return null;

  return (
    <div className="flex gap-3 flex-wrap">
      {apiCost !== null && (
        <div className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
            API Requests:
          </span>
          <span className="text-sm font-bold text-primary-text">{apiCost}</span>
        </div>
      )}
      {lastFetchTime && hasRules && (
        <div className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
            Cached:
          </span>
          <span className="text-sm font-mono text-neutral-700">
            {new Date(lastFetchTime).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
};

export default RulesMetaRow;
