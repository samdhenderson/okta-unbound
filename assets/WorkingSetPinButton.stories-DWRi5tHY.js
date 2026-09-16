import{af as c}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:s,fn:d,within:l}=__STORYBOOK_MODULE_TEST__,u={title:"Shared/WorkingSetPinButton",component:c,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"The pin that keeps an entity on the Home tab, rendered in `PageHeader`'s `cornerAction` slot.\n\nIt carries no visible label, because `ContextBar` already has a control called **Pin** with a different meaning. Its accessible name resolves that: *Pin to Home* names the destination rather than the action. One button in two states, so the state is announced through `aria-pressed`."}}},argTypes:{pinned:{description:"Whether the entity is currently on Home."},onToggle:{description:"Pin it, or release it."},disabled:{description:"Held while the entity is still resolving and has no name to record."}},args:{pinned:!1,onToggle:d()}},n={play:async({args:e,canvas:t,userEvent:r})=>{const i=t.getByRole("button",{name:"Pin to Home"});await s(i).toHaveAttribute("aria-pressed","false"),await r.click(i),await s(e.onToggle).toHaveBeenCalled()}},a={args:{pinned:!0},play:async({canvasElement:e})=>{const t=l(e).getByRole("button",{name:"Unpin from Home"});await s(t).toHaveAttribute("aria-pressed","true")}},o={args:{disabled:!0},play:async({args:e,canvas:t,userEvent:r})=>{await r.click(t.getByRole("button",{name:"Pin to Home"})),await s(e.onToggle).not.toHaveBeenCalled()}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    const button = canvas.getByRole('button', {
      name: 'Pin to Home'
    });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    await expect(args.onToggle).toHaveBeenCalled();
  }
}`,...n.parameters?.docs?.source},description:{story:"Not pinned. The accessible name says where pressing it puts the entity.",...n.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    pinned: true
  },
  play: async ({
    canvasElement
  }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Unpin from Home'
    });
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
}`,...a.parameters?.docs?.source},description:{story:"Already on Home — the same button, pressed.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  },
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: 'Pin to Home'
    }));
    await expect(args.onToggle).not.toHaveBeenCalled();
  }
}`,...o.parameters?.docs?.source},description:{story:"Held until the entity has a name to record — the press never reaches the handler.",...o.parameters?.docs?.description}}};const g=["Unpinned","Pinned","Disabled"];export{o as Disabled,a as Pinned,n as Unpinned,g as __namedExportsOrder,u as default};
