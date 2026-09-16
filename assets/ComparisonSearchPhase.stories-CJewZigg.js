import{C as p}from"./ComparisonSearchPhase-CqtZ00Ud.js";import{m as a}from"./fixtures-CsAiPaTu.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./UserSearchResults-A-1SA20Z.js";import"./useStaggerReveal-XqT17AGi.js";import"./userDisplay-xpx41Abi.js";import"./status-Bn0B6Ou-.js";import"./revealOnHover-DU3PDCIu.js";const{expect:n,fn:c,userEvent:u,within:m}=__STORYBOOK_MODULE_TEST__,d=a[0],R={title:"Users/Comparison/ComparisonSearchPhase",component:p,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'Phase 1 of the comparison modal: a controlled search box and its matching results, with the context user filtered out so nobody can compare with themselves. It shows a "Searching directory…" indicator while a search is in flight and an empty state when a query returns no matches. Fully prop-driven; the parent hook owns the search.'}}},args:{contextUser:d,searchQuery:"",setSearchQuery:c(),isSearching:!1,searchResults:[],onSelectUser:c()},argTypes:{contextUser:{description:"The context user; excluded from results so users can't compare with themselves."},searchQuery:{description:"Current search text (controlled)."},setSearchQuery:{description:"Updates the search text."},isSearching:{description:'When true, shows the "Searching directory…" indicator.'},searchResults:{description:"Raw search results; the context user is filtered out before rendering."},onSelectUser:{description:"Invoked with the chosen user to enter the comparison phase."}}},e={},s={args:{searchQuery:"smith",isSearching:!0}},r={args:{searchQuery:"user",searchResults:a.slice(0,8)},play:async({args:i,canvasElement:h})=>{const o=m(h);await n(o.queryByText("First1 Last1")).toBeNull(),await u.click(o.getByRole("button",{name:"Compare with this user",description:/First2 Last2/})),await n(i.onSelectUser).toHaveBeenCalledWith(a[1])}},t={args:{searchQuery:"zzzznomatch",searchResults:[]}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:"Idle state: an empty query, so just the search box.",...e.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'smith',
    isSearching: true
  }
}`,...s.parameters?.docs?.source},description:{story:'Search in flight, showing the "Searching directory…" indicator.',...s.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'user',
    searchResults: mockUsers.slice(0, 8)
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // The context user is not offered as their own comparison partner.
    await expect(canvas.queryByText('First1 Last1')).toBeNull();
    // The row's overlay is named for the action; the user it acts on is its
    // accessible description.
    await userEvent.click(canvas.getByRole('button', {
      name: 'Compare with this user',
      description: /First2 Last2/
    }));
    await expect(args.onSelectUser).toHaveBeenCalledWith(mockUsers[1]);
  }
}`,...r.parameters?.docs?.source},description:{story:"Query typed with matching results listed (context user filtered out).",...r.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'zzzznomatch',
    searchResults: []
  }
}`,...t.parameters?.docs?.source},description:{story:"Query typed with no matches found.",...t.parameters?.docs?.description}}};const U=["Default","Searching","WithResults","Empty"];export{e as Default,t as Empty,s as Searching,r as WithResults,U as __namedExportsOrder,R as default};
