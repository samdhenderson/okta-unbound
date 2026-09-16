import{R}from"./RulesListPanel-C3AZLTzZ.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./useStaggerReveal-XqT17AGi.js";import"./RuleCard-DOJWVDy0.js";import"./ruleUtils-Vt2BA8lQ.js";import"./revealOnHover-DU3PDCIu.js";const{expect:u,fn:g,userEvent:m,within:p}=__STORYBOOK_MODULE_TEST__,s=[{id:"00rABCDEF1234567890",name:"Engineering – Auto-assign by department",status:"ACTIVE",condition:'user.department == "Engineering"',conditionExpression:'user.department == "Engineering"',groupIds:["00g1a2b3c4d5e6f7g8h9","00g9z8y7x6w5v4u3t2s1"],groupNames:["Engineering – All","Slack – Eng Channel"],userAttributes:["department"],created:"2024-01-15T09:00:00.000Z",lastUpdated:"2026-06-01T14:30:00.000Z",affectsCurrentGroup:!0},{id:"00rZYXWVUT0987654321",name:"Contractors – Auto-assign by user type",status:"INACTIVE",condition:'user.userType == "Contractor"',conditionExpression:'user.userType == "Contractor"',groupIds:["00g5f6g7h8i9j0k1l2m3"],groupNames:["Contractors – All"],userAttributes:["userType"],created:"2023-11-02T12:00:00.000Z",lastUpdated:"2025-03-20T10:15:00.000Z"},{id:"00rLMNOPQR1122334455",name:"Sales – Auto-assign by division",status:"ACTIVE",condition:'user.division == "Sales"',conditionExpression:'user.division == "Sales"',groupIds:["00g6g7h8i9j0k1l2m3n4"],groupNames:["Sales – All"],userAttributes:["division"],created:"2024-05-10T08:00:00.000Z",lastUpdated:"2026-02-14T16:45:00.000Z"}],T={title:"Rules/RulesListPanel",component:R,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'The Rules tab\'s list region, switching between four states: a skeleton while loading, a "Load Rules" call-to-action when nothing is loaded, a "no match" empty state when the search or filter excludes every rule, and otherwise the filtered `RuleCard` list. Each card is a row that opens the rule\'s own detail rung.'}}},argTypes:{isLoading:{description:"Whether a load is in flight."},hasRules:{description:'Whether any rules are loaded at all (drives the "load" vs "no match" empty state).'},filteredRules:{description:"Rules after search + filter."},onLoad:{description:"Load rules (used by the empty-state action)."},onOpenRule:{description:"Open a rule's detail rung."},selectedRuleId:{description:"Rule id being opened (deep-link target), for the arrival flash."},selectedRuleIds:{description:"Ids ticked in the selection basket's `rule` partition."},onToggleSelect:{description:"Toggles a rule's id in the selection basket."}},args:{isLoading:!1,hasRules:!0,filteredRules:s,onLoad:g(),onOpenRule:g(),selectedRuleId:null,selectedRuleIds:new Set,onToggleSelect:g()}},n={play:async({canvasElement:e,args:t})=>{const a=p(e),[h]=a.getAllByRole("button",{name:/open rule/i});await m.click(h),await u(t.onOpenRule).toHaveBeenCalledWith(u.objectContaining({id:s[0].id}))}},o={args:{isLoading:!0}},r={args:{hasRules:!1,filteredRules:[]},play:async({canvasElement:e,args:t})=>{const a=p(e);await m.click(a.getByRole("button",{name:"Load Rules"})),await u(t.onLoad).toHaveBeenCalledTimes(1)}},i={args:{filteredRules:[]}},l={args:{selectedRuleId:s[0].id}},c={play:async({args:e,canvasElement:t})=>{const a=p(t);await m.click(a.getByRole("checkbox",{name:`Select ${s[1].name}`})),await u(e.onToggleSelect).toHaveBeenCalledWith(s[1].id)}},d={args:{selectedRuleIds:new Set([s[0].id])},play:async({canvasElement:e})=>{const t=p(e).getByRole("checkbox",{name:`Select ${s[0].name}`});await u(t).toBeChecked()}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const [first] = canvas.getAllByRole('button', {
      name: /open rule/i
    });
    await userEvent.click(first);
    await expect(args.onOpenRule).toHaveBeenCalledWith(expect.objectContaining({
      id: sampleRules[0].id
    }));
  }
}`,...n.parameters?.docs?.source},description:{story:"Populated list of rule cards. Pressing a card asks the host to open that rule.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    isLoading: true
  }
}`,...o.parameters?.docs?.source},description:{story:"Row skeletons while rules are loading.",...o.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    hasRules: false,
    filteredRules: []
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Load Rules'
    }));
    await expect(args.onLoad).toHaveBeenCalledTimes(1);
  }
}`,...r.parameters?.docs?.source},description:{story:"Nothing loaded yet — the empty state's own action starts the load.",...r.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    filteredRules: []
  }
}`,...i.parameters?.docs?.source},description:{story:'Rules are loaded, but none match the current search/filter — "no match" empty state.',...i.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    selectedRuleId: sampleRules[0].id
  }
}`,...l.parameters?.docs?.source},description:{story:"A deep-link target rule, flashing on arrival.",...l.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('checkbox', {
      name: \`Select \${sampleRules[1].name}\`
    }));
    await expect(args.onToggleSelect).toHaveBeenCalledWith(sampleRules[1].id);
  }
}`,...c.parameters?.docs?.source},description:{story:"Ticking a row's checkbox reports that rule's id — the row's only job; the basket\nitself is owned by the caller (`RulesTab`'s `useRungSelection`).\n\nAlso the axe-clean proof that the checkbox does not trip `nested-interactive`: the\nrow's own click target is a `StretchedButton` overlay, and the checkbox sits above it\nvia `relative z-10` rather than inside it, so the two never nest.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    selectedRuleIds: new Set([sampleRules[0].id])
  },
  play: async ({
    canvasElement
  }) => {
    const checkbox = within(canvasElement).getByRole('checkbox', {
      name: \`Select \${sampleRules[0].name}\`
    });
    await expect(checkbox).toBeChecked();
  }
}`,...d.parameters?.docs?.source},description:{story:"A ticked row keeps its checkbox visible unconditionally, and reads as selected.",...d.parameters?.docs?.description}}};const E=["Default","Loading","NoRulesLoaded","NoMatchingRules","WithSelectedRule","TogglingASelection","WithASelectedRule"];export{n as Default,o as Loading,i as NoMatchingRules,r as NoRulesLoaded,c as TogglingASelection,d as WithASelectedRule,l as WithSelectedRule,E as __namedExportsOrder,T as default};
