# Tab State Persistence System

## Overview

The Tab State Persistence system saves and restores UI state across tab navigation, preventing unnecessary re-fetching and maintaining user context. This dramatically improves UX by:

- Preserving filters, sorts, and search queries
- Maintaining scroll positions
- Retaining cached data
- Avoiding redundant API calls
- Providing instant tab switching

## Architecture

### Components

#### 1. **TabStateManager** (`src/shared/tabState/tabStateManager.ts`)
Core manager providing:
- State save/load operations
- TTL-based expiration
- Automatic cleanup of stale state
- Version management for migrations
- Storage usage tracking

#### 2. **Type Definitions** (`src/shared/tabState/types.ts`)
Defines state structure for each tab:
- `BaseTabState`: Common fields (lastVisited, scrollPosition)
- `RulesTabState`: Rules-specific state
- `GroupsTabState`: Groups-specific state
- `UsersTabState`: Users-specific state
- And more for each tab...

#### 3. **Integration** (Per-tab components)
Each tab component:
- Loads state on mount
- Saves state on unmount and changes
- Tracks scroll position
- Marks tab as visited

## State Structure

### Base State (All Tabs)

```typescript
interface BaseTabState {
  lastVisited: number;      // Timestamp
  scrollPosition: number;   // Scroll offset in pixels
}
```

### Example: Rules Tab State

```typescript
interface RulesTabState extends BaseTabState {
  searchQuery: string;
  activeFilter: 'all' | 'active' | 'conflicts' | 'current-group';
  cachedRules: FormattedRule[] | null;
  cachedStats: RuleStats | null;
  lastFetchTime: string | null;
}
```

### Example: Groups Tab State

```typescript
interface GroupsTabState extends BaseTabState {
  viewMode: 'browse' | 'search' | 'bulk' | 'compare';
  searchQuery: string;
  typeFilter: string;
  sizeFilter: string;
  sortBy: 'name' | 'memberCount' | 'lastUpdated';
  selectedGroupIds: string[];
  cachedGroups: GroupSummary[] | null;
  cacheTimestamp: number | null;
}
```

## Storage

### Location
State is stored in `chrome.storage.local` with keys:
- `tab_state_dashboard`
- `tab_state_operations`
- `tab_state_rules`
- `tab_state_users`
- `tab_state_security`
- `tab_state_groups`
- `tab_state_undo`

### Metadata

Each stored state includes metadata:

```typescript
interface StoredStateMetadata {
  version: number;          // Schema version (for migrations)
  lastUpdated: number;      // Timestamp
  expiresAt: number | null; // Expiration timestamp
}
```

### TTL (Time To Live)

Default: 30 minutes

State automatically expires after TTL and is cleaned up. This prevents:
- Stale data from being restored
- Storage bloat
- Confusion from old state

## Usage

### Saving State

```typescript
import { saveRulesTabState } from '../../shared/tabState/tabStateManager';

// In component
useEffect(() => {
  saveRulesTabState({
    searchQuery,
    activeFilter,
    cachedRules: rules,
    cachedStats: stats,
    scrollPosition: window.scrollY,
  });
}, [searchQuery, activeFilter, rules, stats]);
```

### Loading State

```typescript
import { TabStateManager } from '../../shared/tabState/tabStateManager';
import type { RulesTabState } from '../../shared/tabState/types';

// On mount
useEffect(() => {
  const loadState = async () => {
    const saved = await TabStateManager.loadTabState<RulesTabState>('rules');
    if (saved) {
      setSearchQuery(saved.searchQuery);
      setActiveFilter(saved.activeFilter);
      setRules(saved.cachedRules || []);
      setStats(saved.cachedStats || defaultStats);

      // Restore scroll after render
      setTimeout(() => {
        window.scrollTo(0, saved.scrollPosition);
      }, 100);
    }
  };

  loadState();
}, []);
```

### Tracking Scroll Position

