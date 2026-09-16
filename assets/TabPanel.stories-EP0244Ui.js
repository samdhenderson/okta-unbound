import{j as e,r as u,B as p}from"./iframe-tAvKsVeF.js";import{T as c}from"./TabPanel-CWgFm8_N.js";import"./preload-helper-PPVm8Dsz.js";import"./useScrollPreservation-Cu5EK3Op.js";const{expect:l,userEvent:v,within:m}=__STORYBOOK_MODULE_TEST__,f={title:"Sidepanel/TabPanel",component:c,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"Wraps one top-level tab. Tabs mount on first activation and are hidden — never unmounted — thereafter, so React state survives but DOM scroll state does not.\n\nEvery root-scrolling tab shares one scroll container, so each panel runs its own `useScrollPreservation` against it and returns to *that tab's* offset. The panel also owns a private `Suspense` boundary, so a lazily-loaded tab cannot swap a fallback in over its mounted neighbours."}}},argTypes:{isActive:{description:"Whether this is the selected tab. Drives visibility and scroll."},scrollRef:{description:"Ref on the shared scrolling element. Inert when unset."},children:{description:"The tab's content. Mounted once, then kept mounted."}}},i=({label:r})=>e.jsx("div",{className:"max-w-7xl mx-auto px-6 py-6 space-y-3",children:Array.from({length:30},(t,n)=>e.jsxs("div",{className:"p-3 bg-white border border-neutral-200 rounded-md text-sm",children:[r," — row ",n+1]},n))}),a={args:{isActive:!0,scrollRef:{current:null},children:e.jsx(i,{label:"Active panel"})}},o={args:{isActive:!1,scrollRef:{current:null},children:e.jsx(i,{label:"Hidden panel"})}},s={args:{isActive:!0,scrollRef:{current:null},children:null},render:function(){const t=u.useRef(null),[n,d]=u.useState("one");return e.jsxs("div",{ref:t,className:"h-screen overflow-y-auto bg-canvas",children:[e.jsxs("div",{className:"sticky top-0 z-10 flex gap-2 px-6 py-3 bg-canvas border-b border-neutral-200",children:[e.jsx(p,{variant:n==="one"?"primary":"secondary",size:"sm",onClick:()=>d("one"),children:"Panel one"}),e.jsx(p,{variant:n==="two"?"primary":"secondary",size:"sm",onClick:()=>d("two"),children:"Panel two"})]}),e.jsx(c,{isActive:n==="one",scrollRef:t,children:e.jsx(i,{label:"Panel one"})}),e.jsx(c,{isActive:n==="two",scrollRef:t,children:e.jsx(i,{label:"Panel two"})})]})},play:async({canvasElement:r})=>{const t=m(r);await l(t.getByText("Panel one — row 1")).toBeVisible(),await v.click(t.getByRole("button",{name:"Panel two"})),await l(t.getByText("Panel two — row 1")).toBeVisible(),await l(t.getByText("Panel one — row 1")).not.toBeVisible(),await v.click(t.getByRole("button",{name:"Panel one"})),await l(t.getByText("Panel one — row 1")).toBeVisible()}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    isActive: true,
    scrollRef: {
      current: null
    },
    children: <TallContent label="Active panel" />
  }
}`,...a.parameters?.docs?.source},description:{story:"The active panel: visible, and mirroring the container's scroll offset.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    isActive: false,
    scrollRef: {
      current: null
    },
    children: <TallContent label="Hidden panel" />
  }
}`,...o.parameters?.docs?.source},description:{story:"A hidden panel stays mounted but leaves the accessibility tree and the tab order.",...o.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    isActive: true,
    scrollRef: {
      current: null
    },
    children: null
  },
  render: function SharedScrollContainerStory() {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState<'one' | 'two'>('one');
    return <div ref={scrollRef} className="h-screen overflow-y-auto bg-canvas">
        <div className="sticky top-0 z-10 flex gap-2 px-6 py-3 bg-canvas border-b border-neutral-200">
          <Button variant={active === 'one' ? 'primary' : 'secondary'} size="sm" onClick={() => setActive('one')}>
            Panel one
          </Button>
          <Button variant={active === 'two' ? 'primary' : 'secondary'} size="sm" onClick={() => setActive('two')}>
            Panel two
          </Button>
        </div>
        <TabPanel isActive={active === 'one'} scrollRef={scrollRef}>
          <TallContent label="Panel one" />
        </TabPanel>
        <TabPanel isActive={active === 'two'} scrollRef={scrollRef}>
          <TallContent label="Panel two" />
        </TabPanel>
      </div>;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Panel one — row 1')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Panel two'
    }));
    await expect(canvas.getByText('Panel two — row 1')).toBeVisible();
    await expect(canvas.getByText('Panel one — row 1')).not.toBeVisible();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Panel one'
    }));
    await expect(canvas.getByText('Panel one — row 1')).toBeVisible();
  }
}`,...s.parameters?.docs?.source},description:{story:"Two panels sharing one scroll container: scroll one, switch, and each returns to its own offset.",...s.parameters?.docs?.description}}};const x=["Active","Hidden","SharedScrollContainer"];export{a as Active,o as Hidden,s as SharedScrollContainer,x as __namedExportsOrder,f as default};
