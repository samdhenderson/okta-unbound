import{P as o}from"./PolicyRulesList-CSc_6ci5.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const i=[{id:"0prFAKE000000000001",name:"Trusted device, no prompt",status:"ACTIVE",priority:1},{id:"0prFAKE000000000002",name:"Off-network step-up",status:"INACTIVE",priority:2},{id:"0prFAKE000000000003",name:"Catch-all Rule",status:"ACTIVE",priority:3,system:!0}],d={title:"Policies/PolicyRulesList",component:o,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"A read-only list of one auth policy's rules, showing only the validated scalar fields: evaluation priority, name, status and whether the rule is Okta-managed. A rule's `conditions` and `actions` vary by policy type, are `unknown` by contract, and are never read here. The loading, error and empty states belong to this list."}}},argTypes:{rules:{description:"The policy's validated rules; null until the first load resolves."},isLoading:{description:"Whether the rules fetch is in flight with nothing yet to show."},error:{description:"Message from a failed rules fetch, or null."}},args:{rules:i,isLoading:!1,error:null}},e={},r={args:{rules:null,isLoading:!0}},s={args:{rules:null,error:"Policy rules unavailable"}},a={args:{rules:[]}},t={args:{rules:[{id:"0prFAKE000000000009"}]}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:"Three rules, including an Okta-managed catch-all.",...e.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    rules: null,
    isLoading: true
  }
}`,...r.parameters?.docs?.source},description:{story:"The rules fetch is in flight.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    rules: null,
    error: 'Policy rules unavailable'
  }
}`,...s.parameters?.docs?.source},description:{story:"The rules fetch failed — an inline `danger` alert, not a crash.",...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    rules: []
  }
}`,...a.parameters?.docs?.source},description:{story:"A policy with no rules at all.",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    rules: [{
      id: '0prFAKE000000000009'
    }] as OktaPolicyRule[]
  }
}`,...t.parameters?.docs?.source},description:{story:"A rule missing its optional name and priority falls back to its id and an em dash.",...t.parameters?.docs?.description}}};const p=["Default","Loading","ErrorState","Empty","SparseRule"];export{e as Default,a as Empty,s as ErrorState,r as Loading,t as SparseRule,p as __namedExportsOrder,d as default};
