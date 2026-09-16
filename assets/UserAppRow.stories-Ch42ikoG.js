import{j as T,Q as f}from"./iframe-tAvKsVeF.js";import{s as D,U,A as k}from"./appSourceSummary-Cm8F9h35.js";import"./preload-helper-PPVm8Dsz.js";import"./revealOnHover-DU3PDCIu.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./ruleExpression-nPAdgj2W.js";const{expect:t,fn:r,userEvent:E,within:o}=__STORYBOOK_MODULE_TEST__,G={rule:r(),group:r(),user:r(),app:r(),policy:r()},b="00gFAKE00000000000001",A="00gFAKE00000000000002",O="00gFAKE00000000000003",B=(e,a,n={})=>({group:{id:e,type:"OKTA_GROUP",profile:{name:a}},membershipType:"RULE_BASED",rules:[{id:"0prFAKErule00001",name:"EMEA sales",status:"ACTIVE",conditionExpression:'user.department == "Sales"',groupIds:[e],userAttributes:["department"]}],attribution:"exact",...n}),P=[B(b,"sales.emea"),B(A,"okta.admins",{membershipType:"DIRECT",rules:[]}),{group:{id:O,type:"APP_GROUP",profile:{name:"workday.contractors"}},membershipType:"RULE_BASED",rules:[],attribution:"exact"}],s=e=>D([e],P).rows[0],I=s({id:"0oaFAKEapp000005",label:"Zoom",scope:"USER",isProfileSource:!1}),S=s({id:"0oaFAKEapp000001",label:"Salesforce",scope:"USER",grantGroupId:b,isProfileSource:!1}),x=s({id:"0oaFAKEapp000003",label:"Workday",scope:"GROUP",grantGroupId:O,isProfileSource:!0}),_=s({id:"0oaFAKEapp000004",label:"Figma",scope:"GROUP",isProfileSource:!1}),C=s({id:"0oaFAKEapp000006",label:"Slack",isProfileSource:!1}),R=s({id:"0oaFAKEapp000002",label:"Okta Admin Console",scope:"GROUP",grantGroupId:A,isProfileSource:!1}),M={title:"Users/UserAppRow",component:U,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'One app assignment: which app, how Okta says it was granted, and — once known — which group grants it. The row takes an `AppSourceRow` and owns no I/O at all, so scrolling a long list cannot start work.\n\nA `Direct` badge and a `Through {group}` line are not in tension: Okta reports one scope per app-user and prefers `USER`, so `Direct` means "there is a direct assignment", never "direct only". With no group known the second line states the absence in italic rather than going blank.'}}},decorators:[e=>T.jsx(f,{handlers:G,children:T.jsx("div",{className:"bg-canvas p-4",children:T.jsx("ul",{className:"space-y-2",children:T.jsx(e,{})})})})],args:{row:S,oktaOrigin:"https://example.okta.com"},argTypes:{row:{description:"The row's whole rendered model, derived by `appSourceSummary`."},oktaOrigin:{description:"Origin for the admin-console deep link; the link hides when absent."},selected:{description:"Whether this app is in the selection basket; a ticked row paints ListRow's selected state."},onToggleSelect:{description:"Tick or untick this app. Omitted ⇒ no checkbox renders at all."}}},c={},i={args:{row:I},play:async({canvasElement:e})=>{const a=o(e);await t(a.getByText("Direct")).toBeInTheDocument(),t(a.getAllByTitle(k.USER.caveat).length).toBeGreaterThan(0)}},p={args:{row:S},play:async({canvasElement:e})=>{const a=o(e);await t(a.getByText("Direct")).toBeInTheDocument(),await t(a.getByText("Through sales.emea")).toBeInTheDocument()}},l={args:{row:x},play:async({canvasElement:e})=>{const a=o(e);await t(a.getByText("Via group")).toBeInTheDocument(),await t(a.getByText("Through workday.contractors")).toBeInTheDocument()}},d={args:{row:C},play:async({canvasElement:e})=>{const a=o(e);await t(a.getByText("Source unknown")).toBeInTheDocument()}},u={args:{row:_},play:async({canvasElement:e})=>{const a=o(e);await t(a.getByText("Via group")).toBeInTheDocument(),t(a.getAllByText(k.GROUP.caveat).length).toBeGreaterThan(0),await t(a.queryByText(/^Through /)).toBeNull()}},m={args:{row:R},play:async({canvasElement:e})=>{const a=o(e);await t(a.getByText("Privileged")).toBeInTheDocument()}},g={args:{row:x},play:async({canvasElement:e})=>{const a=o(e),n=a.getByRole("button",{name:"Show how Workday is granted"});await t(n).toHaveAttribute("aria-expanded","false"),await E.click(n),await t(n).toHaveAttribute("aria-expanded","true"),await t(a.getByText("Granted through")).toBeInTheDocument(),await t(a.getByText("Managed by app")).toBeInTheDocument()}},h={args:{row:x,oktaOrigin:null}},w={args:{row:R},parameters:{viewport:{value:"sidepanelCompact"}}},y={args:{onToggleSelect:r()},play:async({args:e,canvas:a})=>{const n=a.getByRole("checkbox",{name:"Select Salesforce"});await t(n).not.toBeChecked(),await E.click(n),await t(e.onToggleSelect).toHaveBeenCalledWith(S.id)}},v={args:{onToggleSelect:r(),selected:!0},play:async({canvas:e})=>{await t(e.getByRole("checkbox",{name:"Select Salesforce"})).toBeChecked()}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:"{}",...c.parameters?.docs?.source},description:{story:"The row that carries two facts at once: a `Direct` badge and a named granting group.",...c.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    row: directOnly
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Direct')).toBeInTheDocument();
    // Read from the copy table rather than retyped, so the story cannot drift from
    // \`AppScopeIndicator\`'s vocabulary. It rides on more than one node, so this
    // asserts the caveat is stated — not where.
    expect(canvas.getAllByTitle(APP_SOURCE_COPY.USER.caveat).length).toBeGreaterThan(0);
  }
}`,...i.parameters?.docs?.source},description:{story:"`USER` scope, no group credited — a plain direct assignment.",...i.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    row: directAndViaGroup
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Direct')).toBeInTheDocument();
    await expect(canvas.getByText('Through sales.emea')).toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:"`USER` scope **with** a credited group. Neither statement retracts the other.",...p.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    row: viaNamedGroup
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Via group')).toBeInTheDocument();
    await expect(canvas.getByText('Through workday.contractors')).toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:"`GROUP` scope with the group named — the row Okta answered completely.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    row: sourceUnknown
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Source unknown')).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"No scope reported at all: its own state, stated in words rather than left blank.",...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    row: viaUnnamedGroup
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Via group')).toBeInTheDocument();
    // Read from the table \`appSourceSummary\` owns rather than retyped. It appears
    // in several places, so this asserts the non-answer is stated — not where.
    expect(canvas.getAllByText(APP_SOURCE_COPY.GROUP.caveat).length).toBeGreaterThan(0);
    await expect(canvas.queryByText(/^Through /)).toBeNull();
  }
}`,...u.parameters?.docs?.source},description:{story:"`GROUP` scope and no group named: the second line states the non-answer rather than inventing a grantor.",...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    row: privileged
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Privileged')).toBeInTheDocument();
  }
}`,...m.parameters?.docs?.source},description:{story:"An app whose assignment is itself administrative access.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    row: viaNamedGroup
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: 'Show how Workday is granted'
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('Granted through')).toBeInTheDocument();
    // The granting group's own source, in the Groups pane's vocabulary.
    await expect(canvas.getByText('Managed by app')).toBeInTheDocument();
  }
}`,...g.parameters?.docs?.source},description:{story:"The disclosure opened: the caveat in full, the `Granted through` card, and the admin deep link.",...g.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    row: viaNamedGroup,
    oktaOrigin: null
  }
}`,...h.parameters?.docs?.source},description:{story:"No origin known, so the disclosure carries no link rather than a broken one.",...h.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    row: privileged
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...w.parameters?.docs?.source},description:{story:"The 360px floor: the app label truncates before the badge does, because the badge is the row's answer.",...w.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    onToggleSelect: fn()
  },
  play: async ({
    args,
    canvas
  }) => {
    const box = canvas.getByRole('checkbox', {
      name: 'Select Salesforce'
    });
    await expect(box).not.toBeChecked();
    await userEvent.click(box);
    await expect(args.onToggleSelect).toHaveBeenCalledWith(directAndViaGroup.id);
  }
}`,...y.parameters?.docs?.source},description:{story:"The checkbox costs this row nothing: its only activation is the trailing\ndisclosure `IconButton`, so a box beside the app icon is purely additive.",...y.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    onToggleSelect: fn(),
    selected: true
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByRole('checkbox', {
      name: 'Select Salesforce'
    })).toBeChecked();
  }
}`,...v.parameters?.docs?.source},description:{story:"Ticked. The checkbox is drawn unconditionally — `REVEAL_ON_HOVER` exempts an\nactive control, or a selection would vanish while scrolling — and the row\ntakes `ListRow`'s `selected` state.",...v.parameters?.docs?.description}}};const j=["Default","Direct","DirectAndViaGroup","ViaGroup","SourceUnknown","UnresolvedSource","PrivilegedApp","OpenDisclosure","WithoutOktaOrigin","Compact","Selectable","Selected"];export{w as Compact,c as Default,i as Direct,p as DirectAndViaGroup,g as OpenDisclosure,m as PrivilegedApp,y as Selectable,v as Selected,d as SourceUnknown,u as UnresolvedSource,l as ViaGroup,h as WithoutOktaOrigin,j as __namedExportsOrder,M as default};
