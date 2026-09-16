import{j as g,A as S}from"./iframe-tAvKsVeF.js";import{U as k}from"./UserSearchPanel-CKIoFVgK.js";import{s}from"./selectionStore-DExy1RDY.js";import{m as t}from"./fixtures-CsAiPaTu.js";import"./preload-helper-PPVm8Dsz.js";import"./UserSearchBar-DY0fUkzs.js";import"./UserSearchResults-A-1SA20Z.js";import"./useStaggerReveal-XqT17AGi.js";import"./userDisplay-xpx41Abi.js";import"./status-Bn0B6Ou-.js";import"./revealOnHover-DU3PDCIu.js";import"./useRungSelection-DALqsLn1.js";import"./useSelection-DlTpY3y-.js";const{expect:a,fn:y,userEvent:w,within:m}=__STORYBOOK_MODULE_TEST__,I={title:"Users/UserSearchPanel",component:k,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The Users tab's \"find a user\" surface: the search box, the detected-user banner, the search results and the pre-search empty state. The debounced query, the banner and the results belong to `useUsersTabState`, so this panel renders without touching Okta, and the `alerts` slot carries the tab's banners between the box and the results.\n\nThe panel owns this rung's tie to the selection basket (`useRungSelection`), which backs the checkbox column. A search returns at most twenty rows, so a cohort is assembled across searches: nothing clears the basket when a new query replaces the rows, and the readout counts the basket rather than the ticked rows on screen."}}},decorators:[r=>g.jsx("div",{className:"max-w-7xl mx-auto px-6 py-6 space-y-6",children:g.jsx(r,{})})],args:{searchQuery:"",onSearchQueryChange:y(),onClearSearch:y(),isSearching:!1,searchResults:[],onSelectUser:y(),hasSelectedUser:!1,hasError:!1},argTypes:{searchQuery:{description:"Current search box value."},onSearchQueryChange:{description:"Invoked on every keystroke; the caller's debounce decides when to search."},onClearSearch:{description:"Clears the search, selection and banners (the search box's clear button)."},isSearching:{description:"True while a debounced search is in flight."},searchResults:{description:"Latest committed search results; an empty array renders no results block."},onSelectUser:{description:"Invoked with the chosen user when a result row is clicked."},hasSelectedUser:{description:"Whether a user is selected — hides the results and the empty state."},hasError:{description:"Whether the tab is showing an error — suppresses the empty state."},alerts:{description:"The tab's merged error / result banners, rendered between the search box and the results."}}},n={},c={args:{searchQuery:"ada",isSearching:!0}},o={args:{searchQuery:"ada",searchResults:t.slice(10,14)},play:async({args:r,canvasElement:e})=>{const b=m(e);await w.click(b.getByRole("button",{name:"View user details",description:/First11 Last11/})),await a(r.onSelectUser).toHaveBeenCalledWith(t[10])}},i={args:{searchQuery:"ada",hasError:!0,alerts:g.jsx(S,{message:{text:"Failed to search users",type:"danger"}})}},l={args:{hasSelectedUser:!0,searchResults:t.slice(10,14)}},h={args:{searchQuery:"ada",searchResults:t.slice(10,14)},parameters:{viewport:{value:"sidepanelCompact"}}},d={args:{searchQuery:"first1",searchResults:t.slice(10,14)},beforeEach:()=>(s.clearAll(),s.toggle({kind:"user",id:"user11",name:"First11 Last11"}),s.toggle({kind:"user",id:"00uFAKE0002",name:"Dana Example"}),s.toggle({kind:"user",id:"00uFAKE0003",name:"Rowan Example"}),()=>s.clearAll()),play:async({canvasElement:r})=>{const e=m(r);await a(e.getByText("3 users selected")).toBeInTheDocument(),await a(e.getByRole("checkbox",{name:"Select First11 Last11"})).toBeChecked()}},u={args:{searchQuery:"nobody",searchResults:[]},beforeEach:()=>(s.clearAll(),s.toggle({kind:"user",id:"00uFAKE0001",name:"Dana Example"}),()=>s.clearAll()),play:async({canvasElement:r})=>{const e=m(r);await a(e.getByText("1 user selected")).toBeInTheDocument()}},p={args:{searchQuery:"first1",searchResults:t.slice(10,13)},beforeEach:()=>(s.clearAll(),()=>s.clearAll()),play:async({canvasElement:r})=>{const e=m(r);await a(e.queryByText(/selected/)).not.toBeInTheDocument(),await w.click(e.getByRole("checkbox",{name:"Select First11 Last11"})),await a(e.getByText("1 user selected")).toBeInTheDocument()}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"Nothing searched yet — the empty state invites a search.",...n.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'ada',
    isSearching: true
  }
}`,...c.parameters?.docs?.source},description:{story:"A query is being typed and its debounced search is in flight.",...c.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'ada',
    searchResults: mockUsers.slice(10, 14)
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // The row's overlay is named for the action; the user it acts on is its
    // accessible description.
    await userEvent.click(canvas.getByRole('button', {
      name: 'View user details',
      description: /First11 Last11/
    }));
    await expect(args.onSelectUser).toHaveBeenCalledWith(mockUsers[10]);
  }
}`,...o.parameters?.docs?.source},description:{story:"Committed search results, each row selectable.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'ada',
    hasError: true,
    alerts: <AlertMessage message={{
      text: 'Failed to search users',
      type: 'danger'
    }} />
  }
}`,...i.parameters?.docs?.source},description:{story:"The tab's merged error channel, rendered through the `alerts` slot.",...i.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    hasSelectedUser: true,
    searchResults: mockUsers.slice(10, 14)
  }
}`,...l.parameters?.docs?.source},description:{story:"A user is selected — the results and the empty state give way to the detail panel.",...l.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'ada',
    searchResults: mockUsers.slice(10, 14)
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...h.parameters?.docs?.source},description:{story:"The same rung at 360px — the width the compaction was for. Each result stays two lines.",...h.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'first1',
    searchResults: mockUsers.slice(10, 14)
  },
  beforeEach: () => {
    selectionStore.clearAll();
    selectionStore.toggle({
      kind: 'user',
      id: 'user11',
      name: 'First11 Last11'
    });
    selectionStore.toggle({
      kind: 'user',
      id: '00uFAKE0002',
      name: 'Dana Example'
    });
    selectionStore.toggle({
      kind: 'user',
      id: '00uFAKE0003',
      name: 'Rowan Example'
    });
    return () => selectionStore.clearAll();
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('3 users selected')).toBeInTheDocument();
    // The one basket entry that is also on screen draws itself ticked.
    await expect(canvas.getByRole('checkbox', {
      name: 'Select First11 Last11'
    })).toBeChecked();
  }
}`,...d.parameters?.docs?.source},description:{story:`A cohort assembled across earlier searches, with the current query's rows on screen.
The readout counts the basket, not the ticked rows: only one of the three is below.`,...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'nobody',
    searchResults: []
  },
  beforeEach: () => {
    selectionStore.clearAll();
    selectionStore.toggle({
      kind: 'user',
      id: '00uFAKE0001',
      name: 'Dana Example'
    });
    return () => selectionStore.clearAll();
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('1 user selected')).toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:`A query that matches nobody, while the basket still holds a cohort — which is why the
readout sits outside the results block.`,...u.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'first1',
    searchResults: mockUsers.slice(10, 13)
  },
  beforeEach: () => {
    selectionStore.clearAll();
    return () => selectionStore.clearAll();
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // Absent at zero: there is no readout to find before the first tick.
    await expect(canvas.queryByText(/selected/)).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('checkbox', {
      name: 'Select First11 Last11'
    }));
    await expect(canvas.getByText('1 user selected')).toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:"Ticking a result adds that user to the basket, and the readout appears.",...p.parameters?.docs?.description}}};const L=["Default","Searching","WithResults","WithError","UserSelected","Compact360","SelectionCarriedAcrossSearches","NoMatchesWithACohortHeld","TickingAResult"];export{h as Compact360,n as Default,u as NoMatchesWithACohortHeld,c as Searching,d as SelectionCarriedAcrossSearches,p as TickingAResult,l as UserSelected,i as WithError,o as WithResults,L as __namedExportsOrder,I as default};
