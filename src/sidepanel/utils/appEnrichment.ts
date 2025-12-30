/**
 * App Enrichment Utilities
 * Functions to enrich OktaApp data with additional metadata for the browse view
 */

import type { OktaApp, AppSummary } from '../../shared/types';

/**
 * Classify app type from signOnMode
 */
export function classifyAppType(app: OktaApp): AppSummary['appType'] {
  const mode = app.signOnMode?.toUpperCase() || '';

  if (mode.includes('SAML_2')) return 'SAML_2_0';
  if (mode.includes('SAML_1')) return 'SAML_1_1';
  if (mode.includes('OPENID')) return 'OPENID_CONNECT';
  if (mode.includes('WS_FED')) return 'WS_FEDERATION';
  if (mode.includes('SECURE_PASSWORD')) return 'SWA';
  if (mode.includes('BROWSER_PLUGIN')) return 'BROWSER_PLUGIN';
  if (mode === 'BOOKMARK') return 'BOOKMARK';
  if (mode.includes('API')) return 'API_SERVICE';

  return 'OTHER';
}

/**
 * Determine provisioning status from app features and settings
 */
export function getProvisioningStatus(app: OktaApp): {
  status: AppSummary['provisioningStatus'];
  type?: AppSummary['provisioningType'];
} {
  const features = app.features || [];
  const settings = app.settings;

  // Check if SCIM provisioning is enabled
  if (features.includes('PROVISIONING') || features.includes('IMPORT_USER_SCHEMA')) {
    const provisioningEnabled = settings?.provisioning?.enabled ||
                                settings?.app?.provisioningEnabled ||
                                false;

    if (provisioningEnabled) {
      // Determine provisioning type
      if (settings?.provisioning?.type === 'SCIM') {
        return { status: 'ENABLED', type: 'SCIM' };
      } else if (features.includes('PROFILE_MASTERING')) {
        return { status: 'ENABLED', type: 'PROFILE_MASTERING' };
      } else if (features.includes('IMPORT_USER_SCHEMA')) {
        return { status: 'ENABLED', type: 'IMPORT' };
      }
      return { status: 'ENABLED' };
    }
  }

  // Check if provisioning is supported but disabled
  if (features.includes('PROVISIONING_CAPABLE') || features.includes('USER_PROVISIONING')) {
    return { status: 'DISABLED' };
  }

  return { status: 'NOT_SUPPORTED' };
}

/**
 * Check if push groups is enabled for the app
 */
export function getPushGroupsStatus(app: OktaApp): {
  enabled: boolean;
  count?: number;
  errors?: number;
} {
  const features = app.features || [];
  const settings = app.settings;

  const pushGroupsEnabled = features.includes('PUSH_NEW_USERS') ||
                            features.includes('PUSH_GROUPS') ||
                            settings?.app?.pushGroupsEnabled === true;

  return {
    enabled: pushGroupsEnabled,
    count: undefined, // Will be enriched later with actual API call if needed
    errors: undefined,
  };
}

/**
 * Get SAML certificate status for SAML apps
 */
export function getSAMLCertStatus(app: OktaApp): {
  status: AppSummary['certStatus'];
  expiresAt?: string;
  daysRemaining?: number;
} {
  const appType = classifyAppType(app);

  if (appType !== 'SAML_2_0' && appType !== 'SAML_1_1') {
    return { status: 'NOT_APPLICABLE' };
  }

  // Check for certificate in settings
  const cert = app.settings?.signOn?.sso?.certificate ||
               app.credentials?.signing?.cert;

  if (!cert) {
    return { status: 'NOT_APPLICABLE' };
  }

  // If certificate has expiration info
  const expiresAt = cert.expiresAt || cert.expires;

  if (!expiresAt) {
    return { status: 'ACTIVE' }; // Has cert but no expiration info
  }

  const expirationDate = new Date(expiresAt);
  const now = new Date();
  const daysRemaining = Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      status: 'EXPIRED',
      expiresAt,
      daysRemaining: 0,
    };
  }

  if (daysRemaining <= 30) {
    return {
      status: 'EXPIRING_SOON',
      expiresAt,
      daysRemaining,
    };
  }

  return {
    status: 'ACTIVE',
    expiresAt,
    daysRemaining,
  };
}

/**
 * Convert OktaApp to AppSummary with basic enrichment (no API calls)
 * Lightweight enrichment based only on app object data
 */
export function enrichAppBasic(app: OktaApp): AppSummary {
  const appType = classifyAppType(app);
  const provisioning = getProvisioningStatus(app);
  const pushGroups = getPushGroupsStatus(app);
  const cert = getSAMLCertStatus(app);

  return {
    ...app,
    // Assignment counts (default to 0, will be enriched later if needed)
    userAssignmentCount: 0,
    groupAssignmentCount: 0,
    totalAssignmentCount: 0,

    // App type
    appType,

    // Provisioning
    provisioningStatus: provisioning.status,
    provisioningType: provisioning.type,

    // Push groups
    pushGroupsEnabled: pushGroups.enabled,
    pushGroupsCount: pushGroups.count,
    pushGroupsErrors: pushGroups.errors,

    // SAML certificate
    certStatus: cert.status,
    certExpiresAt: cert.expiresAt,
    certDaysRemaining: cert.daysRemaining,

    // Additional metadata (will be enriched with API calls if needed)
    hasActiveUsers: false,
    hasInactiveUsers: false,
  };
}

/**
 * Get display label for app type
 */
export function getAppTypeLabel(appType: AppSummary['appType']): string {
  const labels: Record<AppSummary['appType'], string> = {
    SAML_2_0: 'SAML 2.0',
    SAML_1_1: 'SAML 1.1',
    OPENID_CONNECT: 'OIDC',
    WS_FEDERATION: 'WS-Fed',
    SWA: 'SWA',
    BROWSER_PLUGIN: 'Plugin',
    BOOKMARK: 'Bookmark',
    API_SERVICE: 'API',
    OTHER: 'Other',
  };

  return labels[appType] || appType;
}

/**
 * Get display label for provisioning status
 */
export function getProvisioningLabel(status: AppSummary['provisioningStatus'], type?: AppSummary['provisioningType']): string {
  if (status === 'NOT_SUPPORTED') return '—';
  if (status === 'DISABLED') return 'Off';

  if (type === 'SCIM') return 'SCIM';
  if (type === 'PROFILE_MASTERING') return 'Mastering';
  if (type === 'IMPORT') return 'Import';

  return 'On';
}

/**
 * Get display label for push groups
 */
export function getPushGroupsLabel(enabled: boolean, count?: number, errors?: number): string {
  if (!enabled) return 'Off';
  if (errors && errors > 0) return `Errors (${errors})`;
  if (count !== undefined) return `On (${count})`;
  return 'On';
}

/**
 * Get display label for cert status
 */
export function getCertStatusLabel(status?: AppSummary['certStatus'], daysRemaining?: number): string {
  if (!status || status === 'NOT_APPLICABLE') return '—';
  if (status === 'EXPIRED') return 'Expired';
  if (status === 'EXPIRING_SOON') {
    return daysRemaining !== undefined ? `${daysRemaining}d left` : 'Expiring';
  }
  return 'OK';
}
