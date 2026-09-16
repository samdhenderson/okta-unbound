import{C as m}from"./CompareGroupModal-CQnBobZq.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:p,fn:r,userEvent:h}=__STORYBOOK_MODULE_TEST__,i=e=>({type:"OKTA_GROUP",memberCount:0,hasRules:!1,ruleCount:0,usedInRuleCount:0,...e}),g=i({id:"00gFAKE000000000001",name:"Engineering",memberCount:128}),l=[i({id:"00gFAKE000000000002",name:"Engineering — Contractors",memberCount:14}),i({id:"00gFAKE000000000003",name:"Product",memberCount:61}),i({id:"00gFAKE000000000004",name:"Payroll app users",type:"APP_GROUP",memberCount:1})],f={title:"Groups/CompareGroupModal",component:m,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The second-operand picker behind the Group Detail rung's *Compare* action: a detail page has no rows to tick, so this modal supplies the missing group and hands both to `GroupComparisonModal`. Each hit carries its member count, which the overlap split is computed against.\n\n*Compare* stays disabled until a group is chosen, and the group being viewed is never among the hits."}}},args:{isOpen:!0,group:g,query:"",onQueryChange:r(),results:[],isSearching:!1,searchError:null,selected:null,onSelect:r(),onClearSelected:r(),canSearch:!0,onClose:r(),onConfirm:r()},argTypes:{group:{description:"The group on screen — the first operand, named in the field label."},results:{description:"Hits, with the viewed group already removed by the hook."},canSearch:{description:"False with no connected Okta tab; the field disables with a hint."},selected:{description:"The chosen second operand. Null ⇒ *Compare* is disabled."}}},a={play:async({canvas:e})=>{await p(e.getByRole("button",{name:"Compare"})).toBeDisabled()}},s={args:{query:"eng",results:l}},o={args:{query:"eng",isSearching:!0}},t={args:{selected:l[1]},play:async({args:e,canvas:u})=>{const d=u.getByRole("button",{name:"Compare"});await p(d).toBeEnabled(),await h.click(d),await p(e.onConfirm).toHaveBeenCalled()}},n={args:{canSearch:!1}},c={args:{query:"eng",searchError:"Failed to search groups"}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByRole('button', {
      name: 'Compare'
    })).toBeDisabled();
  }
}`,...a.parameters?.docs?.source},description:{story:"Nothing typed yet: an empty field and a disabled *Compare*.",...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    query: 'eng',
    results: hits
  }
}`,...s.parameters?.docs?.source},description:{story:"A query with hits — each row carries the member count the comparison needs.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    query: 'eng',
    isSearching: true
  }
}`,...o.parameters?.docs?.source},description:{story:"Mid-search: the field shows its spinner while the debounced request is out.",...o.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    selected: hits[1]
  },
  play: async ({
    args,
    canvas
  }) => {
    const compare = canvas.getByRole('button', {
      name: 'Compare'
    });
    await expect(compare).toBeEnabled();
    await userEvent.click(compare);
    await expect(args.onConfirm).toHaveBeenCalled();
  }
}`,...t.parameters?.docs?.source},description:{story:"A group chosen: the field collapses to its summary and *Compare* enables.",...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    canSearch: false
  }
}`,...n.parameters?.docs?.source},description:{story:"No connected Okta tab: the field disables and says why, rather than searching nothing.",...n.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    query: 'eng',
    searchError: 'Failed to search groups'
  }
}`,...c.parameters?.docs?.source},description:{story:"The search itself failed — reported as a `danger` alert, not an empty result list.",...c.parameters?.docs?.description}}};const S=["Default","WithResults","Searching","GroupChosen","NoConnectedTab","SearchFailed"];export{a as Default,t as GroupChosen,n as NoConnectedTab,c as SearchFailed,o as Searching,s as WithResults,S as __namedExportsOrder,f as default};
