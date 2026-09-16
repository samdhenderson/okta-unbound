import{P as u}from"./PoliciesListPanel-BcyZ0Hho.js";import{r as y}from"./entityCache-B8HCQ8hY.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./useStaggerReveal-XqT17AGi.js";import"./PolicyCard-CF0s8-Ts.js";import"./revealOnHover-DU3PDCIu.js";import"./PolicyRulesList-CSc_6ci5.js";import"./useEntityQuery-Dec7sZ1f.js";const{expect:d,fn:e,userEvent:p,within:m}=__STORYBOOK_MODULE_TEST__,h=[{id:"rstFAKE000000000001",name:"Any two factors",status:"ACTIVE",type:"ACCESS_POLICY",priority:1,description:"Requires two factors for high-risk applications"},{id:"rstFAKE000000000002",name:"Contractor sign-on",status:"INACTIVE",type:"ACCESS_POLICY",priority:2,description:"Device-bound access for external contractors"},{id:"rstFAKE000000000003",name:"Default Policy",status:"ACTIVE",type:"ACCESS_POLICY",priority:3,system:!0}],g=[{id:"0prFAKE000000000001",name:"Catch-all Rule",status:"ACTIVE",priority:1,system:!0}],T={title:"Policies/PoliciesListPanel",component:u,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:'The Auth Policies tab\'s list region: a scrollable list of policy cards, and the right empty state for the situation. "Nothing loaded" also carries the admin-role caveat, because a `403` on the policies endpoint is indistinguishable from an org with no policies.'}}},argTypes:{isLoading:{description:"Whether a policy load is in flight."},policies:{description:"Policies after the search filter — what actually renders."},hasPolicies:{description:"Whether any policies are loaded (picks the empty state)."},onLoad:{description:"Load the policy list (the empty state's action)."},loadRules:{description:"Fetches a policy's rules for the expanded card."},selectedIds:{description:"Every basket id of kind 'policy', including ones ticked elsewhere."},onToggleSelect:{description:"Tick or untick one card's policy."},onSelectAll:{description:"Replaces the policy selection with every currently filtered policy. A request, not a resolved outcome."},onDeselectAll:{description:"Empties the policy partition, leaving other kinds' picks alone."}},args:{isLoading:!1,policies:h,hasPolicies:!0,onLoad:e(),loadRules:e(async()=>g),selectedIds:new Set,onToggleSelect:e(),onSelectAll:e(),onDeselectAll:e()},beforeEach:()=>{y()}},s={},t={play:async({args:c,canvasElement:l})=>{const n=m(l);await p.click(n.getByRole("button",{name:"Show rules for Any two factors"})),await d(await n.findByText("Catch-all Rule")).toBeInTheDocument(),await d(c.loadRules).toHaveBeenCalledWith("rstFAKE000000000001")}},a={args:{isLoading:!0,policies:[],hasPolicies:!1}},o={args:{policies:[],hasPolicies:!1},play:async({args:c,canvasElement:l})=>{const n=m(l);await p.click(n.getByRole("button",{name:"Reload Policies"})),await d(c.onLoad).toHaveBeenCalled()}},i={args:{policies:[],hasPolicies:!0}},r={args:{selectedIds:new Set([h[0].id])}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"Three policies.",...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show rules for Any two factors'
    }));
    await expect(await canvas.findByText('Catch-all Rule')).toBeInTheDocument();
    await expect(args.loadRules).toHaveBeenCalledWith('rstFAKE000000000001');
  }
}`,...t.parameters?.docs?.source},description:{story:"Expanding a card fetches that policy's rules through `loadRules` and lists them.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    isLoading: true,
    policies: [],
    hasPolicies: false
  }
}`,...a.parameters?.docs?.source},description:{story:"The load is in flight.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    policies: [],
    hasPolicies: false
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Reload Policies'
    }));
    await expect(args.onLoad).toHaveBeenCalled();
  }
}`,...o.parameters?.docs?.source},description:{story:"Nothing came back — the empty state naming the admin-role caveat.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    policies: [],
    hasPolicies: true
  }
}`,...i.parameters?.docs?.source},description:{story:"Policies are loaded but the search matches none of them.",...i.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    selectedIds: new Set([samplePolicies[0].id])
  }
}`,...r.parameters?.docs?.source},description:{story:"One policy already ticked — the card shows it, and the control line reports the count.",...r.parameters?.docs?.description}}};const L=["Default","ExpandingACard","Loading","NoPolicies","NoSearchMatches","WithSelection"];export{s as Default,t as ExpandingACard,a as Loading,o as NoPolicies,i as NoSearchMatches,r as WithSelection,L as __namedExportsOrder,T as default};
