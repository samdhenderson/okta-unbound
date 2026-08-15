import * as React from 'react';
import * as S from '@ds-stories/src/sidepanel/components/shared/Modal.stories';

function compose(S: any, key: string) {
  const meta: any = S.default ?? {};
  const st: any = S[key];
  const args: any = { ...(meta.args ?? {}), ...(st && st.args ? st.args : {}) };
  // Storybook resolves argTypes.mapping (control value -> real arg) before
  // rendering; mirror that so mapped args don't render raw.
  const at: any = { ...(meta.argTypes ?? {}), ...(st && st.argTypes ? st.argTypes : {}) };
  for (const k of Object.keys(args)) {
    const m = at[k] && at[k].mapping;
    if (m && typeof m === 'object' && args[k] in m) args[k] = m[args[k]];
  }
  const title: string = typeof meta.title === 'string' ? meta.title : '';
  const ctx: any = {
    args,
    name: key,
    title,
    kind: title,
    id: '',
    componentId: '',
    globals: {},
    viewMode: 'story',
    parameters: (st && st.parameters) ?? meta.parameters ?? {},
  };
  let render: (() => any) | null = null;
  if (st && typeof st.render === 'function') render = () => st.render(args, ctx);
  else if (typeof st === 'function') render = () => st(args, ctx);
  else if (typeof meta.render === 'function') render = () => meta.render(args, ctx);
  else {
    const C = (st && st.component) || meta.component;
    if (C) render = () => React.createElement(C, args);
  }
  if (!render) return () => null;
  const decorators: any[] = ([] as any[])
    .concat((st && st.decorators) ?? [])
    .concat(meta.decorators ?? []);
  return decorators.reduce(
    (inner: any, dec: any) => () => {
      const out = dec(inner, ctx);
      return out === undefined ? inner() : out;
    },
    render,
  );
}

/**
 * Modal panels are `position: fixed`, so in the preview card they escape their
 * container entirely — the card root measures 0px tall ([RENDER_THIN]) and the
 * panel paints against the page viewport instead of the cell.
 *
 * A non-`none` `transform` makes this wrapper the containing block for fixed
 * descendants, so the panel centres inside the frame rather than the page. The
 * size matches `cfg.overrides.Modal.viewport` (480x640) so the card, the compare
 * capture, and the shipped preview all frame the modal identically.
 *
 * The width must be explicit: the `sm | md | lg | xl` presets are `max-width`
 * rules, so without a fixed containing block they all clamp to whatever width
 * the card happens to have and the size variants become indistinguishable.
 *
 * This only re-homes the panel — the modal's own overlay, sizing, focus trap and
 * open state are untouched, so what renders is still the real component.
 */
const frame = (Story: () => any) => {
  const Framed = () => (
    <div
      style={{
        position: 'relative',
        width: 480,
        height: 640,
        transform: 'translateZ(0)',
        overflow: 'hidden',
      }}
    >
      <Story />
    </div>
  );
  return Framed;
};

export const Default = frame(compose(S, 'Default'));
export const WithFooter = frame(compose(S, 'WithFooter'));
export const Small = frame(compose(S, 'Small'));
export const Large = frame(compose(S, 'Large'));
export const ExtraLarge = frame(compose(S, 'ExtraLarge'));
export const WithLongContent = frame(compose(S, 'WithLongContent'));
export const Closed = frame(compose(S, 'Closed'));
export const MotionShowcase = frame(compose(S, 'MotionShowcase'));
export const ExitInteraction = frame(compose(S, 'ExitInteraction'));
