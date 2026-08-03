/**
 * @module sidepanel/components/shared/PageHeader
 * @description Top-of-view header bar — title with optional subtitle, status badge, leading back
 * affordance, breadcrumb trail, and trailing actions.
 *
 * All leading-slot props (`onBack`, `leading`, `breadcrumbs`) are additive and
 * optional: a header rendered without them is byte-identical to the pre-existing
 * layout. They exist so a tab using
 * {@link sidepanel/hooks/useViewStack.useViewStack} can keep **one** header mounted
 * and swap its contents in place as views are pushed and popped, rather than each
 * view rendering its own header (ADR-0008's stable-region precedent).
 */
import React from 'react';
import Icon from '../overview/shared/Icon';
import IconButton from './IconButton';

interface PageHeaderProps {
  /** Page/section heading. */
  title: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /** Optional trailing action node(s), right-aligned (e.g. a {@link Button}). */
  actions?: React.ReactNode;
  /**
   * Optional back handler. When set, a leading chevron-left {@link IconButton} is
   * rendered before the title. Pass `undefined` at the root of a view stack to
   * hide it. Ignored when {@link PageHeaderProps.leading} is supplied.
   */
  onBack?: () => void;
  /** Accessible name / tooltip for the back button. Defaults to `Back`. */
  backLabel?: string;
  /**
   * Custom node for the leading slot, replacing the default back button (e.g. an
   * avatar or a status glyph). Takes precedence over
   * {@link PageHeaderProps.onBack}.
   */
  leading?: React.ReactNode;
  /**
   * Optional breadcrumb trail rendered above the title — typically a
   * {@link Breadcrumbs} fed from a view stack's `trail`.
   */
  breadcrumbs?: React.ReactNode;
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
 *
 * @example Drilled-in view of a {@link sidepanel/hooks/useViewStack.useViewStack} stack
 * ```tsx
 * <PageHeader
 *   title={nav.currentEntry?.name ?? 'Groups'}
 *   onBack={nav.isRoot ? undefined : nav.pop}
 *   breadcrumbs={nav.isRoot ? undefined : <Breadcrumbs items={nav.trail} />}
 * />
 * ```
 */
const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  badge,
  onBack,
  backLabel = 'Back',
  leading,
  breadcrumbs,
}) => {
  const leadingNode =
    leading ??
    (onBack ? (
      <IconButton label={backLabel} variant="subtle" onClick={onBack}>
        <Icon type="chevron-left" size="md" />
      </IconButton>
    ) : null);

  return (
    <div className="bg-white border-b border-neutral-200">
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {leadingNode && <div className="shrink-0">{leadingNode}</div>}
          <div className="flex-1 min-w-0">
            {breadcrumbs && <div className="mb-1">{breadcrumbs}</div>}
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
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
};

export default PageHeader;
