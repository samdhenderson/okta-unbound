import{B as p}from"./BucketRow-vch5wUdz.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./hatches-BX4G6Stx.js";const b={title:"Sidepanel/Activity/BucketRow",component:p,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"One lane of the bucket rack. The track is the budget, not the shape of the work: its denominator is `remaining`, running requests fill solid, queued and planned work continues dashed, and the pale tail is the headroom left once this work drains. Declared work past the remaining budget saturates the track and removes the tail.\n\nA lane with no denominator never invents one — a remembered bucket draws an empty track and says **at rest**, and a bucket Okta has not reported on draws a faint hatch and states only its counts. Every magnitude drawn is also stated in words, nothing depends on hue, and every pattern is static."}}},argTypes:{bucket:{description:"The bucket state as published by the scheduler."},lowThresholdPercent:{description:"The org-learned percentage at which the scheduler backs off."},now:{description:"Shared clock tick in epoch ms, so every countdown in the bar agrees."}}},e=176e10;function n(l){return{limit:600,remaining:600,resetAt:e+6e4,queued:0,active:0,planned:0,gatedUntil:null,lastActiveAt:null,...l}}const t={args:{bucket:n({bucket:"/api/v1/groups"}),lowThresholdPercent:10,now:e}},r={args:{bucket:n({bucket:"/api/v1/users",remaining:380,planned:812}),lowThresholdPercent:10,now:e}},s={args:{bucket:n({bucket:"/api/v1/users",remaining:288,active:4,queued:26,planned:300}),lowThresholdPercent:10,now:e}},a={args:{bucket:n({bucket:"/api/v1/apps",limit:300,remaining:27,queued:12,planned:96}),lowThresholdPercent:10,now:e}},o={args:{bucket:n({bucket:"/api/v1/users",limit:600,remaining:18,queued:40,planned:500,gatedUntil:e+24e3}),lowThresholdPercent:10,now:e}},i={args:{bucket:n({bucket:"/api/v1/users",limit:600,remaining:60,active:4,queued:240}),lowThresholdPercent:10,now:e}},c={args:{bucket:n({bucket:"/api/v1/users",limit:null,remaining:null,resetAt:null,lastActiveAt:e-125e3}),lowThresholdPercent:10,now:e}},d={args:{bucket:n({bucket:"/api/v1/users",limit:null,remaining:null,resetAt:null}),lowThresholdPercent:10,now:e}},u={args:{bucket:n({bucket:"/api/v1/meta",limit:null,remaining:null,resetAt:null,planned:2}),lowThresholdPercent:10,now:e}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    bucket: bucket({
      bucket: '/api/v1/groups'
    }),
    lowThresholdPercent: 10,
    now: NOW
  }
}`,...t.parameters?.docs?.source},description:{story:"Full headroom, nothing happening.",...t.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    bucket: bucket({
      bucket: '/api/v1/users',
      remaining: 380,
      planned: 812
    }),
    lowThresholdPercent: 10,
    now: NOW
  }
}`,...r.parameters?.docs?.source},description:{story:"Work declared but not yet enqueued, drawn as a dashed claim on the remaining budget.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    bucket: bucket({
      bucket: '/api/v1/users',
      remaining: 288,
      active: 4,
      queued: 26,
      planned: 300
    }),
    lowThresholdPercent: 10,
    now: NOW
  }
}`,...s.parameters?.docs?.source},description:{story:"Running, queued and planned at once — solid, then dashed, then the pale tail.",...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    bucket: bucket({
      bucket: '/api/v1/apps',
      limit: 300,
      remaining: 27,
      queued: 12,
      planned: 96
    }),
    lowThresholdPercent: 10,
    now: NOW
  }
}`,...a.parameters?.docs?.source},description:{story:"Below the org's warning threshold — the row colours at the scheduler's line.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    bucket: bucket({
      bucket: '/api/v1/users',
      limit: 600,
      remaining: 18,
      queued: 40,
      planned: 500,
      gatedUntil: NOW + 24_000
    }),
    lowThresholdPercent: 10,
    now: NOW
  }
}`,...o.parameters?.docs?.source},description:{story:"Gated: the countdown is to the moment this bucket's own gate lifts.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    bucket: bucket({
      bucket: '/api/v1/users',
      limit: 600,
      remaining: 60,
      active: 4,
      queued: 240
    }),
    lowThresholdPercent: 10,
    now: NOW
  }
}`,...i.parameters?.docs?.source},description:{story:"240 requests queued against 60 remaining: the track saturates and the tail is gone.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    bucket: bucket({
      bucket: '/api/v1/users',
      limit: null,
      remaining: null,
      resetAt: null,
      lastActiveAt: NOW - 125_000
    }),
    lowThresholdPercent: 10,
    now: NOW
  }
}`,...c.parameters?.docs?.source},description:{story:"Remembered after its work drained: an empty lane, the words “at rest”, and no budget figure.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    bucket: bucket({
      bucket: '/api/v1/users',
      limit: null,
      remaining: null,
      resetAt: null
    }),
    lowThresholdPercent: 10,
    now: NOW
  }
}`,...d.parameters?.docs?.source},description:{story:"The same lane after a service-worker eviction: `lastActiveAt` is `null`, so no timestamp is fabricated.",...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    bucket: bucket({
      bucket: '/api/v1/meta',
      limit: null,
      remaining: null,
      resetAt: null,
      planned: 2
    }),
    lowThresholdPercent: 10,
    now: NOW
  }
}`,...u.parameters?.docs?.source},description:{story:"No headers for this family, so no denominator and no scale — a faint hatch and the counts in words.",...u.parameters?.docs?.description}}};const w=["Healthy","PlannedWork","FullPipeline","LowHeadroom","Cooling","WorkExceedsBudget","AtRest","AtRestWorkerEvicted","NotReported"];export{c as AtRest,d as AtRestWorkerEvicted,o as Cooling,s as FullPipeline,t as Healthy,a as LowHeadroom,u as NotReported,r as PlannedWork,i as WorkExceedsBudget,w as __namedExportsOrder,b as default};
