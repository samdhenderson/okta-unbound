/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizeUserStatus,
  isValidUserStatus,
  normalizeUserStatusBatch,
  isUiLabel,
  getUserFriendlyStatus,
  getAllUserFriendlyLabels,
} from './statusNormalizer';
import type { UserStatus } from '../types';

describe('statusNormalizer', () => {
  // Suppress console warnings during tests
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('normalizeUserStatus', () => {
    describe('API canonical names (from /api/v1/groups/{id}/users)', () => {
      it('should handle all canonical status values', () => {
        expect(normalizeUserStatus('ACTIVE')).toBe('ACTIVE');
        expect(normalizeUserStatus('DEPROVISIONED')).toBe('DEPROVISIONED');
        expect(normalizeUserStatus('SUSPENDED')).toBe('SUSPENDED');
        expect(normalizeUserStatus('STAGED')).toBe('STAGED');
        expect(normalizeUserStatus('PROVISIONED')).toBe('PROVISIONED');
        expect(normalizeUserStatus('RECOVERY')).toBe('RECOVERY');
        expect(normalizeUserStatus('LOCKED_OUT')).toBe('LOCKED_OUT');
        expect(normalizeUserStatus('PASSWORD_EXPIRED')).toBe('PASSWORD_EXPIRED');
      });
    });

    describe('Admin Console UI labels (from /admin/users/search)', () => {
      it('should normalize "Deactivated" to DEPROVISIONED', () => {
        expect(normalizeUserStatus('Deactivated')).toBe('DEPROVISIONED');
        expect(normalizeUserStatus('DEACTIVATED')).toBe('DEPROVISIONED');
        expect(normalizeUserStatus('deactivated')).toBe('DEPROVISIONED');
      });

      it('should normalize "Pending User Action" to PROVISIONED', () => {
        expect(normalizeUserStatus('Pending User Action')).toBe('PROVISIONED');
        expect(normalizeUserStatus('PENDING_USER_ACTION')).toBe('PROVISIONED');
        expect(normalizeUserStatus('Pending_User_Action')).toBe('PROVISIONED');
        expect(normalizeUserStatus('pending user action')).toBe('PROVISIONED');
      });

      it('should normalize "Password Reset" to RECOVERY', () => {
        expect(normalizeUserStatus('Password Reset')).toBe('RECOVERY');
        expect(normalizeUserStatus('PASSWORD_RESET')).toBe('RECOVERY');
        expect(normalizeUserStatus('Password_Reset')).toBe('RECOVERY');
        expect(normalizeUserStatus('password reset')).toBe('RECOVERY');
      });

      it('should normalize "Locked Out" to LOCKED_OUT', () => {
        expect(normalizeUserStatus('Locked Out')).toBe('LOCKED_OUT');
        expect(normalizeUserStatus('LOCKED_OUT')).toBe('LOCKED_OUT');
        expect(normalizeUserStatus('LockedOut')).toBe('LOCKED_OUT');
        expect(normalizeUserStatus('locked out')).toBe('LOCKED_OUT');
      });

      it('should normalize "Password Expired" to PASSWORD_EXPIRED', () => {
        expect(normalizeUserStatus('Password Expired')).toBe('PASSWORD_EXPIRED');
        expect(normalizeUserStatus('PASSWORD_EXPIRED')).toBe('PASSWORD_EXPIRED');
        expect(normalizeUserStatus('PasswordExpired')).toBe('PASSWORD_EXPIRED');
        expect(normalizeUserStatus('password expired')).toBe('PASSWORD_EXPIRED');
      });

      it('should handle simple title case UI labels', () => {
        expect(normalizeUserStatus('Active')).toBe('ACTIVE');
        expect(normalizeUserStatus('Suspended')).toBe('SUSPENDED');
        expect(normalizeUserStatus('Staged')).toBe('STAGED');
        expect(normalizeUserStatus('Provisioned')).toBe('PROVISIONED');
        expect(normalizeUserStatus('Recovery')).toBe('RECOVERY');
      });
    });

    describe('HTML content extraction', () => {
      it('should extract status from HTML span tags', () => {
        expect(normalizeUserStatus('<span class="badge">Active</span>')).toBe('ACTIVE');
        expect(normalizeUserStatus('<span class="badge badge-success">Active</span>')).toBe('ACTIVE');
        expect(normalizeUserStatus('<span>Deactivated</span>')).toBe('DEPROVISIONED');
      });

      it('should extract status from complex HTML', () => {
        expect(normalizeUserStatus('<div class="status"><span>Suspended</span></div>')).toBe('SUSPENDED');
        expect(normalizeUserStatus('<strong>Locked Out</strong>')).toBe('LOCKED_OUT');
        expect(normalizeUserStatus('<em>Password Reset</em>')).toBe('RECOVERY');
      });

      it('should handle HTML with multiple tags', () => {
        expect(normalizeUserStatus('<div><span class="badge">Active</span></div>')).toBe('ACTIVE');
      });
    });

    describe('Object formats', () => {
      it('should extract from object with "text" property', () => {
        expect(normalizeUserStatus({ text: 'Active' })).toBe('ACTIVE');
        expect(normalizeUserStatus({ text: 'Deactivated' })).toBe('DEPROVISIONED');
      });

      it('should extract from object with "label" property', () => {
        expect(normalizeUserStatus({ label: 'Suspended' })).toBe('SUSPENDED');
        expect(normalizeUserStatus({ label: 'Locked Out' })).toBe('LOCKED_OUT');
      });

      it('should extract from object with "status" property', () => {
        expect(normalizeUserStatus({ status: 'ACTIVE' })).toBe('ACTIVE');
        expect(normalizeUserStatus({ status: 'DEPROVISIONED' })).toBe('DEPROVISIONED');
      });

      it('should extract from object with "statusLabel" property', () => {
        expect(normalizeUserStatus({ statusLabel: 'Password Reset' })).toBe('RECOVERY');
      });

      it('should extract from object with "value" property', () => {
        expect(normalizeUserStatus({ value: 'Staged' })).toBe('STAGED');
      });

      it('should try multiple properties in order', () => {
        expect(normalizeUserStatus({ text: 'Active', label: 'Suspended' })).toBe('ACTIVE');
        expect(normalizeUserStatus({ label: 'Suspended', status: 'STAGED' })).toBe('SUSPENDED');
      });

      it('should handle nested extraction (object -> HTML -> status)', () => {
        expect(normalizeUserStatus({ text: '<span>Active</span>' })).toBe('ACTIVE');
      });

      it('should return default for object without recognizable properties', () => {
        expect(normalizeUserStatus({ foo: 'bar' })).toBe('ACTIVE');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('object without recognizable property'),
          expect.anything()
        );
      });
    });

    describe('Edge cases and error handling', () => {
      it('should return ACTIVE for null', () => {
        expect(normalizeUserStatus(null)).toBe('ACTIVE');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('null/undefined')
        );
      });

      it('should return ACTIVE for undefined', () => {
        expect(normalizeUserStatus(undefined)).toBe('ACTIVE');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('null/undefined')
        );
      });

      it('should return ACTIVE for empty string', () => {
        expect(normalizeUserStatus('')).toBe('ACTIVE');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('empty string')
        );
      });

      it('should return ACTIVE for whitespace-only string', () => {
        expect(normalizeUserStatus('   ')).toBe('ACTIVE');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('empty string')
        );
      });

      it('should return ACTIVE for non-string primitives', () => {
        expect(normalizeUserStatus(123)).toBe('ACTIVE');
        expect(normalizeUserStatus(true)).toBe('ACTIVE');
        expect(normalizeUserStatus(false)).toBe('ACTIVE');
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('should return ACTIVE for unknown status values', () => {
        expect(normalizeUserStatus('INVALID_STATUS')).toBe('ACTIVE');
        expect(normalizeUserStatus('UnknownValue')).toBe('ACTIVE');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unknown status after normalization')
        );
      });

      it('should handle extra whitespace', () => {
        expect(normalizeUserStatus('  Active  ')).toBe('ACTIVE');
        expect(normalizeUserStatus('  Locked  Out  ')).toBe('LOCKED_OUT');
      });
    });

    describe('Context parameter for debugging', () => {
      it('should include context in warning messages', () => {
        normalizeUserStatus(null, 'user:00u123');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('for user:00u123')
        );
      });

      it('should include context for unknown statuses', () => {
        normalizeUserStatus('InvalidStatus', 'api:/admin/users');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('for api:/admin/users')
        );
      });

      it('should work without context', () => {
        normalizeUserStatus(null);
        expect(consoleWarnSpy).toHaveBeenCalled();
      });
    });

    describe('Case sensitivity', () => {
      it('should be case insensitive', () => {
        expect(normalizeUserStatus('active')).toBe('ACTIVE');
        expect(normalizeUserStatus('ACTIVE')).toBe('ACTIVE');
        expect(normalizeUserStatus('Active')).toBe('ACTIVE');
        expect(normalizeUserStatus('AcTiVe')).toBe('ACTIVE');
      });

      it('should handle mixed case multi-word statuses', () => {
        expect(normalizeUserStatus('locked out')).toBe('LOCKED_OUT');
        expect(normalizeUserStatus('Locked Out')).toBe('LOCKED_OUT');
        expect(normalizeUserStatus('LOCKED OUT')).toBe('LOCKED_OUT');
        expect(normalizeUserStatus('LoCkEd OuT')).toBe('LOCKED_OUT');
      });
    });

    describe('Separator variations', () => {
      it('should handle spaces, underscores, and no separators', () => {
        expect(normalizeUserStatus('LOCKED_OUT')).toBe('LOCKED_OUT');
        expect(normalizeUserStatus('LOCKED OUT')).toBe('LOCKED_OUT');
        expect(normalizeUserStatus('LOCKEDOUT')).toBe('LOCKED_OUT');

        expect(normalizeUserStatus('PASSWORD_EXPIRED')).toBe('PASSWORD_EXPIRED');
        expect(normalizeUserStatus('PASSWORD EXPIRED')).toBe('PASSWORD_EXPIRED');
        expect(normalizeUserStatus('PASSWORDEXPIRED')).toBe('PASSWORD_EXPIRED');
      });
    });
  });

  describe('isValidUserStatus', () => {
    it('should return true for all canonical status values', () => {
      const validStatuses: UserStatus[] = [
        'ACTIVE',
        'DEPROVISIONED',
        'SUSPENDED',
        'STAGED',
        'PROVISIONED',
        'RECOVERY',
        'LOCKED_OUT',
        'PASSWORD_EXPIRED',
      ];

      validStatuses.forEach(status => {
        expect(isValidUserStatus(status)).toBe(true);
      });
    });

    it('should return false for UI labels', () => {
      expect(isValidUserStatus('Deactivated')).toBe(false);
      expect(isValidUserStatus('Pending User Action')).toBe(false);
      expect(isValidUserStatus('Password Reset')).toBe(false);
      expect(isValidUserStatus('Locked Out')).toBe(false);
    });

    it('should return false for lowercase canonical values', () => {
      expect(isValidUserStatus('active')).toBe(false);
      expect(isValidUserStatus('deprovisioned')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isValidUserStatus(null)).toBe(false);
      expect(isValidUserStatus(undefined)).toBe(false);
      expect(isValidUserStatus(123)).toBe(false);
      expect(isValidUserStatus({})).toBe(false);
    });

    it('should be type guard compatible', () => {
      const value: unknown = 'ACTIVE';
      if (isValidUserStatus(value)) {
        // TypeScript should know this is UserStatus
        const status: UserStatus = value;
        expect(status).toBe('ACTIVE');
      }
    });
  });

  describe('normalizeUserStatusBatch', () => {
    it('should normalize an array of statuses', () => {
      const input = ['Active', 'Deactivated', 'Suspended', 'STAGED'];
      const expected: UserStatus[] = ['ACTIVE', 'DEPROVISIONED', 'SUSPENDED', 'STAGED'];
      expect(normalizeUserStatusBatch(input)).toEqual(expected);
    });

    it('should handle mixed types in array', () => {
      const input = ['Active', null, { text: 'Suspended' }, 'STAGED'];
      const expected: UserStatus[] = ['ACTIVE', 'ACTIVE', 'SUSPENDED', 'STAGED'];
      expect(normalizeUserStatusBatch(input)).toEqual(expected);
    });

    it('should handle empty array', () => {
      expect(normalizeUserStatusBatch([])).toEqual([]);
    });

    it('should include index in context when no prefix provided', () => {
      normalizeUserStatusBatch([null, 'Active']);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('for index:0')
      );
    });

    it('should use contextPrefix when provided', () => {
      normalizeUserStatusBatch([null], 'group:00g123');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('for group:00g123[0]')
      );
    });

    it('should handle HTML in batch', () => {
      const input = [
        '<span>Active</span>',
        '<div>Deactivated</div>',
        'Suspended',
      ];
      const expected: UserStatus[] = ['ACTIVE', 'DEPROVISIONED', 'SUSPENDED'];
      expect(normalizeUserStatusBatch(input)).toEqual(expected);
    });
  });

  describe('isUiLabel', () => {
    it('should return true for UI labels', () => {
      expect(isUiLabel('Deactivated')).toBe(true);
      expect(isUiLabel('Pending User Action')).toBe(true);
      expect(isUiLabel('Password Reset')).toBe(true);
      expect(isUiLabel('Locked Out')).toBe(true);
      expect(isUiLabel('Password Expired')).toBe(true);
    });

    it('should return false for canonical status values', () => {
      expect(isUiLabel('ACTIVE')).toBe(false);
      expect(isUiLabel('DEPROVISIONED')).toBe(false);
      expect(isUiLabel('SUSPENDED')).toBe(false);
      expect(isUiLabel('STAGED')).toBe(false);
      expect(isUiLabel('PROVISIONED')).toBe(false);
      expect(isUiLabel('RECOVERY')).toBe(false);
      expect(isUiLabel('LOCKED_OUT')).toBe(false);
      expect(isUiLabel('PASSWORD_EXPIRED')).toBe(false);
    });

    it('should return false for unknown values', () => {
      expect(isUiLabel('InvalidStatus')).toBe(false);
      expect(isUiLabel('UnknownValue')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isUiLabel('deactivated')).toBe(true);
      expect(isUiLabel('DEACTIVATED')).toBe(true);
      expect(isUiLabel('Deactivated')).toBe(true);
    });

    it('should handle different separator styles', () => {
      expect(isUiLabel('Locked Out')).toBe(true);
      expect(isUiLabel('Locked_Out')).toBe(true);
      expect(isUiLabel('LockedOut')).toBe(true);
      // But LOCKED_OUT is canonical
      expect(isUiLabel('LOCKED_OUT')).toBe(false);
    });
  });

  describe('getUserFriendlyStatus', () => {
    it('should convert all canonical statuses to user-friendly labels', () => {
      expect(getUserFriendlyStatus('ACTIVE')).toBe('Active');
      expect(getUserFriendlyStatus('DEPROVISIONED')).toBe('Deactivated');
      expect(getUserFriendlyStatus('SUSPENDED')).toBe('Suspended');
      expect(getUserFriendlyStatus('STAGED')).toBe('Staged');
      expect(getUserFriendlyStatus('PROVISIONED')).toBe('Pending User Action');
      expect(getUserFriendlyStatus('RECOVERY')).toBe('Password Reset');
      expect(getUserFriendlyStatus('LOCKED_OUT')).toBe('Locked Out');
      expect(getUserFriendlyStatus('PASSWORD_EXPIRED')).toBe('Password Expired');
    });

    it('should match Okta Admin Console UI labels', () => {
      // These labels should match what users see in the Okta Admin Console
      expect(getUserFriendlyStatus('DEPROVISIONED')).toBe('Deactivated'); // NOT "Deprovisioned"
      expect(getUserFriendlyStatus('PROVISIONED')).toBe('Pending User Action'); // NOT "Provisioned"
      expect(getUserFriendlyStatus('RECOVERY')).toBe('Password Reset'); // NOT "Recovery"
    });

    it('should support round-trip conversion', () => {
      const testCases: Array<[string, UserStatus, string]> = [
        ['Deactivated', 'DEPROVISIONED', 'Deactivated'],
        ['Pending User Action', 'PROVISIONED', 'Pending User Action'],
        ['Password Reset', 'RECOVERY', 'Password Reset'],
        ['Locked Out', 'LOCKED_OUT', 'Locked Out'],
      ];

      testCases.forEach(([uiLabel, canonical, expectedLabel]) => {
        const normalized = normalizeUserStatus(uiLabel);
        expect(normalized).toBe(canonical);
        const friendly = getUserFriendlyStatus(normalized);
        expect(friendly).toBe(expectedLabel);
      });
    });
  });

  describe('getAllUserFriendlyLabels', () => {
    it('should return all status labels', () => {
      const labels = getAllUserFriendlyLabels();
      expect(Object.keys(labels)).toHaveLength(8);
      expect(labels.ACTIVE).toBe('Active');
      expect(labels.DEPROVISIONED).toBe('Deactivated');
      expect(labels.SUSPENDED).toBe('Suspended');
      expect(labels.STAGED).toBe('Staged');
      expect(labels.PROVISIONED).toBe('Pending User Action');
      expect(labels.RECOVERY).toBe('Password Reset');
      expect(labels.LOCKED_OUT).toBe('Locked Out');
      expect(labels.PASSWORD_EXPIRED).toBe('Password Expired');
    });

    it('should return a new object (not a reference)', () => {
      const labels1 = getAllUserFriendlyLabels();
      const labels2 = getAllUserFriendlyLabels();
      expect(labels1).not.toBe(labels2); // Different object references
      expect(labels1).toEqual(labels2); // Same content
    });
  });

  describe('Real-world scenarios', () => {
    describe('Admin Console API response simulation', () => {
      it('should handle typical internal API response', () => {
        // Simulate response from /admin/users/search
        const apiResponse = [
          ['00u123', 'Active', 'John Doe', 'john@example.com'],
          ['00u456', 'Deactivated', 'Jane Smith', 'jane@example.com'],
          ['00u789', 'Suspended', 'Bob Johnson', 'bob@example.com'],
          ['00u101', 'Locked Out', 'Alice Brown', 'alice@example.com'],
          ['00u112', 'Password Reset', 'Charlie Wilson', 'charlie@example.com'],
        ];

        const statuses = apiResponse.map(user => normalizeUserStatus(user[1], `user:${user[0]}`));

        expect(statuses).toEqual([
          'ACTIVE',
          'DEPROVISIONED',
          'SUSPENDED',
          'LOCKED_OUT',
          'RECOVERY',
        ]);
      });
    });

    describe('Public API response simulation', () => {
      it('should handle typical public API response', () => {
        // Simulate response from /api/v1/groups/{id}/users
        const apiResponse = [
          { id: '00u123', status: 'ACTIVE', profile: {} },
          { id: '00u456', status: 'DEPROVISIONED', profile: {} },
          { id: '00u789', status: 'SUSPENDED', profile: {} },
          { id: '00u101', status: 'LOCKED_OUT', profile: {} },
          { id: '00u112', status: 'RECOVERY', profile: {} },
        ];

        const statuses = apiResponse.map(user => normalizeUserStatus(user.status, `user:${user.id}`));

        expect(statuses).toEqual([
          'ACTIVE',
          'DEPROVISIONED',
          'SUSPENDED',
          'LOCKED_OUT',
          'RECOVERY',
        ]);
      });
    });

    describe('Mixed sources', () => {
      it('should normalize statuses from both APIs to same values', () => {
        // From internal API
        const internalApiStatus = normalizeUserStatus('Deactivated');

        // From public API
        const publicApiStatus = normalizeUserStatus('DEPROVISIONED');

        // Should normalize to the same value
        expect(internalApiStatus).toBe(publicApiStatus);
        expect(internalApiStatus).toBe('DEPROVISIONED');
      });

      it('should handle all status pairs consistently', () => {
        const pairs: Array<[string, string, UserStatus]> = [
          ['Active', 'ACTIVE', 'ACTIVE'],
          ['Deactivated', 'DEPROVISIONED', 'DEPROVISIONED'],
          ['Suspended', 'SUSPENDED', 'SUSPENDED'],
          ['Staged', 'STAGED', 'STAGED'],
          ['Pending User Action', 'PROVISIONED', 'PROVISIONED'],
          ['Password Reset', 'RECOVERY', 'RECOVERY'],
          ['Locked Out', 'LOCKED_OUT', 'LOCKED_OUT'],
          ['Password Expired', 'PASSWORD_EXPIRED', 'PASSWORD_EXPIRED'],
        ];

        pairs.forEach(([uiLabel, apiName, expected]) => {
          expect(normalizeUserStatus(uiLabel)).toBe(expected);
          expect(normalizeUserStatus(apiName)).toBe(expected);
        });
      });
    });
  });
});
