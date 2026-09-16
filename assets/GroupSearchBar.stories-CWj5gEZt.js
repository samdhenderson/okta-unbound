import{j as s,r as p}from"./iframe-tAvKsVeF.js";import{G as h}from"./GroupSearchBar-CVDtKvid.js";import"./preload-helper-PPVm8Dsz.js";const{expect:l,fn:u,userEvent:y,within:g}=__STORYBOOK_MODULE_TEST__,x={title:"Groups/GroupSearchBar",component:h,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"The groups search input row. It binds to a different query depending on the search mode: `live` queries Okta directly and shows a trailing spinner while a request is in flight, while `cached` filters the already-loaded list client-side."}}},argTypes:{searchMode:{description:"`live` queries Okta directly; `cached` filters the loaded list."},liveSearchQuery:{description:"Query bound in live mode."},onLiveSearchQueryChange:{description:"Fired as the live-mode query changes."},searchQuery:{description:"Query bound in cached mode."},onSearchQueryChange:{description:"Fired as the cached-mode query changes."},isLiveSearching:{description:"Whether a live search is in flight (shows the trailing spinner)."}},args:{searchMode:"cached",liveSearchQuery:"",onLiveSearchQueryChange:u(),searchQuery:"",onSearchQueryChange:u(),isLiveSearching:!1}},r={render:e=>s.jsx("div",{style:{width:360},children:s.jsx(h,{...e})})},n={args:{searchQuery:"engineering"},render:r.render},i={args:{searchMode:"live"},render:r.render},t={args:{searchMode:"live",liveSearchQuery:"admins",isLiveSearching:!0},render:r.render},m=e=>{const[d,a]=p.useState(""),[v,S]=p.useState("");return s.jsx("div",{style:{width:360},children:s.jsx(h,{...e,searchQuery:d,onSearchQueryChange:a,liveSearchQuery:v,onLiveSearchQueryChange:S})})},c={render:e=>s.jsx(m,{...e}),play:async({canvasElement:e})=>{const a=g(e).getByPlaceholderText("Search groups...");await y.type(a,"engineering"),await l(a).toHaveValue("engineering")}},o={args:{searchMode:"live"},render:e=>s.jsx(m,{...e}),play:async({canvasElement:e})=>{const a=g(e).getByPlaceholderText("Search groups by name...");await y.type(a,"admins"),await l(a).toHaveValue("admins")}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: args => <div style={{
    width: 360
  }}>
      <GroupSearchBar {...args} />
    </div>
}`,...r.parameters?.docs?.source},description:{story:"Cached mode, empty query.",...r.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'engineering'
  },
  render: Default.render
}`,...n.parameters?.docs?.source},description:{story:"Cached mode with a typed query.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    searchMode: 'live'
  },
  render: Default.render
}`,...i.parameters?.docs?.source},description:{story:"Live mode, no query yet.",...i.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    searchMode: 'live',
    liveSearchQuery: 'admins',
    isLiveSearching: true
  },
  render: Default.render
}`,...t.parameters?.docs?.source},description:{story:"Live mode with a query and the spinner shown while the request is in flight.",...t.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: args => <SearchHarness {...args} />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByPlaceholderText('Search groups...');
    await userEvent.type(field, 'engineering');
    await expect(field).toHaveValue('engineering');
  }
}`,...c.parameters?.docs?.source},description:{story:"Type into the cached-mode field: the bound query updates on every keystroke.",...c.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    searchMode: 'live'
  },
  render: args => <SearchHarness {...args} />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByPlaceholderText('Search groups by name...');
    await userEvent.type(field, 'admins');
    await expect(field).toHaveValue('admins');
  }
}`,...o.parameters?.docs?.source},description:{story:"The live-mode field is a separate binding — the same typing drives `liveSearchQuery`.",...o.parameters?.docs?.description}}};const L=["Default","CachedWithQuery","LiveMode","LiveSearching","TypingACachedQuery","TypingALiveQuery"];export{n as CachedWithQuery,r as Default,i as LiveMode,t as LiveSearching,c as TypingACachedQuery,o as TypingALiveQuery,L as __namedExportsOrder,x as default};
