/**
 * @module reel/ad/ui
 * @description The extension's own surface, rebuilt at ad scale.
 *
 * The film never needs this. It has footage: a real panel, filmed doing a real
 * thing, with everything else composed around it (ADR-0045). The advertisement
 * cannot use that footage, because a store page ad has to hold an idea for a
 * second and a half and real footage spends that long on a scroll.
 *
 * So the ad rebuilds the panel. Every measurement here was read off frames
 * pulled out of `captures/*.mp4` with ffmpeg rather than guessed from the
 * source: the capture is 840x980, which is the side panel at 2x, so the numbers
 * below are that pixel space directly and the type sizes are what the panel
 * actually renders at. Colours come from {@link COLOR}, the generated mirror of
 * the app's own tokens, so a brand shade cannot drift here without drifting in
 * the product first.
 *
 * ## The line this must not cross
 *
 * ADR-0045's fourth rule: **a synthetic object must never be mistakable for a
 * screenshot.** The film satisfies that by keeping synthetic surfaces on a dark
 * stage at 2x to 6x, obviously drawn. An ad that rebuilt the panel at 1:1 and
 * cut it against nothing would violate it flatly.
 *
 * What keeps this side of the line: the panel is never presented as a recording.
 * It sits on the film's own dark stage, tilted, scaled past life size, lit from
 * one side, with verbs acting on its parts in ways no browser does - rows
 * arriving one at a time, a value wiping in place, a ring leaving a button. The
 * viewer is looking at a diagram of the product, and it reads as one at every
 * moment. The claim it makes is about **what the product looks like and does**,
 * which is a claim the real panel keeps.
 *
 * ## The data is the demo org's, and it is fake
 *
 * Names, ids and counts here are the same fixture the walks film: `Amara
 * Okonkwo`, `00uFAKE...`, the `Engineering - All` group and its one mistyped
 * department value. No number in this ad is a measured claim about anybody's
 * tenant, and none is presented as one. The repo's placeholder convention
 * (`docs/security.md`) is the rule being followed: no real org, no real id, ever.
 */
import React from 'react';
import { COLOR } from '../theme';

/**
 * The panel's own pixel space: the capture's 840x980, which is the side panel
 * at 2x. Stated once so every stab scales the same object rather than each
 * inventing its own idea of how big the product is.
 */
export const PANEL = { width: 840, height: 980 } as const;

/** The product's surfaces, named for what they are rather than for their hex. */
export const UI = {
  chrome: '#ffffff',
  canvas: COLOR.canvas,
  card: '#ffffff',
  line: COLOR['neutral-200'],
  strongLine: COLOR['neutral-300'],
  title: COLOR['neutral-900'],
  body: COLOR['neutral-700'],
  muted: COLOR['neutral-600'],
  faint: COLOR['neutral-500'],
  brand: COLOR.primary,
  brandText: COLOR['primary-text'],
  brandWash: COLOR['primary-light'],
  brandEdge: COLOR['primary-highlight'],
  good: COLOR['success-text'],
  goodWash: COLOR['success-light'],
  warn: COLOR['warning-text'],
  warnWash: COLOR['warning-light'],
  bad: COLOR['danger-text'],
  badWash: COLOR['danger-light'],
} as const;

/** The type scale the panel actually renders at, in the 840 wide space. */
export const UI_TYPE = {
  header: 17,
  tab: 13,
  h1: 25,
  rowTitle: 15,
  rowBody: 13,
  label: 11,
  mono: 13,
  button: 13,
} as const;

/** The card shadow, one recipe, so every surface in the ad sits at one height. */
const CARD_SHADOW = '0 1px 2px rgba(20,22,40,.06)';

// ---------------------------------------------------------------------------
// Icons. Hand-drawn at 24x24 on the same stroke weight as the product's set,
// because the ad cannot import the app's `Icon` registry: `reel/` is a separate
// project with its own dependency list, deliberately (ADR-0045).
// ---------------------------------------------------------------------------

export type IconName =
  | 'home'
  | 'user'
  | 'users'
  | 'app'
  | 'rule'
  | 'shield'
  | 'export'
  | 'search'
  | 'chevron'
  | 'pin'
  | 'refresh'
  | 'plus'
  | 'minus'
  | 'check'
  | 'warning'
  | 'grip'
  | 'eye'
  | 'eye-off'
  | 'chart'
  | 'settings';

const PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <path d="M16 6.5a3 3 0 0 1 0 5.6M17 15.5a5.5 5.5 0 0 1 4 3.5" />
    </>
  ),
  app: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.4" />
      <path d="M11 18.2h2" />
    </>
  ),
  rule: <path d="M13 3 5 13h5l-1 8 8-10h-5z" />,
  shield: <path d="M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6z" />,
  export: (
    <>
      <path d="M12 4v10" />
      <path d="m8 11 4 3 4-3" />
      <path d="M4.5 18.5h15" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </>
  ),
  chevron: <path d="m9.5 5 7 7-7 7" />,
  pin: (
    <>
      <path d="M12 3.5v9" />
      <path d="M7 12.5h10l-2 4H9z" />
      <path d="M12 16.5v4" />
    </>
  ),
  refresh: (
    <>
      <path d="M19 8a7.5 7.5 0 0 0-13-2.5M5 16a7.5 7.5 0 0 0 13 2.5" />
      <path d="M19 3.5V8h-4.5M5 20.5V16h4.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  // Six dots in two columns: the drag handle, which is the one glyph in this
  // set that has to be recognised instantly at 16px on a phone.
  grip: (
    <>
      <circle cx="9.5" cy="6.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="6.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="17.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="17.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M4 12s3.5-6.5 8-6.5c1.3 0 2.5.3 3.5.8M20 12s-3.5 6.5-8 6.5c-1.3 0-2.5-.3-3.5-.8" />
      <path d="M4 4l16 16" />
    </>
  ),
  chart: (
    <>
      <path d="M4.5 19.5h15" />
      <path d="M7.5 19.5V11M12 19.5V5.5M16.5 19.5v-5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M4.2 7.5l2.2 1.3M17.6 15.2l2.2 1.3M4.2 16.5l2.2-1.3M17.6 8.8l2.2-1.3" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4.5 21 19H3z" />
      <path d="M12 10v4M12 16.4v.2" />
    </>
  ),
};

export const Icon: React.FC<{
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}> = ({ name, size = 20, color = UI.body, strokeWidth = 1.8 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    // `color` as well as `stroke`, because a glyph made of dots rather than
    // strokes (`grip`) fills with `currentColor` - and without this it inherits
    // whatever text colour it happens to sit in instead of the colour the
    // caller asked for. It rendered dark against the dark stage exactly once.
    style={{ display: 'block', flexShrink: 0, color }}
  >
    {PATHS[name]}
  </svg>
);

// ---------------------------------------------------------------------------
// The panel's furniture.
// ---------------------------------------------------------------------------

/** The seven tabs, in the order the product puts them in. */
export const TABS: readonly { icon: IconName; label: string }[] = [
  { icon: 'home', label: 'Home' },
  { icon: 'user', label: 'Users' },
  { icon: 'users', label: 'Groups' },
  { icon: 'app', label: 'Apps' },
  { icon: 'rule', label: 'Rules' },
  { icon: 'shield', label: 'Policies' },
  { icon: 'export', label: 'Export' },
];

/**
 * The title bar: what the panel is looking at, and the two controls beside it.
 *
 * `context` is the live Okta tab's own subject when there is one, which is the
 * product's `ContextBar` and never the same thing as the page heading below it
 * (ADR-0032). Passing nothing gives the resting `Okta Admin`.
 */
export const PanelHeader: React.FC<{ context?: string; contextIcon?: IconName }> = ({
  context,
  contextIcon = 'users',
}) => (
  <div
    style={{
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      background: UI.chrome,
    }}
  >
    {context ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name={contextIcon} size={18} color={UI.muted} />
        <div style={{ fontSize: UI_TYPE.header - 2, fontWeight: 600, color: UI.title }}>
          {context}
        </div>
      </div>
    ) : (
      <div style={{ fontSize: UI_TYPE.header, fontWeight: 700, color: UI.title }}>Okta Admin</div>
    )}
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <Icon name="refresh" size={17} color={UI.faint} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          border: `1px solid ${UI.strongLine}`,
          borderRadius: 8,
        }}
      >
        <Icon name="pin" size={15} color={UI.body} />
        <span style={{ fontSize: UI_TYPE.button, fontWeight: 600, color: UI.title }}>Pin</span>
      </div>
    </div>
  </div>
);

