/**
 * @module sidepanel/components/users/UserAppRow
 * @description One app on the Users tab's Apps pane: which app, how Okta says it was granted, and — once known — which group grants it.
 *
 * ## Two facts, one row
 *
 * Okta reports a single assignment scope per app-user and prefers `USER` when a
 * user is both directly assigned *and* in an assigned group. So the `Direct`
 * badge and a `Through {group}` line are **not** in tension: the badge says what
 * Okta reported, the line says which group Okta credited in the same response,
 * and a row that has both shows both. That combination is the thing the
 * comparison view could never express (ADR-0020), and it is why this row keeps
 * the badge and the source line as separate statements rather than folding them
 * into one verdict.
 *
 * ## An absent source is spelled out
 *
 * When no group is known the second line is not blank — it is the caveat
 * `AppScopeIndicator` owns for that state, rendered *italic* so a stated absence
 * never reads with the weight of a stated fact. The row therefore never leaves a
 * reader to infer a source from an empty line.
 *
 * The row derives everything from an {@link AppSourceRow} and owns no I/O, so
 * scrolling a long list cannot start work (`docs/components.md` §"List rows
 * derive; they never fetch").
 */
import React, { useId, useState } from 'react';
import { Badge, EntityLink, Eyebrow, IconButton, ListRow, OpenInOktaLink } from '../shared';
import Icon from '../shared/Icon';
import type { AppSourceRow } from './appSourceSummary';

/** Props for {@link UserAppRow}. */
export interface UserAppRowProps {
  /** The row's whole rendered model, derived by `appSourceSummary`. */
  row: AppSourceRow;
  /** Okta origin for the admin-console deep link; the link hides when absent. */
  oktaOrigin?: string | null;
}

/**
 * One app assignment, with its source disclosure.
 *
 * @param props - See {@link UserAppRowProps}.
 */
const UserAppRow: React.FC<UserAppRowProps> = ({ row, oktaOrigin }) => {
  const [open, setOpen] = useState(false);
  const detailId = useId();

  const disclosure = (
    // `.disclose` animates grid-template-rows with no JS measurement and holds
    // the panel `inert` while collapsed, so nothing inside is tabbable or
    // announced until it is opened.
    <div id={detailId} className="disclose" data-open={open} inert={!open || undefined}>
      <div>
        <div className="space-y-3 border-t border-neutral-200 px-3 py-3">
          {/* The caveat in full. The row above shows the same sentence truncated
              to one line; this is where it is actually readable. */}
          <p className="text-pretty text-xs text-neutral-600">{row.caveat}</p>

          {row.grantGroupName && (
            <div className="rounded-md border border-neutral-200 bg-canvas p-3">
              <Eyebrow as="div" className="mb-2">
                Granted through
              </Eyebrow>
              <EntityLink type="group" id={row.grantGroupId} name={row.grantGroupName} />
              {row.grantGroupSourceLine && (
                // How that group was itself granted, in the same vocabulary the
                // Groups pane uses — so one group never reads two ways.
                <p className="mt-2 text-xs text-neutral-600">{row.grantGroupSourceLine}</p>
              )}
            </div>
          )}

          <OpenInOktaLink oktaOrigin={oktaOrigin} entityType="app" entityId={row.id} />
        </div>
      </div>
    </div>
  );

  return (
    <ListRow as="li" density="compact" body={disclosure}>
      <div className="flex items-start gap-2">
        <Icon type="app" size="sm" className="mt-0.5 shrink-0 text-neutral-400" />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-neutral-900">{row.label}</span>
            {row.isPrivileged && (
              <Badge
                variant="warning"
                title="This app grants administrative or infrastructure access."
              >
                Privileged
              </Badge>
            )}
          </div>
          {/* `title` carries the whole sentence, because the non-answer states
              are longer than one line at the 360px floor. */}
          <p
            className={`truncate text-xs text-neutral-600 ${row.sourceKnown ? '' : 'italic'}`}
            title={row.sourceLine}
          >
            {row.sourceLine}
          </p>
        </div>

        {/* The caveat rides on `title` here exactly as it does on
            `AppScopeIndicator`, so `Direct` can never be read as "direct only". */}
        <Badge variant={row.badgeVariant} title={row.caveat} className="shrink-0">
          {row.badgeLabel}
        </Badge>

        <IconButton
          label={open ? `Hide how ${row.label} is granted` : `Show how ${row.label} is granted`}
          variant="ghost"
          size="sm"
          expanded={open}
          controls={detailId}
          className="shrink-0"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon
            type="chevron-right"
            size="sm"
            className={`transition-transform duration-(--dur-quick) ${open ? 'rotate-90' : ''}`}
          />
        </IconButton>
      </div>
    </ListRow>
  );
};

export default UserAppRow;
