import{j as a,r as o}from"./iframe-tAvKsVeF.js";import{A as T}from"./AppsToolbar-CItnWmfQ.js";import{f as k}from"./appFilters-B4zycet6.js";import"./preload-helper-PPVm8Dsz.js";import"./okta-DiqjVWpx.js";import"./types-D54cNL3h.js";const{expect:g,fn:h,userEvent:S,within:s}=__STORYBOOK_MODULE_TEST__,G={title:"Apps/AppsToolbar",component:T,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"Fully controlled: the tab shell owns the filter state, so the same values drive both this row and the filtered list. The search box accepts a `/pattern/flags` regex query as well as a plain substring.\n\n`Pushes nothing` means Group Push is enabled on the app and the org snapshot holds no group assignment for it — the snapshot only walks the groups endpoint for `GROUP_PUSH` apps, so a wider reading would report the whole inventory as unassigned."}}},argTypes:{searchQuery:{description:"Current search text (`/pattern/flags` is treated as a regex)."},onSearchQueryChange:{description:"Called with the new search text."},statusFilter:{description:"Selected status bucket (`''` = all)."},onStatusFilterChange:{description:"Called with the newly selected status bucket."},groupsFilter:{description:"Selected group-push bucket (`''` = all)."},onGroupsFilterChange:{description:"Called with the newly selected group-push bucket."},sortBy:{description:"The active sort field."},sortDesc:{description:"Whether the active sort is descending."},onToggleSort:{description:"Select a sort field, or flip the direction when it is already active."},resultCount:{description:"Number of apps after filtering."},totalCount:{description:"Number of apps loaded in total."}},args:{searchQuery:"",onSearchQueryChange:h(),statusFilter:"",onStatusFilterChange:h(),groupsFilter:"",onGroupsFilterChange:h(),sortBy:"label",sortDesc:!1,onToggleSort:h(),resultCount:42,totalCount:42}},n={},i={args:{searchQuery:"sales",resultCount:3}},l={args:{searchQuery:"/^okta_/i",resultCount:7}},c={args:{statusFilter:"INACTIVE",resultCount:5}},u={args:{groupsFilter:"no-groups",resultCount:2}},p={args:{sortBy:"created",sortDesc:!0}},B=[{id:"0oaFAKE0001",label:"Salesforce",status:"ACTIVE",created:"2026-01-15T09:00:00.000Z"},{id:"0oaFAKE0002",label:"Workday HR",status:"INACTIVE",created:"2026-03-01T09:00:00.000Z"},{id:"0oaFAKE0003",label:"Slack",status:"ACTIVE",created:"2025-11-20T09:00:00.000Z"}],d={render:y=>{const t=()=>{const[e,f]=o.useState(""),[b,x]=o.useState(""),[v,A]=o.useState(""),[m,D]=o.useState("label"),[F,w]=o.useState(!1),C=k(B,{searchQuery:e,statusFilter:b,groupsFilter:v,sortBy:m,sortDesc:F});return a.jsxs("div",{className:"space-y-(--sp-field)",children:[a.jsx(T,{...y,searchQuery:e,onSearchQueryChange:f,statusFilter:b,onStatusFilterChange:x,groupsFilter:v,onGroupsFilterChange:A,sortBy:m,sortDesc:F,onToggleSort:r=>{r===m?w(E=>!E):(D(r),w(!1))},resultCount:C.length,totalCount:B.length}),a.jsx("ul",{"aria-label":"Applications",className:"space-y-1 text-sm text-neutral-700",children:C.map(r=>a.jsx("li",{children:r.label},r.id))})]})};return a.jsx(t,{})},play:async({canvasElement:y})=>{const t=s(y),e=t.getByRole("list",{name:"Applications"});await S.type(t.getByLabelText("Search applications"),"sl"),await g(s(e).getAllByRole("listitem")).toHaveLength(1),await g(s(e).getByText("Slack")).toBeInTheDocument(),await S.clear(t.getByLabelText("Search applications")),await S.click(s(t.getByRole("group",{name:"Filter by status"})).getByRole("button",{name:"Inactive"})),await g(s(e).getAllByRole("listitem")).toHaveLength(1),await g(s(e).getByText("Workday HR")).toBeInTheDocument()}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"No search, no status bucket, sorted by name ascending.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'sales',
    resultCount: 3
  }
}`,...i.parameters?.docs?.source},description:{story:"A plain substring search narrowing the result count.",...i.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: '/^okta_/i',
    resultCount: 7
  }
}`,...l.parameters?.docs?.source},description:{story:"A `/regex/` query — matched as a real RegExp, never evaluated.",...l.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    statusFilter: 'INACTIVE',
    resultCount: 5
  }
}`,...c.parameters?.docs?.source},description:{story:"The inactive bucket selected.",...c.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    groupsFilter: 'no-groups',
    resultCount: 2
  }
}`,...u.parameters?.docs?.source},description:{story:`The group-push bucket selected: apps with Group Push on that push no groups —
a configured integration doing no work.`,...u.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    sortBy: 'created',
    sortDesc: true
  }
}`,...p.parameters?.docs?.source},description:{story:"Sorted by created date, descending (newest first).",...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: args => {
    const Harness = () => {
      const [searchQuery, setSearchQuery] = useState('');
      const [statusFilter, setStatusFilter] = useState<'' | 'ACTIVE' | 'INACTIVE'>('');
      const [groupsFilter, setGroupsFilter] = useState<'' | 'no-groups'>('');
      const [sortBy, setSortBy] = useState<'label' | 'status' | 'created'>('label');
      const [sortDesc, setSortDesc] = useState(false);
      const visible = filterAndSortApps(harnessApps, {
        searchQuery,
        statusFilter,
        groupsFilter,
        sortBy,
        sortDesc
      });
      return <div className="space-y-(--sp-field)">
          <AppsToolbar {...args} searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} groupsFilter={groupsFilter} onGroupsFilterChange={setGroupsFilter} sortBy={sortBy} sortDesc={sortDesc} onToggleSort={field => {
          if (field === sortBy) setSortDesc(previous => !previous);else {
            setSortBy(field);
            setSortDesc(false);
          }
        }} resultCount={visible.length} totalCount={harnessApps.length} />
          <ul aria-label="Applications" className="space-y-1 text-sm text-neutral-700">
            {visible.map(app => <li key={app.id}>{app.label}</li>)}
          </ul>
        </div>;
    };
    return <Harness />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole('list', {
      name: 'Applications'
    });
    await userEvent.type(canvas.getByLabelText('Search applications'), 'sl');
    await expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    await expect(within(list).getByText('Slack')).toBeInTheDocument();
    await userEvent.clear(canvas.getByLabelText('Search applications'));
    await userEvent.click(within(canvas.getByRole('group', {
      name: 'Filter by status'
    })).getByRole('button', {
      name: 'Inactive'
    }));
    await expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    await expect(within(list).getByText('Workday HR')).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:`The toolbar wired to real state over a three-app inventory, so searching,
bucketing and sorting all narrow and reorder the list beneath it.`,...d.parameters?.docs?.description}}};const L=["Default","Searching","RegexQuery","InactiveFilter","PushesNothingFilter","SortedByCreatedDesc","Interactive"];export{n as Default,c as InactiveFilter,d as Interactive,u as PushesNothingFilter,l as RegexQuery,i as Searching,p as SortedByCreatedDesc,L as __namedExportsOrder,G as default};
