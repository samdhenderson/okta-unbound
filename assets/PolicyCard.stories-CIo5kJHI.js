import{j as T}from"./iframe-tAvKsVeF.js";import{P as f}from"./PolicyCard-CF0s8-Ts.js";import{r as E}from"./entityCache-B8HCQ8hY.js";import"./preload-helper-PPVm8Dsz.js";import"./revealOnHover-DU3PDCIu.js";import"./PolicyRulesList-CSc_6ci5.js";import"./useEntityQuery-Dec7sZ1f.js";const{expect:a,fn:w,userEvent:s,waitFor:v,within:h}=__STORYBOOK_MODULE_TEST__,n={id:"rstFAKE000000000001",name:"Any two factors",status:"ACTIVE",type:"ACCESS_POLICY",priority:1,description:"Requires two factors for high-risk applications",system:!1},B=[{id:"0prFAKE000000000001",name:"Trusted device, no prompt",status:"ACTIVE",priority:1},{id:"0prFAKE000000000002",name:"Catch-all Rule",status:"ACTIVE",priority:2,system:!0}],I={title:"Policies/PolicyCard",component:f,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"Collapsed it shows the policy name, status pill, evaluation priority, a `System` badge for Okta-managed policies and the description. Expanding fetches the policy's rules through the entity cache, so re-expanding costs no second request. The card is strictly read-only — it renders no mutation affordance at all."}}},argTypes:{policy:{description:"The validated policy to display."},loadRules:{description:"Fetches a policy's rules (the tab passes `api.getPolicyRules`)."},selected:{description:"Whether this policy is in the selection basket; a ticked card paints ListRow's selected state."},onToggleSelect:{description:"Tick or untick this policy. Omitted ⇒ no checkbox renders at all."}},args:{policy:n,loadRules:w(async()=>B)},beforeEach:()=>{E()}},c={},r={args:{policy:{id:"rstFAKE000000000003",name:"Default Policy",status:"ACTIVE",type:"ACCESS_POLICY",priority:99,system:!0}}},i={args:{policy:{...n,id:"rstFAKE000000000002",status:"INACTIVE"}}},l={play:async({canvasElement:t})=>{const e=h(t);await s.click(e.getByRole("button",{name:"Show rules for Any two factors"})),await v(()=>a(e.getByText("Trusted device, no prompt")).toBeInTheDocument()),await a(e.getByRole("button",{name:`Copy policy id for Any two factors (${n.id})`})).toBeInTheDocument()}},d={play:async({canvasElement:t})=>{const e=h(t);await s.click(e.getByRole("button",{name:"Show rules"})),await v(()=>a(e.getByText("Trusted device, no prompt")).toBeInTheDocument()),await a(e.getByRole("button",{name:"Hide rules"})).toBeInTheDocument()}},p={play:async({canvasElement:t})=>{const e=h(t),o=e.getByRole("button",{name:"Show rules for Any two factors"});o.focus(),await s.keyboard("{Enter}"),await v(()=>a(e.getByText("Trusted device, no prompt")).toBeInTheDocument()),await a(o).toHaveAttribute("aria-expanded","true")}},y={args:{loadRules:w(async()=>{throw new Error("Policy rules unavailable")})},play:async({canvasElement:t})=>{const e=h(t);await s.click(e.getByRole("button",{name:"Show rules for Any two factors"})),await v(()=>a(e.getByText(/Could not load rules/)).toBeInTheDocument())}},u={render:t=>T.jsxs("div",{className:"space-y-2",children:[T.jsx(f,{...t,policy:{...n,id:"rstFAKE000000000001"}}),T.jsx(f,{...t,policy:{...n,id:"rstFAKE000000000004"}})]}),play:async({canvasElement:t})=>{const e=h(t),o=e.getAllByRole("button",{name:"Show rules for Any two factors"});a(o).toHaveLength(2),await s.click(o[0]),await s.click(o[1]),await a(e.getByRole("button",{name:"Copy policy id for Any two factors (rstFAKE000000000001)"})).toBeInTheDocument(),await a(e.getByRole("button",{name:"Copy policy id for Any two factors (rstFAKE000000000004)"})).toBeInTheDocument()}},m={args:{onToggleSelect:w()},play:async({args:t,canvas:e})=>{const o=e.getByRole("checkbox",{name:"Select Any two factors"});await a(o).not.toBeChecked(),await s.click(o),await a(t.onToggleSelect).toHaveBeenCalledWith(n.id)}},g={args:{onToggleSelect:w(),selected:!0},play:async({canvas:t})=>{await a(t.getByRole("checkbox",{name:"Select Any two factors"})).toBeChecked()}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:"{}",...c.parameters?.docs?.source},description:{story:"Collapsed — nothing has been fetched yet.",...c.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    policy: {
      id: 'rstFAKE000000000003',
      name: 'Default Policy',
      status: 'ACTIVE',
      type: 'ACCESS_POLICY',
      priority: 99,
      system: true
    } as OktaPolicyListItem
  }
}`,...r.parameters?.docs?.source},description:{story:"An Okta-managed catch-all policy: `System` badge, no description.",...r.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    policy: {
      ...samplePolicy,
      id: 'rstFAKE000000000002',
      status: 'INACTIVE'
    } as OktaPolicyListItem
  }
}`,...i.parameters?.docs?.source},description:{story:"A deactivated policy — neutral status pill.",...i.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show rules for Any two factors'
    }));
    await waitFor(() => expect(canvas.getByText('Trusted device, no prompt')).toBeInTheDocument());
    await expect(canvas.getByRole('button', {
      name: \`Copy policy id for Any two factors (\${samplePolicy.id})\`
    })).toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:"Expanded, with the lazily-fetched rules and the policy's copyable id.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show rules'
    }));
    await waitFor(() => expect(canvas.getByText('Trusted device, no prompt')).toBeInTheDocument());
    await expect(canvas.getByRole('button', {
      name: 'Hide rules'
    })).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"Clicking anywhere in the header toggles the disclosure, not just the trailing\n`IconButton`. The overlay's accessible name is the shorter `Show rules`, so the\ntwo controls do not announce as one message doubled.",...d.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', {
      name: 'Show rules for Any two factors'
    });
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(canvas.getByText('Trusted device, no prompt')).toBeInTheDocument());
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
}`,...p.parameters?.docs?.source},description:{story:"The keyboard path: the trailing `IconButton` carries `aria-expanded` and opens on Enter.",...p.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    loadRules: fn(async () => {
      throw new Error('Policy rules unavailable');
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show rules for Any two factors'
    }));
    await waitFor(() => expect(canvas.getByText(/Could not load rules/)).toBeInTheDocument());
  }
}`,...y.parameters?.docs?.source},description:{story:"Expanded when the rules fetch fails — the inline `danger` state.",...y.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  render: args => <div className="space-y-2">
      <PolicyCard {...args} policy={{
      ...samplePolicy,
      id: 'rstFAKE000000000001'
    }} />
      <PolicyCard {...args} policy={{
      ...samplePolicy,
      id: 'rstFAKE000000000004'
    }} />
    </div>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const toggles = canvas.getAllByRole('button', {
      name: 'Show rules for Any two factors'
    });
    expect(toggles).toHaveLength(2);
    await userEvent.click(toggles[0]);
    await userEvent.click(toggles[1]);
    await expect(canvas.getByRole('button', {
      name: 'Copy policy id for Any two factors (rstFAKE000000000001)'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Copy policy id for Any two factors (rstFAKE000000000004)'
    })).toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:`Two policies sharing a display name, different ids. The copy controls fold the id
