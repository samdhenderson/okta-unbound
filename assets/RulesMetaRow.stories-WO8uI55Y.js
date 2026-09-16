import{R as o}from"./RulesMetaRow-DhxG1CUj.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./dateFormat-tpkRVL7u.js";const p={title:"Rules/RulesMetaRow",component:o,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Small metadata chips above the Rules list: what the last load cost in API requests, and when the cached data was fetched. Each chip is gated independently — the cache chip needs both a time and loaded rules — and the row renders nothing when neither has anything to say."}}},argTypes:{apiCost:{description:"API requests the last load cost, or null when unknown."},lastFetchTime:{description:"ISO timestamp of the last successful load, or null."},hasRules:{description:"Whether any rules are loaded (gates the cache chip)."}},args:{apiCost:12,lastFetchTime:"2026-07-16T14:30:00.000Z",hasRules:!0}},e={},s={args:{lastFetchTime:null,hasRules:!1}},a={args:{apiCost:null}},t={args:{apiCost:null,hasRules:!1}},r={args:{apiCost:null,lastFetchTime:null,hasRules:!1}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:"Both chips shown: request count and cache time.",...e.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    lastFetchTime: null,
    hasRules: false
  }
}`,...s.parameters?.docs?.source},description:{story:"Only the API-requests chip (no cache time known).",...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    apiCost: null
  }
}`,...a.parameters?.docs?.source},description:{story:"Only the cached-time chip (cost unknown).",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    apiCost: null,
    hasRules: false
  }
}`,...t.parameters?.docs?.source},description:{story:"Cache time present but no rules loaded yet — the cache chip is suppressed too.",...t.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    apiCost: null,
    lastFetchTime: null,
    hasRules: false
  }
}`,...r.parameters?.docs?.source},description:{story:"Nothing to show — the component renders null.",...r.parameters?.docs?.description}}};const d=["Default","ApiCostOnly","CachedOnly","NoRulesLoaded","Empty"];export{s as ApiCostOnly,a as CachedOnly,e as Default,r as Empty,t as NoRulesLoaded,d as __namedExportsOrder,p as default};
