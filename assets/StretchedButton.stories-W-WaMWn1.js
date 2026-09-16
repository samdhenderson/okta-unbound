import{m as p,j as e,C as m,I as u,b}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:l,fn:h,userEvent:d,within:v}=__STORYBOOK_MODULE_TEST__,y={title:"Shared/StretchedButton",component:p,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'The "stretched link" pattern as a real `<button>`: an empty, absolutely-positioned button covering its positioned ancestor, so clicking anywhere on a card activates it without a `role="button"` div or a card wrapped in a button.\n\n**Layout contract:** the click target must be `relative`, and the card’s own controls `relative z-10` or they sit under the overlay. Every card in a list shares one label, so pass `describedBy` pointing at the element that names this card.'}}},argTypes:{label:{description:"Accessible name — required, since the button has no visible content."},onClick:{description:"Activation handler."},describedBy:{description:"`id` of the element that names this specific card (usually its title)."},title:{description:"Tooltip text; defaults to `label`."},disabled:{description:"Disables activation."},className:{description:"Extra classes merged after the base positioning classes."}},args:{label:"View group details",onClick:h()}},t={render:o=>e.jsxs("div",{className:"relative w-80 rounded-md border border-neutral-200 bg-white px-3 py-2",children:[e.jsx(p,{...o,describedBy:"stretched-demo-name"}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"relative z-10",children:e.jsx(m,{checked:!1,onChange:h(),"aria-label":"Select Engineering"})}),e.jsx("h3",{id:"stretched-demo-name",className:"text-sm font-semibold text-neutral-900",children:"Engineering"}),e.jsx("span",{className:"relative z-10 ml-auto",children:e.jsx(u,{label:"Expand",size:"sm",children:e.jsx(b,{type:"chevron-right",size:"sm"})})})]}),e.jsx("p",{className:"mt-0.5 text-xs text-neutral-600",children:"Click anywhere on the card — except the two controls — to activate."})]})},a={...t,parameters:{pseudo:{focusVisible:!0}}},s={...t,args:{disabled:!0}},n={...t,parameters:{pseudo:{active:!0}}},r={...t,play:async({canvasElement:o,args:i})=>{const c=v(o);await d.click(c.getByRole("checkbox",{name:"Select Engineering"})),await l(i.onClick).not.toHaveBeenCalled(),await d.click(c.getByRole("button",{name:"View group details"})),await l(i.onClick).toHaveBeenCalledTimes(1)}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: args => <div className="relative w-80 rounded-md border border-neutral-200 bg-white px-3 py-2">
      <StretchedButton {...args} describedBy="stretched-demo-name" />
      <div className="flex items-center gap-2">
        <span className="relative z-10">
          <Checkbox checked={false} onChange={fn()} aria-label="Select Engineering" />
        </span>
        <h3 id="stretched-demo-name" className="text-sm font-semibold text-neutral-900">
          Engineering
        </h3>
        <span className="relative z-10 ml-auto">
          <IconButton label="Expand" size="sm">
            <Icon type="chevron-right" size="sm" />
          </IconButton>
        </span>
      </div>
      <p className="mt-0.5 text-xs text-neutral-600">
        Click anywhere on the card — except the two controls — to activate.
      </p>
    </div>
}`,...t.parameters?.docs?.source},description:{story:`On its own the button is invisible, so it is only meaningful in context: this
is the group-row shape it was built for — a checkbox and an icon button lifted
above the overlay, with everything else plain content.`,...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  ...Default,
  parameters: {
    pseudo: {
      focusVisible: true
    }
  }
}`,...a.parameters?.docs?.source},description:{story:`Focus-visible state (forced via the pseudo-states addon): the overlay draws its
focus ring around the whole card, so a keyboard user can see what they are on.`,...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  ...Default,
  args: {
    disabled: true
  }
}`,...s.parameters?.docs?.source},description:{story:"Disabled — the card is inert, but its own controls still work.",...s.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  ...Default,
  parameters: {
    pseudo: {
      active: true
    }
  }
}`,...n.parameters?.docs?.source},description:{story:"Pressed state (forced via the pseudo-states addon): the overlay paints nothing at rest,\nso `:active` washes the whole card rather than using the `.press` transform, which on an\ninvisible box would be a no-op.",...n.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  ...Default,
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('checkbox', {
      name: 'Select Engineering'
    }));
    await expect(args.onClick).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', {
      name: 'View group details'
    }));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  }
}`,...r.parameters?.docs?.source},description:{story:`The overlay takes the click for the card, and the controls lifted above it keep their
own: ticking the checkbox never activates the row.`,...r.parameters?.docs?.description}}};const w=["Default","Focus","Disabled","Pressed","ActivatingTheCard"];export{r as ActivatingTheCard,t as Default,s as Disabled,a as Focus,n as Pressed,w as __namedExportsOrder,y as default};
