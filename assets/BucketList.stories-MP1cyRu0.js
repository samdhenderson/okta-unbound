import{B as u}from"./BucketList-DzYaL5aO.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./BucketRow-vch5wUdz.js";import"./hatches-BX4G6Stx.js";import"./RackLegend-DSZtnY8F.js";const b={title:"Sidepanel/Activity/BucketList",component:u,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:`The bucket rack of the expanded activity bar. Lanes are identical because the question is comparative: which endpoint family is holding everything up?

Every published bucket gets a lane — no filter, no row cap, no summary line. A lane appears when the scheduler starts tracking a bucket and disappears when the scheduler forgets it; the rack renders retention and has no retention policy of its own. Height is bounded by scrolling rather than truncating.`}}},argTypes:{buckets:{description:"Buckets as published by the scheduler, most-pressured first."},lowThresholdPercent:{description:"The org-learned percentage at which the scheduler backs off."},now:{description:"Shared clock tick in epoch ms, so every countdown in the bar agrees."}}},t=176e10;function e(c){return{limit:600,remaining:600,resetAt:t+6e4,queued:0,active:0,planned:0,gatedUntil:null,lastActiveAt:null,...c}}const n={args:{buckets:[e({bucket:"/api/v1/users"}),e({bucket:"/api/v1/groups"}),e({bucket:"/api/v1/policies"})],lowThresholdPercent:10,now:t}},i={args:{buckets:[e({bucket:"/api/v1/users",remaining:288,active:4,queued:26,planned:470,lastActiveAt:t-400}),e({bucket:"/api/v1/groups",remaining:512,active:3,queued:8,lastActiveAt:t-900}),e({bucket:"/api/v1/apps",limit:300,remaining:24,active:1,lastActiveAt:t}),e({bucket:"/api/v1/policies"})],lowThresholdPercent:10,now:t}},a={args:{buckets:[e({bucket:"/api/v1/users",limit:null,remaining:null,resetAt:null,lastActiveAt:t-95e3}),e({bucket:"/api/v1/groups",limit:null,remaining:null,resetAt:null,lastActiveAt:t-8e3}),e({bucket:"/api/v1/policies"})],lowThresholdPercent:10,now:t}},s={args:{buckets:[e({bucket:"/api/v1/users",remaining:18,queued:40,planned:500,gatedUntil:t+24e3,lastActiveAt:t-1e3}),e({bucket:"/api/v1/groups",remaining:540,active:4,lastActiveAt:t-200}),e({bucket:"/api/v1/meta",limit:null,remaining:null,resetAt:null})],lowThresholdPercent:10,now:t}},r={args:{buckets:[e({bucket:"/api/v1/users",limit:600,remaining:90,active:4,queued:120}),e({bucket:"/api/v1/groups",limit:600,remaining:410,active:2,queued:18}),e({bucket:"/api/v1/apps",limit:300,remaining:22,gatedUntil:t+24e3}),e({bucket:"/api/v1/zones",queued:2,lastActiveAt:t-400}),e({bucket:"/api/v1/policies",lastActiveAt:t-4e4}),e({bucket:"/api/v1/meta",limit:null,remaining:null,resetAt:null,active:1}),e({bucket:"/api/v1/idps"})],lowThresholdPercent:10,now:t}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    buckets: [bucket({
      bucket: '/api/v1/users'
    }), bucket({
      bucket: '/api/v1/groups'
    }), bucket({
      bucket: '/api/v1/policies'
    })],
    lowThresholdPercent: 10,
    now: NOW
  }
}`,...n.parameters?.docs?.source},description:{story:"Nothing has been exercised: every family collapses to one grey line.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    buckets: [bucket({
      bucket: '/api/v1/users',
      remaining: 288,
      active: 4,
      queued: 26,
      planned: 470,
      lastActiveAt: NOW - 400
    }), bucket({
      bucket: '/api/v1/groups',
      remaining: 512,
      active: 3,
      queued: 8,
      lastActiveAt: NOW - 900
    }), bucket({
      bucket: '/api/v1/apps',
      limit: 300,
      remaining: 24,
      active: 1,
      lastActiveAt: NOW
    }), bucket({
      bucket: '/api/v1/policies'
    })],
    lowThresholdPercent: 10,
    now: NOW
  }
}`,...i.parameters?.docs?.source},description:{story:"A walk under way: three families working in parallel, which is what the rack is for.",...i.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    buckets: [bucket({
      bucket: '/api/v1/users',
      limit: null,
      remaining: null,
      resetAt: null,
      lastActiveAt: NOW - 95_000
    }), bucket({
      bucket: '/api/v1/groups',
      limit: null,
      remaining: null,
      resetAt: null,
      lastActiveAt: NOW - 8_000
    }), bucket({
      bucket: '/api/v1/policies'
    })],
    lowThresholdPercent: 10,
    now: NOW
  }
}`,...a.parameters?.docs?.source},description:{story:`A minute after the walk: the lanes survive, but they are empty, say **at rest** and
carry no budget figure. The one number is an age, and it is labelled as one.`,...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    buckets: [bucket({
      bucket: '/api/v1/users',
      remaining: 18,
      queued: 40,
      planned: 500,
      gatedUntil: NOW + 24_000,
      lastActiveAt: NOW - 1_000
    }), bucket({
      bucket: '/api/v1/groups',
      remaining: 540,
      active: 4,
      lastActiveAt: NOW - 200
    }), bucket({
      bucket: '/api/v1/meta',
      limit: null,
      remaining: null,
      resetAt: null
    })],
    lowThresholdPercent: 10,
    now: NOW
  }
}`,...s.parameters?.docs?.source},description:{story:"One family gated: the lane is hatched and carries its own countdown, not the global one.",...s.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    buckets: [bucket({
      bucket: '/api/v1/users',
      limit: 600,
      remaining: 90,
      active: 4,
      queued: 120
    }), bucket({
      bucket: '/api/v1/groups',
      limit: 600,
      remaining: 410,
      active: 2,
      queued: 18
    }), bucket({
      bucket: '/api/v1/apps',
      limit: 300,
      remaining: 22,
      gatedUntil: NOW + 24_000
    }), bucket({
      bucket: '/api/v1/zones',
      queued: 2,
      lastActiveAt: NOW - 400
    }), bucket({
      bucket: '/api/v1/policies',
      lastActiveAt: NOW - 40_000
    }), bucket({
      bucket: '/api/v1/meta',
      limit: null,
      remaining: null,
      resetAt: null,
      active: 1
    }), bucket({
      bucket: '/api/v1/idps'
    })],
    lowThresholdPercent: 10,
    now: NOW
  }
}`,...r.parameters?.docs?.source},description:{story:"Seven families at once: every one keeps its lane, and the rack scrolls rather than summarising.",...r.parameters?.docs?.description}}};const v=["NothingExercised","WorkInParallel","RememberedAtRest","OneFamilyGated","EveryBucketKeepsItsLane"];export{r as EveryBucketKeepsItsLane,n as NothingExercised,s as OneFamilyGated,a as RememberedAtRest,i as WorkInParallel,v as __namedExportsOrder,b as default};