```typescript
// Track scroll position changes
useEffect(() => {
  const handleScroll = () => {
    TabStateManager.updateScrollPosition('rules', window.scrollY);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

### Marking Tab Visited

```typescript
// On mount
useEffect(() => {
  TabStateManager.markTabVisited('rules');
}, []);
```

## Tab Integration Example

Here's a complete example for the Rules tab:

```typescript
const RulesTab: React.FC = () => {
  const [rules, setRules] = useState<FormattedRule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Load state on mount
  useEffect(() => {
    const loadState = async () => {
      const saved = await TabStateManager.loadTabState<RulesTabState>('rules');
      if (saved) {
        if (saved.cachedRules) setRules(saved.cachedRules);
        if (saved.searchQuery) setSearchQuery(saved.searchQuery);
        if (saved.activeFilter) setActiveFilter(saved.activeFilter);
        if (saved.scrollPosition) {
          setTimeout(() => window.scrollTo(0, saved.scrollPosition), 100);
        }
      }
    };
    loadState();
    TabStateManager.markTabVisited('rules');
  }, []);

  // Save state on changes
  useEffect(() => {
    if (rules.length > 0) {
      saveRulesTabState({
        cachedRules: rules,
        searchQuery,
        activeFilter,
        scrollPosition: window.scrollY,
      });
    }
  }, [rules, searchQuery, activeFilter]);

  // Track scroll
  useEffect(() => {
    const handleScroll = () => {
      TabStateManager.updateScrollPosition('rules', window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ... rest of component
};
```

## Benefits

### 1. No Re-fetching

When switching back to a tab:
- Cached data is restored instantly
- No API calls needed if data is fresh
- Filters and searches remain active

### 2. Preserved Context

Users don't lose their place:
- Scroll position restored
- Search query maintained
- Filters and sorts preserved
- Selections remembered

### 3. Reduced Load

- Fewer API calls = less load on Okta
- Faster tab switching
- Lower bandwidth usage
- Better rate limit compliance

### 4. Better UX

- Instant tab switching
- No "flash of empty content"
- Seamless navigation
- Feels like a native app

## Cleanup

### Automatic

The background service worker runs cleanup every hour:

```typescript
setInterval(() => {
  TabStateManager.cleanupExpiredStates();
}, 60 * 60 * 1000);
```

This removes:
- Expired states (>30 minutes old)
- Invalid version states
- Corrupted data

### Manual

Clear specific tab:
```typescript
await TabStateManager.clearTabState('rules');
```

Clear all tabs:
```typescript
await TabStateManager.clearAllTabStates();
```

## Versioning

### Schema Migrations

When state structure changes, increment `STATE_VERSION`:

```typescript
const STATE_VERSION = 2; // Was 1, now 2
```

Old state with version 1 will be discarded on load, preventing errors from schema mismatches.

### Adding New Fields

Add fields as optional to maintain backward compatibility:

```typescript
interface RulesTabState extends BaseTabState {
  searchQuery: string;
  activeFilter: FilterType;
  newField?: string; // Optional - won't break old state
}
```

## Storage Limits

Chrome storage limits:
- `chrome.storage.local`: 10MB total
- Per-item: 8KB recommended, 1MB max

### Managing Size

To keep storage efficient:
1. Use TTL to expire old state
2. Don't cache large datasets unnecessarily
3. Clean up periodically
4. Consider compression for large objects

### Monitoring

Check storage usage:

```typescript
const info = await TabStateManager.getStorageInfo();
console.log('States:', info.totalStates);
console.log('Bytes:', info.totalBytes);
console.log('Details:', info.states);
```

## Best Practices

### 1. Save Strategically

Don't save on every keystroke:
```typescript
// Bad
onChange={(e) => {
  setQuery(e.target.value);
  saveState({ query: e.target.value }); // Too frequent
}}

// Good
useEffect(() => {
  const timer = setTimeout(() => {
    saveState({ query });
  }, 500);
  return () => clearTimeout(timer);
}, [query]); // Debounced
```

### 2. Load Defensively

Always handle missing state:
```typescript
const saved = await TabStateManager.loadTabState('rules');
const query = saved?.searchQuery || ''; // Fallback to default
```

### 3. Restore Timing

Restore scroll position after render:
```typescript
if (saved?.scrollPosition) {
  setTimeout(() => {
    window.scrollTo(0, saved.scrollPosition);
  }, 100); // Wait for DOM
}
```

### 4. Cache Data Freshness

Check if cached data is still valid:
```typescript
const saved = await TabStateManager.loadTabState('rules');
if (saved?.cachedRules && saved?.lastFetchTime) {
  const age = Date.now() - new Date(saved.lastFetchTime).getTime();
  if (age < 5 * 60 * 1000) { // 5 minutes
    setRules(saved.cachedRules); // Use cache
  } else {
    fetchFreshRules(); // Cache too old
  }
}
```

## Future Enhancements

Potential improvements:
- Compression for large states
- Sync across devices (via `chrome.storage.sync`)
- State snapshots for debugging
- State rollback/undo
- Per-group state isolation
- State export/import for backups
- Automatic state validation
- Smart cache invalidation

## Debugging

### View Stored State

```javascript
// In browser console
chrome.storage.local.get(null, (items) => {
  console.log('All storage:', items);
});

// Get specific tab state
chrome.storage.local.get(['tab_state_rules'], (result) => {
  console.log('Rules tab state:', result.tab_state_rules);
});
```

### Clear All State

```javascript
// In browser console
chrome.storage.local.clear(() => {
  console.log('All state cleared');
});
```

### Monitor Saves

Enable logging in TabStateManager:
```typescript
console.log('[TabStateManager] Saved state for tab:', tabName);
```

## Integration Checklist

When adding state persistence to a new tab:

- [ ] Define state interface in `types.ts`
- [ ] Create convenience save function
- [ ] Load state on component mount
- [ ] Save state on relevant changes
- [ ] Track scroll position
- [ ] Mark tab as visited
- [ ] Handle missing/expired state gracefully
- [ ] Test state restoration after navigation
- [ ] Verify state expiration works
- [ ] Check storage size doesn't grow excessively
