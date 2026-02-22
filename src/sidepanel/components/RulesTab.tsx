import React, { useState, useEffect } from 'react';
import RuleCard from './RuleCard';
import PageHeader from './shared/PageHeader';
import Button from './shared/Button';
import AlertMessage from './shared/AlertMessage';
import LoadingSpinner from './shared/LoadingSpinner';
import EmptyState from './shared/EmptyState';
import type { FormattedRule, AuditLogEntry } from '../../shared/types';
import { filterRules } from '../../shared/ruleUtils';
import { useProgress } from '../contexts/ProgressContext';
import { logAction } from '../../shared/undoManager';
import { auditStore } from '../../shared/storage/auditStore';
import { RulesCache } from '../../shared/rulesCache';
import { TabStateManager, saveRulesTabState } from '../../shared/tabState/tabStateManager';
import type { RulesTabState } from '../../shared/tabState/types';

interface RulesTabProps {
  targetTabId?: number;
  currentGroupId?: string;
  oktaOrigin?: string | null;
  selectedRuleId?: string | null;
  onRuleSelected?: () => void;
}

type FilterType = 'all' | 'active' | 'conflicts' | 'current-group';

const RulesTab: React.FC<RulesTabProps> = ({
  targetTabId,
  currentGroupId,
  oktaOrigin,
  selectedRuleId,
  onRuleSelected
}) => {
  const [rules, setRules] = useState<FormattedRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, conflicts: 0 });
  const [apiCost, setApiCost] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);
  const { startProgress, updateProgress, completeProgress } = useProgress();

  // Load rules and state from TabStateManager on mount
  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const savedState = await TabStateManager.loadTabState<RulesTabState>('rules');
        if (savedState) {
          console.log('[RulesTab] Loaded persisted state from TabStateManager');
          if (savedState.cachedRules) setRules(savedState.cachedRules);
          if (savedState.cachedStats) setStats(savedState.cachedStats);
          if (savedState.lastFetchTime) setLastFetchTime(savedState.lastFetchTime);
          if (savedState.searchQuery) setSearchQuery(savedState.searchQuery);
          if (savedState.activeFilter) setActiveFilter(savedState.activeFilter);
          if (savedState.scrollPosition) {
            // Restore scroll position after a short delay
            setTimeout(() => {
              window.scrollTo(0, savedState.scrollPosition);
            }, 100);
          }
        }
      } catch (err) {
        console.error('[RulesTab] Failed to load persisted state:', err);
      }
    };

    loadPersistedState();

    // Mark tab as visited
    TabStateManager.markTabVisited('rules');
  }, []);

  // Handle selectedRuleId navigation
  useEffect(() => {
    if (selectedRuleId && rules.length > 0) {
      console.log('[RulesTab] Navigating to rule:', selectedRuleId);

      // Find the rule and scroll to it
      const ruleElement = document.querySelector(`[data-rule-id="${selectedRuleId}"]`);
      if (ruleElement) {
        ruleElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Clear the selection after a delay
        setTimeout(() => {
          onRuleSelected?.();
        }, 2000);
      } else {
        console.warn('[RulesTab] Rule not found in DOM:', selectedRuleId);
      }
    }
  }, [selectedRuleId, rules, onRuleSelected]);

  // Persist rules and UI state whenever they change
  useEffect(() => {
    if (rules.length > 0) {
      saveRulesTabState({
        cachedRules: rules,
        cachedStats: stats,
        lastFetchTime,
        searchQuery,
        activeFilter,
        scrollPosition: window.scrollY,
      }).catch((err) => {
        console.error('[RulesTab] Failed to persist state:', err);
      });
    }
  }, [rules, stats, lastFetchTime, searchQuery, activeFilter]);

  // Persist scroll position periodically
  useEffect(() => {
    const handleScroll = () => {
      TabStateManager.updateScrollPosition('rules', window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLoadRules = async (force: boolean = false) => {
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
      startProgress('Loading Rules', 'Loading group rules...', 1);

      // Track API requests made
      let apiRequestCount = 0;

      // OPTIMIZED: Check global cache first (unless forced refresh)
      if (!force) {
        const cached = await RulesCache.get();
        if (cached) {
          console.log('[RulesTab] Using cached rules from global cache');
          setRules(cached.rules);
          setStats(cached.stats);
          setLastFetchTime(new Date(cached.timestamp).toISOString());
          setApiCost(0); // No API calls needed
          updateProgress(1, 1, `Loaded ${cached.rules.length} rules from cache`);
          setTimeout(() => completeProgress(), 500);
          setIsLoading(false);
          return;
        }
      }

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

        // OPTIMIZED: Populate global cache for other components to use
        await RulesCache.set(
          response.rules || [],
          [], // rawRules not available from formatted response
          response.stats || { total: 0, active: 0, inactive: 0, conflicts: 0 },
          response.conflicts || []
        );

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

  const filterButtonClass = (filter: FilterType) =>
    `px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-100 ${
      activeFilter === filter
        ? 'bg-primary text-white'
        : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-500'
    }`;

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="Group Rules"
        subtitle="Analyze group rules and detect potential conflicts"
        badge={stats.conflicts > 0 ? { text: `${stats.conflicts} Conflicts`, variant: 'warning' } : undefined}
        actions={
          <Button
            variant={rules.length > 0 ? 'secondary' : 'primary'}
            icon="refresh"
            onClick={() => handleLoadRules(rules.length > 0)}
            disabled={isLoading}
            loading={isLoading}
          >
            {rules.length > 0 ? 'Refresh' : 'Load Rules'}
          </Button>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Metadata Row */}
        {(apiCost !== null || (lastFetchTime && rules.length > 0)) && (
          <div className="flex gap-3 flex-wrap">
            {apiCost !== null && (
              <div className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md flex items-center gap-2">
                <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">API Requests:</span>
                <span className="text-sm font-bold text-primary-text">{apiCost}</span>
              </div>
            )}
            {lastFetchTime && rules.length > 0 && (
              <div className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md flex items-center gap-2">
                <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Cached:</span>
                <span className="text-sm font-mono text-neutral-700">{new Date(lastFetchTime).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <AlertMessage
            message={{ text: error, type: 'error' }}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Stats Overview */}
        {rules.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-md border border-neutral-200 p-4 bg-white">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-600">Total Rules</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{stats.total}</p>
            </div>
            <div className="rounded-md border border-neutral-200 p-4 bg-white">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-600">Active</p>
              <p className="text-2xl font-bold text-success mt-1">{stats.active}</p>
            </div>
            <div className="rounded-md border border-neutral-200 p-4 bg-white">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-600">Inactive</p>
              <p className="text-2xl font-bold text-neutral-600 mt-1">{stats.inactive}</p>
            </div>
            <div className="rounded-md border border-neutral-200 p-4 bg-white">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-600">Conflicts</p>
              <p className="text-2xl font-bold text-warning mt-1">{stats.conflicts}</p>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        {rules.length > 0 && (
          <div className="space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-neutral-200 rounded-md text-sm placeholder-neutral-400 focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary transition-all duration-100"
                placeholder="Search rules by name, condition, or attributes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <button className={filterButtonClass('all')} onClick={() => setActiveFilter('all')}>
                All Rules
              </button>
              <button className={filterButtonClass('active')} onClick={() => setActiveFilter('active')}>
                Active Only
              </button>
              <button
                className={`${filterButtonClass('conflicts')} disabled:opacity-50 disabled:cursor-not-allowed`}
                onClick={() => setActiveFilter('conflicts')}
                disabled={stats.conflicts === 0}
              >
                Conflicts ({stats.conflicts})
              </button>
              {currentGroupId && (
                <button className={filterButtonClass('current-group')} onClick={() => setActiveFilter('current-group')}>
                  Current Group
                </button>
              )}
            </div>
          </div>
        )}

        {/* Rules List */}
        <div className="min-h-[400px]">
          {isLoading ? (
            <LoadingSpinner size="lg" message="Loading rules..." centered />
          ) : rules.length === 0 ? (
            <EmptyState
              icon="list"
              title="No Rules Loaded"
              description='Click "Load Rules" to analyze your Okta group rules'
              actions={[
                { label: 'Load Rules', onClick: () => handleLoadRules(false), variant: 'primary' }
              ]}
            />
          ) : filteredRules.length === 0 ? (
            <EmptyState
              icon="search"
              title="No Matching Rules"
              description="No rules match your search or filter criteria"
            />
          ) : (
            <div className="space-y-3">
              {filteredRules.map((rule) => (
                <div key={rule.id} data-rule-id={rule.id}>
                  <RuleCard
                    rule={rule}
                    onActivate={handleActivateRule}
                    onDeactivate={handleDeactivateRule}
                    oktaOrigin={oktaOrigin}
                    isHighlighted={selectedRuleId === rule.id}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RulesTab;