/** The tab strip. Only the active tab carries its label, exactly as the product does. */
export const TabStrip: React.FC<{ active: number; revealed?: number }> = ({
  active,
  revealed = TABS.length,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'stretch',
      gap: 4,
      padding: '0 16px',
      background: UI.chrome,
      borderBottom: `1px solid ${UI.line}`,
    }}
  >
    {TABS.map((tab, i) => {
      const on = i === active;
      return (
        <div
          key={tab.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '13px 10px 12px',
            borderBottom: `3px solid ${on ? UI.brand : 'transparent'}`,
            opacity: i < revealed ? 1 : 0,
          }}
        >
          <Icon name={tab.icon} size={19} color={on ? UI.brand : UI.body} />
          {on && (
            <span style={{ fontSize: UI_TYPE.tab, fontWeight: 600, color: UI.brandText }}>
              {tab.label}
            </span>
          )}
        </div>
      );
    })}
    <div style={{ flex: 1 }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 4 }}>
      <Icon name="search" size={18} color={UI.body} />
      <span style={{ fontSize: UI_TYPE.tab, fontWeight: 600, color: UI.body }}>K</span>
    </div>
  </div>
);

/** The status bar the panel keeps pinned to its own bottom edge. */
export const StatusBar: React.FC<{ state?: string }> = ({ state = 'Ready' }) => (
  <div
    style={{
      height: 52,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      background: UI.chrome,
      borderTop: `1px solid ${UI.line}`,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ width: 9, height: 9, borderRadius: 5, background: COLOR.success }} />
      <span style={{ fontSize: UI_TYPE.rowBody, fontWeight: 600, color: UI.title }}>{state}</span>
    </div>
    <div
      style={{
        padding: '7px 14px',
        borderRadius: 8,
        background: UI.badWash,
        fontSize: UI_TYPE.button,
        fontWeight: 600,
        color: UI.strongLine,
      }}
    >
      Cancel
    </div>
  </div>
);

/**
 * The whole panel: chrome, body, status bar, at {@link PANEL}'s size.
 *
 * Takes its body as children rather than a page id, because every stab shows a
 * different half-built moment of a different tab and none of them is a page the
 * product actually renders end to end.
 */
export const Panel: React.FC<{
  active: number;
  context?: string;
  contextIcon?: IconName;
  revealedTabs?: number;
  state?: string;
  children: React.ReactNode;
}> = ({ active, context, contextIcon, revealedTabs, state, children }) => (
  <div
    style={{
      width: PANEL.width,
      height: PANEL.height,
      background: UI.canvas,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      borderRadius: 6,
    }}
  >
    <PanelHeader context={context} contextIcon={contextIcon} />
    <TabStrip active={active} revealed={revealedTabs} />
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>{children}</div>
    <StatusBar state={state} />
  </div>
);

// ---------------------------------------------------------------------------
// Content primitives.
// ---------------------------------------------------------------------------

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: UI_TYPE.label,
      fontWeight: 700,
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: UI.muted,
      margin: '0 0 10px 2px',
    }}
  >
    {children}
  </div>
);

export const PageHeading: React.FC<{
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}> = ({ title, sub, right }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: '18px 20px 14px',
      background: UI.chrome,
    }}
  >
    <div>
      <div style={{ fontSize: UI_TYPE.h1, fontWeight: 700, color: UI.title }}>{title}</div>
      {sub && <div style={{ fontSize: UI_TYPE.rowBody, color: UI.muted, marginTop: 6 }}>{sub}</div>}
    </div>
    {right}
  </div>
);

export const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({
  style,
  children,
}) => (
  <div
    style={{
      background: UI.card,
      border: `1px solid ${UI.line}`,
      borderRadius: 10,
      boxShadow: CARD_SHADOW,
      ...style,
    }}
  >
    {children}
  </div>
);

export type BadgeTone = 'brand' | 'neutral' | 'good' | 'warn' | 'bad';

