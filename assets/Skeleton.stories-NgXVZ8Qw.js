import{f as i,j as d}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const m={title:"Shared/Skeleton",component:i,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'A shimmering placeholder for content whose shape is already known: `text` (a single line), `row` (a list-row block), `card` (a stat/summary block). `count` renders N repeats under one staggered entrance. The visual bones are `aria-hidden`; a single `role="status"` node carries the accessible name. For unknown-shape or unknown-duration work use `LoadingSpinner` instead.'}}},argTypes:{variant:{description:"Placeholder shape. Defaults to `text`."},size:{description:"Line thickness (`text`) or block padding (`row`/`card`). Defaults to `md`."},count:{description:"Number of repeated blocks. Defaults to `1`."},width:{description:"Tailwind width class for the `text` line (e.g. `w-1/2`). Defaults to `w-full`."},label:{description:'Accessible name for the `role="status"` node. Defaults to `"Loading"`.'},className:{description:"Extra classes merged onto the outer wrapper."}},args:{variant:"text"}},e={},r={args:{width:"w-1/2"}},a={args:{variant:"row"},parameters:{layout:"padded"}},s={args:{variant:"row",count:3,label:"Loading members"},parameters:{layout:"padded",motion:"on"}},t={args:{variant:"card"},parameters:{layout:"padded"}},o={args:{variant:"card",count:4,label:"Loading stats"},parameters:{layout:"padded",motion:"on"}},n={args:{variant:"row"},parameters:{layout:"padded"},render:c=>d.jsxs("div",{className:"space-y-3",children:[d.jsx(i,{...c,size:"sm"}),d.jsx(i,{...c,size:"md"}),d.jsx(i,{...c,size:"lg"})]})};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:"A single text line, full width.",...e.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    width: 'w-1/2'
  }
}`,...r.parameters?.docs?.source},description:{story:"A narrower text line.",...r.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'row'
  },
  parameters: {
    layout: 'padded'
  }
}`,...a.parameters?.docs?.source},description:{story:"One list-row placeholder, at `GroupListItem`/`MemberRow` height.",...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'row',
    count: 3,
    label: 'Loading members'
  },
  parameters: {
    layout: 'padded',
    motion: 'on'
  }
}`,...s.parameters?.docs?.source},description:{story:'The common "list is loading" shape.',...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'card'
  },
  parameters: {
    layout: 'padded'
  }
}`,...t.parameters?.docs?.source},description:{story:"One stat/summary card placeholder, at `StatCard` height.",...t.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'card',
    count: 4,
    label: 'Loading stats'
  },
  parameters: {
    layout: 'padded',
    motion: 'on'
  }
}`,...o.parameters?.docs?.source},description:{story:'The "stat grid is loading" shape.',...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'row'
  },
  parameters: {
    layout: 'padded'
  },
  render: args => <div className="space-y-3">
      <Skeleton {...args} size="sm" />
      <Skeleton {...args} size="md" />
      <Skeleton {...args} size="lg" />
    </div>
}`,...n.parameters?.docs?.source},description:{story:"The three sizes, on the `row` variant.",...n.parameters?.docs?.description}}};const u=["Default","TextNarrow","Row","RowCount","Card","CardCount","Sizes"];export{t as Card,o as CardCount,e as Default,a as Row,s as RowCount,n as Sizes,r as TextNarrow,u as __namedExportsOrder,m as default};
