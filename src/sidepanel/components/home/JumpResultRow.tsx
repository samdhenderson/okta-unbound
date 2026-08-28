/**
 * @module sidepanel/components/home/JumpResultRow
 * @description One row in the Home tab's jump-bar results.
 *
 * The design's rule for this row is a single sentence: **it names the
 * destination on its right edge, so pressing it is never a surprise.** The
 * results list mixes kinds — a group, the rules that feed it, the user you
 * searched for — and a row that does not say where it goes is asking the reader
 * to guess which tab they are about to be thrown into.
 *
 * ## An unreachable kind is a link, not a disabled row
 *
 * Not every entity kind has a destination in every build:
 * `NavigationContext.canNavigateTo('app')` is `false` today, because no app
 * deep-link handler is registered. A row for one of those kinds does **not**
 * render greyed out — a control that exists only to refuse is worse than no
 * control (ADR-0039's "no verb without a wire", applied to a row). It renders as
 * an `OpenInOktaLink` instead, which is a real, working route to the same
 * entity. When the handler lands, the row upgrades itself with no change here.
 */
import React from 'react';
import ListRow from '../shared/ListRow';
import OpenInOktaLink from '../shared/OpenInOktaLink';
import Icon from '../shared/Icon';
import { destinationLabel, KIND_ICON } from './jumpDestinations';
import type { JumpResult } from '../../hooks/useJumpResolver';
import type { OktaAdminEntityType } from '../../../shared/utils/oktaUrl';

/** Props for {@link JumpResultRow}. */
export interface JumpResultRowProps {
  /** The resolved entity to render. */
  result: JumpResult;
  /**
   * Open this entity on its owning tab. Omitted when the build cannot reach the
   * result's kind, which switches the row to its "Open in Okta" form.
   */
  onSelect?: (result: JumpResult) => void;
  /**
   * Org origin, for the Okta deep link used when `onSelect` is absent. Without
   * it an unreachable row has no route at all and renders its kind as plain
   * text rather than a broken control.
   */
  oktaOrigin?: string | null;
}

/**
 * Okta admin-console link targets, for the kinds `oktaUrl` can address.
 *
 * `rule` is absent because the admin console has no single-rule route — a rule
 * is only viewable inside its group — so an unreachable rule row shows no link
 * rather than a fabricated one.
 */
const OKTA_LINK_TYPE: Partial<Record<JumpResult['kind'], OktaAdminEntityType>> = {
  group: 'group',
  user: 'user',
  app: 'app',
};

/**
 * Render one jump result.
 *
 * @param props - See {@link JumpResultRowProps}.
 *
 * @example
 * ```tsx
 * <JumpResultRow result={{ kind: 'group', id: '00gFAKE…', name: 'Engineering' }}
 *                onSelect={open} />
 * ```
 */
const JumpResultRow: React.FC<JumpResultRowProps> = ({ result, onSelect, oktaOrigin }) => {
  const linkType = OKTA_LINK_TYPE[result.kind];

  const mark = onSelect ? (
    <span className="text-xs font-medium text-neutral-600 shrink-0">
      {destinationLabel(result.kind)} ›
    </span>
  ) : linkType ? (
    <OpenInOktaLink oktaOrigin={oktaOrigin} entityType={linkType} entityId={result.id} size="sm" />
  ) : null;

  return (
    <ListRow
      as={onSelect ? 'button' : 'div'}
      density="comfortable"
      onClick={onSelect ? () => onSelect(result) : undefined}
      ariaLabel={onSelect ? `${result.name} — open in ${destinationLabel(result.kind)}` : undefined}
    >
      <div className="flex items-center gap-3 min-w-0 w-full">
        <Icon type={KIND_ICON[result.kind]} size="sm" className="text-neutral-500 shrink-0" />
        <div className="min-w-0 flex-1 text-left">
          <div className="text-sm font-medium text-neutral-900 truncate">{result.name}</div>
          {result.secondary && (
            <div className="text-xs text-neutral-600 truncate">{result.secondary}</div>
          )}
        </div>
        {mark}
      </div>
    </ListRow>
  );
};

export default JumpResultRow;
