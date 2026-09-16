import{G as g}from"./GroupsListPanel-2k9QCICm.js";import{a as u}from"./fixtures-CsAiPaTu.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./useStaggerReveal-XqT17AGi.js";import"./GroupListItem-CtwRBpIQ.js";import"./revealOnHover-DU3PDCIu.js";import"./groupSourceSummary-srPaUr-6.js";import"./memberSourceBuckets-CMd9i71b.js";import"./chartPalette-Byit8206.js";import"./GroupListItemDetails-BhMiS0RE.js";import"./MemberSourceMeter-BZ5AAva_.js";import"./dateFormat-tpkRVL7u.js";import"./memberSourceCache-BoDWg628.js";import"./entityCache-B8HCQ8hY.js";import"./keys-CUIcVywe.js";const{expect:d,fn:l,userEvent:y,within:m}=__STORYBOOK_MODULE_TEST__,h=[{id:u.id,name:u.profile.name,description:u.profile.description,type:"OKTA_GROUP",memberCount:128,hasRules:!0,ruleCount:2},{id:"group456",name:"Push - Salesforce Admins",type:"APP_GROUP",memberCount:14,hasRules:!1,ruleCount:0,sourceAppId:"app1",sourceAppName:"Salesforce"},{id:"group789",name:"Everyone",type:"BUILT_IN",memberCount:5400,hasRules:!1,ruleCount:0}],D={title:"Groups/GroupsListPanel",component:g,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'The scrollable groups list plus its mode-specific empty states.\n\nRenders a `GroupListItem` per filtered group, forwarding selection, deep-link, and analyze-source handlers. Shows a spinner during the initial load, and distinct empty states for cached mode with excluding filters versus a live search that returned no matches — the live "no results" copy is suppressed while a search is still in flight.'}}},argTypes:{loading:{description:"Whether the initial group load is in progress."},searchMode:{description:"`live` queries Okta directly; `cached` filters the loaded list."},liveSearchQuery:{description:"Current live-search query (drives the live empty-state copy)."},isLiveSearching:{description:'Whether a live search is in flight (suppresses the "no results" state).'},hasGroups:{description:"Whether any groups are loaded — gates the cached-mode empty state."},activeFilterCount:{description:'Active-filter count — gates the "Clear Filters" empty-state action.'},filteredGroups:{description:"Groups to render after filtering/sorting."},selectedGroupIds:{description:"Ids of the currently selected groups."},selectedCount:{description:"How many groups are selected — the `· N selected` half of the line beneath the list, omitted entirely when zero."},onToggleSelect:{description:"Toggles selection for a group id."},oktaOrigin:{description:"Okta origin passed to each row for deep-linking."},onLoadAllGroups:{description:"Switches to cached mode by loading all groups (live empty-state action)."},onClearFilters:{description:"Clears all filters (cached empty-state action)."},onOpenDetail:{description:"Drills into a group's read-only detail view (pushes onto the tab's view stack)."},highlightedGroupId:{description:"Group id to highlight (deep-link target from the Rules tab)."}},args:{loading:!1,searchMode:"cached",liveSearchQuery:"",isLiveSearching:!1,hasGroups:!0,activeFilterCount:0,filteredGroups:h,selectedGroupIds:new Set,selectedCount:0,onToggleSelect:l(),oktaOrigin:"https://example.okta.com",onLoadAllGroups:l(),onClearFilters:l(),onOpenDetail:l()}},t={},r={args:{selectedGroupIds:new Set([h[0].id]),selectedCount:1},play:async({canvasElement:p})=>{const e=m(p);await d(e.getByText(/Showing 3 of 3 · 1 selected/)).toBeInTheDocument()}},s={args:{highlightedGroupId:h[1].id}},o={args:{loading:!0,filteredGroups:[]}},a={args:{filteredGroups:[],hasGroups:!0,activeFilterCount:2}},i={args:{filteredGroups:[],searchMode:"live",liveSearchQuery:"nonexistent-group",isLiveSearching:!1,hasGroups:!1}},n={args:{filteredGroups:[],searchMode:"live",liveSearchQuery:"admins",isLiveSearching:!0,hasGroups:!1}},c={play:async({canvasElement:p})=>{const e=m(p);await d(e.getByText(/Showing 50 of 120/)).toBeInTheDocument(),await y.click(e.getByRole("button",{name:/Load more/})),await d(await e.findByText(/Showing 100 of 120/)).toBeInTheDocument(),await d(e.getByText("Team 100")).toBeInTheDocument()},args:{filteredGroups:Array.from({length:120},(p,e)=>({id:`00gFAKE${String(e).padStart(4,"0")}`,name:`Team ${e+1}`,description:"Generated sample group",type:"OKTA_GROUP",memberCount:e*7%400,hasRules:e%5===0,ruleCount:e%5===0?1:0}))}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source},description:{story:"Three groups spanning the OKTA/APP/BUILT-IN types.",...t.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    selectedGroupIds: new Set([sampleGroups[0].id]),
    selectedCount: 1
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Showing 3 of 3 · 1 selected/)).toBeInTheDocument();
  }
}`,...r.parameters?.docs?.source},description:{story:`One group is selected, and the line beneath the list says so — the app's one
plain-prose statement of the selection count.`,...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    highlightedGroupId: sampleGroups[1].id
  }
}`,...s.parameters?.docs?.source},description:{story:"One group is highlighted (deep-link target from the Rules tab).",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true,
    filteredGroups: []
  }
}`,...o.parameters?.docs?.source},description:{story:"Initial group load in progress.",...o.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    filteredGroups: [],
    hasGroups: true,
    activeFilterCount: 2
  }
}`,...a.parameters?.docs?.source},description:{story:"Cached mode with active filters that exclude every group.",...a.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    filteredGroups: [],
    searchMode: 'live',
    liveSearchQuery: 'nonexistent-group',
    isLiveSearching: false,
    hasGroups: false
  }
}`,...i.parameters?.docs?.source},description:{story:"Live mode with a query that returned no matches.",...i.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    filteredGroups: [],
    searchMode: 'live',
    liveSearchQuery: 'admins',
    isLiveSearching: true,
    hasGroups: false
  }
}`,...n.parameters?.docs?.source},description:{story:"Live mode, a search is currently in flight (suppresses the empty state).",...n.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Showing 50 of 120/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: /Load more/
    }));
    await expect(await canvas.findByText(/Showing 100 of 120/)).toBeInTheDocument();
    await expect(canvas.getByText('Team 100')).toBeInTheDocument();
  },
  args: {
    filteredGroups: Array.from({
      length: 120
    }, (_, i) => ({
      id: \`00gFAKE\${String(i).padStart(4, '0')}\`,
      name: \`Team \${i + 1}\`,
      description: 'Generated sample group',
      type: 'OKTA_GROUP' as const,
      memberCount: i * 7 % 400,
      hasRules: i % 5 === 0,
      ruleCount: i % 5 === 0 ? 1 : 0
    }))
  }
}`,...c.parameters?.docs?.source},description:{story:`A large filtered list (120 groups): only the first 50 rows are mounted, and the
"Load more" footer reveals the rest a page at a time.`,...c.parameters?.docs?.description}}};const E=["Default","WithSelection","Highlighted","Loading","EmptyWithFilters","LiveNoResults","LiveSearching","LargeListWindowed"];export{t as Default,a as EmptyWithFilters,s as Highlighted,c as LargeListWindowed,i as LiveNoResults,n as LiveSearching,o as Loading,r as WithSelection,E as __namedExportsOrder,D as default};
