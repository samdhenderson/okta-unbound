import React, { useState, useEffect } from 'react';
import RuleCard from './RuleCard';
import type { FormattedRule, RuleConflict, AuditLogEntry } from '../../shared/types';
import { filterRules } from '../../shared/ruleUtils';
import { useProgress } from '../contexts/ProgressContext';
import { logAction } from '../../shared/undoManager';
import { auditStore } from '../../shared/storage/auditStore';

interface RulesTabProps {
  targetTabId?: number;
  currentGroupId?: string;
  oktaOrigin?: string | null;
}

type FilterType = 'all' | 'active' | 'conflicts' | 'current-group';

const RulesTab: React.FC<RulesTabProps> = ({ targetTabId, currentGroupId, oktaOrigin }) => {
  const [rules, setRules] = useState<FormattedRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, conflicts: 0 });
  const [apiCost, setApiCost] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);
  const { startProgress, updateProgress, completeProgress } = useProgress();

  // Load rules from chrome.storage on mount
  useEffect(() => {
    const loadPersistedRules = async () => {
      try {
        const result = await chrome.storage.local.get(['cachedRules', 'cachedRulesStats', 'cachedRulesTime']);
        if (result.cachedRules && result.cachedRulesStats) {
          console.log('[RulesTab] Loaded persisted rules from storage:', result.cachedRules.length);
          setRules(result.cachedRules);
          setStats(result.cachedRulesStats);
          setLastFetchTime(result.cachedRulesTime || null);
        }
      } catch (err) {
        console.error('[RulesTab] Failed to load persisted rules:', err);
      }
    };

    loadPersistedRules();
  }, []);

  // Persist rules to chrome.storage whenever they change
  useEffect(() => {
    if (rules.length > 0) {
      const persistRules = async () => {
        try {
          const fetchTime = new Date().toISOString();
          await chrome.storage.local.set({
            cachedRules: rules,
            cachedRulesStats: stats,
            cachedRulesTime: fetchTime,
          });
          console.log('[RulesTab] Persisted', rules.length, 'rules to storage');
        } catch (err) {
          console.error('[RulesTab] Failed to persist rules:', err);
        }
      };

      persistRules();
    }
  }, [rules, stats]);

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

      // Start progress - we don't know total yet, so use indeterminate progress
      startProgress('Loading group rules...', 1);

      // Track API requests made
      let apiRequestCount = 0;

      const response = await chrome.tabs.sendMessage(targetTabId, {
        action: 'fetchGroupRules',
      });

      console.log('[RulesTab] Received response:', response);

      if (response.success) {
        const rulesCount = response.rules?.length || 0;
        updateProgress(1, 1, `Loaded ${rulesCount} rules successfully`);

        setRules(response.rules || []);
        setStats(response.stats || { total: 0, active: 0, inactive: 0, conflicts: 0 });
        setLastFetchTime(new Date().toISOString());

        // Calculate actual API cost based on response metadata
        // The content script makes 1 request for rules fetch
        apiRequestCount = 1;
        setApiCost(apiRequestCount);

        console.log('[RulesTab] Loaded rules successfully:', {
          count: response.rules?.length,
          stats: response.stats,
          apiCost: apiRequestCount
        });

        // Complete progress after a short delay to show success message
        setTimeout(() => {
          completeProgress();
        }, 1000);
      } else {
        setError(response.error || 'Failed to fetch rules');
        console.error('[RulesTab] Error fetching rules:', response.error);
        completeProgress();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with Okta tab');
      console.error('[RulesTab] Exception:', err);
      completeProgress();
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateRule = async (ruleId: string) => {
    if (!targetTabId) return;

    const startTime = Date.now();
    let currentUserEmail = 'unknown@unknown.com';

    try {
      console.log('[RulesTab] Activating rule:', ruleId);

      // Get current user for audit logging
      try {
        const userResponse = await chrome.tabs.sendMessage(targetTabId, {
          action: 'makeApiRequest',
          endpoint: '/api/v1/users/me',
          method: 'GET',
        });
        if (userResponse.success && userResponse.data) {
          currentUserEmail = userResponse.data.profile?.email || 'unknown@unknown.com';
        }
      } catch (err) {
        console.error('[RulesTab] Failed to get current user:', err);
      }

      // Find the rule to get its name for undo logging
      const rule = rules.find(r => r.id === ruleId);
      const ruleName = rule?.name || 'Unknown Rule';
      const groupIds = rule?.groupIds || [];
      const groupNames = rule?.groupNames || [];

      const response = await chrome.tabs.sendMessage(targetTabId, {
        action: 'activateRule',
        ruleId,
      });

      if (response.success) {
        // Log undo action
        await logAction(`Activated rule: ${ruleName}`, {
          type: 'ACTIVATE_RULE',
          ruleId,
          ruleName,
        });

        // Log to audit trail (fire-and-forget)
        const auditEntry: AuditLogEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'activate_rule',
          groupId: groupIds[0] || 'multiple',
          groupName: groupNames.length > 0 ? groupNames.join(', ') : ruleName,
          performedBy: currentUserEmail,
          affectedUsers: [],
          result: 'success',
          details: {
            usersSucceeded: 0,
            usersFailed: 0,
            apiRequestCount: 1,
            durationMs: Date.now() - startTime,
          },
        };
        auditStore.logOperation(auditEntry).catch((err) => {
          console.error('[RulesTab] Failed to log audit entry:', err);
        });

        // Reload rules to get updated status
        await handleLoadRules();
      } else {
        setError(response.error || 'Failed to activate rule');

        // Log failure to audit trail
        const auditEntry: AuditLogEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'activate_rule',
          groupId: groupIds[0] || 'multiple',
          groupName: groupNames.length > 0 ? groupNames.join(', ') : ruleName,
          performedBy: currentUserEmail,
          affectedUsers: [],
          result: 'failed',
          details: {
            usersSucceeded: 0,
            usersFailed: 0,
            apiRequestCount: 1,
            durationMs: Date.now() - startTime,
            errorMessages: [response.error || 'Unknown error'],
          },
        };
        auditStore.logOperation(auditEntry).catch((err) => {
          console.error('[RulesTab] Failed to log audit entry:', err);
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to activate rule');
      console.error('[RulesTab] Activation error:', err);

      // Log error to audit trail
      const rule = rules.find(r => r.id === ruleId);
      const groupIds = rule?.groupIds || [];
      const groupNames = rule?.groupNames || [];
      const auditEntry: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        action: 'activate_rule',
        groupId: groupIds[0] || 'unknown',
        groupName: groupNames.length > 0 ? groupNames.join(', ') : 'Unknown',
        performedBy: currentUserEmail,
        affectedUsers: [],
        result: 'failed',
        details: {
          usersSucceeded: 0,
          usersFailed: 0,
          apiRequestCount: 1,
          durationMs: Date.now() - startTime,
          errorMessages: [err.message || 'Unknown error'],
        },
      };
      auditStore.logOperation(auditEntry).catch((e) => {
        console.error('[RulesTab] Failed to log audit entry:', e);
      });
    }
  };

  const handleDeactivateRule = async (ruleId: string) => {
    if (!targetTabId) return;

    const startTime = Date.now();
    let currentUserEmail = 'unknown@unknown.com';

    try {
      console.log('[RulesTab] Deactivating rule:', ruleId);

      // Get current user for audit logging
      try {
        const userResponse = await chrome.tabs.sendMessage(targetTabId, {
          action: 'makeApiRequest',
          endpoint: '/api/v1/users/me',
          method: 'GET',
        });
        if (userResponse.success && userResponse.data) {
          currentUserEmail = userResponse.data.profile?.email || 'unknown@unknown.com';
        }
      } catch (err) {
        console.error('[RulesTab] Failed to get current user:', err);
      }

      // Find the rule to get its name for undo logging
      const rule = rules.find(r => r.id === ruleId);
      const ruleName = rule?.name || 'Unknown Rule';
      const groupIds = rule?.groupIds || [];
      const groupNames = rule?.groupNames || [];

      const response = await chrome.tabs.sendMessage(targetTabId, {
        action: 'deactivateRule',
        ruleId,
      });

      if (response.success) {
        // Log undo action
        await logAction(`Deactivated rule: ${ruleName}`, {
          type: 'DEACTIVATE_RULE',
          ruleId,
          ruleName,
        });

        // Log to audit trail (fire-and-forget)
        const auditEntry: AuditLogEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'deactivate_rule',
          groupId: groupIds[0] || 'multiple',
          groupName: groupNames.length > 0 ? groupNames.join(', ') : ruleName,
          performedBy: currentUserEmail,
          affectedUsers: [],
          result: 'success',
          details: {
            usersSucceeded: 0,
            usersFailed: 0,
            apiRequestCount: 1,
            durationMs: Date.now() - startTime,
          },
        };
        auditStore.logOperation(auditEntry).catch((err) => {
          console.error('[RulesTab] Failed to log audit entry:', err);
        });

        // Reload rules to get updated status
        await handleLoadRules();
      } else {
        setError(response.error || 'Failed to deactivate rule');

        // Log failure to audit trail
        const auditEntry: AuditLogEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'deactivate_rule',
          groupId: groupIds[0] || 'multiple',
          groupName: groupNames.length > 0 ? groupNames.join(', ') : ruleName,
          performedBy: currentUserEmail,
          affectedUsers: [],
          result: 'failed',
          details: {
            usersSucceeded: 0,
            usersFailed: 0,
            apiRequestCount: 1,
            durationMs: Date.now() - startTime,
            errorMessages: [response.error || 'Unknown error'],
          },
        };
        auditStore.logOperation(auditEntry).catch((err) => {
          console.error('[RulesTab] Failed to log audit entry:', err);
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate rule');
      console.error('[RulesTab] Deactivation error:', err);

      // Log error to audit trail
      const rule = rules.find(r => r.id === ruleId);
      const groupIds = rule?.groupIds || [];
      const groupNames = rule?.groupNames || [];
      const auditEntry: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        action: 'deactivate_rule',
        groupId: groupIds[0] || 'unknown',
        groupName: groupNames.length > 0 ? groupNames.join(', ') : 'Unknown',
        performedBy: currentUserEmail,
        affectedUsers: [],
        result: 'failed',
        details: {
          usersSucceeded: 0,
          usersFailed: 0,
          apiRequestCount: 1,
          durationMs: Date.now() - startTime,
          errorMessages: [err.message || 'Unknown error'],
        },
      };
      auditStore.logOperation(auditEntry).catch((e) => {
        console.error('[RulesTab] Failed to log audit entry:', e);
      });
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

        {/* Last Fetch Time */}
        {lastFetchTime && rules.length > 0 && (
          <div className="api-cost-indicator" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <span className="api-cost-label">Cached from:</span>
            <span className="api-cost-value" style={{ color: 'var(--text-secondary)' }}>
              {new Date(lastFetchTime).toLocaleString()}
            </span>
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
                  oktaOrigin={oktaOrigin}
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
