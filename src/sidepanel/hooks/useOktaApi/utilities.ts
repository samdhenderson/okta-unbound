/**
 * @module hooks/useOktaApi/utilities
 * @description Shared utility functions for API operations
 */

/**
 * Parse pagination link from Okta API response headers
 */
export function parseNextLink(linkHeader?: string): string | null {
  if (!linkHeader) return null;

  const links = linkHeader.split(',');
  for (const link of links) {
    if (link.includes('rel="next"')) {
      const match = link.match(/<([^>]+)>/);
      if (match) {
        const fullUrl = new URL(match[1]);
        return fullUrl.pathname + fullUrl.search;
      }
    }
  }
  return null;
}

/**
 * Deep merge utility for complex app profiles
 * Handles arrays (merge or replace based on strategy), nested objects, and null values
 */
export function deepMergeProfiles(
  baseProfile: Record<string, any>,
  overrideProfile: Record<string, any>,
  arrayStrategy: 'merge' | 'replace' = 'replace'
): Record<string, any> {
  const result: Record<string, any> = { ...baseProfile };

  for (const [key, overrideValue] of Object.entries(overrideProfile)) {
    const baseValue = result[key];

    // Skip null/undefined override values (keep base)
    if (overrideValue === null || overrideValue === undefined) {
      continue;
    }

    // Handle arrays (e.g., Salesforce permission sets)
    if (Array.isArray(overrideValue)) {
      if (arrayStrategy === 'merge' && Array.isArray(baseValue)) {
        // Merge arrays, dedupe
        result[key] = [...new Set([...baseValue, ...overrideValue])];
      } else {
        // Replace array entirely
        result[key] = [...overrideValue];
      }
    }
    // Handle nested objects (not arrays)
    else if (typeof overrideValue === 'object' && typeof baseValue === 'object' && !Array.isArray(baseValue)) {
      result[key] = deepMergeProfiles(baseValue || {}, overrideValue, arrayStrategy);
    }
    // Primitive values
    else {
      result[key] = overrideValue;
    }
  }

  return result;
}