into their accessible names and stay distinguishable; the disclosure controls do not.`,...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    onToggleSelect: fn()
  },
  play: async ({
    args,
    canvas
  }) => {
    const box = canvas.getByRole('checkbox', {
      name: 'Select Any two factors'
    });
    await expect(box).not.toBeChecked();
    await userEvent.click(box);
    await expect(args.onToggleSelect).toHaveBeenCalledWith(samplePolicy.id);
  }
}`,...m.parameters?.docs?.source},description:{story:"The checkbox needs the same `relative z-10` escape hatch as the trailing\n`IconButton`, since the header is already a `StretchedButton` overlay —\nwithout it the checkbox would sit under the overlay and be unclickable.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    onToggleSelect: fn(),
    selected: true
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByRole('checkbox', {
      name: 'Select Any two factors'
    })).toBeChecked();
  }
}`,...g.parameters?.docs?.source},description:{story:"Ticked. The checkbox is drawn unconditionally — `REVEAL_ON_HOVER` exempts an\nactive control, or a selection would vanish while scrolling — and the card\ntakes `ListRow`'s `selected` state.",...g.parameters?.docs?.description}}};const D=["Default","SystemPolicy","Inactive","Expanded","HeaderClickToggles","KeyboardToggles","RulesLoadFailure","DuplicateNamesStayDistinguishable","Selectable","Selected"];export{c as Default,u as DuplicateNamesStayDistinguishable,l as Expanded,d as HeaderClickToggles,i as Inactive,p as KeyboardToggles,y as RulesLoadFailure,m as Selectable,g as Selected,r as SystemPolicy,D as __namedExportsOrder,I as default};
