/**
 * @module sidepanel/components/shared/PageHeader
 * @description Top-of-view header bar — title with optional subtitle, status badge, and trailing actions.
 */
import React from 'react';

interface PageHeaderProps {
  /** Page/section heading. */
  title: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /** Optional trailing action node(s), right-aligned (e.g. a {@link Button}). */
  actions?: React.ReactNode;
  /** Optional coloured badge next to the title. Defaults to `neutral`. */
  badge?: {
    text: string;
    /**
     * Badge colour. Note: this is PageHeader's own local badge palette and still
     * uses `error` as a key; it is distinct from the canonical {@link StatusType}
     * vocabulary (which uses `danger`, per ADR-0002).
     */
    variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  };
}

const badgeVariants = {
  primary: 'bg-primary-light text-primary-text border-primary-highlight',
  success: 'bg-success-light text-success-text border-success-light',
  warning: 'bg-warning-light text-warning-text border-warning-light',
  error: 'bg-danger-light text-danger-text border-danger-light',
  neutral: 'bg-neutral-50 text-neutral-600 border-neutral-200',
};

/**
 * Standardized header bar rendered at the top of a tab/view.
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title="Groups"
 *   subtitle="Manage Okta group membership"
 *   badge={{ text: 'Beta', variant: 'primary' }}
 *   actions={<Button icon="plus">New</Button>}
 * />
 * ```
 */
const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions, badge }) => {
  return (
    <div className="bg-white border-b border-neutral-200">
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1
              className="text-lg font-semibold text-neutral-900"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {title}
            </h1>
            {badge && (
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-medium border ${badgeVariants[badge.variant || 'neutral']}`}
              >
                {badge.text}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-0.5 text-sm text-neutral-600">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
};

export default PageHeader;
