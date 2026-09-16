import{j as i,r as g}from"./iframe-tAvKsVeF.js";import{R as v}from"./RulesFilterPanel-DohjCk4S.js";import"./preload-helper-PPVm8Dsz.js";const{expect:a,fn:f,userEvent:p,within:o}=__STORYBOOK_MODULE_TEST__,y=[{name:"Engineering — all ICs",status:"ACTIVE",conflicted:!1},{name:"Engineering Managers",status:"ACTIVE",conflicted:!0},{name:"Contractors — EMEA",status:"INACTIVE",conflicted:!1},{name:"Sales — AMER",status:"INACTIVE",conflicted:!0}],S=s=>y.filter(e=>s==="active"?e.status==="ACTIVE":s==="paused"?e.status==="INACTIVE":s==="conflicts"?e.conflicted:!0),B={title:"Rules/RulesFilterPanel",component:v,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:'The Rules rung\'s filter chips and sort selector, disclosed below the action strip by its `FilterToggle`. Presentational: every chip and the sort reports upward, and the rung owns the filtering.\n\nThe Conflicts chip is disabled rather than omitted at zero, and keeps its `(0)` — "how many rules conflict" is a finding about the loaded set, and zero is the good answer, worth stating rather than leaving the reader to wonder whether the check ran.'}}},argTypes:{activeFilter:{description:"The active filter chip."},onFilterChange:{description:"Called with the newly chosen filter."},conflictsCount:{description:"Conflict count shown on, and gating, the Conflicts chip."},showCurrentGroup:{description:'Whether to offer the "Current Group" chip.'},sortMode:{description:"Active list sort mode."},onSortChange:{description:"Called with the newly chosen sort mode."}},args:{activeFilter:"all",onFilterChange:f(),conflictsCount:0,showCurrentGroup:!1,sortMode:"default",onSortChange:f()}},n={},l={args:{conflictsCount:3,activeFilter:"conflicts"}},c={args:{showCurrentGroup:!0,activeFilter:"current-group"}},d={args:{sortMode:"similarity"}},u={render:s=>{const e=()=>{const[t,w]=g.useState("all"),[m,C]=g.useState("default"),h=S(t),R=m==="name"?[...h].sort((r,A)=>r.name.localeCompare(A.name)):h;return i.jsxs("div",{className:"space-y-(--sp-field)",children:[i.jsx(v,{...s,activeFilter:t,onFilterChange:w,conflictsCount:y.filter(r=>r.conflicted).length,sortMode:m,onSortChange:C}),i.jsx("ul",{"aria-label":"Rules",className:"space-y-1 text-sm text-neutral-700",children:R.map(r=>i.jsx("li",{children:r.name},r.name))})]})};return i.jsx(e,{})},play:async({canvasElement:s})=>{const e=o(s),t=e.getByRole("list",{name:"Rules"});await a(o(t).getAllByRole("listitem")).toHaveLength(4),await p.click(e.getByRole("button",{name:"Active Only"})),await a(e.getByRole("button",{name:"Active Only"})).toHaveAttribute("aria-pressed","true"),await a(o(t).getAllByRole("listitem")).toHaveLength(2),await p.click(e.getByRole("button",{name:"Conflicts (2)"})),await a(o(t).getAllByRole("listitem")).toHaveLength(2),await a(o(t).getByText("Sales — AMER")).toBeInTheDocument(),await p.selectOptions(e.getByLabelText("Sort rules"),"name"),await a(o(t).getAllByRole("listitem")[0]).toHaveTextContent("Engineering Managers")}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"No filter applied, default order, no conflicts found.",...n.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    conflictsCount: 3,
    activeFilter: 'conflicts'
  }
}`,...l.parameters?.docs?.source},description:{story:"Conflicts were found — the chip is live and states how many.",...l.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    showCurrentGroup: true,
    activeFilter: 'current-group'
  }
}`,...c.parameters?.docs?.source},description:{story:'A group is detected on the live Okta tab, so the "Current Group" chip is offered.',...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    sortMode: 'similarity' satisfies RuleSortMode
  }
}`,...d.parameters?.docs?.source},description:{story:"The near-duplicate detector's order — one of the two things the badge counts.",...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  render: args => {
    const Harness = () => {
      const [activeFilter, setActiveFilter] = useState<RulesFilterType>('all');
      const [sortMode, setSortMode] = useState<RuleSortMode>('default');
      const visible = applyFilter(activeFilter);
      const ordered = sortMode === 'name' ? [...visible].sort((a, b) => a.name.localeCompare(b.name)) : visible;
      return <div className="space-y-(--sp-field)">
          <RulesFilterPanel {...args} activeFilter={activeFilter} onFilterChange={setActiveFilter} conflictsCount={sampleRules.filter(rule => rule.conflicted).length} sortMode={sortMode} onSortChange={setSortMode} />
          <ul aria-label="Rules" className="space-y-1 text-sm text-neutral-700">
            {ordered.map(rule => <li key={rule.name}>{rule.name}</li>)}
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
    await userEvent.click(canvas.getByRole('button', {
      name: 'Active Only'
    }));
    await expect(canvas.getByRole('button', {
      name: 'Active Only'
    })).toHaveAttribute('aria-pressed', 'true');
    await expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Conflicts (2)'
    }));
    await expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    await expect(within(list).getByText('Sales — AMER')).toBeInTheDocument();
    await userEvent.selectOptions(canvas.getByLabelText('Sort rules'), 'name');
    await expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Engineering Managers');
  }
}`,...u.parameters?.docs?.source},description:{story:`The panel wired to real state over a four-rule list, so each chip narrows the
list beneath it and the sort reorders it.`,...u.parameters?.docs?.description}}};const F=["Default","WithConflicts","WithCurrentGroup","SortedBySimilarity","Interactive"];export{n as Default,u as Interactive,d as SortedBySimilarity,l as WithConflicts,c as WithCurrentGroup,F as __namedExportsOrder,B as default};
