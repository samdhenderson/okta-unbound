import type { OktaUser } from './types';

/**
 * Basic Okta Expression Language Evaluator (Client-Side)
 *
 * Takes a user object and a condition expression and returns whether the user matches.
 *
 * LIMITATIONS (Due to Okta Platform Constraints):
 * ─────────────────────────────────────────────────
 *
 * ❌ NOT SUPPORTED - These expressions CANNOT be evaluated client-side:
 *
 * 1. isMemberOfGroup() / isMemberOfAnyGroup() - Group membership checks
 *    WHY: Requires additional API calls per user to fetch their groups.
 *         Rate limits (600 req/min) make this impractical for large groups.
 *         USE canEvaluateClientSide() to detect these expressions.
 *
 * 2. app.* attributes - Application context
 *    WHY: App context is only available during authentication flows,
 *         not when evaluating group rules from the admin console.
 *
 * 3. Complex nested expressions or custom functions
 *    WHY: This is a simplified parser, not a full Okta EL implementation.
 *
 * ✅ SUPPORTED patterns:
 * - user.attribute == "value" or user.attribute eq "value"
 * - user.attribute != "value"
 * - Logical operators: AND, OR, parentheses
 * - Common profile attributes: department, title, userType, etc.
 */
export function evaluateRuleExpression(expression: string, user: OktaUser): boolean {
    if (!expression || !expression.trim()) return false;

    // normalize expression
    let expr = expression.trim();

    // Replace user.attribute with actual values
    // We need to handle string values carefully to avoid injection or borking the logic
    // Strategy: 
    // 1. Identify all user.xyz tokens
    // 2. Replace them with a placeholder or the actual value (quoted)

    // Implementation detail: Use a simplified approach for common patterns first

    try {
        // 1. Handle isMemberOfGroup / isMemberOfAnyGroup
        // These functions aren't standard JS, so we need to pre-process them
        // or mock them in a safe evaluation context.

        // For now, let's try a regex-based token replacement followed by a safe evaluation
        // functionality or a custom parser. Given complexity, a custom parser for specific supported syntax is safer.

        // Simplest approach: "Transpile" to JavaScript

        // Replace 'eq' with '==='
        expr = expr.replace(/\s+eq\s+/gi, ' === ');

        // Replace 'ne' with '!==' (if Okta supports it, otherwise !=)
        // Okta uses !=

        // Replace 'and' with '&&'
        expr = expr.replace(/\s+and\s+/gi, ' && ');

        // Replace 'or' with '||'
        expr = expr.replace(/\s+or\s+/gi, ' || ');

        // Replace user.attribute references
        // This matches user.firstName, user.profile.department, etc.
        // Okta usually uses user.department (mapped to profile)
        expr = expr.replace(/user\.([a-zA-Z0-9_]+)/g, (_match, attr) => {
            const val = user.profile[attr];
            if (val === undefined || val === null) return 'null';
            if (typeof val === 'string') return JSON.stringify(val);
            return String(val);
        });

        // Handle isMemberOfGroup specific function
        // format: isMemberOfGroup("groupId")
        expr = expr.replace(/isMemberOfGroup\s*\(([^)]+)\)/g, (_match, _args) => {
            // This functionality requires knowing user's groups, which we might not have in the user object alone.
            // If the rule depends on group membership, and we don't have it, we might return false or throw.
            // For basic profile-based rules, this won't be hit.
            // If we strictly only support profile attributes for now as per the plan:
            console.warn('isMemberOfGroup is not fully supported in client-side evaluation without group list context');
            return 'false';
        });

        // Create a function to evaluate
         
        const result = new Function(`return ${expr}`);
        return Boolean(result());

    } catch (err) {
        console.warn(`Failed to evaluate expression: "${expression}"`, err);
        return false;
    }
}

/**
 * Pre-validates if an expression can be safely evaluated client-side.
 *
 * Use this BEFORE calling evaluateRuleExpression() to avoid misleading results.
 * If this returns false, the UI should show "Cannot evaluate" rather than
 * showing incorrect match/no-match results.
 *
 * @returns true if the expression only uses supported patterns (user.* attributes)
 * @returns false if the expression uses unsupported patterns that would give wrong results
 */
export function canEvaluateClientSide(expression: string): boolean {
    if (!expression) return false;

    // Group membership checks require fetching user's groups - not available
    if (expression.includes('isMemberOf')) return false;

    // App context is only available during authentication, not admin operations
    if (expression.includes('app.')) return false;

    return true;
}
