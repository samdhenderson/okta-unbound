import{A as h}from"./AppsListPanel-5SkoTPi2.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./useStaggerReveal-XqT17AGi.js";import"./AppListItem-C9ztEllB.js";import"./revealOnHover-DU3PDCIu.js";import"./useEntityQuery-Dec7sZ1f.js";import"./entityCache-B8HCQ8hY.js";import"./keys-CUIcVywe.js";import"./dateFormat-tpkRVL7u.js";import"./appFilters-B4zycet6.js";import"./okta-DiqjVWpx.js";import"./types-D54cNL3h.js";const{expect:p,fn:a,userEvent:d,waitFor:g,within:m}=__STORYBOOK_MODULE_TEST__,u=[{id:"0oaFAKE0001",name:"salesforce",label:"Salesforce",status:"ACTIVE",signOnMode:"SAML_2_0",created:"2026-01-15T09:00:00.000Z",lastUpdated:"2026-06-02T11:30:00.000Z"},{id:"0oaFAKE0002",name:"workday",label:"Workday HR",status:"INACTIVE",signOnMode:"SAML_2_0",created:"2026-03-01T09:00:00.000Z"},{id:"0oaFAKE0003",name:"bookmark",label:"Internal Wiki",status:"ACTIVE",signOnMode:"BOOKMARK",created:"2025-11-20T09:00:00.000Z"}],F={title:"Apps/AppsListPanel",component:h,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'Renders an `AppListItem` per filtered app, forwarding the org origin and the lazy assignment-count fetcher, and a row skeleton while the inventory loads. The two empty states are distinct: "nothing loaded" offers a reload, "nothing matches" offers a filter reset — and only when a filter or search is actually active.'}}},argTypes:{loading:{description:"Whether the inventory load is in progress."},apps:{description:"Apps to render, already filtered and sorted."},hasApps:{description:"Whether any apps are loaded — picks which empty state to show."},activeFilterCount:{description:'Active-filter count — gates the "Clear filters" empty-state action.'},hasSearchQuery:{description:'Whether a search query is active — also gates "Clear filters".'},onClearFilters:{description:"Clears the search and status filters."},onReload:{description:"Reloads the inventory."},oktaOrigin:{description:"Okta origin passed to each row for its deep link."},fetchAssignmentCounts:{description:"Loads a single app's assignment counts, lazily, once its row is expanded."},selectedIds:{description:"Every basket id of kind 'app', including ones ticked elsewhere."},onToggleSelect:{description:"Tick or untick one row's app."},onSelectAll:{description:"Replaces the app selection with every currently filtered app. A request, not a resolved outcome."},onDeselectAll:{description:"Empties the app partition, leaving other kinds' picks alone."}},args:{loading:!1,apps:u,hasApps:!0,activeFilterCount:0,hasSearchQuery:!1,onClearFilters:a(),onReload:a(),oktaOrigin:"https://example.okta.com",fetchAssignmentCounts:a(async()=>({users:128,groups:4})),selectedIds:new Set,onToggleSelect:a(),onSelectAll:a(),onDeselectAll:a()}},s={},n={play:async({canvasElement:t})=>{const e=m(t);await p(e.queryByText("128 users")).not.toBeInTheDocument(),await d.click(e.getByRole("button",{name:"Expand Salesforce"})),await p(e.getByRole("button",{name:"Collapse Salesforce"})).toBeInTheDocument(),await g(()=>p(e.getByText("128 users")).toBeInTheDocument())}},o={args:{loading:!0,apps:[]}},r={args:{apps:[],hasApps:!0,activeFilterCount:1,hasSearchQuery:!0},play:async({args:t,canvasElement:e})=>{const l=m(e);await d.click(l.getByRole("button",{name:"Clear filters"})),await p(t.onClearFilters).toHaveBeenCalled()}},i={args:{apps:[],hasApps:!1},play:async({args:t,canvasElement:e})=>{const l=m(e);await d.click(l.getByRole("button",{name:"Load applications"})),await p(t.onReload).toHaveBeenCalled()}},c={args:{selectedIds:new Set([u[0].id])}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"Three applications spanning the active/inactive and SAML/bookmark axes.",...s.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('128 users')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Expand Salesforce'
    }));
    await expect(canvas.getByRole('button', {
      name: 'Collapse Salesforce'
    })).toBeInTheDocument();
    await waitFor(() => expect(canvas.getByText('128 users')).toBeInTheDocument());
  }
}`,...n.parameters?.docs?.source},description:{story:"Assignment counts arrive only once a row is expanded — never on the list render.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true,
    apps: []
  }
}`,...o.parameters?.docs?.source},description:{story:"The inventory load is in progress.",...o.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    apps: [],
    hasApps: true,
    activeFilterCount: 1,
    hasSearchQuery: true
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear filters'
    }));
    await expect(args.onClearFilters).toHaveBeenCalled();
  }
}`,...r.parameters?.docs?.source},description:{story:"Filters exclude every loaded app — offers a filter reset.",...r.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    apps: [],
    hasApps: false
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Load applications'
    }));
    await expect(args.onReload).toHaveBeenCalled();
  }
}`,...i.parameters?.docs?.source},description:{story:"Nothing loaded yet (or an org with no apps) — offers a reload.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    selectedIds: new Set([sampleApps[0].id])
  }
}`,...c.parameters?.docs?.source},description:{story:"One app already ticked — the row shows it, and the control line reports the count.",...c.parameters?.docs?.description}}};const I=["Default","ExpandingARowFetchesCounts","Loading","NoMatches","NothingLoaded","WithSelection"];export{s as Default,n as ExpandingARowFetchesCounts,o as Loading,r as NoMatches,i as NothingLoaded,c as WithSelection,I as __namedExportsOrder,F as default};
