import{E as m}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:l,fn:e,userEvent:u,within:g}=__STORYBOOK_MODULE_TEST__,C={title:"Shared/EmptyState",component:m,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"Centered “no content” placeholder — icon badge, title, description, and optional actions — for empty lists, no-results, first-run, error and permission states. Each action renders as a shared `Button` (defaulting to `primary`); the row is omitted entirely when `actions` is empty."}}},argTypes:{icon:{description:"Icon glyph shown in the circular badge."},title:{description:"Bold headline."},description:{description:"Supporting explanatory copy."},actions:{description:"Optional action buttons (rendered only when non-empty)."},className:{description:"Extra classes merged onto the outer container."}},args:{icon:"search",title:"No results found",description:"Try adjusting your search or filter criteria"}},n={},t={args:{actions:[{label:"Clear Filters",onClick:e()}]}},r={args:{actions:[{label:"Clear Filters",onClick:e()},{label:"Try Again",onClick:e(),variant:"secondary"}]},play:async({args:c,canvasElement:d})=>{const p=g(d);await u.click(p.getByRole("button",{name:"Try Again"})),await l(c.actions?.[1].onClick).toHaveBeenCalledTimes(1),await l(c.actions?.[0].onClick).not.toHaveBeenCalled()}},o={args:{icon:"users",title:"No users yet",description:"Start by adding your first user to this group",actions:[{label:"Add User",onClick:e(),variant:"primary"}]}},a={args:{icon:"alert",title:"Something went wrong",description:"We encountered an error while loading your data",actions:[{label:"Reload",onClick:e(),variant:"primary"}]}},s={args:{icon:"lock",title:"Access denied",description:"You do not have permission to view this content"}},i={args:{icon:"settings",title:"No settings configured",description:"Configure your preferences to get started",actions:[{label:"Configure Now",onClick:e(),variant:"secondary"}]}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"Default without actions.",...n.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    actions: [{
      label: 'Clear Filters',
      onClick: fn()
    }]
  }
}`,...t.parameters?.docs?.source},description:{story:"With a single primary action.",...t.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    actions: [{
      label: 'Clear Filters',
      onClick: fn()
    }, {
      label: 'Try Again',
      onClick: fn(),
      variant: 'secondary'
    }]
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Try Again'
    }));
    await expect(args.actions?.[1].onClick).toHaveBeenCalledTimes(1);
    await expect(args.actions?.[0].onClick).not.toHaveBeenCalled();
  }
}`,...r.parameters?.docs?.source},description:{story:"Two actions, each wired to its own handler.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    icon: 'users',
    title: 'No users yet',
    description: 'Start by adding your first user to this group',
    actions: [{
      label: 'Add User',
      onClick: fn(),
      variant: 'primary'
    }]
  }
}`,...o.parameters?.docs?.source},description:{story:"Empty list variant.",...o.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    icon: 'alert',
    title: 'Something went wrong',
    description: 'We encountered an error while loading your data',
    actions: [{
      label: 'Reload',
      onClick: fn(),
      variant: 'primary'
    }]
  }
}`,...a.parameters?.docs?.source},description:{story:"Error state variant.",...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    icon: 'lock',
    title: 'Access denied',
    description: 'You do not have permission to view this content'
  }
}`,...s.parameters?.docs?.source},description:{story:"Lockout/permission state.",...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    icon: 'settings',
    title: 'No settings configured',
    description: 'Configure your preferences to get started',
    actions: [{
      label: 'Configure Now',
      onClick: fn(),
      variant: 'secondary'
    }]
  }
}`,...i.parameters?.docs?.source},description:{story:"Secondary action variant.",...i.parameters?.docs?.description}}};const f=["Default","WithAction","WithMultipleActions","Empty","ErrorState","NoPermission","SecondaryAction"];export{n as Default,o as Empty,a as ErrorState,s as NoPermission,i as SecondaryAction,t as WithAction,r as WithMultipleActions,f as __namedExportsOrder,C as default};
