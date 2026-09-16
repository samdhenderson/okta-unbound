import{R as r}from"./ResetTimeline-B4mIrGPr.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const d={title:"Sidepanel/Activity/ResetTimeline",component:r,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"The reset timeline, shown only while a gate is armed. Each cooling-down bucket gets a mark on one axis, so their return order is a glance rather than a subtraction. The axis is at least sixty seconds wide, and with nothing gated the component renders nothing at all."}}},argTypes:{buckets:{description:"Buckets as published by the scheduler."},now:{description:"Shared clock tick in epoch ms, so the whole bar agrees on the time."}}},e=176e10;function t(s){return{limit:600,remaining:600,resetAt:e+6e4,queued:0,active:0,planned:0,gatedUntil:null,lastActiveAt:null,...s}}const n={args:{buckets:[t({bucket:"/api/v1/users",remaining:12,gatedUntil:e+24e3})],now:e}},a={args:{buckets:[t({bucket:"/api/v1/apps",remaining:4,gatedUntil:e+95e3}),t({bucket:"/api/v1/users",remaining:9,gatedUntil:e+18e3}),t({bucket:"/api/v1/groups",remaining:21,gatedUntil:e+47e3}),t({bucket:"/api/v1/policies"})],now:e}},i={args:{buckets:[t({bucket:"/api/v1/apps",remaining:0,gatedUntil:e+24e4})],now:e}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    buckets: [bucket({
      bucket: '/api/v1/users',
      remaining: 12,
      gatedUntil: NOW + 24_000
    })],
    now: NOW
  }
}`,...n.parameters?.docs?.source},description:{story:"One bucket cooling down, on the minimum axis.",...n.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    buckets: [bucket({
      bucket: '/api/v1/apps',
      remaining: 4,
      gatedUntil: NOW + 95_000
    }), bucket({
      bucket: '/api/v1/users',
      remaining: 9,
      gatedUntil: NOW + 18_000
    }), bucket({
      bucket: '/api/v1/groups',
      remaining: 21,
      gatedUntil: NOW + 47_000
    }), bucket({
      bucket: '/api/v1/policies'
    })],
    now: NOW
  }
}`,...a.parameters?.docs?.source},description:{story:"Three at once — the ordering the component exists for.",...a.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    buckets: [bucket({
      bucket: '/api/v1/apps',
      remaining: 0,
      gatedUntil: NOW + 240_000
    })],
    now: NOW
  }
}`,...i.parameters?.docs?.source},description:{story:"A long gate widens the axis past a minute rather than clipping.",...i.parameters?.docs?.description}}};const u=["SingleGate","StaggeredGates","LongCooldown"];export{i as LongCooldown,n as SingleGate,a as StaggeredGates,u as __namedExportsOrder,d as default};
