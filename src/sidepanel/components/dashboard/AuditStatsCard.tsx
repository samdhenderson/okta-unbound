import React, { useState, useEffect } from 'react';
import { auditStore } from '../../../shared/storage/auditStore';
import type { AuditStats } from '../../../shared/types';

const AuditStatsCard: React.FC = () => {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const auditStats = await auditStore.getStats();
        setStats(auditStats);
      } catch (error) {
        console.error('[AuditStatsCard] Failed to load stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '20px',
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
          📊 Audit Trail Stats
        </h3>
        <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading...</div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '20px',
      }}
    >
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
        📊 Audit Trail Stats
      </h3>

      {/* Main stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {/* Total operations */}
        <div
          style={{
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
          }}
        >
          <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>
            Total Operations
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>
            {stats.totalOperations.toLocaleString()}
          </div>
        </div>

        {/* This week operations */}
        <div
          style={{
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
          }}
        >
          <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>This Week</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>
            {stats.lastWeekOperations.toLocaleString()}
          </div>
        </div>

        {/* Success rate */}
        <div
          style={{
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
          }}
        >
          <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>
            Success Rate
          </div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: stats.successRate >= 90 ? '#10b981' : stats.successRate >= 70 ? '#f59e0b' : '#ef4444',
            }}
          >
            {stats.successRate.toFixed(1)}%
          </div>
        </div>

        {/* Users affected */}
        <div
          style={{
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
          }}
        >
          <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>
            Users Affected
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>
            {stats.totalUsersAffected.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Operations breakdown */}
      {Object.keys(stats.operationsByType).length > 0 && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: '8px',
            }}
          >
            OPERATIONS BY TYPE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Object.entries(stats.operationsByType).map(([type, count]) => (
              <div
                key={type}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                }}
              >
                <span style={{ color: '#374151' }}>
                  {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
                <span style={{ fontWeight: 600, color: '#111827' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer info */}
      <div
        style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #e5e7eb',
          fontSize: '11px',
          color: '#6b7280',
          textAlign: 'center',
        }}
      >
        {stats.totalApiRequests > 0 &&
          `${stats.totalApiRequests.toLocaleString()} total API requests logged`}
      </div>
    </div>
  );
};

export default AuditStatsCard;
