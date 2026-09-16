import{L as a,j as e}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:u,fn:w,userEvent:g,within:y}=__STORYBOOK_MODULE_TEST__,f={title:"Shared/ListRow",component:a,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:'The chrome every list row shares: radius, resting border, hover border and transition are fixed with no prop to change them, and only `density`, `state`, `flash`, `body` and `as` are exposed. The interior belongs to the feature and follows the typography contract in `docs/design-system.md`.\n\nPrefer `StretchedButton` over `as="button"` when the row contains its own controls — a button cannot legally contain a checkbox or another button.'}}},argTypes:{children:{description:"The row's content, owned by the feature."},density:{description:"Content density: `compact` resolves the row spacing role, `comfortable` the card role."},state:{description:"Resting appearance: `default`, `selected`, or `highlighted`."},flash:{description:"One-shot success confirmation via `animate-affirm-flash`."},as:{description:"Element to render: `div`, `li`, `a`, or `button`."},onClick:{description:"Activation handler; supplying it makes the row interactive."},href:{description:'`href` for `as="a"`.'},target:{description:'Link target; `_blank` also sets `rel="noopener noreferrer"`.'},ariaLabel:{description:"Accessible name when the content does not supply one."},describedBy:{description:"`id` of the element describing this row."},dataAttributes:{description:"Row-identity attributes (`data-group-id`, …)."},className:{description:"Extra classes — layout only, never colour."},testId:{description:"Test id applied to the row element."}},args:{children:null}},t=({title:s="Engineering",meta:m="Okta group · 248 members"})=>e.jsxs("div",{className:"flex items-start justify-between gap-3",children:[e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsx("div",{className:"truncate text-sm font-semibold text-neutral-900",children:s}),e.jsx("div",{className:"mt-0.5 truncate text-xs text-neutral-600",children:m})]}),e.jsx("span",{className:"shrink-0 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-600",children:"Active"})]}),r={args:{children:e.jsx(t,{})}},n={args:{children:null},render:()=>e.jsxs("div",{className:"space-y-3",children:[e.jsx(a,{density:"compact",children:e.jsx(t,{title:"compact — py-(--sp-row-y) px-(--sp-row-x)",meta:"Dense scanning list"})}),e.jsx(a,{density:"comfortable",children:e.jsx(t,{title:"comfortable — p-(--sp-card)",meta:"Rich card with badges and a meta line"})})]})},o={args:{children:null},render:()=>e.jsxs("div",{className:"space-y-3",children:[e.jsx(a,{state:"default",children:e.jsx(t,{title:"default",meta:"Resting"})}),e.jsx(a,{state:"selected",children:e.jsx(t,{title:"selected",meta:"A user choice — persists"})}),e.jsx(a,{state:"highlighted",children:e.jsx(t,{title:"highlighted",meta:"A deep-link target — transient"})})]})},i={args:{children:null,onClick:w()},render:s=>e.jsxs("div",{className:"space-y-3",children:[e.jsx(a,{as:"button",onClick:s.onClick,ariaLabel:"Open Engineering",children:e.jsx(t,{title:'as="button"',meta:"Whole row activates — keyboard reachable"})}),e.jsx(a,{as:"a",href:"#list-row-demo",target:"_blank",children:e.jsx(t,{title:'as="a"',meta:"Real navigation — rel is set automatically"})})]}),play:async({args:s,canvasElement:m})=>{const h=y(m).getByRole("button",{name:"Open Engineering"});await g.click(h),await u(s.onClick).toHaveBeenCalledTimes(1),h.focus(),await u(h).toHaveFocus(),await g.keyboard("{Enter}"),await u(s.onClick).toHaveBeenCalledTimes(2)}},d={args:{children:e.jsx(t,{title:"Pressed",meta:"scale(.995) — subtle, for a wide target"})},render:s=>e.jsx(a,{...s,as:"button",onClick:()=>{},ariaLabel:"Open Engineering"}),parameters:{pseudo:{active:!0}}},c={args:{children:null},render:()=>e.jsx("ul",{className:"space-y-3",children:["Engineering","Design","Support"].map(s=>e.jsx(a,{as:"li",density:"compact",children:e.jsx(t,{title:s,meta:"Okta group"})},s))})},l={args:{children:null},render:()=>e.jsx(a,{body:e.jsx("div",{className:"disclose","data-open":"true",children:e.jsx("div",{className:"border-t border-neutral-200 bg-neutral-50 px-4 py-3",children:e.jsx("p",{className:"text-xs text-neutral-600",children:"Body content sets its own padding and can carry its own background — the header above keeps the density padding."})})}),children:e.jsx(t,{title:"Expandable row",meta:"Header keeps p-4; body sets its own"})})},p={args:{flash:!0,children:e.jsx(t,{title:"Just added",meta:"animate-affirm-flash"})}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    children: <RowBody />
  }
}`,...r.parameters?.docs?.source},description:{story:"The default: comfortable padding, resting state.",...r.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    children: null
  },
  render: () => <div className="space-y-3">
      <ListRow density="compact">
        <RowBody title="compact — py-(--sp-row-y) px-(--sp-row-x)" meta="Dense scanning list" />
      </ListRow>
      <ListRow density="comfortable">
        <RowBody title="comfortable — p-(--sp-card)" meta="Rich card with badges and a meta line" />
      </ListRow>
    </div>
}`,...n.parameters?.docs?.source},description:{story:"Both densities side by side; each resolves a `--sp-*` role, so the gap holds at every width.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    children: null
  },
  render: () => <div className="space-y-3">
      <ListRow state="default">
        <RowBody title="default" meta="Resting" />
      </ListRow>
      <ListRow state="selected">
        <RowBody title="selected" meta="A user choice — persists" />
      </ListRow>
      <ListRow state="highlighted">
        <RowBody title="highlighted" meta="A deep-link target — transient" />
      </ListRow>
    </div>
}`,...o.parameters?.docs?.source},description:{story:"All three resting states: `selected` persists, `highlighted` is a transient deep-link target.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    children: null,
    onClick: fn()
  },
  render: args => <div className="space-y-3">
      <ListRow as="button" onClick={args.onClick} ariaLabel="Open Engineering">
        <RowBody title='as="button"' meta="Whole row activates — keyboard reachable" />
      </ListRow>
      <ListRow as="a" href="#list-row-demo" target="_blank">
        <RowBody title='as="a"' meta="Real navigation — rel is set automatically" />
      </ListRow>
    </div>,
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole('button', {
      name: 'Open Engineering'
    });
    await userEvent.click(row);
    await expect(args.onClick).toHaveBeenCalledTimes(1);

    // The keyboard path a bare \`<div onClick>\` never had.
    row.focus();
    await expect(row).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  }
}`,...i.parameters?.docs?.source},description:{story:"Interactive rows: a whole-row button and a real link, both keyboard reachable.",...i.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    children: <RowBody title="Pressed" meta="scale(.995) — subtle, for a wide target" />
  },
  render: args => <ListRow {...args} as="button" onClick={() => {}} ariaLabel="Open Engineering" />,
  parameters: {
    pseudo: {
      active: true
    }
  }
}`,...d.parameters?.docs?.source},description:{story:"Pressed state, forced via the pseudo-states addon: `.press-subtle`'s `scale(.995)` depress.",...d.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    children: null
  },
  render: () => <ul className="space-y-3">
      {['Engineering', 'Design', 'Support'].map(name => <ListRow key={name} as="li" density="compact">
          <RowBody title={name} meta="Okta group" />
        </ListRow>)}
    </ul>
}`,...c.parameters?.docs?.source},description:{story:'Inside a `<ul>` as `as="li"`, using the `space-y-3` separator pattern.',...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    children: null
  },
  render: () => <ListRow body={<div className="disclose" data-open="true">
          <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-xs text-neutral-600">
              Body content sets its own padding and can carry its own background — the header above
              keeps the density padding.
            </p>
          </div>
        </div>}>
      <RowBody title="Expandable row" meta="Header keeps p-4; body sets its own" />
    </ListRow>
}`,...l.parameters?.docs?.source},description:{story:"An expandable row via the `body` slot: the header keeps the density padding, the\nbody sets its own, and the card clips so a `.disclose` body cannot escape the radius.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    flash: true,
    children: <RowBody title="Just added" meta="animate-affirm-flash" />
  }
}`,...p.parameters?.docs?.source},description:{story:"A one-shot success confirmation on a row that was just added or changed.",...p.parameters?.docs?.description}}};const R=["Default","Densities","States","Interactive","Pressed","InAList","Expandable","Flash"];export{r as Default,n as Densities,l as Expandable,p as Flash,c as InAList,i as Interactive,d as Pressed,o as States,R as __namedExportsOrder,f as default};
