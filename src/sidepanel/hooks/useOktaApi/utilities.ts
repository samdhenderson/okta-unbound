/**
 * @module hooks/useOktaApi/utilities
 * @description Shared utility functions for API operations.
 *
 * The pagination primitives (`parseNextLink`, `nextPageUrl`) moved to the
 * canonical `shared/utils/oktaPagination` module; they are re-exported here so
 * existing imports (and the barrel) keep working unchanged.
 */

export { parseNextLink, nextPageUrl } from '@/shared/utils/oktaPagination';

/**
 * Recursively merge one app profile over another.
 *
 * @param baseProfile - Starting profile; copied, never mutated.
 * @param overrideProfile - Values layered on top of the base.
 * @param arrayStrategy - How to combine array-valued fields: `'replace'` (default)
 * swaps the whole array; `'merge'` unions and de-dupes with the base array.
 * @returns A new profile object with overrides applied.
 * @remarks `null`/`undefined` override values are skipped so the base value survives;
 * nested plain objects recurse with the same strategy; all other values are replaced.
 */
export function deepMergeProfiles(
  baseProfile: Record<string, unknown>,
  overrideProfile: Record<string, unknown>,
  arrayStrategy: 'merge' | 'replace' = 'replace',
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...baseProfile };

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
    else if (
      typeof overrideValue === 'object' &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      result[key] = deepMergeProfiles(
        (baseValue as Record<string, unknown> | null) || {},
        overrideValue as Record<string, unknown>,
        arrayStrategy,
      );
    }
    // Primitive values
    else {
      result[key] = overrideValue;
    }
  }

  return result;
}