const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  brand: { bg: UI.brandEdge, fg: UI.brandText },
  neutral: { bg: COLOR['neutral-100'], fg: UI.body },
  good: { bg: UI.goodWash, fg: UI.good },
  warn: { bg: UI.warnWash, fg: UI.warn },
  bad: { bg: UI.badWash, fg: UI.bad },
};

export const Badge: React.FC<{ tone?: BadgeTone; children: React.ReactNode }> = ({
  tone = 'brand',
  children,
}) => {
  const { bg, fg } = BADGE_TONES[tone];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 5,
        background: bg,
        color: fg,
        fontSize: UI_TYPE.label,
        fontWeight: 700,
        letterSpacing: '.04em',
      }}
    >
      {children}
    </span>
  );
};

/**
 * One list row: the product's `ListRow`, which is the single most repeated
 * object in the panel and therefore the one the ad has to get right.
 */
export const Row: React.FC<{
  icon?: IconName;
  title: React.ReactNode;
  sub?: React.ReactNode;
  meta?: React.ReactNode;
  right?: React.ReactNode;
  chevron?: boolean;
  style?: React.CSSProperties;
}> = ({ icon, title, sub, meta, right, chevron = true, style }) => (
  <Card style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', ...style }}>
    {icon && <Icon name={icon} size={20} color={UI.faint} />}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: UI_TYPE.rowTitle,
          fontWeight: 600,
          color: UI.title,
        }}
      >
        {title}
      </div>
      {sub && <div style={{ fontSize: UI_TYPE.rowBody, color: UI.muted, marginTop: 3 }}>{sub}</div>}
      {meta && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: UI_TYPE.rowBody,
            color: UI.muted,
            marginTop: 5,
          }}
        >
          {meta}
        </div>
      )}
    </div>
    {right}
    {chevron && <Icon name="chevron" size={18} color={UI.strongLine} />}
  </Card>
);

/** A count and its unit, the way every row in the product prints one. */
export const Meta: React.FC<{ value: React.ReactNode; unit: string }> = ({ value, unit }) => (
  <span>
    <strong style={{ color: UI.title, fontVariantNumeric: 'tabular-nums' }}>{value}</strong> {unit}
  </span>
);

export const Button: React.FC<{
  tone?: 'primary' | 'ghost';
  icon?: IconName;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ tone = 'primary', icon, style, children }) => {
  const primary = tone === 'primary';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '11px 16px',
        borderRadius: 9,
        background: primary ? UI.brand : UI.chrome,
        border: `1px solid ${primary ? UI.brand : UI.strongLine}`,
        color: primary ? '#ffffff' : UI.title,
        fontSize: UI_TYPE.button,
        fontWeight: 600,
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={16} color={primary ? '#ffffff' : UI.body} />}
      {children}
    </div>
  );
};

export const SearchField: React.FC<{ placeholder: string; focused?: boolean }> = ({
  placeholder,
  focused,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      height: 48,
      padding: '0 16px',
      background: UI.chrome,
      border: `${focused ? 2 : 1}px solid ${focused ? UI.brand : UI.strongLine}`,
      borderRadius: 10,
      boxShadow: focused ? `0 0 0 4px ${UI.brandWash}` : undefined,
    }}
  >
    <Icon name="search" size={19} color={UI.faint} />
    <span style={{ fontSize: UI_TYPE.rowTitle, color: UI.faint }}>{placeholder}</span>
  </div>
);

/**
 * A rule expression, in the product's own mono block.
 *
 * `children` rather than a string, so a stab can put a verb around one
 * character of the expression - which is the entire argument of the compare
 * stab, and the one place in this ad where a single glyph is the subject.
 */
export const Code: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({
  style,
  children,
}) => (
  <div
    style={{
      background: COLOR['neutral-100'],
      borderRadius: 7,
      padding: '12px 14px',
      fontFamily: "'SF Mono', 'JetBrains Mono', Menlo, monospace",
      fontSize: UI_TYPE.mono,
      color: UI.title,
      whiteSpace: 'pre',
      ...style,
    }}
  >
    {children}
  </div>
);

