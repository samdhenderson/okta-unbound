import{G as h}from"./GroupComparisonModal-SMAOQFHU.js";import{m as r,a as G}from"./fixtures-CsAiPaTu.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./csvUtils-DgNWYp8m.js";const{expect:c,fn:i,within:d}=__STORYBOOK_MODULE_TEST__;function m(e,p,g){return{id:e,name:p,type:G.type,memberCount:g,hasRules:!1,ruleCount:0}}const u=[m("g1","Engineering",60),m("g2","Product",45)],w=[...u,m("g3","Design",20)],l=new Map([["g1",r.slice(0,60)],["g2",r.slice(30,75)]]),y=new Map([...l,["g3",r.slice(60,80)]]),C={groups:[{id:"g1",name:"Engineering",memberCount:60},{id:"g2",name:"Product",memberCount:45}],intersection:r.slice(30,60).map(e=>e.id),uniqueMembers:{g1:r.slice(0,30).map(e=>e.id),g2:r.slice(60,75).map(e=>e.id)},totalUniqueUsers:75},b={groups:[{id:"g1",name:"Engineering",memberCount:60},{id:"g2",name:"Product",memberCount:45},{id:"g3",name:"Design",memberCount:20}],intersection:[],uniqueMembers:{g1:r.slice(0,30).map(e=>e.id),g2:[],g3:r.slice(75,80).map(e=>e.id)},totalUniqueUsers:80},O={title:"Groups/GroupComparisonModal",component:h,tags:["autodocs"],parameters:{layout:"fullscreen",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:"Modal comparing membership overlap across 2–5 selected groups. Opening triggers the comparison: it fetches members (reusing the passed cache where it can) and renders the shared intersection, each group’s unique members, and — for 3+ groups — a pairwise overlap matrix. It renders nothing when closed."}}},argTypes:{isOpen:{description:"Whether the modal is visible; opening triggers the comparison."},onClose:{description:"Closes the modal."},groups:{description:"Groups to compare (expects 2–5)."},compareGroups:{description:"Fetches members and computes the comparison result, reporting progress."},memberCache:{description:"Cached members keyed by group id; also used to build the pairwise matrix."}},args:{isOpen:!0,onClose:i(),groups:u,compareGroups:i(async()=>C),memberCache:l}},o={play:async({args:e})=>{const p=d(await d(document.body).findByRole("dialog"));await c(await p.findByText("Total Unique Users")).toBeVisible(),await c(p.getByText("In All Groups")).toBeVisible(),await c(e.compareGroups).toHaveBeenCalled()}},s={args:{groups:w,compareGroups:i(async()=>b),memberCache:y}},a={args:{compareGroups:i(()=>new Promise(()=>{}))}},t={args:{compareGroups:i(async()=>{throw new Error("Comparison failed: rate limited")})}},n={args:{isOpen:!1}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  play: async ({
    args
  }) => {
    const dialog = within(await within(document.body).findByRole('dialog'));
    await expect(await dialog.findByText('Total Unique Users')).toBeVisible();
    await expect(dialog.getByText('In All Groups')).toBeVisible();
    await expect(args.compareGroups).toHaveBeenCalled();
  }
}`,...o.parameters?.docs?.source},description:{story:"Default: two groups compared, no pairwise matrix.",...o.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    groups: threeGroups,
    compareGroups: fn(async () => threeGroupResult),
    memberCache: threeGroupCache
  }
}`,...s.parameters?.docs?.source},description:{story:"Three groups compared — renders the pairwise overlap matrix.",...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    compareGroups: fn(() => new Promise<GroupComparisonResult>(() => {}))
  }
}`,...a.parameters?.docs?.source},description:{story:"Comparison in flight — `compareGroups` never resolves.",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    compareGroups: fn(async () => {
      throw new Error('Comparison failed: rate limited');
    })
  }
}`,...t.parameters?.docs?.source},description:{story:"The comparison call rejects.",...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    isOpen: false
  }
}`,...n.parameters?.docs?.source},description:{story:"Closed state (renders nothing).",...n.parameters?.docs?.description}}};const U=["Default","ThreeGroups","Loading","ErrorState","Closed"];export{n as Closed,o as Default,t as ErrorState,a as Loading,s as ThreeGroups,U as __namedExportsOrder,O as default};
