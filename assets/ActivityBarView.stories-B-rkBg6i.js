import{j as _,R as O}from"./iframe-tAvKsVeF.js";import{A as N}from"./ActivityBarView-Bo-E72KG.js";import{i as P}from"./decorators-D0l07Q7O.js";import"./preload-helper-PPVm8Dsz.js";import"./BucketList-DzYaL5aO.js";import"./BucketRow-vch5wUdz.js";import"./hatches-BX4G6Stx.js";import"./RackLegend-DSZtnY8F.js";import"./CondensedBar-BG5akcNn.js";import"./OperationList-CdprATOK.js";import"./OperationRow-VYbtlK_2.js";import"./PipelineMeter-BzIGys_V.js";import"./ResetTimeline-B4mIrGPr.js";const{expect:x,fn:V,userEvent:E,within:F}=__STORYBOOK_MODULE_TEST__,$={title:"Sidepanel/ActivityBarView",component:N,tags:["autodocs"],decorators:[P],parameters:{layout:"fullscreen",docs:{description:{component:"Pure presentation of the unified activity bar: a fixed bottom bar whose status region, one-line summary (queue · rate · ETA) and action area stay mounted, so values coming and going swap text in place instead of reflowing the row. Beneath it sits the bucket rack, one lane per rate-limit family the scheduler has exercised. A chevron condenses the whole thing to a 36px line — status, rate and a processed/progress tally — which is the state the bar boots into.\n\nEvery figure arrives as an already-merged `ActivityView`; timers and context wiring live in `useActivityBar`."}}},argTypes:{view:{description:"Merged, display-ready activity state (status, summary figures, the ETA range, buckets, progress, cancel flags)."},onCancel:{description:"Invoked when the user confirms cancellation of the current work."},onCancelOperation:{description:"Stops one declared operation, leaving every other one running."},collapsed:{description:"Whether the bar is condensed to its essentials."},onToggleCollapse:{description:"Toggles between the condensed and full layouts."}},args:{onCancel:V(),onCancelOperation:V(),onToggleCollapse:V()}},t=176e10,n={statusLabel:"Ready",statusColorVar:"var(--color-success)",busy:!1,operationActive:!1,current:0,total:0,percentage:0,opCompleted:0,opActive:0,opFailed:0,queueLength:0,activeRequests:0,rateLimit:null,eta:null,processed:0,failed:0,isCancelling:!1,canCancel:!1,buckets:[],lowThresholdPercent:10,operations:[],now:t},i={args:{view:n}},o={args:{view:{...n,statusLabel:"Processing",statusColorVar:"var(--color-info)",busy:!0,operationActive:!0,operationName:"Removing members",current:42,total:120,percentage:35,elapsedLabel:"0:18",eta:{kind:"point",lowerMs:34e3,label:"~0:34 left"},opCompleted:40,opActive:2,opFailed:0,queueLength:6,activeRequests:2,canCancel:!0}}},l={args:{view:{...n,statusLabel:"Processing",statusColorVar:"var(--color-info)",busy:!0,operationActive:!0,operationName:"Adding members",current:88,total:100,percentage:88,elapsedLabel:"1:02",eta:{kind:"point",lowerMs:8e3,label:"~0:08 left"},opCompleted:82,opActive:1,opFailed:5,queueLength:1,activeRequests:1,canCancel:!0}}},c={args:{view:{...n,statusLabel:"Throttled",statusColorVar:"var(--color-warning)",busy:!0,queueLength:14,activeRequests:3,rateLimit:{remaining:8,limit:100,low:!0},canCancel:!0}}},u={args:{view:{...n,statusLabel:"Cooldown",statusColorVar:"var(--color-danger)",busy:!0,queueLength:9,cooldownLabel:"12s",canCancel:!0}}},p={args:{view:{...n,processed:118,failed:3}}},d={args:{collapsed:!0,view:{...n,rateLimit:{remaining:480,limit:600,low:!1},processed:118,failed:3}}},m={args:{collapsed:!0,view:{...n,statusLabel:"Processing",statusColorVar:"var(--color-info)",busy:!0,operationActive:!0,operationName:"Removing members",current:42,total:120,percentage:35,opCompleted:40,opActive:2,opFailed:1,rateLimit:{remaining:90,limit:600,low:!1},queueLength:6,activeRequests:2,canCancel:!0}}},g={args:{collapsed:!1,view:{...n,statusLabel:"Processing",statusColorVar:"var(--color-info)",busy:!0,operationActive:!0,operationName:"Removing members",current:42,total:120,percentage:35,elapsedLabel:"0:18",eta:{kind:"point",lowerMs:34e3,label:"~0:34 left"},opCompleted:40,opActive:2,opFailed:0,rateLimit:{remaining:90,limit:600,low:!1},queueLength:6,activeRequests:2,canCancel:!0}}},v={args:{view:{...n,statusLabel:"Processing",statusColorVar:"var(--color-info)",busy:!0,operationActive:!0,operationName:"Removing members",current:10,total:50,percentage:20,opCompleted:10,opActive:0,opFailed:0,queueLength:3,isCancelling:!0,canCancel:!1}}};function e(a){return{limit:600,remaining:600,resetAt:t+6e4,queued:0,active:0,planned:0,gatedUntil:null,lastActiveAt:null,...a}}const b={args:{view:{...n,processed:128,buckets:[e({bucket:"/api/v1/users"}),e({bucket:"/api/v1/groups"}),e({bucket:"/api/v1/apps"}),e({bucket:"/api/v1/policies"}),e({bucket:"/api/v1/meta",limit:null,remaining:null,resetAt:null})]}}},w={args:{view:{...n,statusLabel:"Processing",statusColorVar:"var(--color-info)",busy:!0,operationActive:!0,operationName:"Export all users",current:312,total:812,percentage:38,opCompleted:312,opActive:4,queueLength:26,activeRequests:4,rateLimit:{remaining:288,limit:600,low:!1},canCancel:!0,buckets:[e({bucket:"/api/v1/users",remaining:288,active:4,queued:26,planned:470}),e({bucket:"/api/v1/groups"}),e({bucket:"/api/v1/policies"})]}}},h={args:{view:{...n,statusLabel:"Cooldown",statusColorVar:"var(--color-danger)",busy:!0,queueLength:40,rateLimit:{remaining:18,limit:600,low:!0},cooldownLabel:"24s",canCancel:!0,buckets:[e({bucket:"/api/v1/users",remaining:18,queued:40,planned:500,gatedUntil:t+24e3}),e({bucket:"/api/v1/apps",limit:300,remaining:81,queued:3,planned:402}),e({bucket:"/api/v1/groups"}),e({bucket:"/api/v1/policies"})]}}},k={args:{view:{...n,processed:1284,buckets:[e({bucket:"/api/v1/users",limit:null,remaining:null,resetAt:null,lastActiveAt:t-95e3}),e({bucket:"/api/v1/groups",limit:null,remaining:null,resetAt:null,lastActiveAt:t-6e3}),e({bucket:"/api/v1/apps",limit:null,remaining:null,resetAt:null}),e({bucket:"/api/v1/policies"})]}}},C={args:{view:{...n,statusLabel:"Processing",statusColorVar:"var(--color-info)",busy:!0,operationActive:!0,operationName:"Export all users",current:1,total:812,percentage:0,opCompleted:1,opActive:4,queueLength:30,activeRequests:4,rateLimit:{remaining:594,limit:600,low:!1},eta:{kind:"unknown",label:"estimating…"},canCancel:!0,buckets:[e({bucket:"/api/v1/users",remaining:594,active:4,queued:30,planned:778,lastActiveAt:t-1e3})]}}},y={args:{view:{...n,statusLabel:"Cooldown",statusColorVar:"var(--color-danger)",busy:!0,operationActive:!0,operationName:"Export all users",current:406,total:812,percentage:50,opCompleted:402,opActive:4,opFailed:4,queueLength:40,activeRequests:4,rateLimit:{remaining:18,limit:600,low:!0},eta:{kind:"range",lowerMs:8e4,upperMs:17e4,label:"1:20–2:50 left"},canCancel:!0,buckets:[e({bucket:"/api/v1/users",remaining:18,queued:40,planned:366,gatedUntil:t+9e4,lastActiveAt:t-2e3}),e({bucket:"/api/v1/groups",limit:600,remaining:540,active:4,lastActiveAt:t-500})]}}};function R(a,r,s=0){return{id:`${a}-leg`,bucket:a,method:"GET",estimated:r,spent:s,remaining:r===null?null:Math.max(0,r-s),approximate:!1}}const f={args:{view:{...n,statusLabel:"Processing",statusColorVar:"var(--color-info)",busy:!0,operationActive:!0,operationName:"Export all users",current:312,total:812,percentage:38,opCompleted:312,opActive:4,queueLength:26,activeRequests:4,rateLimit:{remaining:288,limit:600,low:!1},canCancel:!0,buckets:[e({bucket:"/api/v1/users",remaining:288,active:4,queued:26,planned:470}),e({bucket:"/api/v1/groups",active:1,planned:2})],operations:[{id:"export",name:"Export all users",startedAt:t-9e4,legs:[R("/api/v1/users",812,342)],spent:342,estimated:812,remaining:470,approximate:!1},{id:"search",name:"Search groups",startedAt:t-2e3,legs:[R("/api/v1/groups",3,1)],spent:1,estimated:3,remaining:2,approximate:!0}]}}},A={args:{view:{...n,statusLabel:"Cooldown",statusColorVar:"var(--color-danger)",busy:!0,queueLength:40,rateLimit:{remaining:18,limit:600,low:!0},cooldownLabel:"24s",canCancel:!0,buckets:[e({bucket:"/api/v1/users",remaining:18,queued:40,planned:470,gatedUntil:t+24e3}),e({bucket:"/api/v1/apps",limit:300,remaining:4,queued:3,planned:402,gatedUntil:t+95e3}),e({bucket:"/api/v1/groups"})],operations:[{id:"export",name:"Export all users",startedAt:t-9e4,legs:[R("/api/v1/users",812,342)],spent:342,estimated:812,remaining:470,approximate:!1},{id:"assignments",name:"Count app assignments",startedAt:t-3e4,legs:[R("/api/v1/apps",402,0)],spent:0,estimated:402,remaining:402,approximate:!0}]}}},T=a=>{const[r,s]=O.useState(!0);return _.jsx(N,{...a,collapsed:r,onToggleCollapse:()=>s(S=>!S)})},L={args:{view:{...n,statusLabel:"Processing",statusColorVar:"var(--color-info)",busy:!0,operationActive:!0,operationName:"Removing members",current:42,total:120,percentage:35,eta:{kind:"point",lowerMs:34e3,label:"~0:34 left"},opCompleted:40,opActive:2,queueLength:6,activeRequests:2,rateLimit:{remaining:90,limit:600,low:!1},canCancel:!0,buckets:[e({bucket:"/api/v1/users",remaining:90,active:2,queued:6})]}},render:a=>_.jsx(T,{...a}),play:async({canvasElement:a})=>{const r=F(a);await E.click(await r.findByRole("button",{name:"Show all activity stats"})),await x(await r.findByTestId("activity-operation-name")).toHaveTextContent("Removing members"),await E.click(await r.findByRole("button",{name:"Hide extra activity stats"})),await x(await r.findByRole("button",{name:"Show all activity stats"})).toBeInTheDocument()}},q={args:{view:{...n,statusLabel:"Processing",statusColorVar:"var(--color-info)",busy:!0,operationActive:!0,operationName:"Removing members",current:10,total:50,percentage:20,opCompleted:10,queueLength:3,canCancel:!0}},play:async({args:a,canvasElement:r})=>{const s=F(r);await E.click(await s.findByRole("button",{name:"Cancel"})),await x(a.onCancel).toHaveBeenCalled()}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    view: idleView
  }
}`,...i.parameters?.docs?.source},description:{story:"Fully idle — nothing queued, nothing processed, cancel disabled.",...i.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Removing members',
      current: 42,
      total: 120,
      percentage: 35,
      elapsedLabel: '0:18',
      eta: {
        kind: 'point',
        lowerMs: 34_000,
        label: '~0:34 left'
      },
      opCompleted: 40,
      opActive: 2,
      opFailed: 0,
      queueLength: 6,
      activeRequests: 2,
      canCancel: true
    }
  }
}`,...o.parameters?.docs?.source},description:{story:"A named batch operation in progress with the full breakdown row.",...o.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Adding members',
      current: 88,
      total: 100,
      percentage: 88,
      elapsedLabel: '1:02',
      eta: {
        kind: 'point',
        lowerMs: 8_000,
        label: '~0:08 left'
      },
      opCompleted: 82,
      opActive: 1,
      opFailed: 5,
      queueLength: 1,
      activeRequests: 1,
      canCancel: true
    }
  }
}`,...l.parameters?.docs?.source},description:{story:"A running operation with some failed items in the batch breakdown.",...l.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      statusLabel: 'Throttled',
      statusColorVar: 'var(--color-warning)',
      busy: true,
      queueLength: 14,
      activeRequests: 3,
      rateLimit: {
        remaining: 8,
        limit: 100,
        low: true
      },
      canCancel: true
    }
  }
}`,...c.parameters?.docs?.source},description:{story:"Scheduler is rate-limit throttled with headroom below the 20% warning line.",...c.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      statusLabel: 'Cooldown',
      statusColorVar: 'var(--color-danger)',
      busy: true,
      queueLength: 9,
      cooldownLabel: '12s',
      canCancel: true
    }
  }
}`,...u.parameters?.docs?.source},description:{story:"Scheduler is in a cooldown window, counting down to resume.",...u.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      processed: 118,
      failed: 3
    }
  }
}`,...p.parameters?.docs?.source},description:{story:"Idle after a completed run, showing the processed tally with failures.",...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    collapsed: true,
    view: {
      ...idleView,
      rateLimit: {
        remaining: 480,
        limit: 600,
        low: false
      },
      processed: 118,
      failed: 3
    }
  }
}`,...d.parameters?.docs?.source},description:{story:"Condensed to essentials — status, rate and the processed tally. This is the state the bar boots into.",...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    collapsed: true,
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Removing members',
      current: 42,
      total: 120,
      percentage: 35,
      opCompleted: 40,
      opActive: 2,
      opFailed: 1,
      rateLimit: {
        remaining: 90,
        limit: 600,
        low: false
      },
      queueLength: 6,
      activeRequests: 2,
      canCancel: true
    }
  }
}`,...m.parameters?.docs?.source},description:{story:"Condensed, with an operation running — progress shows in place of the tally.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    collapsed: false,
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Removing members',
      current: 42,
      total: 120,
      percentage: 35,
      elapsedLabel: '0:18',
      eta: {
        kind: 'point',
        lowerMs: 34_000,
        label: '~0:34 left'
      },
      opCompleted: 40,
      opActive: 2,
      opFailed: 0,
      rateLimit: {
        remaining: 90,
        limit: 600,
        low: false
      },
      queueLength: 6,
      activeRequests: 2,
      canCancel: true
    }
  }
}`,...g.parameters?.docs?.source},description:{story:"Expanded by the reader — the full stats show, wrapping onto multiple lines in a narrow panel.",...g.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Removing members',
      current: 10,
      total: 50,
      percentage: 20,
      opCompleted: 10,
      opActive: 0,
      opFailed: 0,
      queueLength: 3,
      isCancelling: true,
      canCancel: false
    }
  }
}`,...v.parameters?.docs?.source},description:{story:'Cancel confirmed and unwinding — the button reads "Cancelling…" and disables.',...v.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      processed: 128,
      buckets: [bucket({
        bucket: '/api/v1/users'
      }), bucket({
        bucket: '/api/v1/groups'
      }), bucket({
        bucket: '/api/v1/apps'
      }), bucket({
        bucket: '/api/v1/policies'
      }), bucket({
        bucket: '/api/v1/meta',
        limit: null,
        remaining: null,
        resetAt: null
      })]
    }
  }
}`,...b.parameters?.docs?.source},description:{story:"Five families seen, all at full headroom, so the rack collapses to a single grey line.",...b.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Export all users',
      current: 312,
      total: 812,
      percentage: 38,
      opCompleted: 312,
      opActive: 4,
      queueLength: 26,
      activeRequests: 4,
      rateLimit: {
        remaining: 288,
        limit: 600,
        low: false
      },
      canCancel: true,
      buckets: [bucket({
        bucket: '/api/v1/users',
        remaining: 288,
        active: 4,
        queued: 26,
        planned: 470
      }), bucket({
        bucket: '/api/v1/groups'
      }), bucket({
        bucket: '/api/v1/policies'
      })]
    }
  }
}`,...w.parameters?.docs?.source},description:{story:"An export under way: `/api/v1/users` has 812 requests declared against it before most of them exist.",...w.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      statusLabel: 'Cooldown',
      statusColorVar: 'var(--color-danger)',
      busy: true,
      queueLength: 40,
      rateLimit: {
        remaining: 18,
        limit: 600,
        low: true
      },
      cooldownLabel: '24s',
      canCancel: true,
      buckets: [bucket({
        bucket: '/api/v1/users',
        remaining: 18,
        queued: 40,
        planned: 500,
        gatedUntil: FIXED_NOW + 24_000
      }), bucket({
        bucket: '/api/v1/apps',
        limit: 300,
        remaining: 81,
        queued: 3,
        planned: 402
      }), bucket({
        bucket: '/api/v1/groups'
      }), bucket({
        bucket: '/api/v1/policies'
      })]
    }
  }
}`,...h.parameters?.docs?.source},description:{story:"One family exhausted and cooling while the rest stay untouched; the countdown is that bucket's own gate.",...h.parameters?.docs?.description}}};k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      processed: 1_284,
      buckets: [bucket({
        bucket: '/api/v1/users',
        limit: null,
        remaining: null,
        resetAt: null,
        lastActiveAt: FIXED_NOW - 95_000
      }), bucket({
        bucket: '/api/v1/groups',
        limit: null,
        remaining: null,
        resetAt: null,
        lastActiveAt: FIXED_NOW - 6_000
      }), bucket({
        bucket: '/api/v1/apps',
        limit: null,
        remaining: null,
        resetAt: null
      }), bucket({
        bucket: '/api/v1/policies'
      })]
    }
  }
}`,...k.parameters?.docs?.source},description:{story:"The rack a minute after a walk finished: retained lanes say **at rest** with no\nbudget figure, and one with a `null` `lastActiveAt` says only that, rather than\ninventing a time.",...k.parameters?.docs?.description}}};C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Export all users',
      current: 1,
      total: 812,
      percentage: 0,
      opCompleted: 1,
      opActive: 4,
      queueLength: 30,
      activeRequests: 4,
      rateLimit: {
        remaining: 594,
        limit: 600,
        low: false
      },
      eta: {
        kind: 'unknown',
        label: 'estimating…'
      },
      canCancel: true,
      buckets: [bucket({
        bucket: '/api/v1/users',
        remaining: 594,
        active: 4,
        queued: 30,
        planned: 778,
        lastActiveAt: FIXED_NOW - 1_000
      })]
    }
  }
}`,...C.parameters?.docs?.source},description:{story:"A run with no throughput sample yet: the ETA slot says **estimating…** rather than a number.",...C.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      statusLabel: 'Cooldown',
      statusColorVar: 'var(--color-danger)',
      busy: true,
      operationActive: true,
      operationName: 'Export all users',
      current: 406,
      total: 812,
      percentage: 50,
      opCompleted: 402,
      opActive: 4,
      opFailed: 4,
      queueLength: 40,
      activeRequests: 4,
      rateLimit: {
        remaining: 18,
        limit: 600,
        low: true
      },
      eta: {
        kind: 'range',
        lowerMs: 80_000,
        upperMs: 170_000,
        label: '1:20–2:50 left'
      },
      canCancel: true,
      buckets: [bucket({
        bucket: '/api/v1/users',
        remaining: 18,
        queued: 40,
        planned: 366,
        gatedUntil: FIXED_NOW + 90_000,
        lastActiveAt: FIXED_NOW - 2_000
      }), bucket({
        bucket: '/api/v1/groups',
        limit: 600,
        remaining: 540,
        active: 4,
        lastActiveAt: FIXED_NOW - 500
      })]
    }
  }
}`,...y.parameters?.docs?.source},description:{story:"Throughput is measurable and a gate is armed, so the ETA ceiling absorbs the cooldown.",...y.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Export all users',
      current: 312,
      total: 812,
      percentage: 38,
      opCompleted: 312,
      opActive: 4,
      queueLength: 26,
      activeRequests: 4,
      rateLimit: {
        remaining: 288,
        limit: 600,
        low: false
      },
      canCancel: true,
      buckets: [bucket({
        bucket: '/api/v1/users',
        remaining: 288,
        active: 4,
        queued: 26,
        planned: 470
      }), bucket({
        bucket: '/api/v1/groups',
        active: 1,
        planned: 2
      })],
      operations: [{
        id: 'export',
        name: 'Export all users',
        startedAt: FIXED_NOW - 90_000,
        legs: [leg('/api/v1/users', 812, 342)],
        spent: 342,
        estimated: 812,
        remaining: 470,
        approximate: false
      }, {
        id: 'search',
        name: 'Search groups',
        startedAt: FIXED_NOW - 2_000,
        legs: [leg('/api/v1/groups', 3, 1)],
        spent: 1,
        estimated: 3,
        remaining: 2,
        approximate: true
      }]
    }
  }
}`,...f.parameters?.docs?.source},description:{story:'Two operations at once: each row carries its own stop control and the queue-wide button becomes "Cancel all".',...f.parameters?.docs?.description}}};A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      statusLabel: 'Cooldown',
      statusColorVar: 'var(--color-danger)',
      busy: true,
      queueLength: 40,
      rateLimit: {
        remaining: 18,
        limit: 600,
        low: true
      },
      cooldownLabel: '24s',
      canCancel: true,
      buckets: [bucket({
        bucket: '/api/v1/users',
        remaining: 18,
        queued: 40,
        planned: 470,
        gatedUntil: FIXED_NOW + 24_000
      }), bucket({
        bucket: '/api/v1/apps',
        limit: 300,
        remaining: 4,
        queued: 3,
        planned: 402,
        gatedUntil: FIXED_NOW + 95_000
      }), bucket({
        bucket: '/api/v1/groups'
      })],
      operations: [{
        id: 'export',
        name: 'Export all users',
        startedAt: FIXED_NOW - 90_000,
        legs: [leg('/api/v1/users', 812, 342)],
        spent: 342,
        estimated: 812,
        remaining: 470,
        approximate: false
      }, {
        id: 'assignments',
        name: 'Count app assignments',
        startedAt: FIXED_NOW - 30_000,
        legs: [leg('/api/v1/apps', 402, 0)],
        spent: 0,
        estimated: 402,
        remaining: 402,
        approximate: true
      }]
    }
  }
}`,...A.parameters?.docs?.source},description:{story:`Gated, with the ledger above and the reset timeline between: what is still
owed, and when each family comes back to pay it.`,...A.parameters?.docs?.description}}};L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Removing members',
      current: 42,
      total: 120,
      percentage: 35,
      eta: {
        kind: 'point',
        lowerMs: 34_000,
        label: '~0:34 left'
      },
      opCompleted: 40,
      opActive: 2,
      queueLength: 6,
      activeRequests: 2,
      rateLimit: {
        remaining: 90,
        limit: 600,
        low: false
      },
      canCancel: true,
      buckets: [bucket({
        bucket: '/api/v1/users',
        remaining: 90,
        active: 2,
        queued: 6
      })]
    }
  },
  render: args => <CollapsibleHarness {...args} />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', {
      name: 'Show all activity stats'
    }));
    await expect(await canvas.findByTestId('activity-operation-name')).toHaveTextContent('Removing members');
    await userEvent.click(await canvas.findByRole('button', {
      name: 'Hide extra activity stats'
    }));
    await expect(await canvas.findByRole('button', {
      name: 'Show all activity stats'
    })).toBeInTheDocument();
  }
}`,...L.parameters?.docs?.source},description:{story:"Operate the chevron: the condensed line expands to the full bar, then folds back.",...L.parameters?.docs?.description}}};q.parameters={...q.parameters,docs:{...q.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...idleView,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Removing members',
      current: 10,
      total: 50,
      percentage: 20,
      opCompleted: 10,
      queueLength: 3,
      canCancel: true
    }
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', {
      name: 'Cancel'
    }));
    await expect(args.onCancel).toHaveBeenCalled();
  }
}`,...q.parameters?.docs?.source},description:{story:"The queue-wide cancel button reports the confirmed cancellation to its handler.",...q.parameters?.docs?.description}}};const z=["Default","OperationInProgress","OperationWithFailures","RateLimitLow","Cooldown","ProcessedWithFailures","CollapsedIdle","CollapsedOperation","Expanded","Cancelling","BucketsAllQuiet","BucketsWithPlannedWork","BucketCoolingDown","RackAtRest","EtaNotKnownYet","EtaRangeWidenedByCooldown","ConcurrentOperations","GatedWithLedger","ToggleCollapse","CancelRunningWork"];export{h as BucketCoolingDown,b as BucketsAllQuiet,w as BucketsWithPlannedWork,q as CancelRunningWork,v as Cancelling,d as CollapsedIdle,m as CollapsedOperation,f as ConcurrentOperations,u as Cooldown,i as Default,C as EtaNotKnownYet,y as EtaRangeWidenedByCooldown,g as Expanded,A as GatedWithLedger,o as OperationInProgress,l as OperationWithFailures,p as ProcessedWithFailures,k as RackAtRest,c as RateLimitLow,L as ToggleCollapse,z as __namedExportsOrder,$ as default};
