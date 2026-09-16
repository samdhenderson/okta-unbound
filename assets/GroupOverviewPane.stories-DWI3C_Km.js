import{G as u}from"./GroupOverviewPane-B2Obh1r4.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:l,fn:p,userEvent:d,within:c}=__STORYBOOK_MODULE_TEST__,n={id:"00gFAKEgroup00001",name:"Engineering",description:"Eng team",type:"OKTA_GROUP",memberCount:70,hasRules:!0,ruleCount:2,pushMappings:[{mappingId:"m1",sourceUserGroupId:"00gFAKEgroup00001",targetGroupName:"Engineering (Slack)",priority:1,appId:"0oaFAKEAPP1",appName:"Slack"}]},s={...n,pushMappings:void 0},g={total:70,direct:1,ruleBased:69,unattributed:0,byRule:[{ruleId:"0prFAKE1",ruleName:"Eng — full-time",count:45},{ruleId:"0prFAKE2",ruleName:"Eng — contract",count:25}]},m={total:12,direct:12,ruleBased:0,unattributed:0,byRule:[]},S={title:"Groups/GroupOverviewPane",component:u,tags:["autodocs"],parameters:{docs:{description:{component:"The Group Detail view's landing pane: verdict tiles, each a derived claim, that drill into the tab that answers it. Presentational only — every figure re-reads state `GroupDetailView` already computes, and the pane issues no fetch of its own.\n\nA tile never restates a fact `PageHeader` already owns, and a fact that has not loaded is omitted rather than shown as zero: the Access and Rules tiles are absent until their reads resolve, and the app-push tile exists only when the group carries at least one mapping."}}},argTypes:{group:{description:"The group being described. Only `pushMappings` is read here."},breakdown:{description:"The manual-vs-rule membership split, once the gated analysis has run."},memberStatus:{description:"Status of the gated member-source analysis."},feedingRulesCount:{description:"Number of rules that assign into this group."},rulesStatus:{description:"Status of the feeding-rules load."},appsCount:{description:"Number of apps this group is assigned to."},appsStatus:{description:"Status of the app-assignment read."},rolesCount:{description:"Number of admin roles this group grants."},rolesStatus:{description:"Whether the admin-roles read could be completed."},referencingRulesCount:{description:"Number of rules that reference this group in a condition expression."},referencingStatus:{description:"Status of the referencing-rules load."},onNavigate:{description:"Switches the Group Detail view's active tab."}},args:{group:s,breakdown:null,memberStatus:"idle",feedingRulesCount:0,rulesStatus:"loading",appsCount:0,appsStatus:"loading",rolesCount:0,rolesStatus:"loading",referencingRulesCount:0,referencingStatus:"loading",onNavigate:p()}},e={play:async({canvasElement:r,args:o})=>{const i=c(r);await d.click(i.getByRole("button",{name:/Where membership comes from/i})),await l(o.onNavigate).toHaveBeenCalledWith("members")}},t={args:{group:n,breakdown:g,memberStatus:"done",feedingRulesCount:2,rulesStatus:"done",appsCount:5,appsStatus:"done",rolesCount:2,rolesStatus:"available",referencingRulesCount:1,referencingStatus:"done"}},a={args:{group:s,breakdown:m,memberStatus:"done",feedingRulesCount:0,rulesStatus:"done",appsCount:0,appsStatus:"done",rolesCount:0,rolesStatus:"available",referencingRulesCount:0,referencingStatus:"done"}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /Where membership comes from/i
    }));
    await expect(args.onNavigate).toHaveBeenCalledWith('members');
  }
}`,...e.parameters?.docs?.source},description:{story:`Nothing has loaded yet: the membership-source tile shows its call-to-action and the
Access/Rules tiles are absent. Pressing the tile routes to the tab that answers it.`,...e.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    group: groupWithPush,
    breakdown: analyzedBreakdown,
    memberStatus: 'done',
    feedingRulesCount: 2,
    rulesStatus: 'done',
    appsCount: 5,
    appsStatus: 'done',
    rolesCount: 2,
    rolesStatus: 'available',
    referencingRulesCount: 1,
    referencingStatus: 'done'
  }
}`,...t.parameters?.docs?.source},description:{story:"Every read resolved and a live push mapping: all four tiles render.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    group: groupWithoutPush,
    breakdown: allManualBreakdown,
    memberStatus: 'done',
    feedingRulesCount: 0,
    rulesStatus: 'done',
    appsCount: 0,
    appsStatus: 'done',
    rolesCount: 0,
    rolesStatus: 'available',
    referencingRulesCount: 0,
    referencingStatus: 'done'
  }
}`,...a.parameters?.docs?.source},description:{story:"A confirmed all-manual group: real loaded zeros, and no push tile at all.",...a.parameters?.docs?.description}}};const v=["NotAnalyzed","AllTilesLoaded","Empty"];export{t as AllTilesLoaded,a as Empty,e as NotAnalyzed,v as __namedExportsOrder,S as default};
