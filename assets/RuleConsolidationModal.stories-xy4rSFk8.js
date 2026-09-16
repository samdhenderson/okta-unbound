import{R as f}from"./RuleConsolidationModal-D9cL_vDO.js";import{A as v}from"./useActorNotice-Cg6X6cVk.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:E,fn:d,userEvent:u,waitFor:y,within:A}=__STORYBOOK_MODULE_TEST__,C=[{id:"grp1",name:"Engineering"},{id:"grp2",name:"Engineering Managers"},{id:"grp3",name:"Engineering Contractors"}],l=[{id:"rule1",name:"Engineering - US",status:"ACTIVE"},{id:"rule2",name:"Engineering - EU",status:"ACTIVE"}],S={mode:"add-target",baseName:"Engineering - US",resultingName:"Engineering - US (consolidated)",resultingGroupIds:["grp1","grp2"],addedGroupIds:["grp2"],addedGroupNames:["Engineering Managers"],retireRules:l,willActivate:!0},T={mode:"merge",baseName:"Engineering - US",resultingName:"Engineering (consolidated)",resultingGroupIds:["grp1","grp3"],addedGroupIds:["grp3"],addedGroupNames:["Engineering Contractors"],retireRules:l,willActivate:!0},g={createdRuleId:"rule99",createdRuleName:"Engineering - US (consolidated)",retired:2,retireFailed:0},k={title:"Rules/RuleConsolidationModal",component:f,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"Wizard for rule consolidation. The add-target flow is search-select a group → dry-run diff → confirm; the merge flow opens straight to the diff for a cluster of identical-expression rules. Confirming creates the union rule, activates it if needed, then retires the source rules — all audited and captured for undo."}}},argTypes:{phase:{description:"Lifecycle phase of the consolidation flow, driving which step renders."},preview:{description:"The dry-run diff of the resulting rule, or null before a preview."},result:{description:"The outcome of a completed run, or null until done."},error:{description:"Failure message to surface, or null."},actorNotice:{description:"Non-blocking notice for a run whose acting admin could not be confirmed, so the audit entry carries no actor."},onDismissActorNotice:{description:"Dismiss the actor-unavailable notice."},searchGroups:{description:"Search groups by name (add-target select step)."},onChooseGroup:{description:"Choose the group to add."},onExecute:{description:"Execute the consolidation."},onClose:{description:"Close + reset."}},args:{phase:"select",preview:null,result:null,error:null,searchGroups:d(async()=>C),onChooseGroup:d(),onExecute:d(),onClose:d()}},e={},r={play:async({args:m,canvasElement:h})=>{const p=A(h.ownerDocument.body);await u.type(p.getByPlaceholderText("Search groups by name…"),"Engineering");const w=await p.findByRole("button",{name:"Engineering Managers"});await u.click(w),await y(()=>E(m.onChooseGroup).toHaveBeenCalledWith("grp2","Engineering Managers"))}},o={args:{phase:"loading"}},n={args:{phase:"preview",preview:S}},s={args:{phase:"preview",preview:T}},a={args:{phase:"running"}},t={args:{phase:"done",result:g}},i={args:{phase:"error",error:"Failed to create the consolidated rule: rate limited."}},c={args:{phase:"done",result:g,actorNotice:v,onDismissActorNotice:d()}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:"Add-target flow: the group search-select step.",...e.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.type(canvas.getByPlaceholderText('Search groups by name…'), 'Engineering');
    const hit = await canvas.findByRole('button', {
      name: 'Engineering Managers'
    });
    await userEvent.click(hit);
    await waitFor(() => expect(args.onChooseGroup).toHaveBeenCalledWith('grp2', 'Engineering Managers'));
  }
}`,...r.parameters?.docs?.source},description:{story:"The search-select step running: typing searches, and picking a hit chooses it.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    phase: 'loading'
  }
}`,...o.parameters?.docs?.source},description:{story:"Loading the source rule before the wizard can proceed.",...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    phase: 'preview',
    preview: mockPreview
  }
}`,...n.parameters?.docs?.source},description:{story:"Dry-run diff for adding a target group to an existing rule.",...n.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    phase: 'preview',
    preview: mockMergePreview
  }
}`,...s.parameters?.docs?.source},description:{story:"Dry-run diff for merging two identical-condition rules.",...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    phase: 'running'
  }
}`,...a.parameters?.docs?.source},description:{story:"The write is in flight: creating the new rule and retiring the sources.",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    phase: 'done',
    result: mockResult
  }
}`,...t.parameters?.docs?.source},description:{story:"A successfully completed consolidation.",...t.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    phase: 'error',
    error: 'Failed to create the consolidated rule: rate limited.'
  }
}`,...i.parameters?.docs?.source},description:{story:"The consolidation failed and surfaced an error message.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    phase: 'done',
    result: mockResult,
    actorNotice: ACTOR_UNAVAILABLE_NOTICE,
    onDismissActorNotice: fn()
  }
}`,...c.parameters?.docs?.source},description:{story:`A completed run whose acting admin could not be confirmed: the consolidation went
through and is audited with no actor on the entry. The notice never blocks the run.`,...c.parameters?.docs?.description}}};const D=["Default","ChoosingAGroup","Loading","AddTargetPreview","MergePreview","Running","Done","ErrorState","ActorUnavailable"];export{c as ActorUnavailable,n as AddTargetPreview,r as ChoosingAGroup,e as Default,t as Done,i as ErrorState,o as Loading,s as MergePreview,a as Running,D as __namedExportsOrder,k as default};
