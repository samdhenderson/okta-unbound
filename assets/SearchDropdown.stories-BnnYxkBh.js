import{v as j,j as r,M as k,r as D}from"./iframe-tAvKsVeF.js";import{m as t}from"./fixtures-CsAiPaTu.js";import"./preload-helper-PPVm8Dsz.js";const{expect:v,fn:x,userEvent:b,within:C}=__STORYBOOK_MODULE_TEST__,w=s=>s,E={title:"Shared/SearchDropdown",component:j,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Generic search input with a live results dropdown and a selected-item summary state. Fully controlled: the caller owns the query, the in-flight flag, and the results array — `renderResult` / `renderSelected` project each item to UI."}}},argTypes:{placeholder:{description:"Placeholder text for the search input."},query:{description:"Controlled query text."},onQueryChange:{description:"Called with the new query on each keystroke."},isSearching:{description:"When true, shows a spinner in the field (search in flight)."},results:{description:"Result items to render in the dropdown."},showDropdown:{description:"Whether the results dropdown is visible (also requires non-empty `results`)."},onSelect:{description:"Called when a result is clicked."},renderResult:{description:"Renders a single result row."},selectedItem:{description:"Currently selected item; when set (with `renderSelected`) the picker shows its summary state instead of the input."},renderSelected:{description:"Renders the selected item’s summary; required to show the selected state."},onClear:{description:"Clears the query or selection; renders the clear affordance when provided."},disabled:{description:"Disables the input."},label:{description:"Optional field label."},hint:{description:"Optional helper text below the field."},getKey:{description:"Stable React key for a result; defaults to the array index."},error:{description:"Inline danger alert for a failed search, shown under the field."}},args:{placeholder:"Search users...",query:"",onQueryChange:x(),isSearching:!1,results:[],showDropdown:!1,onSelect:x(),onClear:x(),renderResult:s=>{const e=w(s);return r.jsxs("div",{children:[r.jsxs("div",{className:"font-medium text-sm",children:[e.profile.firstName," ",e.profile.lastName]}),r.jsx("div",{className:"text-xs text-neutral-500",children:e.profile.email})]})}}},n={},i={args:{label:"Source User",hint:"Search by name or email"}},c={args:{query:"john",isSearching:!0}},l={args:{query:"john",showDropdown:!0,results:t.slice(0,5)}},d={args:{query:"a",showDropdown:!0,results:t}},u={args:{query:"john",error:"Search failed: the Okta tab is no longer signed in."}},p={args:{label:"Search for a user",query:"john",showDropdown:!0,results:t.slice(0,6)},render:s=>r.jsx("div",{className:"w-[400px]",children:r.jsx(k,{isOpen:!0,onClose:x(),title:"Add member to Engineering",children:r.jsx(j,{...s})})})},m={args:{query:"jane",showDropdown:!1,results:[]}},h={args:{selectedItem:t[0],renderSelected:s=>{const e=w(s);return r.jsx("div",{className:"flex items-center gap-2",children:r.jsxs("div",{children:[r.jsxs("div",{className:"text-sm font-medium",children:[e.profile.firstName," ",e.profile.lastName]}),r.jsx("div",{className:"text-xs text-neutral-600",children:e.profile.email})]})})}}},y={args:{label:"Source User",selectedItem:t[0],renderSelected:s=>{const e=w(s);return r.jsx("div",{className:"flex items-center gap-2",children:r.jsxs("div",{children:[r.jsxs("div",{className:"text-sm font-medium",children:[e.profile.firstName," ",e.profile.lastName]}),r.jsx("div",{className:"text-xs text-neutral-600",children:e.profile.email})]})})}}},f={render:function(e){const[a,S]=D.useState(""),[R,N]=D.useState(null),q=a?t.filter(o=>o.profile.email.includes(a.toLowerCase())).slice(0,5):[];return r.jsx("div",{className:"w-[360px]",children:r.jsx(j,{...e,label:"Source user",query:a,onQueryChange:S,results:q,showDropdown:q.length>0,onSelect:o=>{N(w(o)),S("")},selectedItem:R??void 0,renderSelected:o=>r.jsx("div",{className:"text-sm",children:w(o).profile.email}),onClear:()=>{N(null),S("")}})})},play:async({canvasElement:s})=>{const e=C(s);await b.type(e.getByRole("textbox"),"user12@");const a=await e.findByText("user12@example.com");await b.click(a),await v(e.getByRole("button",{name:"Clear selection"})).toBeInTheDocument(),await v(e.queryByRole("textbox")).not.toBeInTheDocument(),await b.click(e.getByRole("button",{name:"Clear selection"})),await v(e.getByRole("textbox")).toHaveValue("")}},g={args:{disabled:!0,label:"Source User"}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"Default empty search.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Source User',
    hint: 'Search by name or email'
  }
}`,...i.parameters?.docs?.source},description:{story:"With label and hint.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    query: 'john',
    isSearching: true
  }
}`,...c.parameters?.docs?.source},description:{story:"Searching state with spinner.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    query: 'john',
    showDropdown: true,
    results: mockUsers.slice(0, 5)
  }
}`,...l.parameters?.docs?.source},description:{story:"With results dropdown visible.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    query: 'a',
    showDropdown: true,
    results: mockUsers
  }
}`,...d.parameters?.docs?.source},description:{story:"Far more hits than fit. The panel is in flow — it never overlays what follows\nit — but it caps at its own `max-h` and scrolls internally, so a 250-result\nsearch cannot push the host's content off the bottom of the screen.",...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    query: 'john',
    error: 'Search failed: the Okta tab is no longer signed in.'
  }
}`,...u.parameters?.docs?.source},description:{story:"A failed type-ahead. The error belongs to the field, above the results.",...u.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Search for a user',
    query: 'john',
    showDropdown: true,
    results: mockUsers.slice(0, 6)
  },
  render: args => <div className="w-[400px]">
      <Modal isOpen onClose={fn()} title="Add member to Engineering">
        <SearchDropdown {...args} />
      </Modal>
    </div>
}`,...p.parameters?.docs?.source},description:{story:"The regression case: results open inside a `Modal`. The modal body is a\nscroller, so an absolutely-positioned panel used to be clipped by it — every\nrow here must be visible and clickable inside the panel.",...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    query: 'jane',
    showDropdown: false,
    results: []
  }
}`,...m.parameters?.docs?.source},description:{story:"With query and clear button.",...m.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    selectedItem: mockUsers[0],
    renderSelected: (item: unknown) => {
      const user = asUser(item);
      return <div className="flex items-center gap-2">
          <div>
            <div className="text-sm font-medium">
              {user.profile.firstName} {user.profile.lastName}
            </div>
            <div className="text-xs text-neutral-600">{user.profile.email}</div>
          </div>
        </div>;
    }
  }
}`,...h.parameters?.docs?.source},description:{story:"Selected item state.",...h.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Source User',
    selectedItem: mockUsers[0],
    renderSelected: (item: unknown) => {
      const user = asUser(item);
      return <div className="flex items-center gap-2">
          <div>
            <div className="text-sm font-medium">
              {user.profile.firstName} {user.profile.lastName}
            </div>
            <div className="text-xs text-neutral-600">{user.profile.email}</div>
          </div>
        </div>;
    }
  }
}`,...y.parameters?.docs?.source},description:{story:"Selected with label.",...y.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  render: function InteractiveSearch(args) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<OktaUser | null>(null);
    const results = query ? mockUsers.filter(user => user.profile.email.includes(query.toLowerCase())).slice(0, 5) : [];
    return <div className="w-[360px]">
        <SearchDropdown {...args} label="Source user" query={query} onQueryChange={setQuery} results={results} showDropdown={results.length > 0} onSelect={item => {
        setSelected(asUser(item));
        setQuery('');
      }} selectedItem={selected ?? undefined} renderSelected={item => <div className="text-sm">{asUser(item).profile.email}</div>} onClear={() => {
        setSelected(null);
        setQuery('');
      }} />
      </div>;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox'), 'user12@');
    const hit = await canvas.findByText('user12@example.com');
    await userEvent.click(hit);
    await expect(canvas.getByRole('button', {
      name: 'Clear selection'
    })).toBeInTheDocument();
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear selection'
    }));
    await expect(canvas.getByRole('textbox')).toHaveValue('');
  }
}`,...f.parameters?.docs?.source},description:{story:"Real state behind the field: type to filter, click a hit to select it, clear to start over.",...f.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true,
    label: 'Source User'
  }
}`,...g.parameters?.docs?.source},description:{story:"Disabled state.",...g.parameters?.docs?.description}}};const T=["Default","WithLabel","Searching","WithResults","ManyResults","SearchError","InsideModal","WithQuery","Selected","SelectedWithLabel","Interactive","Disabled"];export{n as Default,g as Disabled,p as InsideModal,f as Interactive,d as ManyResults,u as SearchError,c as Searching,h as Selected,y as SelectedWithLabel,i as WithLabel,m as WithQuery,l as WithResults,T as __namedExportsOrder,E as default};
