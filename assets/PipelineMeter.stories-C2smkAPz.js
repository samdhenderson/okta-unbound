import{P as a}from"./PipelineMeter-BzIGys_V.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const p={title:"Sidepanel/Activity/PipelineMeter",component:a,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"The four-state pipeline bar used by the expanded activity bar. Segments run in pipeline order — **spent** → **in flight** → **queued** → **planned** — each a solid fill sized by its share of the declared total. The planned share renders identically whether the plan sized it exactly or estimated it."}}},argTypes:{counts:{description:"Requests in each pipeline state."},label:{description:"Accessible description — the meter is content, not decoration."}}},e={args:{counts:{spent:0,active:0,queued:0,planned:0},label:"No requests"}},n={args:{counts:{spent:312,active:4,queued:26,planned:470},label:"312 spent, 4 in flight, 26 queued, 470 planned"}},t={args:{counts:{spent:0,active:0,queued:0,planned:812},label:"812 planned"}},s={args:{counts:{spent:812,active:0,queued:0,planned:0},label:"812 spent"}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    counts: {
      spent: 0,
      active: 0,
      queued: 0,
      planned: 0
    },
    label: 'No requests'
  }
}`,...e.parameters?.docs?.source},description:{story:"Nothing yet — an empty track, so a row that gains work does not change height.",...e.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    counts: {
      spent: 312,
      active: 4,
      queued: 26,
      planned: 470
    },
    label: '312 spent, 4 in flight, 26 queued, 470 planned'
  }
}`,...n.parameters?.docs?.source},description:{story:"An export part-way through a walk whose length is now known exactly.",...n.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    counts: {
      spent: 0,
      active: 0,
      queued: 0,
      planned: 812
    },
    label: '812 planned'
  }
}`,...t.parameters?.docs?.source},description:{story:"Declared but not started: everything is still ahead.",...t.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    counts: {
      spent: 812,
      active: 0,
      queued: 0,
      planned: 0
    },
    label: '812 spent'
  }
}`,...s.parameters?.docs?.source},description:{story:"Finished — the whole track is spent budget.",...s.parameters?.docs?.description}}};const c=["Empty","PartlySpent","AllPlanned","Complete"];export{t as AllPlanned,s as Complete,e as Empty,n as PartlySpent,c as __namedExportsOrder,p as default};
