import{j as r,r as h}from"./iframe-tAvKsVeF.js";import{R as y}from"./RulesSearchRow-Dfi82CYt.js";import"./preload-helper-PPVm8Dsz.js";const{expect:d,fn:g,userEvent:m,within:u}=__STORYBOOK_MODULE_TEST__,R=["Engineering — all ICs","Engineering Managers","Contractors — EMEA","Sales — AMER"],E={title:"Rules/RulesSearchRow",component:y,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"The Rules rung's search field beside its filter disclosure — the node the action strip renders in its `subRow`, so the field docks with the verbs and stays reachable at any scroll offset. Fully controlled: the query and the panel state belong to the rung, and the count on the toggle is the only trace of an applied filter once the panel below is closed."}}},argTypes:{searchQuery:{description:"Current search text."},onSearchChange:{description:"Called with the full next query on each keystroke."},filtersOpen:{description:"Whether the filter panel below the band is open."},onToggleFilters:{description:"Toggles that panel."},activeFilterCount:{description:"Number of filters applied; the toggle badge is hidden at 0."}},args:{searchQuery:"",onSearchChange:g(),filtersOpen:!1,onToggleFilters:g(),activeFilterCount:0}},n={},i={args:{searchQuery:"Engineering"}},o={args:{filtersOpen:!0}},l={args:{activeFilterCount:2},play:async({canvasElement:s})=>{const e=u(s);await d(e.getByRole("button",{name:"Filters, 2 applied"})).toBeInTheDocument()}},c={render:s=>{const e=()=>{const[a,p]=h.useState(""),[f,v]=h.useState(!1),w=R.filter(t=>t.toLowerCase().includes(a.trim().toLowerCase()));return r.jsxs("div",{className:"space-y-(--sp-field)",children:[r.jsx(y,{...s,searchQuery:a,onSearchChange:p,filtersOpen:f,onToggleFilters:()=>v(t=>!t)}),r.jsx("ul",{"aria-label":"Rules",className:"space-y-1 text-sm text-neutral-700",children:w.map(t=>r.jsx("li",{children:t},t))})]})};return r.jsx(e,{})},play:async({canvasElement:s})=>{const e=u(s),a=e.getByRole("list",{name:"Rules"});await d(u(a).getAllByRole("listitem")).toHaveLength(4),await m.type(e.getByPlaceholderText(/Search rules/i),"engineering"),await d(u(a).getAllByRole("listitem")).toHaveLength(2);const p=e.getByRole("button",{name:"Filters"});await m.click(p),await d(p).toHaveAttribute("aria-pressed","true")}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"Empty field, panel closed, no filters applied.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'Engineering'
  }
}`,...i.parameters?.docs?.source},description:{story:"A query in the field.",...i.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    filtersOpen: true
  }
}`,...o.parameters?.docs?.source},description:{story:"The panel is open — the toggle carries the open state.",...o.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    activeFilterCount: 2
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // The badge digit is \`aria-hidden\`; the count reaches assistive tech by name.
    await expect(canvas.getByRole('button', {
      name: 'Filters, 2 applied'
    })).toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:"Two filters applied with the panel closed: the badge is all that is left to say so.",...l.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: args => {
    const Harness = () => {
      const [searchQuery, setSearchQuery] = useState('');
      const [filtersOpen, setFiltersOpen] = useState(false);
      const visible = sampleRules.filter(name => name.toLowerCase().includes(searchQuery.trim().toLowerCase()));
      return <div className="space-y-(--sp-field)">
          <RulesSearchRow {...args} searchQuery={searchQuery} onSearchChange={setSearchQuery} filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen(previous => !previous)} />
          <ul aria-label="Rules" className="space-y-1 text-sm text-neutral-700">
            {visible.map(name => <li key={name}>{name}</li>)}
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
      name: 'Rules'
    });
    await expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    await userEvent.type(canvas.getByPlaceholderText(/Search rules/i), 'engineering');
    await expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    const toggle = canvas.getByRole('button', {
      name: 'Filters'
    });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  }
}`,...c.parameters?.docs?.source},description:{story:`The row wired to real state over a four-rule list, so typing narrows the list
beneath it and the toggle opens and closes.`,...c.parameters?.docs?.description}}};const F=["Default","Searching","FiltersOpen","FiltersApplied","Interactive"];export{n as Default,l as FiltersApplied,o as FiltersOpen,c as Interactive,i as Searching,F as __namedExportsOrder,E as default};
