// Rule Inspector feature
// Fetches, analyzes, and detects conflicts in Okta group rules

class RuleInspector {
  constructor(apiClient, paginationHelper) {
    this.apiClient = apiClient;
    this.paginationHelper = paginationHelper;
    this.rules = [];
  }

  // Fetch all group rules from Okta
  async fetchAllRules(onProgress = null) {
    try {
      if (onProgress) {
        onProgress({ stage: 'start', message: 'Fetching group rules...' });
      }

      const endpoint = '/api/v1/groups/rules';
      const response = await this.apiClient.makeRequest(endpoint);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch rules');
      }

      this.rules = response.data || [];

      if (onProgress) {
        onProgress({
          stage: 'complete',
          message: `Loaded ${this.rules.length} group rules`,
          success: true,
          count: this.rules.length
        });
      }

      return {
        success: true,
        rules: this.rules,
        count: this.rules.length
      };

    } catch (error) {
      if (onProgress) {
        onProgress({
          stage: 'error',
          message: `Failed to fetch rules: ${error.message}`,
          success: false
        });
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get rule statistics
  getRuleStats() {
    const active = this.rules.filter(r => r.status === 'ACTIVE').length;
    const inactive = this.rules.filter(r => r.status === 'INACTIVE').length;
    const conflicts = this.detectConflicts().length;

    return {
      total: this.rules.length,
      active,
      inactive,
      conflicts
    };
  }

  // Detect potential conflicts between rules
  detectConflicts() {
    const conflicts = [];

    // Compare each rule with every other rule
    for (let i = 0; i < this.rules.length; i++) {
      for (let j = i + 1; j < this.rules.length; j++) {
        const rule1 = this.rules[i];
        const rule2 = this.rules[j];

        // Only check active rules
        if (rule1.status !== 'ACTIVE' || rule2.status !== 'ACTIVE') {
          continue;
        }

        // Check if rules have overlapping conditions
        const conflict = this.checkRuleOverlap(rule1, rule2);
        if (conflict) {
          conflicts.push({
            rule1: {
              id: rule1.id,
              name: rule1.name
            },
            rule2: {
              id: rule2.id,
              name: rule2.name
            },
            reason: conflict.reason
          });
        }
      }
    }

    return conflicts;
  }

  // Check if two rules have overlapping conditions
  checkRuleOverlap(rule1, rule2) {
    // If they assign to the same group, check condition overlap
    if (this.assignSameGroups(rule1, rule2)) {
      // Simple heuristic: if both rules use similar user attributes, flag as potential conflict
      const attrs1 = this.extractUserAttributes(rule1);
      const attrs2 = this.extractUserAttributes(rule2);

      const commonAttrs = attrs1.filter(a => attrs2.includes(a));
      if (commonAttrs.length > 0) {
        return {
          reason: `Both rules use ${commonAttrs.join(', ')} and assign to the same group(s)`
        };
      }
    }

    return null;
  }

  // Check if rules assign to same groups
  assignSameGroups(rule1, rule2) {
    const groups1 = rule1.actions?.assignUserToGroups?.groupIds || [];
    const groups2 = rule2.actions?.assignUserToGroups?.groupIds || [];

    return groups1.some(g => groups2.includes(g));
  }

  // Extract user attributes from rule conditions
  extractUserAttributes(rule) {
    const attributes = [];
    const condition = rule.conditions?.expression?.value || '';

    // Parse common patterns like user.department, user.title, etc.
    const matches = condition.match(/user\.(\w+)/g) || [];
    matches.forEach(match => {
      const attr = match.replace('user.', '');
      if (!attributes.includes(attr)) {
        attributes.push(attr);
      }
    });

    return attributes;
  }

  // Filter rules by search query
  filterRules(query) {
    if (!query || query.trim() === '') {
      return this.rules;
    }

    const lowerQuery = query.toLowerCase();

    return this.rules.filter(rule => {
      return (
        rule.name.toLowerCase().includes(lowerQuery) ||
        rule.id.toLowerCase().includes(lowerQuery) ||
        (rule.conditions?.expression?.value || '').toLowerCase().includes(lowerQuery)
      );
    });
  }

  // Format rule for display
  formatRuleForDisplay(rule) {
    return {
      id: rule.id,
      name: rule.name,
      status: rule.status,
      condition: rule.conditions?.expression?.value || 'No condition specified',
      groupIds: rule.actions?.assignUserToGroups?.groupIds || [],
      created: rule.created,
      lastUpdated: rule.lastUpdated
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RuleInspector;
}