/** The scrolling body every tab shares: canvas, padded, gapped. */
export const Body: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({
  style,
  children,
}) => (
  <div
    style={{
      height: '100%',
      background: UI.canvas,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * A filter pill: the product's own segmented selector.
 *
 * Two live in the profile pane ("All attributes", "Used by rules") and two in
 * the blast radius report ("Groups 2", "Rules 4"). Same object, so it is one
 * component rather than two that drift.
 */
export const FilterPill: React.FC<{
  selected?: boolean;
  count?: number;
  children: React.ReactNode;
}> = ({ selected, count, children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: '7px 13px',
      borderRadius: 999,
      background: selected ? UI.brandWash : UI.chrome,
      border: `1px solid ${selected ? UI.brand : UI.strongLine}`,
      color: selected ? UI.brandText : UI.body,
      fontSize: UI_TYPE.rowBody,
      fontWeight: 600,
    }}
  >
    {children}
    {count !== undefined && (
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          color: selected ? UI.brandText : UI.faint,
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    )}
  </span>
);

/** Which alert this is. `danger` is the product's vocabulary; `error` is not. */
export type AlertTone = 'warn' | 'danger' | 'info';

const ALERT_TONES: Record<AlertTone, { bg: string; edge: string; fg: string; icon: IconName }> = {
  warn: { bg: UI.warnWash, edge: '#e8dda8', fg: UI.warn, icon: 'warning' },
  danger: { bg: UI.badWash, edge: '#f3c8bf', fg: UI.bad, icon: 'warning' },
  info: { bg: UI.brandWash, edge: UI.brandEdge, fg: UI.brandText, icon: 'shield' },
};

/**
 * The banded alert the product puts above a consequential action.
 *
 * The left rule is the whole read at ad scale: the band's fill is pale enough
 * to survive a store page's bitrate but not loud enough to be seen in a
 * quarter-second, and a 3px bar in the tone's own colour is.
 */
export const AlertMessage: React.FC<{ tone?: AlertTone; children: React.ReactNode }> = ({
  tone = 'warn',
  children,
}) => {
  const { bg, edge, fg, icon } = ALERT_TONES[tone];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '13px 15px',
        borderRadius: 9,
        background: bg,
        border: `1px solid ${edge}`,
        borderLeft: `3px solid ${fg}`,
      }}
    >
      <Icon name={icon} size={19} color={fg} />
      <div style={{ fontSize: UI_TYPE.rowBody, color: UI.title, lineHeight: 1.45 }}>{children}</div>
    </div>
  );
};

/**
 * A modal over the panel: the scrim, and the card it dims for.
 *
 * Absolutely positioned inside the panel's own body rather than over the whole
 * frame, because that is where the product puts it - a side panel modal never
 * escapes the panel. Which means the stab behind it stays visible at the edges,
 * and the viewer can see it is the same screen they were just looking at.
 */
export const Sheet: React.FC<{
  title: string;
  sub?: React.ReactNode;
  footer?: React.ReactNode;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ title, sub, footer, style, children }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(20,22,40,.42)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
    }}
  >
    <div
      style={{
        width: '100%',
        background: UI.chrome,
        borderRadius: 12,
        boxShadow: '0 24px 60px -18px rgba(20,22,40,.5)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${UI.line}` }}>
        <div style={{ fontSize: UI_TYPE.h1, fontWeight: 700, color: UI.title }}>{title}</div>
        {sub && (
          <div style={{ fontSize: UI_TYPE.rowBody, color: UI.muted, marginTop: 5 }}>{sub}</div>
        )}
      </div>
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          background: UI.canvas,
        }}
      >
        {children}
      </div>
      {footer && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '14px 20px',
            borderTop: `1px solid ${UI.line}`,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  </div>
);

/**
 * The hairline the display editor splices between two rows to say where a
 * dragged attribute will land.
 *
 * A full-width 2px bar in the brand colour, exactly as the product renders it.
 * It is a separate export rather than a literal inside the stab because
 * {@link DropGap} is what opens the space for it, and a caller pairing a verb
 * with a hand-drawn bar would be free to pick a different weight each time.
 */
export const DropIndicator: React.FC = () => (
  <div style={{ height: 2, borderRadius: 1, background: UI.brand }} />
);
