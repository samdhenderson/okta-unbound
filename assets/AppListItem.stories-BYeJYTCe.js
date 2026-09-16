import{j as y}from"./iframe-tAvKsVeF.js";import{A as k}from"./AppListItem-C9ztEllB.js";import"./preload-helper-PPVm8Dsz.js";import"./revealOnHover-DU3PDCIu.js";import"./useEntityQuery-Dec7sZ1f.js";import"./entityCache-B8HCQ8hY.js";import"./keys-CUIcVywe.js";import"./dateFormat-tpkRVL7u.js";import"./appFilters-B4zycet6.js";import"./okta-DiqjVWpx.js";import"./types-D54cNL3h.js";const{expect:t,fn:h,userEvent:u,waitFor:f,within:w}=__STORYBOOK_MODULE_TEST__,n={id:"0oaFAKE0001",name:"salesforce",label:"Salesforce",status:"ACTIVE",signOnMode:"SAML_2_0",created:"2026-01-15T09:00:00.000Z",lastUpdated:"2026-06-02T11:30:00.000Z"},R={title:"Apps/AppListItem",component:k,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:`Collapsed it shows the display label, status badge, sign-on mode, app key and created date. Expanding reveals the ids and dates, an "Open in Okta" deep link built from the validated org origin, and the app's assignment counts — fetched only once the row is open, then cached by app id.`}}},argTypes:{app:{description:"The app to render."},oktaOrigin:{description:'Okta org origin, enabling the "Open in Okta" deep link when present.'},fetchAssignmentCounts:{description:"Loads this app's assignment counts; called only once the row is expanded. Must be stable."},selected:{description:"Whether this app is in the selection basket; a ticked row paints ListRow's selected state."},onToggleSelect:{description:"Tick or untick this app. Omitted ⇒ no checkbox renders at all."}},args:{app:n,oktaOrigin:"https://example.okta.com",fetchAssignmentCounts:h(async()=>({users:128,groups:4}))}},o={},r={play:async({canvasElement:e})=>{const a=w(e);await u.click(a.getByRole("button",{name:"Expand Salesforce"})),await f(()=>t(a.getByRole("button",{name:`Copy application id for Salesforce (${n.id})`})).toBeInTheDocument()),await f(()=>t(a.getByText("128 users")).toBeInTheDocument())}},c={render:e=>y.jsxs("div",{className:"space-y-2",children:[y.jsx(k,{...e,app:{...n,id:"0oaFAKE0001"}}),y.jsx(k,{...e,app:{...n,id:"0oaFAKE0099"}})]}),play:async({canvasElement:e})=>{const a=w(e),s=a.getAllByRole("button",{name:"Expand Salesforce"});t(s).toHaveLength(2),await u.click(s[0]),await u.click(s[1]),await f(()=>t(a.getByRole("button",{name:"Copy application id for Salesforce (0oaFAKE0001)"})).toBeInTheDocument()),await t(a.getByRole("button",{name:"Copy application id for Salesforce (0oaFAKE0099)"})).toBeInTheDocument()}},i={args:{app:{id:"0oaFAKE0002",name:"workday",label:"Workday HR",status:"INACTIVE",signOnMode:"SAML_2_0",created:"2026-03-01T09:00:00.000Z"}}},p={args:{app:{id:"0oaFAKE0009"}}},l={args:{oktaOrigin:void 0}},d={args:{app:{...n,id:"0oaFAKE0011"},fetchAssignmentCounts:h(async()=>null)}},m={args:{onToggleSelect:h()},play:async({args:e,canvas:a})=>{const s=a.getByRole("checkbox",{name:"Select Salesforce"});await t(s).not.toBeChecked(),await u.click(s),await t(e.onToggleSelect).toHaveBeenCalledWith(n.id)}},g={args:{onToggleSelect:h(),selected:!0},play:async({canvas:e})=>{await t(e.getByRole("checkbox",{name:"Select Salesforce"})).toBeChecked()}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:"{}",...o.parameters?.docs?.source},description:{story:"An active SAML app with a full set of metadata.",...o.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Expand Salesforce'
    }));
    await waitFor(() => expect(canvas.getByRole('button', {
      name: \`Copy application id for Salesforce (\${salesforce.id})\`
    })).toBeInTheDocument());
    await waitFor(() => expect(canvas.getByText('128 users')).toBeInTheDocument());
  }
}`,...r.parameters?.docs?.source},description:{story:"Expanded — the detail grid, the copyable id, and the lazily-fetched assignment counts.",...r.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: args => <div className="space-y-2">
      <AppListItem {...args} app={{
      ...salesforce,
      id: '0oaFAKE0001'
    }} />
      <AppListItem {...args} app={{
      ...salesforce,
      id: '0oaFAKE0099'
    }} />
    </div>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const toggles = canvas.getAllByRole('button', {
      name: 'Expand Salesforce'
    });
    expect(toggles).toHaveLength(2);
    await userEvent.click(toggles[0]);
    await userEvent.click(toggles[1]);
    await waitFor(() => expect(canvas.getByRole('button', {
      name: 'Copy application id for Salesforce (0oaFAKE0001)'
    })).toBeInTheDocument());
    await expect(canvas.getByRole('button', {
      name: 'Copy application id for Salesforce (0oaFAKE0099)'
    })).toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"Two app instances sharing a display label: the copy control folds the id into its accessible name, so they stay distinguishable.",...c.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    app: {
      id: '0oaFAKE0002',
      name: 'workday',
      label: 'Workday HR',
      status: 'INACTIVE',
      signOnMode: 'SAML_2_0',
      created: '2026-03-01T09:00:00.000Z'
    } as OktaAppListItem
  }
}`,...i.parameters?.docs?.source},description:{story:"An inactive app — neutral status badge.",...i.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    app: {
      id: '0oaFAKE0009'
    } as OktaAppListItem
  }
}`,...p.parameters?.docs?.source},description:{story:"A lenient row where Okta returned only the id — the label falls back to it.",...p.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    oktaOrigin: undefined
  }
}`,...l.parameters?.docs?.source},description:{story:'No org origin known yet — the "Open in Okta" link hides itself.',...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    app: {
      ...salesforce,
      id: '0oaFAKE0011'
    } as OktaAppListItem,
    fetchAssignmentCounts: fn(async (): Promise<AppAssignmentCounts | null> => null)
  }
}`,...d.parameters?.docs?.source},description:{story:"Assignment counts are unavailable (the count walk failed).",...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
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
    await expect(args.onToggleSelect).toHaveBeenCalledWith(salesforce.id);
  }
}`,...m.parameters?.docs?.source},description:{story:"The checkbox costs this row nothing: its expand toggle is a mouse-only\n`onClick` on a plain `<div>`, never a real interactive element, so there is\nno `nested-interactive` risk. The name says which app (`Select Salesforce`).",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
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
}`,...g.parameters?.docs?.source},description:{story:"Ticked. The checkbox is drawn unconditionally — `REVEAL_ON_HOVER` exempts an\nactive control, or a selection would vanish while scrolling — and the card\ntakes `ListRow`'s `selected` state.",...g.parameters?.docs?.description}}};const F=["Default","Expanded","DuplicateLabelsStayDistinguishable","Inactive","MinimalFields","NoOktaOrigin","AssignmentCountsUnavailable","Selectable","Selected"];export{d as AssignmentCountsUnavailable,o as Default,c as DuplicateLabelsStayDistinguishable,r as Expanded,i as Inactive,p as MinimalFields,l as NoOktaOrigin,m as Selectable,g as Selected,F as __namedExportsOrder,R as default};
