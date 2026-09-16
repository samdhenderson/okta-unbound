import{R as r}from"./RulesStatsGrid-Dq_N7l7-.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./StatCard-DmVy9h_z.js";const l={title:"Rules/RulesStatsGrid",component:r,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The Rules tab's four summary tiles: total, active, inactive, and conflicts.\n\nBuilt from the shared `StatCard` so it reads consistently with the Overview tab. Counts are locale-formatted with a thousands separator. The conflicts tile is the only stateful one — it switches from neutral to warning styling when the conflict count is above zero."}}},argTypes:{stats:{description:"Aggregate rule counts (total / active / inactive / conflicts)."}},args:{stats:{total:42,active:30,inactive:12,conflicts:0}}},t={},s={args:{stats:{total:42,active:28,inactive:10,conflicts:4}}},e={args:{stats:{total:0,active:0,inactive:0,conflicts:0}}},a={args:{stats:{total:12500,active:11800,inactive:700,conflicts:15}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source},description:{story:"No conflicts — the conflicts tile stays neutral.",...t.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    stats: {
      total: 42,
      active: 28,
      inactive: 10,
      conflicts: 4
    }
  }
}`,...s.parameters?.docs?.source},description:{story:"Conflicts present — the conflicts tile switches to warning styling.",...s.parameters?.docs?.description}}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    stats: {
      total: 0,
      active: 0,
      inactive: 0,
      conflicts: 0
    }
  }
}`,...e.parameters?.docs?.source},description:{story:"No rules at all.",...e.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    stats: {
      total: 12500,
      active: 11800,
      inactive: 700,
      conflicts: 15
    }
  }
}`,...a.parameters?.docs?.source},description:{story:"A large rule set, exercising the thousands-separator formatting.",...a.parameters?.docs?.description}}};const p=["Default","WithConflicts","Empty","LargeCounts"];export{t as Default,e as Empty,a as LargeCounts,s as WithConflicts,p as __namedExportsOrder,l as default};
