import React, { useState, useEffect } from 'react';
import RuleCard from './RuleCard';
import PageHeader from './shared/PageHeader';
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

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="Group Rules"
        subtitle="Analyze group rules and detect potential conflicts"
        icon="bolt"
        badge={stats.conflicts > 0 ? { text: `${stats.conflicts} Conflicts`, variant: 'warning' } : undefined}
        actions={
          <button
            className="px-5 py-2.5 bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white font-semibold rounded-lg hover:from-[#005a8f] hover:to-[#007dc1] transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center gap-2"
            onClick={() => handleLoadRules(rules.length > 0)}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Loading...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{rules.length > 0 ? 'Refresh' : 'Load Rules'}</span>
              </>
            )}
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Metadata Row */}
        {(apiCost !== null || (lastFetchTime && rules.length > 0)) && (
          <div className="flex gap-3 flex-wrap">
            {apiCost !== null && (
              <div className="px-4 py-2 bg-gradient-to-br from-white to-gray-50/50 border border-gray-200/60 rounded-lg shadow-sm flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">API Requests:</span>
                <span className="text-sm font-bold text-[#007dc1]">{apiCost}</span>
              </div>
            )}
            {lastFetchTime && rules.length > 0 && (
              <div className="px-4 py-2 bg-gradient-to-br from-white to-gray-50/50 border border-gray-200/60 rounded-lg shadow-sm flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Cached:</span>
                <span className="text-sm font-mono text-gray-700">{new Date(lastFetchTime).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        {rules.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-3 duration-500">
            <div className="relative overflow-hidden rounded-xl border border-gray-200/60 p-5 bg-gradient-to-br from-white to-gray-50/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#007dc1]/10 to-[#3d9dd9]/10 opacity-50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-600">Total Rules</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-emerald-200/60 p-5 bg-gradient-to-br from-white to-emerald-50/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 opacity-50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-600">Active</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">{stats.active}</p>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-gray-200/60 p-5 bg-gradient-to-br from-white to-gray-50/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-500/10 to-gray-600/10 opacity-50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-600">Inactive</p>
                <p className="text-3xl font-bold text-gray-600 mt-2">{stats.inactive}</p>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-amber-200/60 p-5 bg-gradient-to-br from-white to-amber-50/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-amber-600/10 opacity-50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-600">Conflicts</p>
                <p className="text-3xl font-bold text-amber-600 mt-2">{stats.conflicts}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        {rules.length > 0 && (
          <div className="space-y-3 animate-in slide-in-from-top-4 duration-500">
            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 shadow-sm hover:shadow"
                placeholder="Search rules by name, condition, or attributes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  activeFilter === 'all'
                    ? 'bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
                onClick={() => setActiveFilter('all')}
              >
                All Rules
              </button>
              <button
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  activeFilter === 'active'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
                onClick={() => setActiveFilter('active')}
              >
                Active Only
              </button>
              <button
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeFilter === 'conflicts'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
                onClick={() => setActiveFilter('conflicts')}
                disabled={stats.conflicts === 0}
              >
                Conflicts ({stats.conflicts})
              </button>
              {currentGroupId && (
                <button
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    activeFilter === 'current-group'
                      ? 'bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveFilter('current-group')}
                >
                  Current Group
                </button>
              )}
            </div>
          </div>
        )}

        {/* Rules List */}
        <div className="min-h-[400px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-300">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-200 border-t-[#007dc1] rounded-full animate-spin" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-[#3d9dd9] rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1s' }} />
              </div>
              <p className="mt-6 text-gray-600 font-medium">Loading rules...</p>
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#007dc1]/10 to-[#3d9dd9]/10 flex items-center justify-center mb-4">
                <span className="text-3xl">⚡</span>
              </div>
              <p className="text-gray-600 max-w-md">Click "Load Rules" to analyze your Okta group rules</p>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-500/10 to-gray-600/10 flex items-center justify-center mb-4">
                <span className="text-3xl">🔍</span>
              </div>
              <p className="text-gray-600 max-w-md">No rules match your search or filter criteria</p>
            </div>
          ) : (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {filteredRules.map((rule, index) => (
                <div
                  key={rule.id}
                  data-rule-id={rule.id}
                  className="animate-in slide-in-from-left-2 duration-300"
                  style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
                >
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
