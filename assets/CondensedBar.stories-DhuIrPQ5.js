import{j as t,B as o}from"./iframe-tAvKsVeF.js";import{a as i}from"./CondensedBar-BG5akcNn.js";import"./preload-helper-PPVm8Dsz.js";const p={title:"Sidepanel/Activity/CondensedBar",component:i,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:'The condensed activity line: status, rate-limit headroom, and a processed/progress tally, with no lane bars. It is a separate tree from the full layout and is swapped rather than cross-faded, so the Cancel control and the bar’s `role="status"` live region are never mounted twice.'}}},argTypes:{view:{description:"Merged, display-ready activity state."},actions:{description:"The toggle + Cancel cluster, built by the bar so both trees share one instance shape."}}},s={statusLabel:"Ready",statusColorVar:"var(--color-success)",busy:!1,operationActive:!1,current:0,total:0,percentage:0,eta:null,opCompleted:0,opActive:0,opFailed:0,queueLength:0,activeRequests:0,rateLimit:{remaining:480,limit:600,low:!1},processed:0,failed:0,isCancelling:!1,canCancel:!1,buckets:[],lowThresholdPercent:10,operations:[],now:176e10},n=t.jsx(o,{variant:"danger",size:"xs",disabled:!0,children:"Cancel"}),e={args:{view:{...s,processed:118,failed:3},actions:n}},a={args:{view:{...s,statusLabel:"Processing",statusColorVar:"var(--color-info)",busy:!0,operationActive:!0,operationName:"Removing members",current:42,total:120,opFailed:1,canCancel:!0},actions:t.jsx(o,{variant:"danger",size:"xs",children:"Cancel"})}},r={args:{view:{...s,statusLabel:"Cooldown",statusColorVar:"var(--color-danger)",busy:!0,rateLimit:{remaining:18,limit:600,low:!0},processed:964},actions:n}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...base,
      processed: 118,
      failed: 3
    },
    actions
  }
}`,...e.parameters?.docs?.source},description:{story:"Idle, with a running total of what the scheduler has processed.",...e.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...base,
      statusLabel: 'Processing',
      statusColorVar: 'var(--color-info)',
      busy: true,
      operationActive: true,
      operationName: 'Removing members',
      current: 42,
      total: 120,
      opFailed: 1,
      canCancel: true
    },
    actions: <Button variant="danger" size="xs">
        Cancel
      </Button>
  }
}`,...a.parameters?.docs?.source},description:{story:"A named operation running: the tally is replaced by live progress.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    view: {
      ...base,
      statusLabel: 'Cooldown',
      statusColorVar: 'var(--color-danger)',
      busy: true,
      rateLimit: {
        remaining: 18,
        limit: 600,
        low: true
      },
      processed: 964
    },
    actions
  }
}`,...r.parameters?.docs?.source},description:{story:"Low headroom, called out in words as well as colour.",...r.parameters?.docs?.description}}};const u=["Idle","Running","LowHeadroom"];export{e as Idle,r as LowHeadroom,a as Running,u as __namedExportsOrder,p as default};
