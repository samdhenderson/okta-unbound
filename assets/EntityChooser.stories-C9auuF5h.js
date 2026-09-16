import{j as h}from"./iframe-tAvKsVeF.js";import{a as g,C as y}from"./EntityChooser-DY08NxvZ.js";import"./preload-helper-PPVm8Dsz.js";const{expect:a,fn:d,userEvent:m,within:i}=__STORYBOOK_MODULE_TEST__,l=[{id:"00gFAKE01",name:"AWS Sandbox 2019",detail:"0 members"},{id:"00gFAKE11",name:"Salesforce Users",detail:"412 members"},{id:"00gFAKE21",name:"Engineering – All",detail:"1,204 members"},{id:"00gFAKE31",name:"Contractors – Q3 pilot",detail:"17 members"}],B={title:"Home/EntityChooser",component:g,tags:["autodocs"],parameters:{docs:{description:{component:"Pick one entity out of a list already in memory and hand its id back. It filters; it never searches — everything offered arrives through `choices` and typing narrows that array locally, with no async source. The visible cap is stated rather than silently truncating the list."}}},args:{choices:l,filterLabel:"Filter groups",actionLabel:"Scan MFA coverage for this group",onChoose:d()},decorators:[t=>h.jsx("div",{className:"max-w-md bg-neutral-50 p-3",children:h.jsx(t,{})})]},n={play:async({canvasElement:t,args:e})=>{const p=i(t);await a(p.getAllByRole("listitem")).toHaveLength(l.length),await m.click(p.getByRole("button",{description:"Salesforce Users"})),await a(e.onChoose).toHaveBeenCalledWith("00gFAKE11")}},s={play:async({canvasElement:t})=>{const e=i(t);await m.type(e.getByRole("searchbox",{name:"Filter groups"}),"contract"),await a(e.getAllByRole("listitem")).toHaveLength(1),await a(e.getByText("Contractors – Q3 pilot")).toBeInTheDocument()}},o={args:{emptyLabel:"No group matches that name."},play:async({canvasElement:t})=>{const e=i(t);await m.type(e.getByRole("searchbox",{name:"Filter groups"}),"zzzz"),await a(e.queryByRole("listitem")).not.toBeInTheDocument(),await a(e.getByText("No group matches that name.")).toBeInTheDocument()}},r={args:{choices:Array.from({length:400},(t,e)=>({id:`00gFAKE${e}`,name:`Project team ${e}`,detail:`${e} members`}))},play:async({canvasElement:t})=>{const e=i(t);await a(e.getAllByRole("listitem")).toHaveLength(y),await a(e.getByText(/Showing the first 25 of 400\./)).toBeInTheDocument()}},c={args:{choices:l.map(({id:t,name:e})=>({id:t,name:e}))},play:async({canvasElement:t})=>{const e=i(t);await a(e.queryByText("412 members")).not.toBeInTheDocument(),await a(e.getAllByRole("listitem")).toHaveLength(l.length)}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(GROUPS.length);
    await userEvent.click(canvas.getByRole('button', {
      description: 'Salesforce Users'
    }));
    await expect(args.onChoose).toHaveBeenCalledWith('00gFAKE11');
  }
}`,...n.parameters?.docs?.source},description:{story:"Everything on offer, unfiltered. Pressing a row hands its id back once.",...n.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox', {
      name: 'Filter groups'
    }), 'contract');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(1);
    await expect(canvas.getByText('Contractors – Q3 pilot')).toBeInTheDocument();
  }
}`,...s.parameters?.docs?.source},description:{story:"Typing narrows the rows already in memory — no request, at any keystroke.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    emptyLabel: 'No group matches that name.'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox', {
      name: 'Filter groups'
    }), 'zzzz');
    await expect(canvas.queryByRole('listitem')).not.toBeInTheDocument();
    await expect(canvas.getByText('No group matches that name.')).toBeInTheDocument();
  }
}`,...o.parameters?.docs?.source},description:{story:"Nothing matches: the chooser says so in the caller's own words.",...o.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    choices: Array.from({
      length: 400
    }, (_, i) => ({
      id: \`00gFAKE\${i}\`,
      name: \`Project team \${i}\`,
      detail: \`\${i} members\`
    }))
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(CHOOSER_VISIBLE_LIMIT);
    await expect(canvas.getByText(/Showing the first 25 of 400\\./)).toBeInTheDocument();
  }
}`,...r.parameters?.docs?.source},description:{story:"A big org: only the first {@link CHOOSER_VISIBLE_LIMIT} rows render, and the line says so.",...r.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    choices: GROUPS.map(({
      id,
      name
    }) => ({
      id,
      name
    }))
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('412 members')).not.toBeInTheDocument();
    await expect(canvas.getAllByRole('listitem')).toHaveLength(GROUPS.length);
  }
}`,...c.parameters?.docs?.source},description:{story:"No `detail` line: the row is just a name, and still a full-height target.",...c.parameters?.docs?.description}}};const E=["Default","Filtered","NoMatches","Capped","NamesOnly"];export{r as Capped,n as Default,s as Filtered,c as NamesOnly,o as NoMatches,E as __namedExportsOrder,B as default};
