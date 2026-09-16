import{R as v}from"./RuleImpactModal-tvlzqoPN.js";import{m as g}from"./fixtures-CsAiPaTu.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./StatCard-DmVy9h_z.js";import"./userDisplay-xpx41Abi.js";const{expect:c,fn:m,within:y}=__STORYBOOK_MODULE_TEST__,d=g.slice(10,22),p=g.slice(10,90),S={groupId:"grp1",groupName:"Engineering",memberCount:60,heldSolelyCount:d.length,heldSolelyByRule:d},w={groupId:"grp2",groupName:"Engineering Contractors",memberCount:90,heldSolelyCount:p.length,heldSolelyByRule:p},b={groupId:"grp3",groupName:"Engineering Managers",memberCount:12,heldSolelyCount:0,heldSolelyByRule:[]},N={ruleId:"rule1",ruleName:"Engineering - US",targetGroups:[S,b],distinctMemberCount:72,totalHeldSolely:d.length},E={ruleId:"rule2",ruleName:"Engineering - EU",targetGroups:[w],distinctMemberCount:90,totalHeldSolely:p.length},C={ruleId:"rule3",ruleName:"Orphaned rule",targetGroups:[],distinctMemberCount:0,totalHeldSolely:0},h={groupId:"grp4",groupName:"Engineering",memberCount:12,heldSolelyCount:0,heldSolelyByRule:[]},f={ruleId:"rule4",ruleName:"Only Rule",targetGroups:[h],distinctMemberCount:12,totalHeldSolely:0,emptyRuleInventory:!0},T={ruleId:"rule5",ruleName:"Engineering - US",targetGroups:[h],distinctMemberCount:12,totalHeldSolely:0,emptyRuleInventory:!1},D={title:"Rules/RuleImpactModal",component:v,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'Read-only "what does this rule hold up?" preview for a group rule: its target groups with live member counts, and how many members are held by this rule **alone**.\n\nIn `deactivate` mode it doubles as the confirmation gate for the deactivation. Deactivating removes nobody — it leaves those members unattributed — so the copy never says they lose access.'}}},argTypes:{isOpen:{description:"Whether the modal is shown."},ruleName:{description:"The rule name being analyzed (for the header/copy)."},mode:{description:"Preview vs deactivation-confirmation intent."},status:{description:"Async status of the capture."},summary:{description:"The captured summary once available."},error:{description:"Error message when `status === 'error'`."},progress:{description:"Load progress while capturing."},onClose:{description:"Close/cancel the modal."},onConfirmDeactivate:{description:"Commit the deactivation (only used in `deactivate` mode)."},onNavigateToGroup:{description:"Jump to a target group in the Groups tab."}},args:{isOpen:!0,ruleName:"Engineering - US",mode:"preview",status:"done",summary:N,error:null,progress:null,onClose:m(),onConfirmDeactivate:m(),onNavigateToGroup:m()}},r={},o={args:{mode:"deactivate"}},t={args:{status:"loading",summary:null,progress:{current:2,total:3,message:"Loading Engineering Contractors…"}}},a={args:{status:"error",summary:null,error:"Failed to load group members."}},s={args:{summary:C}},n={args:{ruleName:"Engineering - EU",summary:E}},i={args:{ruleName:"Only Rule",summary:f},play:async({canvasElement:u})=>{const e=y(u.ownerDocument.body);await c(e.getByText("This org has no other group rules, so there was nothing to check this rule against.")).toBeVisible(),await c(e.queryByText(/Checked against every other group rule in the org/)).not.toBeInTheDocument()}},l={args:{summary:T},play:async({canvasElement:u})=>{const e=y(u.ownerDocument.body);await c(e.getByText("Checked against every other group rule in the org — none collide with this one.")).toBeVisible(),await c(e.queryByText(/no other group rules/)).not.toBeInTheDocument()}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source},description:{story:"Read-only preview: impact summary across target groups.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'deactivate'
  }
}`,...o.parameters?.docs?.source},description:{story:"Deactivation-confirmation gate: nobody is removed, N become unattributed.",...o.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    status: 'loading',
    summary: null,
    progress: {
      current: 2,
      total: 3,
      message: 'Loading Engineering Contractors…'
    }
  }
}`,...t.parameters?.docs?.source},description:{story:"Capturing member counts across target groups.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    status: 'error',
    summary: null,
    error: 'Failed to load group members.'
  }
}`,...a.parameters?.docs?.source},description:{story:"The impact capture failed.",...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    summary: mockEmptySummary
  }
}`,...s.parameters?.docs?.source},description:{story:"A rule with no target groups — nothing would change.",...s.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    ruleName: 'Engineering - EU',
    summary: mockLargeSummary
  }
}`,...n.parameters?.docs?.source},description:{story:'A large solely-held list, exercising the per-group "and N more…" overflow.',...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    ruleName: 'Only Rule',
    summary: mockNoRuleInventorySummary
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByText('This org has no other group rules, so there was nothing to check this rule against.')).toBeVisible();
    await expect(canvas.queryByText(/Checked against every other group rule in the org/)).not.toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"The org has no other group rules, so there was nothing to check this rule against —\ndistinct from `EvaluatedNoOverlap`, which reads identically on the stat tile alone.",...i.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    summary: mockEvaluatedNoOverlapSummary
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByText('Checked against every other group rule in the org — none collide with this one.')).toBeVisible();
    await expect(canvas.queryByText(/no other group rules/)).not.toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:"Other group rules exist and were checked against this one; none collide. Same\n`totalHeldSolely` as `NoOtherRulesInOrg`, a different fact, so different copy.",...l.parameters?.docs?.description}}};const H=["Default","DeactivateConfirm","Loading","ErrorState","NoTargetGroups","LargeSoleHoldList","NoOtherRulesInOrg","EvaluatedNoOverlap"];export{o as DeactivateConfirm,r as Default,a as ErrorState,l as EvaluatedNoOverlap,n as LargeSoleHoldList,t as Loading,i as NoOtherRulesInOrg,s as NoTargetGroups,H as __namedExportsOrder,D as default};
