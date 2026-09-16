import{aj as m,j as o,b as y}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:s,userEvent:b,waitFor:h,within:i}=__STORYBOOK_MODULE_TEST__,f={title:"Shared/Tooltip",component:m,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'Hover- and focus-triggered label chip for a control whose own rendering does not name it. Opens on hover and on focus after `--dur-hover-intent`, carries `role="tooltip"` wired to the trigger with `aria-describedby`, and closes on Escape, blur, pointer-leave or a scroll that moves the trigger.\n\nA tooltip is additive: it describes, it does not name — an icon-only control still needs its own `aria-label`. The trigger comes from a render prop and the chip is portalled to `document.body`, so there is no wrapper element to break a `tablist`.'}}},argTypes:{label:{description:"The chip’s text. A few words — it names a thing, it never wraps."},disabled:{description:"Suppresses the chip while still rendering the trigger."},children:{description:"Render prop for the trigger; spread the supplied props onto your element."}},args:{label:"Groups",children:()=>null}},r={render:e=>o.jsx(m,{...e,children:t=>o.jsx("button",{type:"button","aria-label":e.label,className:"rounded-md p-2.5 text-neutral-600 transition-colors duration-(--dur-instant) hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-primary",...t,children:o.jsx(y,{type:"users",size:"sm"})})})},c={args:{label:"Rules"},parameters:{a11y:{config:{rules:[{id:"button-name",enabled:!0}]}}},render:r.render},l={args:{disabled:!0},render:r.render,play:async({canvasElement:e})=>{const t=i(e);await b.hover(t.getByRole("button",{name:"Groups"})),await s(i(document.body).queryByRole("tooltip")).toBeNull()}},d={render:r.render,play:async({canvasElement:e})=>{const t=i(e),n=i(document.body),a=t.getByRole("button",{name:"Groups"});await s(a).not.toHaveAttribute("aria-describedby"),await b.hover(a);const g=await n.findByRole("tooltip",{},{timeout:2e3});await s(g).toHaveTextContent("Groups"),await s(a).toHaveAttribute("aria-describedby",g.id),await b.keyboard("{Escape}"),await h(()=>s(n.queryByRole("tooltip")).toBeNull())}},p={render:r.render,play:async({canvasElement:e})=>{const t=i(e),n=i(document.body),a=t.getByRole("button",{name:"Groups"});a.focus(),await s(await n.findByRole("tooltip",{},{timeout:2e3})).toHaveTextContent("Groups"),a.blur(),await h(()=>s(n.queryByRole("tooltip")).toBeNull())}},u={render:()=>o.jsx("div",{className:"flex items-center gap-0.5",children:[["Users","user"],["Groups","users"],["Rules","bolt"],["Policies","shield"]].map(([e,t])=>o.jsx(m,{label:e,children:n=>o.jsx("button",{type:"button","aria-label":e,className:"rounded-md p-2.5 text-neutral-600 transition-colors duration-(--dur-instant) hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-primary",...n,children:o.jsx(y,{type:t,size:"sm"})})},e))})};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: args => <Tooltip {...args}>
      {trigger => <button type="button" aria-label={args.label} className="rounded-md p-2.5 text-neutral-600 transition-colors duration-(--dur-instant) hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-primary" {...trigger}>
          <Icon type="users" size="sm" />
        </button>}
    </Tooltip>
}`,...r.parameters?.docs?.source},description:{story:"The reference shape: an icon-only button that keeps its own `aria-label`.",...r.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Rules'
  },
  parameters: {
    a11y: {
      // The point of this story: an icon-only trigger keeps a real accessible name.
      config: {
        rules: [{
          id: 'button-name',
          enabled: true
        }]
      }
    }
  },
  render: Default.render
}`,...c.parameters?.docs?.source},description:{story:"The tooltip describes and the `aria-label` names; the chip never becomes the only name.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  },
  render: Default.render,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole('button', {
      name: 'Groups'
    }));
    await expect(within(document.body).queryByRole('tooltip')).toBeNull();
  }
}`,...l.parameters?.docs?.source},description:{story:"`disabled` renders the trigger unchanged and suppresses only the chip.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: Default.render,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    const trigger = canvas.getByRole('button', {
      name: 'Groups'
    });
    await expect(trigger).not.toHaveAttribute('aria-describedby');
    await userEvent.hover(trigger);
    const chip = await body.findByRole('tooltip', {}, {
      timeout: 2000
    });
    await expect(chip).toHaveTextContent('Groups');
    await expect(trigger).toHaveAttribute('aria-describedby', chip.id);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('tooltip')).toBeNull());
  }
}`,...d.parameters?.docs?.source},description:{story:"Hovering past the intent delay opens the chip; Escape closes it again.",...d.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  render: Default.render,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    const trigger = canvas.getByRole('button', {
      name: 'Groups'
    });
    trigger.focus();
    await expect(await body.findByRole('tooltip', {}, {
      timeout: 2000
    })).toHaveTextContent('Groups');
    trigger.blur();
    await waitFor(() => expect(body.queryByRole('tooltip')).toBeNull());
  }
}`,...p.parameters?.docs?.source},description:{story:"The keyboard path: focusing the trigger opens the same chip, blur closes it.",...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-0.5">
      {([['Users', 'user'], ['Groups', 'users'], ['Rules', 'bolt'], ['Policies', 'shield']] as const).map(([label, icon]) => <Tooltip key={label} label={label}>
          {trigger => <button type="button" aria-label={label} className="rounded-md p-2.5 text-neutral-600 transition-colors duration-(--dur-instant) hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-primary" {...trigger}>
              <Icon type={icon} size="sm" />
            </button>}
        </Tooltip>)}
    </div>
}`,...u.parameters?.docs?.source},description:{story:"Several triggers side by side — the case the hover-intent delay exists for.",...u.parameters?.docs?.description}}};const x=["Default","AccessibleName","Disabled","Opening","OpensOnFocus","InARow"];export{c as AccessibleName,r as Default,l as Disabled,u as InARow,d as Opening,p as OpensOnFocus,x as __namedExportsOrder,f as default};
