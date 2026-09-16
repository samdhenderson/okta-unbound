import{j as m,Q as w}from"./iframe-tAvKsVeF.js";import{G as v}from"./GroupRulesSection-CXK5bPU1.js";import{s as h}from"./selectionStore-DExy1RDY.js";import"./preload-helper-PPVm8Dsz.js";import"./RuleCard-DOJWVDy0.js";import"./ruleUtils-Vt2BA8lQ.js";import"./revealOnHover-DU3PDCIu.js";import"./useRungSelection-DALqsLn1.js";import"./useSelection-DlTpY3y-.js";const{expect:d,fn:R,userEvent:b,within:y}=__STORYBOOK_MODULE_TEST__,f={"00gFAKEGROUP0001":"Engineering — Platform","00gFAKEGROUP0002":"Contractors — EMEA"},p=e=>({status:"ACTIVE",condition:'department == "Engineering"',conditionExpression:'user.department == "Engineering"',groupIds:["00gFAKEGROUP0001"],userAttributes:["department"],created:"2024-01-01T00:00:00.000Z",lastUpdated:"2025-01-01T00:00:00.000Z",...e}),g=[p({id:"0prFAKE1",name:"Engineering intake"}),p({id:"0prFAKE2",name:"Platform contractors",condition:"in Contractors — EMEA and department is Platform",conditionExpression:'isMemberOfAnyGroup("00gFAKEGROUP0002") AND user.department == "Platform"',allGroupNamesMap:f})],A=[p({id:"0prFAKE3",name:"Contractors gate",status:"INACTIVE",condition:"in Engineering — Platform",conditionExpression:'isMemberOfAnyGroup("00gFAKEGROUP0001")',allGroupNamesMap:f})],B={title:"Groups/GroupRulesSection",component:v,tags:["autodocs"],parameters:{docs:{description:{component:"The two rule relationships a group can have, listed separately: rules that **assign members into** it, and rules that merely **consult** it in a condition. Those are opposite facts, so they never share a count.\n\nEach row is the same `RuleCard` the Rules tab renders, with a read-only **When** line carrying the condition beneath it. The section wires no write verb at all, and renders no control that would pretend otherwise."}}},decorators:[e=>m.jsx(w,{handlers:{group:R()},children:m.jsx(e,{})})],beforeEach:()=>(h.clearAll(),()=>h.clearAll()),argTypes:{assigningRules:{description:"Rules whose `assignUserToGroups` targets this group."},assigningStatus:{description:"Status of the assigning-rules load."},assigningError:{description:"Error message when the assigning-rules load failed."},referencingRules:{description:"Rules whose condition expression names this group by id."},referencingStatus:{description:"Status of the referencing-rules load."},referencingError:{description:"Error message when the referencing-rules load failed."},onNavigateToRule:{description:"Opens a rule's detail rung on the Rules tab. Pressing a row is the jump."}},args:{assigningRules:g,assigningStatus:"done",assigningError:null,referencingRules:A,referencingStatus:"done",referencingError:null,onNavigateToRule:R()}},n={},s={play:async({args:e,canvas:u,userEvent:r})=>{const E=u.getAllByRole("button",{name:"Open rule in the Rules tab"});await r.click(E[0]),await d(e.onNavigateToRule).toHaveBeenCalledWith("0prFAKE1")}},t={args:{assigningRules:[g[1]],referencingRules:[]}},a={args:{assigningRules:[],referencingRules:[]}},o={args:{referencingStatus:"loading",referencingRules:[]}},i={args:{referencingStatus:"error",referencingError:"Rules listing unavailable",referencingRules:[]}},c={args:{onNavigateToRule:void 0}},l={play:async({canvasElement:e})=>{const r=y(e).getByRole("checkbox",{name:`Select ${g[0].name}`});await d(r).not.toBeChecked(),await b.click(r),await d(r).toBeChecked()}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"Both relationships populated, with two rules resolving a group id to a named badge.",...n.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    const rows = canvas.getAllByRole('button', {
      name: 'Open rule in the Rules tab'
    });
    await userEvent.click(rows[0]);
    await expect(args.onNavigateToRule).toHaveBeenCalledWith('0prFAKE1');
  }
}`,...s.parameters?.docs?.source},description:{story:"Pressing a row deep-links that rule into the Rules tab.",...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    assigningRules: [assigningRules[1]],
    referencingRules: []
  }
}`,...t.parameters?.docs?.source},description:{story:"A single rule whose condition reads a group by id — the **When** line shows it without a press.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    assigningRules: [],
    referencingRules: []
  }
}`,...a.parameters?.docs?.source},description:{story:"Neither relationship exists — two distinct facts, and no create control.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    referencingStatus: 'loading',
    referencingRules: []
  }
}`,...o.parameters?.docs?.source},description:{story:"One axis still loading while the other has already answered.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    referencingStatus: 'error',
    referencingError: 'Rules listing unavailable',
    referencingRules: []
  }
}`,...i.parameters?.docs?.source},description:{story:"One axis failed; the other keeps its rules rather than disappearing with it.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    onNavigateToRule: undefined
  }
}`,...c.parameters?.docs?.source},description:{story:"No navigation handler: the rows are inert by design, but still state their conditions.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox', {
      name: \`Select \${assigningRules[0].name}\`
    });
    await expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
  }
}`,...l.parameters?.docs?.source},description:{story:"Ticking a row's checkbox — backed by the shared selection basket, the same one the\nRules tab's `RuleCard`s write to. Also the axe-clean proof that the checkbox does not\ntrip `nested-interactive`: it sits above the row's `StretchedButton` overlay via\n`relative z-10`, a sibling rather than a descendant of the interactive control.",...l.parameters?.docs?.description}}};const F=["Default","OpeningARule","ConditionInPlace","NoRules","LoadingOneAxis","OneAxisFailed","NoDeepLink","TogglingASelection"];export{t as ConditionInPlace,n as Default,o as LoadingOneAxis,c as NoDeepLink,a as NoRules,i as OneAxisFailed,s as OpeningARule,l as TogglingASelection,F as __namedExportsOrder,B as default};
