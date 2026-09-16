import{j as f,Q as D}from"./iframe-tAvKsVeF.js";import{U as R}from"./UserAppsList-DWMO2jLO.js";import{A as S}from"./appSourceSummary-Cm8F9h35.js";import{s as k}from"./selectionStore-DExy1RDY.js";import"./preload-helper-PPVm8Dsz.js";import"./useRungSelection-DALqsLn1.js";import"./useSelection-DlTpY3y-.js";import"./revealOnHover-DU3PDCIu.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./ruleExpression-nPAdgj2W.js";const{expect:t,fn:r,userEvent:s,within:o}=__STORYBOOK_MODULE_TEST__,I={rule:r(),group:r(),user:r(),app:r(),policy:r()},E="00gFAKE00000000000001",A="00gFAKE00000000000002",b="00gFAKE00000000000003",x=(a,e,n={})=>({group:{id:a,type:"OKTA_GROUP",profile:{name:e}},membershipType:"RULE_BASED",rules:[{id:"0prFAKErule00001",name:"EMEA sales",status:"ACTIVE",conditionExpression:'user.department == "Sales"',groupIds:[a],userAttributes:["department"]}],attribution:"exact",...n}),P=[x(E,"sales.emea"),x(A,"okta.admins",{membershipType:"DIRECT",rules:[]}),x(b,"workday.contractors",{group:{id:b,type:"APP_GROUP",profile:{name:"workday.contractors"}},rules:[]})],T=[{id:"0oaFAKEapp000001",label:"Salesforce",scope:"USER",grantGroupId:E,isProfileSource:!1},{id:"0oaFAKEapp000002",label:"Okta Admin Console",scope:"GROUP",grantGroupId:A,isProfileSource:!1},{id:"0oaFAKEapp000003",label:"Workday",scope:"GROUP",grantGroupId:b,isProfileSource:!0},{id:"0oaFAKEapp000004",label:"Figma",scope:"GROUP",isProfileSource:!1},{id:"0oaFAKEapp000005",label:"Zoom",scope:"USER",isProfileSource:!1},{id:"0oaFAKEapp000006",label:"Slack",isProfileSource:!1}],W={title:"Users/UserAppsList",component:R,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:'Which apps this user has, and which group grants each one. The granting group is named on load at no extra cost — Okta already names it in the `expand=user/{id}` embed — so there is no per-row "name the group" button.\n\nA `Direct` badge and a `Through {group}` line are not in tension: Okta reports a single scope per app-user and prefers `USER`, so `Direct` only means "there is a direct assignment". A grantor that is not known is spelled out in italic rather than left blank, and `complete: false` raises a standing, non-dismissible warning — a partial walk must never read as this user\'s whole access.'}}},decorators:[a=>f.jsx(D,{handlers:I,children:f.jsx(a,{})})],argTypes:{apps:{description:"The user's app assignments, with `grantGroupId` already filled in wherever it is known."},memberships:{description:"The user’s group memberships — used only to *name* a group Okta already credited, never to infer one."},isLoading:{description:"Shows row placeholders instead of the list."},complete:{description:"Whether the pagination walk finished. `false` raises the non-dismissible incompleteness warning."},oktaOrigin:{description:"Origin for the per-row admin deep links; they hide when absent."}},args:{apps:T,memberships:P,isLoading:!1,complete:!0,oktaOrigin:"https://example.okta.com"},beforeEach:()=>(k.clearAll(),()=>k.clearAll())},c={play:async({canvasElement:a})=>{const e=o(a);await t(e.getAllByText("Direct")).toHaveLength(2),await t(e.getAllByText("Via group")).toHaveLength(3),await t(e.getByText("Source unknown")).toBeInTheDocument(),await t(e.getByText("Through sales.emea")).toBeInTheDocument(),t(e.getAllByText(S.GROUP.caveat).length).toBeGreaterThan(0),await t(e.getByText("2 direct · 3 via group · 1 unknown source")).toBeInTheDocument()}},i={args:{apps:[T[0]]},play:async({canvasElement:a})=>{const e=o(a);await t(e.getByText("Direct")).toBeInTheDocument(),await t(e.getByText("Through sales.emea")).toBeInTheDocument(),await t(e.getByTitle(/does not rule out a group path/i)).toBeInTheDocument()}},p={args:{apps:[T[3]]},play:async({canvasElement:a})=>{const e=o(a);await t(e.getByText("Via group")).toBeInTheDocument(),t(e.getAllByText(S.GROUP.caveat).length).toBeGreaterThan(0),await t(e.queryByText(/^Through /)).toBeNull()}},l={args:{apps:[T[1]]},play:async({canvasElement:a})=>{const e=o(a);await t(e.getByText("Okta Admin Console")).toBeInTheDocument(),await t(e.getByText("Privileged")).toBeInTheDocument()}},d={args:{apps:[T[2]]},play:async({canvasElement:a})=>{const e=o(a),n=e.getByRole("button",{name:/Show how Workday is granted/i});await t(n).toHaveAttribute("aria-expanded","false"),await s.click(n),await t(n).toHaveAttribute("aria-expanded","true"),await t(e.getByText("Granted through")).toBeInTheDocument(),await t(e.getByRole("button",{name:"Open group workday.contractors"})).toBeInTheDocument(),await t(e.getByText("Managed by app")).toBeInTheDocument()}},u={args:{isLoading:!0}},m={args:{complete:!1},play:async({canvasElement:a})=>{const n=o(a).getByRole("alert");await t(n).toHaveTextContent(/may be incomplete/i),await t(o(n).queryByRole("button")).toBeNull()}},h={args:{apps:[]},play:async({canvasElement:a})=>{const e=o(a);await t(e.getByText("No apps assigned")).toBeInTheDocument(),await t(e.queryByRole("button",{name:"Clear filters"})).toBeNull()}},g={play:async({canvasElement:a})=>{const e=o(a);await s.type(e.getByRole("searchbox",{name:"Filter apps or granting group"}),"nothing matches this"),await t(e.getByText("No apps match")).toBeInTheDocument(),await s.click(e.getByRole("button",{name:"Clear filters"})),await t(e.getByText("Salesforce")).toBeInTheDocument()}},y={play:async({canvasElement:a})=>{const e=o(a);await s.type(e.getByRole("searchbox",{name:"Filter apps or granting group"}),"workday.contractors"),await t(e.getByText("Workday")).toBeInTheDocument(),await t(e.queryByText("Salesforce")).toBeNull()}},w={play:async({canvasElement:a})=>{const e=o(a);await s.click(e.getByRole("button",{name:/^Unknown 1$/})),await t(e.getByText("Slack")).toBeInTheDocument(),await t(e.queryByText("Salesforce")).toBeNull()}},v={play:async({canvasElement:a})=>{const e=o(a),n=e.getByRole("checkbox",{name:"Select Salesforce"});await t(n).not.toBeChecked(),await s.click(n),await t(n).toBeChecked(),await t(e.getByText(/1 selected/)).toBeInTheDocument(),await s.click(e.getByRole("button",{name:"Select all"})),await t(e.getByRole("checkbox",{name:"Select Slack"})).toBeChecked()}},B={parameters:{viewport:{value:"sidepanelCompact"}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // All three badge states are present and are three different words, so the
    // distinction never rides on colour.
    await expect(canvas.getAllByText('Direct')).toHaveLength(2);
    await expect(canvas.getAllByText('Via group')).toHaveLength(3);
    await expect(canvas.getByText('Source unknown')).toBeInTheDocument();

    // The row that carries both facts: a Direct badge AND a named group.
    await expect(canvas.getByText('Through sales.emea')).toBeInTheDocument();

    // The unresolved row says so rather than leaving its line blank. The same
    // sentence legitimately appears more than once — truncated on the row, on the
    // badge's tooltip, and in full inside the (collapsed) disclosure — so this
    // asserts that it is stated at all, not where.
    //
    // Read from the module that owns the copy rather than retyped: a story that
    // restates the prose goes green while asserting a sentence the pane no longer
    // says, which is worse than going red.
    expect(canvas.getAllByText(APP_SOURCE_COPY.GROUP.caveat).length).toBeGreaterThan(0);

    // The summary accounts for every bucket that is non-zero.
    await expect(canvas.getByText('2 direct · 3 via group · 1 unknown source')).toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:`Every state on one screen: the three badges, the row that states two facts at once,
an unresolved row, and a privileged app.`,...c.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    apps: [APPS[0]]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // Both statements, together, neither retracting the other.
    await expect(canvas.getByText('Direct')).toBeInTheDocument();
    await expect(canvas.getByText('Through sales.emea')).toBeInTheDocument();
    // And the badge still refuses exclusivity in its tooltip.
    await expect(canvas.getByTitle(/does not rule out a group path/i)).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"The `USER`-scope row that also names a group: two facts, neither retracting the other.",...i.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    apps: [APPS[3]]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Via group')).toBeInTheDocument();
    expect(canvas.getAllByText(APP_SOURCE_COPY.GROUP.caveat).length).toBeGreaterThan(0);
    // And it never invents a grantor to fill the line with.
    await expect(canvas.queryByText(/^Through /)).toBeNull();
  }
}`,...p.parameters?.docs?.source},description:{story:"A group-granted row Okta named no group for: a non-answer, stated.",...p.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    apps: [APPS[1]]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Okta Admin Console')).toBeInTheDocument();
    await expect(canvas.getByText('Privileged')).toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:"An app whose assignment is itself administrative access.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    apps: [APPS[2]]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: /Show how Workday is granted/i
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('Granted through')).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Open group workday.contractors'
    })).toBeInTheDocument();
    // The granting group's own source, in the Groups pane's vocabulary.
    await expect(canvas.getByText('Managed by app')).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"A row opened: the caveat in full, the `Granted through` card naming the group and how\nthat group was itself granted, and the admin deep link.",...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    isLoading: true
  }
}`,...u.parameters?.docs?.source},description:{story:"Rows are placeholdered rather than spun, so nothing shifts when they land.",...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    complete: false
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    await expect(alert).toHaveTextContent(/may be incomplete/i);
    // No dismiss control — the caveat cannot be cleared away from the list.
    await expect(within(alert).queryByRole('button')).toBeNull();
  }
}`,...m.parameters?.docs?.source},description:{story:"The walk did not finish, and the warning is not dismissible: it describes the list itself.",...m.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    apps: []
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No apps assigned')).toBeInTheDocument();
    // Distinct from the filtered-empty state: there is nothing to clear.
    await expect(canvas.queryByRole('button', {
      name: 'Clear filters'
    })).toBeNull();
  }
}`,...h.parameters?.docs?.source},description:{story:"Okta reports no assignments at all — a fact about the user, not about a filter.",...h.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox', {
      name: 'Filter apps or granting group'
    }), 'nothing matches this');
    await expect(canvas.getByText('No apps match')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear filters'
    }));
    await expect(canvas.getByText('Salesforce')).toBeInTheDocument();
  }
}`,...g.parameters?.docs?.source},description:{story:"Filtered down to nothing — a different statement, with a way back.",...g.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox', {
      name: 'Filter apps or granting group'
    }), 'workday.contractors');
    await expect(canvas.getByText('Workday')).toBeInTheDocument();
    await expect(canvas.queryByText('Salesforce')).toBeNull();
  }
}`,...y.parameters?.docs?.source},description:{story:"Filtering by the granting group's name, not just the app's.",...y.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /^Unknown 1$/
    }));
    await expect(canvas.getByText('Slack')).toBeInTheDocument();
    await expect(canvas.queryByText('Salesforce')).toBeNull();
  }
}`,...w.parameters?.docs?.source},description:{story:"One bucket at a time, with the pill counts saying what each holds.",...w.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByRole('checkbox', {
      name: 'Select Salesforce'
    });
    await expect(box).not.toBeChecked();
    await userEvent.click(box);
    await expect(box).toBeChecked();
    await expect(canvas.getByText(/1 selected/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Select all'
    }));
    await expect(canvas.getByRole('checkbox', {
      name: 'Select Slack'
    })).toBeChecked();
  }
}`,...v.parameters?.docs?.source},description:{story:`Every row carries a checkbox, backed by the panel-wide selection basket. Select all
replaces the app partition with the currently filtered rows.`,...v.parameters?.docs?.description}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...B.parameters?.docs?.source},description:{story:"The 360px floor: the app label truncates before the badge does, never the verdict.",...B.parameters?.docs?.description}}};const M=["Default","DirectAndViaGroup","UnresolvedSource","PrivilegedApp","OpenDisclosure","Loading","IncompleteWalk","NoApps","FilteredToNothing","FilterByGrantingGroup","FilteredToUnknown","Selectable","Compact"];export{B as Compact,c as Default,i as DirectAndViaGroup,y as FilterByGrantingGroup,g as FilteredToNothing,w as FilteredToUnknown,m as IncompleteWalk,u as Loading,h as NoApps,d as OpenDisclosure,l as PrivilegedApp,v as Selectable,p as UnresolvedSource,M as __namedExportsOrder,W as default};
