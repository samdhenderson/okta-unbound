import{B as s,j as r,b as w}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:k,fn:B}=__STORYBOOK_MODULE_TEST__,C={title:"Shared/Button",component:s,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"The primary text button primitive — the default choice for any clickable CTA.\n\nFive variants (`primary | secondary | danger | ghost | success`) and four sizes (`xs | sm | md | lg`), with an optional leading/trailing icon, loading spinner, trailing count badge, and full-width layout. Disabled and loading both block interaction. For icon-only affordances use `IconButton`; for filter toggles use `FilterPill`."}}},argTypes:{children:{description:"Button label content."},variant:{description:"Visual treatment; `secondary` is the default and `primary` is the page call to action."},size:{description:"Size scale (`xs` ≈ 24px, `sm` ≈ 36px, `md` ≈ 40px, `lg` ≈ 56px); defaults to `md`."},icon:{description:"Optional icon glyph rendered alongside the label (hidden while `loading`)."},iconPosition:{description:"Which side of the label the icon sits on. Defaults to `left`."},disabled:{description:"Disables the button."},loading:{description:"Shows a spinner and disables the button while an action is in flight."},onClick:{description:"Click handler."},type:{description:"Native button type. Defaults to `button` (does not submit forms)."},className:{description:"Extra classes merged onto the button."},fullWidth:{description:"Stretch to fill the container width."},badge:{description:"Optional count/badge pill rendered at the trailing edge (e.g. unread count)."},title:{description:"Native `title` tooltip."}},args:{children:"Add group",onClick:B()}},n={},o={args:{variant:"primary",icon:"plus"}},i={args:{variant:"danger",children:"Remove members"}},c={args:{variant:"ghost"}},d={args:{variant:"link",size:"xs",children:"Select all (245)"}},l={args:{variant:"link",size:"xs",children:"Select all (245)",disabled:!0}},p={args:{disabled:!0},play:async({args:e,canvas:a,userEvent:t})=>{await t.click(a.getByRole("button",{name:"Add group"})),await k(e.onClick).not.toHaveBeenCalled()}},u={args:{variant:"primary",loading:!0},play:async({args:e,canvas:a,userEvent:t})=>{await t.click(a.getByRole("button",{name:"Add group"})),await k(e.onClick).not.toHaveBeenCalled()}},m={args:{variant:"primary"},play:async({args:e,canvas:a,userEvent:t})=>{await t.click(a.getByRole("button",{name:"Add group"})),await k(e.onClick).toHaveBeenCalledTimes(1)}},g={args:{variant:"primary",badge:"3"}},h={args:{variant:"primary"},parameters:{pseudo:{hover:!0}}},v={args:{variant:"primary"},parameters:{pseudo:{focusVisible:!0}}},b={args:{variant:"primary"},parameters:{pseudo:{active:!0}}},y={render:e=>r.jsxs("div",{style:{display:"flex",gap:12,alignItems:"center"},children:[r.jsx(s,{...e,size:"xs",children:"Extra small"}),r.jsx(s,{...e,size:"sm",children:"Small"}),r.jsx(s,{...e,size:"md",children:"Medium"}),r.jsx(s,{...e,size:"lg",children:"Large"})]}),args:{variant:"primary"}},x={render:e=>r.jsxs("div",{children:[r.jsx(s,{...e,expanded:!0,controls:"button-disclosure-region",icon:"minus",children:"Manage"}),r.jsx("div",{id:"button-disclosure-region",className:"mt-2 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700",children:"The region this button shows and hides."})]}),args:{variant:"ghost",size:"sm"}},f={render:e=>r.jsxs("div",{className:"w-48",children:[r.jsxs(s,{...e,expanded:!0,controls:"button-element-child-region",children:["Rules that use this group",r.jsx(w,{type:"chevron-right",size:"sm",className:"rotate-90"})]}),r.jsx("div",{id:"button-element-child-region",className:"sr-only",children:"The region this button shows and hides."})]}),args:{variant:"ghost",size:"xs"}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"Default (secondary) treatment.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'primary',
    icon: 'plus'
  }
}`,...o.parameters?.docs?.source},description:{story:"The high-emphasis call to action.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'danger',
    children: 'Remove members'
  }
}`,...i.parameters?.docs?.source},description:{story:"Destructive action styling.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'ghost'
  }
}`,...c.parameters?.docs?.source},description:{story:"Low-emphasis, chromeless — but still a box, with its size's horizontal padding.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'link',
    size: 'xs',
    children: 'Select all (245)'
  }
}`,...d.parameters?.docs?.source},description:{story:"`link` is the other chromeless treatment, and not a box at all: no horizontal padding,\nso its first glyph lines up with the box edges above and below it. It is still a real\n`<button>` — never use it to make a verb quieter.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'link',
    size: 'xs',
    children: 'Select all (245)',
    disabled: true
  }
}`,...l.parameters?.docs?.source},description:{story:"Disabled, a `link` loses its colour and its underline rather than greying a box.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  },
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: 'Add group'
    }));
    await expect(args.onClick).not.toHaveBeenCalled();
  }
}`,...p.parameters?.docs?.source},description:{story:"Disabled state — the click never reaches the handler.",...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'primary',
    loading: true
  },
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: 'Add group'
    }));
    await expect(args.onClick).not.toHaveBeenCalled();
  }
}`,...u.parameters?.docs?.source},description:{story:"Spinner shown while an action is in flight, which also blocks the click.",...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'primary'
  },
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: 'Add group'
    }));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  }
}`,...m.parameters?.docs?.source},description:{story:"An enabled button reports the press once per click.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'primary',
    badge: '3'
  }
}`,...g.parameters?.docs?.source},description:{story:"Trailing count badge.",...g.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'primary'
  },
  parameters: {
    pseudo: {
      hover: true
    }
  }
}`,...h.parameters?.docs?.source},description:{story:"Hover state (forced via the pseudo-states addon).",...h.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'primary'
  },
  parameters: {
    pseudo: {
      focusVisible: true
    }
  }
}`,...v.parameters?.docs?.source},description:{story:"Focus-visible state (forced via the pseudo-states addon).",...v.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'primary'
  },
  parameters: {
    pseudo: {
      active: true
    }
  }
}`,...b.parameters?.docs?.source},description:{story:"Pressed state (forced via the pseudo-states addon): `.press`'s depress plus a darker background step beyond hover.",...b.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  render: args => <div style={{
    display: 'flex',
    gap: 12,
    alignItems: 'center'
  }}>
      <Button {...args} size="xs">
        Extra small
      </Button>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>,
  args: {
    variant: 'primary'
  }
}`,...y.parameters?.docs?.source},description:{story:"The four size steps side by side. `xs` (24px) is for furniture around a list, never a page's own verb.",...y.parameters?.docs?.description}}};x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  render: args => <div>
      <Button {...args} expanded controls="button-disclosure-region" icon="minus">
        Manage
      </Button>
      <div id="button-disclosure-region" className="mt-2 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
        The region this button shows and hides.
      </div>
    </div>,
  args: {
    variant: 'ghost',
    size: 'sm'
  }
}`,...x.parameters?.docs?.source},description:{story:"A labelled disclosure trigger: `expanded` + `controls` put `aria-expanded`/`aria-controls` on the button.",...x.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  render: args => <div className="w-48">
      <Button {...args} expanded controls="button-element-child-region">
        Rules that use this group
        <Icon type="chevron-right" size="sm" className="rotate-90" />
      </Button>
      <div id="button-element-child-region" className="sr-only">
        The region this button shows and hides.
      </div>
    </div>,
  args: {
    variant: 'ghost',
    size: 'xs'
  }
}`,...f.parameters?.docs?.source},description:{story:"A label plus an element child — the shape a rotating disclosure chevron needs, since the\n`icon` prop renders its own `Icon` and cannot carry the open state's `rotate-90`.",...f.parameters?.docs?.description}}};const D=["Default","Primary","Danger","Ghost","Link","LinkDisabled","Disabled","Loading","Clicked","WithBadge","Hover","Focus","Pressed","Sizes","Disclosure","LabelWithElementChild"];export{m as Clicked,i as Danger,n as Default,p as Disabled,x as Disclosure,v as Focus,c as Ghost,h as Hover,f as LabelWithElementChild,d as Link,l as LinkDisabled,u as Loading,b as Pressed,o as Primary,y as Sizes,g as WithBadge,D as __namedExportsOrder,C as default};
