import React, { useState } from 'react';
import RuleCard from './RuleCard';
import type { FormattedRule } from '../../shared/types';
import { filterRules } from '../../shared/ruleUtils';

interface RulesTabProps {
  targetTabId?: number;
  currentGroupId?: string;
}

type FilterType = 'all' | 'active' | 'conflicts' | 'current-group';

const RulesTab: React.FC<RulesTabProps> = ({ targetTabId, currentGroupId }) => {
  const [rules, setRules] = useState<FormattedRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, conflicts: 0 });
  const [apiCost, setApiCost] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLoadRules = async () => {
    if (!targetTabId) {
      setError('No Okta tab connected');
      return;
    }

    setIsLoading(true);
    setError(null);
    setApiCost(null);

    try {
      console.log('[RulesTab] Fetching rules from tab:', targetTabId);

      // Track API requests made
      let apiRequestCount = 0;

      const response = await chrome.tabs.sendMessage(targetTabId, {
        action: 'fetchGroupRules',
      });

      console.log('[RulesTab] Received response:', response);

      if (response.success) {
        setRules(response.rules || []);
        setStats(response.stats || { total: 0, active: 0, inactive: 0, conflicts: 0 });

        // Calculate actual API cost based on response metadata
        // The content script makes 1 request for rules fetch
        apiRequestCount = 1;
        setApiCost(apiRequestCount);

        console.log('[RulesTab] Loaded rules successfully:', {
          count: response.rules?.length,
          stats: response.stats,
          apiCost: apiRequestCount
        });
      } else {
        setError(response.error || 'Failed to fetch rules');
        console.error('[RulesTab] Error fetching rules:', response.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with Okta tab');
      console.error('[RulesTab] Exception:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateRule = async (ruleId: string) => {
    if (!targetTabId) return;

    try {
      console.log('[RulesTab] Activating rule:', ruleId);
      const response = await chrome.tabs.sendMessage(targetTabId, {
        action: 'activateRule',
        ruleId,
      });

      if (response.success) {
        // Reload rules to get updated status
        await handleLoadRules();
      } else {
        setError(response.error || 'Failed to activate rule');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to activate rule');
      console.error('[RulesTab] Activation error:', err);
    }
  };

  const handleDeactivateRule = async (ruleId: string) => {
    if (!targetTabId) return;

    try {
      console.log('[RulesTab] Deactivating rule:', ruleId);
      const response = await chrome.tabs.sendMessage(targetTabId, {
        action: 'deactivateRule',
        ruleId,
      });

      if (response.success) {
        // Reload rules to get updated status
        await handleLoadRules();
      } else {
        setError(response.error || 'Failed to deactivate rule');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate rule');
      console.error('[RulesTab] Deactivation error:', err);
    }
  };

  // Apply search and filters
  const filteredRules = React.useMemo(() => {
    let result = filterRules(rules, searchQuery);

    // Apply active filter
    switch (activeFilter) {
      case 'active':
        result = result.filter((r) => r.status === 'ACTIVE');
        break;
      case 'conflicts':
        result = result.filter((r) => r.conflicts && r.conflicts.length > 0);
        break;
      case 'current-group':
        result = result.filter((r) => r.affectsCurrentGroup);
        break;
    }

    return result;
  }, [rules, searchQuery, activeFilter]);

  return (
    <div className="tab-content active">
      <div className="section">
        <div className="section-header">
          <div>
            <h2>Group Rules</h2>
            <p className="section-description">
              Analyze group rules and detect potential conflicts
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleLoadRules}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : rules.length > 0 ? 'Refresh Rules' : 'Load Rules'}
          </button>
        </div>

        {/* API Cost Indicator */}
        {apiCost !== null && (
          <div className="api-cost-indicator">
            <span className="api-cost-label">API Requests:</span>
            <span className="api-cost-value">{apiCost}</span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="alert alert-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Stats Overview */}
        {rules.length > 0 && (
          <div className="rules-stats">
            <div className="stat-card">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Rules</div>
            </div>
            <div className="stat-card">
              <div className="stat-value stat-success">{stats.active}</div>
              <div className="stat-label">Active</div>
            </div>
            <div className="stat-card">
              <div className="stat-value stat-muted">{stats.inactive}</div>
              <div className="stat-label">Inactive</div>
            </div>
            <div className="stat-card">
              <div className="stat-value stat-warning">{stats.conflicts}</div>
              <div className="stat-label">Conflicts</div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        {rules.length > 0 && (
          <>
            <div className="rules-search">
              <input
                type="text"
                className="input"
                placeholder="Search rules by name, condition, or attributes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="rules-filters">
              <button
                className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActiveFilter('all')}
              >
                All Rules
              </button>
              <button
                className={`filter-btn ${activeFilter === 'active' ? 'active' : ''}`}
                onClick={() => setActiveFilter('active')}
              >
                Active Only
              </button>
              <button
                className={`filter-btn ${activeFilter === 'conflicts' ? 'active' : ''}`}
                onClick={() => setActiveFilter('conflicts')}
                disabled={stats.conflicts === 0}
              >
                Conflicts ({stats.conflicts})
              </button>
              {currentGroupId && (
                <button
                  className={`filter-btn ${activeFilter === 'current-group' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('current-group')}
                >
                  Current Group
                </button>
              )}
            </div>
          </>
        )}

        {/* Rules List */}
        <div className="rules-container">
          {isLoading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading rules...</p>
            </div>
          ) : rules.length === 0 ? (
            <div className="empty-state">
              <p className="muted">Click "Load Rules" to analyze your Okta group rules</p>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="empty-state">
              <p className="muted">No rules match your search or filter criteria</p>
            </div>
          ) : (
            <div className="rules-list">
              {filteredRules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onActivate={handleActivateRule}
                  onDeactivate={handleDeactivateRule}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RulesTab;
