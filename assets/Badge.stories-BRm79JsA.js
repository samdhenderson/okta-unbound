import{a as r,j as e}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const d={title:"Shared/Badge",component:r,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"A small status or type mark. Variants follow the shared status vocabulary (`success | warning | danger | info`, never `error`), plus `neutral` for an uncolored mark and `primary` for entity type/identity. A badge is a label, not a control — if it needs a click handler, use `FilterPill` or `Button`."}}},argTypes:{children:{description:"Badge label — a word or two."},variant:{description:"Colour treatment. Defaults to `neutral`."},solid:{description:"Render the filled treatment instead of the tinted one."},title:{description:"Native `title` tooltip."},className:{description:"Extra classes merged after the variant classes."},testId:{description:"Optional test handle."}},args:{children:"Active"}},a={args:{variant:"neutral",children:"Okta group"}},t={render:()=>e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(r,{variant:"neutral",children:"Built-in"}),e.jsx(r,{variant:"primary",children:"Okta group"}),e.jsx(r,{variant:"info",children:"Rule"}),e.jsx(r,{variant:"success",children:"Active"}),e.jsx(r,{variant:"warning",children:"Suspended"}),e.jsx(r,{variant:"danger",children:"Deprovisioned"})]})},n={render:()=>e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(r,{variant:"primary",solid:!0,children:"Current group"}),e.jsx(r,{variant:"primary",children:"Okta group"}),e.jsx(r,{variant:"neutral",children:"412 members"})]})},i={args:{variant:"warning",children:"App group",title:"Mastered by an application, which manages its own members."}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'neutral',
    children: 'Okta group'
  }
}`,...a.parameters?.docs?.source},description:{story:"The default, uncolored mark.",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap items-center gap-2">
      <Badge variant="neutral">Built-in</Badge>
      <Badge variant="primary">Okta group</Badge>
      <Badge variant="info">Rule</Badge>
      <Badge variant="success">Active</Badge>
      <Badge variant="warning">Suspended</Badge>
      <Badge variant="danger">Deprovisioned</Badge>
    </div>
}`,...t.parameters?.docs?.source},description:{story:"Every tinted treatment on one row.",...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap items-center gap-2">
      <Badge variant="primary" solid>
        Current group
      </Badge>
      <Badge variant="primary">Okta group</Badge>
      <Badge variant="neutral">412 members</Badge>
    </div>
}`,...n.parameters?.docs?.source},description:{story:"The filled treatment beside the tinted marks it outranks.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'warning',
    children: 'App group',
    title: 'Mastered by an application, which manages its own members.'
  }
}`,...i.parameters?.docs?.source}}};const c=["Default","AllVariants","Solid","WithTooltip"];export{t as AllVariants,a as Default,n as Solid,i as WithTooltip,c as __namedExportsOrder,d as default};
