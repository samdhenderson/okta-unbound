import React, { useState, useEffect } from 'react';
import type { SecurityScanCache } from '../../../shared/types';

interface SecurityWidgetProps {
  groupId: string;
  onViewSecurity: () => void;
}

const CACHE_KEY = 'security_scan_cache';

const SecurityWidget: React.FC<SecurityWidgetProps> = ({ groupId, onViewSecurity }) => {
  const [scanCache, setScanCache] = useState<SecurityScanCache | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCache = async () => {
      try {
        const result = await chrome.storage.local.get([CACHE_KEY]);
        const cache = result[CACHE_KEY] as SecurityScanCache | undefined;

        if (cache && cache.groupId === groupId) {
          setScanCache(cache);
        }
      } catch (error) {
        console.error('[SecurityWidget] Failed to load cache:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCache();
  }, [groupId]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#28a745';
    if (score >= 60) return '#ffc107';
    if (score >= 40) return '#fd7e14';
    return '#dc3545';
  };

  const getCriticalCount = () => {
    if (!scanCache?.posture) return 0;
    return scanCache.posture.findings.filter((f) => f.severity === 'critical').length;
  };

  const getHighCount = () => {
    if (!scanCache?.posture) return 0;
    return scanCache.posture.findings.filter((f) => f.severity === 'high').length;
  };

  if (isLoading) {
    return (
      <div className="dashboard-card">
        <h3 className="dashboard-card-title">Security Posture</h3>
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!scanCache) {
    return (
      <div className="dashboard-card">
        <h3 className="dashboard-card-title">Security Posture</h3>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ color: '#666', marginBottom: '16px' }}>No security scan has been run yet.</p>
          <button className="btn btn-primary btn-sm" onClick={onViewSecurity}>
            Run Security Scan
          </button>
        </div>
      </div>
    );
  }

  const score = scanCache.posture.overallScore;
  const criticalCount = getCriticalCount();
  const highCount = getHighCount();
  const totalOrphaned = scanCache.orphanedAccounts.length;

  return (
    <div className="dashboard-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="dashboard-card-title">Security Posture</h3>
        <div
          className="security-widget-score"
          style={{
            backgroundColor: getScoreColor(score),
            color: 'white',
          }}
        >
          {score}
        </div>
      </div>

      <div className="security-widget-body">
        {criticalCount > 0 && (
          <div className="security-widget-stat">
            <span style={{ color: '#dc3545', fontWeight: 600 }}>Critical Findings</span>
            <span style={{ color: '#dc3545', fontWeight: 700 }}>{criticalCount}</span>
          </div>
        )}
        {highCount > 0 && (
          <div className="security-widget-stat">
            <span style={{ color: '#fd7e14', fontWeight: 600 }}>High Priority Findings</span>
            <span style={{ color: '#fd7e14', fontWeight: 700 }}>{highCount}</span>
          </div>
        )}
        {totalOrphaned > 0 && (
          <div className="security-widget-stat">
            <span style={{ color: '#6c757d' }}>Orphaned Accounts</span>
            <span style={{ fontWeight: 600 }}>{totalOrphaned}</span>
          </div>
        )}
        {criticalCount === 0 && highCount === 0 && totalOrphaned === 0 && (
          <div style={{ padding: '12px 0', textAlign: 'center', color: '#28a745' }}>
            <strong>No security issues detected!</strong>
          </div>
        )}
      </div>

      <div className="security-widget-footer">
        <button className="btn btn-secondary btn-sm" onClick={onViewSecurity}>
          View Details
        </button>
      </div>

      <div style={{ marginTop: '12px', fontSize: '12px', color: '#999', textAlign: 'center' }}>
        Last scan: {new Date(scanCache.timestamp).toLocaleString()}
      </div>
    </div>
  );
};

export default SecurityWidget;
