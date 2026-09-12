/**
 * Behavior test for {@link GroupReferenceChip}: the satisfied/unsatisfied glyph
 * is complete-or-absent, gated on `hasContext` rather than on `satisfied` alone.
 * Everything else about this component (label composition per match kind) is a
 * pure render and is covered by its stories, not duplicated here.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GroupReferenceChip from './GroupReferenceChip';
import type { ClauseGroupReference } from '../../../shared/rules/explainExpression';

const satisfied: ClauseGroupReference = {
  match: 'id',
  value: '00gFAKECHIPTEST1',
  satisfied: true,
  matchedGroupName: 'Engineering',
};

const unsatisfied: ClauseGroupReference = {
  match: 'id',
  value: '00gFAKECHIPTEST9',
  satisfied: false,
};

describe('GroupReferenceChip', () => {
  // Both fixtures are `match: 'id'`, so every render also carries a
  // `CopyIconButton` (its own decorative clipboard glyph) regardless of
  // `hasContext` — that control names the raw id, not the membership check.
  // The count below is that baseline plus one more only when `hasContext`
  // supplies the satisfied/unsatisfied glyph.
  const COPY_ICON_ONLY = 1;

  it('renders no satisfied/unsatisfied glyph at all when no context was supplied', () => {
    const { container } = render(<GroupReferenceChip reference={satisfied} hasContext={false} />);

    // The glyph is decorative (aria-hidden) either way, so presence/absence is
    // asserted structurally rather than by an accessible name.
    expect(container.querySelectorAll('svg')).toHaveLength(COPY_ICON_ONLY);
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('renders the satisfied glyph when context was supplied and the reference is satisfied', () => {
    const { container } = render(<GroupReferenceChip reference={satisfied} hasContext />);
    expect(container.querySelectorAll('svg')).toHaveLength(COPY_ICON_ONLY + 1);
  });

  it('renders the unsatisfied glyph when context was supplied and the reference is not satisfied', () => {
    const { container } = render(<GroupReferenceChip reference={unsatisfied} hasContext />);
    expect(container.querySelectorAll('svg')).toHaveLength(COPY_ICON_ONLY + 1);
    expect(screen.getByText('00gFAKECHIPTEST9')).toBeInTheDocument();
  });
});
