import{x as p,j as e,r as h,d as v}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:r,fn:x,userEvent:g,within:f}=__STORYBOOK_MODULE_TEST__,b={title:"Shared/FilterToggle",component:p,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Opens and closes a filter panel and carries a count badge of the currently active filters. It takes the active wash both when the panel is expanded and when any filter is applied with the panel closed, so a hidden filter shortening the list below stays visible. The badge is hidden at zero."}}},argTypes:{open:{description:"Whether the filter panel is expanded."},activeCount:{description:"Number of filters applied. The badge is hidden at 0."},onToggle:{description:"Toggles the filter panel open/closed."},size:{description:"Vertical scale, matching the `Input` it stands beside."},label:{description:"Visible label. Defaults to `Filters`."},title:{description:"Native tooltip. Defaults to `Toggle filters`."},controls:{description:"Id of the disclosed region; supplying it swaps `aria-pressed` for `aria-expanded`."}},args:{open:!1,activeCount:0,onToggle:x()}},n={},o={args:{open:!0}},i={args:{activeCount:4}},u={args:{open:!0,activeCount:2}},c={render:t=>e.jsxs("div",{className:"flex items-start gap-4",children:[e.jsx(p,{...t,size:"md"}),e.jsx(p,{...t,size:"lg"})]}),args:{activeCount:2}},l={render:t=>{const s=()=>{const[a,m]=h.useState("");return e.jsxs("div",{className:"flex w-[420px] items-start gap-2",children:[e.jsx(v,{type:"search",size:"lg",value:a,onChange:m,ariaLabel:"Search groups",placeholder:"Search…"}),e.jsx(p,{...t,size:"lg"})]})};return e.jsx(s,{})},args:{activeCount:1}},y=()=>{const[t,s]=h.useState(!1);return e.jsxs("div",{className:"w-[320px]",children:[e.jsx(p,{open:t,activeCount:2,onToggle:()=>s(a=>!a),controls:"filter-panel"}),t&&e.jsx("div",{id:"filter-panel",className:"mt-2 rounded-md border border-neutral-200 p-3 text-sm",children:"Status: Active · Type: Okta group"})]})},d={render:()=>e.jsx(y,{}),play:async({canvasElement:t})=>{const s=f(t),a=s.getByRole("button",{name:/filters/i});await r(a).toHaveAttribute("aria-expanded","false"),await g.click(a),await r(a).toHaveAttribute("aria-expanded","true"),await r(s.getByText(/Status: Active/)).toBeInTheDocument(),await g.click(a),await r(a).toHaveAttribute("aria-expanded","false"),await r(s.queryByText(/Status: Active/)).not.toBeInTheDocument()}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"Collapsed, nothing applied — the resting state.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    open: true
  }
}`,...o.parameters?.docs?.source},description:{story:"Active wash even at zero filters, because the panel itself is showing.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    activeCount: 4
  }
}`,...i.parameters?.docs?.source},description:{story:"The count badge, and the wash that says the list is shortened.",...i.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    open: true,
    activeCount: 2
  }
}`,...u.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex items-start gap-4">
      <FilterToggle {...args} size="md" />
      <FilterToggle {...args} size="lg" />
    </div>,
  args: {
    activeCount: 2
  }
}`,...c.parameters?.docs?.source},description:{story:'`lg` beside an `Input size="lg"`, `md` beside anything shorter.',...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: args => {
    const SearchRow = () => {
      const [query, setQuery] = useState('');
      return <div className="flex w-[420px] items-start gap-2">
          <Input type="search" size="lg" value={query} onChange={setQuery} ariaLabel="Search groups" placeholder="Search…" />
          <FilterToggle {...args} size="lg" />
        </div>;
    };
    return <SearchRow />;
  },
  args: {
    activeCount: 1
  }
}`,...l.parameters?.docs?.source},description:{story:"The search row shape every consumer builds — field, then toggle.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <FilterDisclosure />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', {
      name: /filters/i
    });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText(/Status: Active/)).toBeInTheDocument();
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryByText(/Status: Active/)).not.toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"Click the toggle and the panel it controls appears; click again and it is gone.",...d.parameters?.docs?.description}}};const T=["Default","Open","WithActiveCount","OpenWithActiveCount","Sizes","BesideASearchField","DisclosesAPanel"];export{l as BesideASearchField,n as Default,d as DisclosesAPanel,o as Open,u as OpenWithActiveCount,c as Sizes,i as WithActiveCount,T as __namedExportsOrder,b as default};
