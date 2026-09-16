import b from"./AuthPoliciesTab-CuGFJGj0.js";import{u as m,m as u}from"./useOktaApi.mock-bZSfZMMp.js";import{r as y}from"./entityCache-B8HCQ8hY.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./PoliciesListPanel-BcyZ0Hho.js";import"./useStaggerReveal-XqT17AGi.js";import"./PolicyCard-CF0s8-Ts.js";import"./revealOnHover-DU3PDCIu.js";import"./PolicyRulesList-CSc_6ci5.js";import"./useEntityQuery-Dec7sZ1f.js";import"./useOwedLoad-DMHsWWoG.js";import"./usePoliciesData-B9NC3cn4.js";import"./keys-CUIcVywe.js";import"./useRefreshSubject-C1Lrhmtk.js";import"./useRungSelection-DALqsLn1.js";import"./useSelection-DlTpY3y-.js";import"./selectionStore-DExy1RDY.js";import"./policyFilters-0Alm462X.js";import"./dateFormat-tpkRVL7u.js";const{expect:h,fn:t,userEvent:f,waitFor:w,within:g}=__STORYBOOK_MODULE_TEST__,E=[{id:"rstFAKE000000000001",name:"Any two factors",status:"ACTIVE",type:"ACCESS_POLICY",priority:1,description:"Requires two factors for high-risk applications",system:!1,created:"2026-01-15T09:00:00.000Z",lastUpdated:"2026-06-02T11:30:00.000Z"},{id:"rstFAKE000000000002",name:"Contractor sign-on",status:"INACTIVE",type:"ACCESS_POLICY",priority:2,description:"Device-bound access for external contractors",system:!1,created:"2026-02-01T09:00:00.000Z"},{id:"rstFAKE000000000003",name:"Default Policy",status:"ACTIVE",type:"ACCESS_POLICY",priority:3,description:"Catch-all policy applied to apps with no explicit policy",system:!0}],T=[{id:"0prFAKE000000000001",name:"Trusted device, no prompt",status:"ACTIVE",priority:1},{id:"0prFAKE000000000002",name:"Off-network step-up",status:"ACTIVE",priority:2},{id:"0prFAKE000000000003",name:"Catch-all Rule",status:"ACTIVE",priority:3,system:!0}],N={title:"Policies/AuthPoliciesTab",component:b,tags:["autodocs"],parameters:{layout:"fullscreen",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:"Auth Policies tab shell: browse and search the org's app authentication policies, with each card's rules fetched lazily on expand.\n\nRead-only by construction. Because Okta's policy endpoints are commonly forbidden for non-super-admins, a `403` is indistinguishable from an empty org, so the empty state names both."}}},argTypes:{targetTabId:{description:"Chrome tab id of the connected Okta tab; the load is skipped when absent."},isActive:{description:"Whether this is the selected top-level tab; the load defers until it is."},selectedPolicyId:{description:"A policy to arrive at, applied once as a filter then cleared."}},args:{targetTabId:1},beforeEach:()=>{y(),m.mockReturnValue(u({listPolicies:t(async()=>E),getPolicyRules:t(async()=>T)}))}},s={},r={beforeEach:()=>{y(),m.mockReturnValue(u({listPolicies:t(()=>new Promise(()=>{}))}))}},n={beforeEach:()=>{y(),m.mockReturnValue(u({listPolicies:t(async()=>[])}))}},i={beforeEach:()=>{y(),m.mockReturnValue(u({listPolicies:t(async()=>{throw new Error("Failed to fetch auth policies")})}))}},c={play:async({canvasElement:a})=>{const e=g(a),o=await e.findByRole("button",{name:"Show rules for Any two factors"});await f.click(o),await w(()=>h(e.getByText("Trusted device, no prompt")).toBeInTheDocument())}},l={play:async({canvasElement:a})=>{const e=g(a),o=await e.findByRole("button",{name:"Show rules for Any two factors"});await f.click(o),await w(()=>h(e.getByText(/Could not load rules/)).toBeInTheDocument())},beforeEach:()=>{y(),m.mockReturnValue(u({listPolicies:t(async()=>E),getPolicyRules:t(async()=>{throw new Error("Policy rules unavailable")})}))}},p={play:async({canvasElement:a})=>{const e=g(a),o=await e.findByRole("searchbox",{name:"Search auth policies"});await f.type(o,"contractor"),await w(()=>h(e.getByText("Contractor sign-on")).toBeInTheDocument()),await h(e.queryByText("Any two factors")).not.toBeInTheDocument()}},d={args:{targetTabId:void 0}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"Three policies loaded — the populated list with its search box.",...s.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  beforeEach: () => {
    resetEntityCache();
    useOktaApi.mockReturnValue(makeUseOktaApiValue({
      listPolicies: fn(() => new Promise<OktaPolicyListItem[]>(() => {}))
    }));
  }
}`,...r.parameters?.docs?.source},description:{story:"The policy load is still in flight — full-panel spinner.",...r.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  beforeEach: () => {
    resetEntityCache();
    useOktaApi.mockReturnValue(makeUseOktaApiValue({
      listPolicies: fn(async () => [] as OktaPolicyListItem[])
    }));
  }
}`,...n.parameters?.docs?.source},description:{story:"No policies came back. Indistinguishable from a `403` for an admin role without\npolicy read access, so the empty state names both possibilities.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  beforeEach: () => {
    resetEntityCache();
    useOktaApi.mockReturnValue(makeUseOktaApiValue({
      listPolicies: fn(async () => {
        throw new Error('Failed to fetch auth policies');
      })
    }));
  }
}`,...i.parameters?.docs?.source},description:{story:"The policy load failed — dismissible `danger` banner above the empty list.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('button', {
      name: 'Show rules for Any two factors'
    });
    await userEvent.click(toggle);
    await waitFor(() => expect(canvas.getByText('Trusted device, no prompt')).toBeInTheDocument());
  }
}`,...c.parameters?.docs?.source},description:{story:"A policy expanded to reveal its lazily-fetched rules.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('button', {
      name: 'Show rules for Any two factors'
    });
    await userEvent.click(toggle);
    await waitFor(() => expect(canvas.getByText(/Could not load rules/)).toBeInTheDocument());
  },
  beforeEach: () => {
    resetEntityCache();
    useOktaApi.mockReturnValue(makeUseOktaApiValue({
      listPolicies: fn(async () => samplePolicies),
      getPolicyRules: fn(async () => {
        throw new Error('Policy rules unavailable');
      })
    }));
  }
}`,...l.parameters?.docs?.source},description:{story:"A policy whose rules fail to load — the inline per-policy `danger` state on expand.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const search = await canvas.findByRole('searchbox', {
      name: 'Search auth policies'
    });
    await userEvent.type(search, 'contractor');
    await waitFor(() => expect(canvas.getByText('Contractor sign-on')).toBeInTheDocument());
    await expect(canvas.queryByText('Any two factors')).not.toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:"Type into the search box: the list narrows to the matching policy.",...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    targetTabId: undefined
  }
}`,...d.parameters?.docs?.source},description:{story:'No Okta tab connected — nothing is fetched; the header offers "Load Policies".',...d.parameters?.docs?.description}}};const Z=["Default","Loading","Empty","ErrorState","ExpandedRules","RulesLoadFailure","SearchFiltersList","Disconnected"];export{s as Default,d as Disconnected,n as Empty,i as ErrorState,c as ExpandedRules,r as Loading,l as RulesLoadFailure,p as SearchFiltersList,Z as __namedExportsOrder,N as default};
