import{j as g}from"./iframe-tAvKsVeF.js";import{P as m}from"./PaletteRow-BiL1s8SJ.js";import"./preload-helper-PPVm8Dsz.js";const{expect:t,fn:h,userEvent:y,within:p}=__STORYBOOK_MODULE_TEST__,E={title:"Sidepanel/Palette/PaletteRow",component:m,tags:["autodocs"],parameters:{docs:{description:{component:"One row in the ⌘K palette's result list — a section to jump to, or an entity to open. Given an `href` the row renders as an `<a>`, otherwise as a `<button>`: never both, because a link nested inside the row button is a `nested-interactive` violation and a button wrapping a link is a control that does nothing.\n\nThe roving anchor lives in the list, not the row: exactly one row carries `tabIndex={0}` and every other carries `-1`, so the whole result list is one tab stop. The row takes the value it is told and a ref the list focuses."}}},argTypes:{trailing:{control:!1,description:'Right-edge mark naming where the row goes (`Groups ›`), or carrying its "Open in Okta" link.'},isCurrent:{description:'Whether this is the section the reader is already on; marks the row `aria-current="page"`.'},tabIndex:{description:"The roving anchor: `0` on exactly one row in the list, `-1` on every other."}},args:{icon:"users",label:"Groups",tabIndex:0,onClick:h()}},a={},r={play:async({args:e,canvasElement:n})=>{await y.click(p(n).getByRole("button",{name:"Groups"})),await t(e.onClick).toHaveBeenCalledTimes(1)}},o={args:{label:"Home",icon:"home",isCurrent:!0},play:async({canvasElement:e})=>{const n=p(e).getByRole("button");await t(n).toHaveAttribute("aria-current","page")}},s={args:{label:"Engineering",secondary:"Everyone in the engineering org"}},i={args:{label:"Engineering",secondary:"Everyone in the engineering org",trailing:"Groups ›",ariaLabel:"Engineering — open in Groups"},play:async({canvasElement:e})=>{await t(p(e).getByRole("button",{name:"Engineering — open in Groups"})).toBeInTheDocument()}},c={args:{label:"Rules",icon:"bolt",tabIndex:-1},play:async({canvasElement:e})=>{await t(p(e).getByRole("button")).toHaveAttribute("tabindex","-1")}},l={args:{label:"Engineering",secondary:"All engineers",href:"https://example.okta.com/admin/group/00gFAKE0000000000001",trailing:"Okta ↗",ariaLabel:"Engineering — open in Okta"},play:async({canvasElement:e})=>{const n=p(e),u=n.getByRole("link",{name:"Engineering — open in Okta"});await t(u).toHaveAttribute("rel","noopener noreferrer"),await t(n.queryByRole("button")).toBeNull()}},d={args:{label:"Contractors — EMEA — Finance and Procurement (managed by IAM)",secondary:"Sourced from the HR feed; membership is rule-driven and cannot be edited by hand",trailing:"Groups ›"},decorators:[e=>g.jsx("div",{style:{width:360},children:g.jsx(e,{})})]};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:"{}",...a.parameters?.docs?.source},description:{story:"A section row: glyph and label, nothing else to say.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    await userEvent.click(within(canvasElement).getByRole('button', {
      name: 'Groups'
    }));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  }
}`,...r.parameters?.docs?.source},description:{story:"Pressing the row activates it — the palette's cue to navigate and close.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Home',
    icon: 'home',
    isCurrent: true
  },
  play: async ({
    canvasElement
  }) => {
    const row = within(canvasElement).getByRole('button');
    // The tint is not the signal — \`aria-current\` is what a screen reader hears.
    await expect(row).toHaveAttribute('aria-current', 'page');
  }
}`,...o.parameters?.docs?.source},description:{story:"The section the reader is already on — tinted, marked, and named in words.",...o.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Engineering',
    secondary: 'Everyone in the engineering org'
  }
}`,...s.parameters?.docs?.source},description:{story:"An entity row: the second line carries the one extra fact worth showing.",...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Engineering',
    secondary: 'Everyone in the engineering org',
    trailing: 'Groups ›',
    ariaLabel: 'Engineering — open in Groups'
  },
  play: async ({
    canvasElement
  }) => {
    // "Engineering" alone does not say where the row goes; the accessible name does.
    await expect(within(canvasElement).getByRole('button', {
      name: 'Engineering — open in Groups'
    })).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"An entity row that names its destination in its accessible name.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Rules',
    icon: 'bolt',
    tabIndex: -1
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByRole('button')).toHaveAttribute('tabindex', '-1');
  }
}`,...c.parameters?.docs?.source},description:{story:"Off the roving anchor: in the list, but not a tab stop.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Engineering',
    secondary: 'All engineers',
    href: 'https://example.okta.com/admin/group/00gFAKE0000000000001',
    trailing: 'Okta ↗',
    ariaLabel: 'Engineering — open in Okta'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link', {
      name: 'Engineering — open in Okta'
    });

    // A new tab needs \`noopener\`: the Okta console must never get a handle on
    // the opener document.
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // Not a button wrapping a link, and not a link wrapping a button.
    await expect(canvas.queryByRole('button')).toBeNull();
  }
}`,...l.parameters?.docs?.source},description:{story:"The unreachable case: the anchor replaces the button rather than nesting inside it.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Contractors — EMEA — Finance and Procurement (managed by IAM)',
    secondary: 'Sourced from the HR feed; membership is rule-driven and cannot be edited by hand',
    trailing: 'Groups ›'
  },
  decorators: [Story => <div style={{
    width: 360
  }}>
        <Story />
      </div>]
}`,...d.parameters?.docs?.source},description:{story:"A long name and a long second line, at the panel's narrowest.",...d.parameters?.docs?.description}}};const k=["Default","Activating","Current","WithSecondary","WithTrailingMark","NotTheAnchor","AsLink","Truncated"];export{r as Activating,l as AsLink,o as Current,a as Default,c as NotTheAnchor,d as Truncated,s as WithSecondary,i as WithTrailingMark,k as __namedExportsOrder,E as default};
