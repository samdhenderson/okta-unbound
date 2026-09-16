import{C as k}from"./ComparisonOverviewTab-B1tUxBO9.js";import{a as u}from"./fixtures-CsAiPaTu.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./CauseWorklist-BP5lMtA6.js";import"./CauseWorklistRow-CE38mMU8.js";import"./ClauseGroupList-0V5tF3Gv.js";import"./groupContext-D0LcfWax.js";import"./ruleExpression-nPAdgj2W.js";import"./membershipAnalysis-CAnarCAG.js";const{expect:m,fn:l,userEvent:y,within:f}=__STORYBOOK_MODULE_TEST__,p=(c,n)=>({group:{...u,id:c,profile:{...u.profile,name:n}},membershipType:"DIRECT",rules:[],attribution:"exact"}),i={onlyCompared:[p("g1","Engineering - Platform"),p("g2","VPN Access")],shared:[p("g3","All Employees")],onlyContext:[p("g4","Finance Approvers")]},d={onlyCompared:[{id:"a1",label:"Salesforce"}],shared:[{id:"a2",label:"Slack"},{id:"a3",label:"Google Workspace"}],onlyContext:[]},v=[{groupId:"00gFAKE001",groupName:"Engineering - Platform",remedy:"blocked-by-attribute",ruleId:"0prFAKE001",ruleName:"Platform engineers",failingClauses:[{node:"leaf",expressionText:'user.department == "Platform"',resolvedValue:"Support",status:"fail",reads:[{path:"user.department",value:"Support"}]}]},{groupId:"00gFAKE002",groupName:"VPN Access",remedy:"cannot-determine",undeterminedReason:"needs-group-context",failingClauses:[]}],J={title:"Users/Comparison/ComparisonOverviewTab",component:k,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"Summary tab of the comparison modal: two proportion cards (groups + apps) with jump-to-detail links, followed by the cause worklist. Each card shows the shared vs unique split for one dimension and its whole-percent overlap, entirely from pre-bucketed props.\n\nThe `causes` prop is optional on purpose: absent means not computed, which reads differently from an empty array meaning computed and nothing found."}}},args:{contextName:"Jane Doe",comparedName:"John Smith",groupBuckets:i,appBuckets:d,groupSimilarity:33,appSimilarity:67,onJumpToGroups:l(),onJumpToApps:l(),causes:v,onViewClauses:l()},argTypes:{contextName:{description:"Display name for the context user."},comparedName:{description:"Display name for the compared user."},groupBuckets:{description:"Bucketed group memberships (only-compared / shared / only-context)."},appBuckets:{description:"Bucketed app assignments (only-compared / shared / only-context)."},groupSimilarity:{description:"Group overlap as a whole percent (0–100)."},appSimilarity:{description:"App overlap as a whole percent, or `null` when the read did not complete."},onJumpToGroups:{description:"Jumps to the Groups detail tab."},onJumpToApps:{description:"Jumps to the Apps detail tab."},causes:{description:"Access differences classified by remedy. Absent means not computed."},onViewClauses:{description:"Opens the full clause checklist for one cause."}}},e={play:async({canvasElement:c,args:n})=>{const g=f(c),[h,C]=g.getAllByRole("button",{name:"View details"});await y.click(h),await m(n.onJumpToGroups).toHaveBeenCalledTimes(1),await y.click(C),await m(n.onJumpToApps).toHaveBeenCalledTimes(1)}},o={args:{groupBuckets:{onlyCompared:[],shared:i.shared,onlyContext:[]},appBuckets:{onlyCompared:[],shared:d.shared,onlyContext:[]},groupSimilarity:100,appSimilarity:100,causes:[]}},a={args:{groupBuckets:{onlyCompared:i.onlyCompared,shared:[],onlyContext:i.onlyContext},appBuckets:{onlyCompared:d.onlyCompared,shared:[],onlyContext:[]},groupSimilarity:0,appSimilarity:0}},r={args:{appBuckets:{onlyCompared:[],shared:[],onlyContext:[]},appSimilarity:null}},s={args:{groupBuckets:{onlyCompared:[],shared:[],onlyContext:[]},appBuckets:{onlyCompared:[],shared:[],onlyContext:[]},groupSimilarity:0,appSimilarity:0,causes:[]}},t={args:{causes:void 0}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const [groupsLink, appsLink] = canvas.getAllByRole('button', {
      name: 'View details'
    });
    await userEvent.click(groupsLink);
    await expect(args.onJumpToGroups).toHaveBeenCalledTimes(1);
    await userEvent.click(appsLink);
    await expect(args.onJumpToApps).toHaveBeenCalledTimes(1);
  }
}`,...e.parameters?.docs?.source},description:{story:"A mix of shared and unique groups/apps. Each card's link routes to its detail tab.",...e.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    groupBuckets: {
      onlyCompared: [],
      shared: groupBuckets.shared,
      onlyContext: []
    },
    appBuckets: {
      onlyCompared: [],
      shared: appBuckets.shared,
      onlyContext: []
    },
    groupSimilarity: 100,
    appSimilarity: 100,
    // Perfect overlap: the worklist WAS computed and found nothing.
    causes: []
  }
}`,...o.parameters?.docs?.source},description:{story:"Perfect overlap on both groups and apps.",...o.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    groupBuckets: {
      onlyCompared: groupBuckets.onlyCompared,
      shared: [],
      onlyContext: groupBuckets.onlyContext
    },
    appBuckets: {
      onlyCompared: appBuckets.onlyCompared,
      shared: [],
      onlyContext: []
    },
    groupSimilarity: 0,
    appSimilarity: 0
  }
}`,...a.parameters?.docs?.source},description:{story:"No overlap at all between the two users.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    appBuckets: {
      onlyCompared: [],
      shared: [],
      onlyContext: []
    },
    appSimilarity: null
  }
}`,...r.parameters?.docs?.source},description:{story:"The app walk did not finish: its card drops the percentage, the groups card is untouched.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    groupBuckets: {
      onlyCompared: [],
      shared: [],
      onlyContext: []
    },
    appBuckets: {
      onlyCompared: [],
      shared: [],
      onlyContext: []
    },
    groupSimilarity: 0,
    appSimilarity: 0,
    causes: []
  }
}`,...s.parameters?.docs?.source},description:{story:"Both users have zero groups and zero apps.",...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    causes: undefined
  }
}`,...t.parameters?.docs?.source},description:{story:"`causes` absent: the worklist says not computed, rather than nothing to fix.",...t.parameters?.docs?.description}}};const G=["Default","FullOverlap","NoOverlap","AppOverlapUnavailable","Empty","CausesNotComputed"];export{r as AppOverlapUnavailable,t as CausesNotComputed,e as Default,s as Empty,o as FullOverlap,a as NoOverlap,G as __namedExportsOrder,J as default};
