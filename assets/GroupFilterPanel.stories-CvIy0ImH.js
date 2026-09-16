import{r as t,j as C}from"./iframe-tAvKsVeF.js";import{G as T}from"./GroupFilterPanel-0BYFh3XL.js";import"./preload-helper-PPVm8Dsz.js";const{expect:a,fn:r,userEvent:d,within:x}=__STORYBOOK_MODULE_TEST__,O=[{id:"app1",name:"Salesforce"},{id:"app2",name:"Workday"},{id:"app3",name:"Zoom"}],W={title:"Groups/GroupFilterPanel",component:T,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'Cached-mode filter + sort panel for the groups list: group type, member-count bucket, push status, rule attribution, and push-target app, plus the sort field and direction. Fully controlled — every axis is owned by the caller. With any filter active it surfaces a summary chips row with a "Clear all" link.'}}},argTypes:{activeFilterCount:{description:"Number of active filters (drives the active-chips row)."},typeFilter:{description:"Selected group-type filter (`''` = all)."},setTypeFilter:{description:"Sets the group-type filter."},sizeFilter:{description:"Selected member-count bucket (`''` = all)."},setSizeFilter:{description:"Sets the member-count bucket."},pushFilter:{description:"Push-status filter."},setPushFilter:{description:"Sets the push-status filter."},ruleFilter:{description:"Rule-attribution filter."},setRuleFilter:{description:"Sets the rule-attribution filter."},pushAppFilter:{description:"Set of push-target app ids to filter by (empty = all)."},setPushAppFilter:{description:"Updates the push-target-app id set."},availablePushApps:{description:"Push-target apps available as filter chips."},sortBy:{description:"Active sort field."},sortDesc:{description:"Whether the active sort is descending."},toggleSort:{description:"Toggles the sort field (or flips direction if already active)."},clearFilters:{description:"Resets all filters (and the search query)."}},args:{activeFilterCount:0,typeFilter:"",setTypeFilter:r(),sizeFilter:"",setSizeFilter:r(),pushFilter:"",setPushFilter:r(),ruleFilter:"",setRuleFilter:r(),pushAppFilter:new Set,setPushAppFilter:r(),availablePushApps:O,sortBy:"name",sortDesc:!1,toggleSort:r(),clearFilters:r()}},o={},l={args:{activeFilterCount:3,typeFilter:"OKTA_GROUP",sizeFilter:"large",pushFilter:"pushed"}},n={args:{activeFilterCount:1,pushAppFilter:new Set(["app1","app2"])}},p={args:{activeFilterCount:1,ruleFilter:"unruled"}},c={args:{availablePushApps:[]}},u={args:{sortBy:"memberCount",sortDesc:!0}},F={render:function(e){const[s,i]=t.useState(e.typeFilter),[m,y]=t.useState(e.sizeFilter),[v,g]=t.useState(e.pushFilter),[S,f]=t.useState(e.ruleFilter),[A,b]=t.useState(e.pushAppFilter),[w,R]=t.useState(e.sortBy),[B,D]=t.useState(e.sortDesc),k=(s?1:0)+(m?1:0)+(v?1:0)+(S?1:0)+(A.size>0?1:0);return C.jsx(T,{...e,activeFilterCount:k,typeFilter:s,setTypeFilter:i,sizeFilter:m,setSizeFilter:y,pushFilter:v,setPushFilter:g,ruleFilter:S,setRuleFilter:f,pushAppFilter:A,setPushAppFilter:b,sortBy:w,sortDesc:B,toggleSort:P=>{D(z=>P===w?!z:!1),R(P)},clearFilters:()=>{i(""),y(""),g(""),f(""),b(new Set)}})},play:async({canvasElement:h})=>{const e=x(h),s=e.getByRole("button",{name:"Okta"});await d.click(s),await a(s).toHaveAttribute("aria-pressed","true"),await a(e.getByText("Type: OKTA GROUP")).toBeInTheDocument();const i=e.getByRole("button",{name:"No rules"});await d.click(i),await a(i).toHaveAttribute("aria-pressed","true"),await d.click(e.getByRole("button",{name:"Clear all"})),await a(e.queryByText("Type: OKTA GROUP")).not.toBeInTheDocument(),await a(s).toHaveAttribute("aria-pressed","false")}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:"{}",...o.parameters?.docs?.source},description:{story:"No filters active — the chips row is hidden.",...o.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    activeFilterCount: 3,
    typeFilter: 'OKTA_GROUP',
    sizeFilter: 'large',
    pushFilter: 'pushed'
  }
}`,...l.parameters?.docs?.source},description:{story:'Several filters active — shows the active-filter chips row with a "Clear all" link.',...l.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    activeFilterCount: 1,
    pushAppFilter: new Set(['app1', 'app2'])
  }
}`,...n.parameters?.docs?.source},description:{story:'Push-target app filter chip active, driving the "Apps:" summary chip.',...n.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    activeFilterCount: 1,
    ruleFilter: 'unruled'
  }
}`,...p.parameters?.docs?.source},description:{story:`The rule-attribution axis, set to "No rules" — the chip names the fact, not a
consequence: members can arrive by Workflows, SCIM or the API with no rule involved.`,...p.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    availablePushApps: []
  }
}`,...c.parameters?.docs?.source},description:{story:'No push-target apps available — the "Push Target App" row is hidden.',...c.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    sortBy: 'memberCount',
    sortDesc: true
  }
}`,...u.parameters?.docs?.source},description:{story:"Sorted by member count, descending.",...u.parameters?.docs?.description}}};F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  render: function InteractiveFilters(args) {
    const [typeFilter, setTypeFilter] = useState(args.typeFilter);
    const [sizeFilter, setSizeFilter] = useState(args.sizeFilter);
    const [pushFilter, setPushFilter] = useState(args.pushFilter);
    const [ruleFilter, setRuleFilter] = useState(args.ruleFilter);
    const [pushAppFilter, setPushAppFilter] = useState(args.pushAppFilter);
    const [sortBy, setSortBy] = useState(args.sortBy);
    const [sortDesc, setSortDesc] = useState(args.sortDesc);
    const activeFilterCount = (typeFilter ? 1 : 0) + (sizeFilter ? 1 : 0) + (pushFilter ? 1 : 0) + (ruleFilter ? 1 : 0) + (pushAppFilter.size > 0 ? 1 : 0);
    return <GroupFilterPanel {...args} activeFilterCount={activeFilterCount} typeFilter={typeFilter} setTypeFilter={setTypeFilter} sizeFilter={sizeFilter} setSizeFilter={setSizeFilter} pushFilter={pushFilter} setPushFilter={setPushFilter} ruleFilter={ruleFilter} setRuleFilter={setRuleFilter} pushAppFilter={pushAppFilter} setPushAppFilter={setPushAppFilter} sortBy={sortBy} sortDesc={sortDesc} toggleSort={field => {
      setSortDesc(previous => field === sortBy ? !previous : false);
      setSortBy(field);
    }} clearFilters={() => {
      setTypeFilter('');
      setSizeFilter('');
      setPushFilter('');
      setRuleFilter('');
      setPushAppFilter(new Set<string>());
    }} />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const okta = canvas.getByRole('button', {
      name: 'Okta'
    });
    await userEvent.click(okta);
    await expect(okta).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByText('Type: OKTA GROUP')).toBeInTheDocument();
    const noRules = canvas.getByRole('button', {
      name: 'No rules'
    });
    await userEvent.click(noRules);
    await expect(noRules).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear all'
    }));
    await expect(canvas.queryByText('Type: OKTA GROUP')).not.toBeInTheDocument();
    await expect(okta).toHaveAttribute('aria-pressed', 'false');
  }
}`,...F.parameters?.docs?.source},description:{story:"Real state behind every axis: pick filters, watch the chips row appear, then clear it.",...F.parameters?.docs?.description}}};const _=["Default","WithActiveFilters","WithPushAppFilter","WithRuleFilter","NoPushApps","SortedDescending","Interactive"];export{o as Default,F as Interactive,c as NoPushApps,u as SortedDescending,l as WithActiveFilters,n as WithPushAppFilter,p as WithRuleFilter,_ as __namedExportsOrder,W as default};
