import React from 'react';
import { initialsOf, hueFromId } from '../../../../shared/utils/userDisplay';
import { similarityColor } from './comparisonAnalytics';
import type { OktaUser } from '../../../../shared/types';

interface ComparisonHeroProps {
  contextUser: OktaUser;
  comparedUser: OktaUser;
  contextName: string;
  comparedName: string;
  similarity: number;
  isLoading: boolean;
}

/**
 * Split-screen hero: the two users' avatars with a central Jaccard Match %.
 * The hsl() avatar gradient is a documented dynamic-color raw-style exception.
 */
const ComparisonHero: React.FC<ComparisonHeroProps> = ({
  contextUser,
  comparedUser,
  contextName,
  comparedName,
  similarity,
  isLoading,
}) => (
  <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-br from-white via-white to-primary-light/40 shadow-sm">
    <div
      className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      aria-hidden
    />
    <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
      <UserSide user={contextUser} name={contextName} align="left" label="Context" />

      <div className="relative flex flex-col items-center justify-center px-2 py-3">
        <div
          className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-neutral-200"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col items-center gap-0.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-500">
            {isLoading ? '— —' : 'Match'}
          </span>
          <span
            className="font-mono text-base font-bold leading-none"
            style={{ color: similarityColor(similarity) }}
          >
            {isLoading ? '··' : `${similarity}%`}
          </span>
        </div>
      </div>

      <UserSide user={comparedUser} name={comparedName} align="right" label="Compared" />
    </div>
  </div>
);

const UserSide: React.FC<{
  user: OktaUser;
  name: string;
  align: 'left' | 'right';
  label: string;
}> = ({ user, name, align, label }) => {
  const hue = hueFromId(user.id);
  const initials = initialsOf(user);
  const isRight = align === 'right';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${isRight ? 'flex-row-reverse text-right' : 'text-left'}`}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white shadow-sm"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 40) % 360} 65% 38%))`,
          fontFamily: 'var(--font-heading)',
        }}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
          {label}
        </div>
        <div className="truncate text-sm font-semibold text-neutral-900" title={name}>
          {name}
        </div>
        <div
          className="truncate text-[11px] text-neutral-500"
          title={user.profile.email || user.profile.login}
        >
          {user.profile.email || user.profile.login}
        </div>
      </div>
    </div>
  );
};

export default ComparisonHero;
