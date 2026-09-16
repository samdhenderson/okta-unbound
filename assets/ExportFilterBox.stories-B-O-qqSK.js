import{j as u,r as h}from"./iframe-tAvKsVeF.js";import{E as l}from"./ExportFilterBox-B0xYA_h5.js";import"./preload-helper-PPVm8Dsz.js";const{expect:p,fn:m,userEvent:g,within:x}=__STORYBOOK_MODULE_TEST__,v={title:"Export/ExportFilterBox",component:l,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"The shared `Input` plus the descriptor's help text and a readout driven by the tab hook's first-page probe: `Checking…` while the probe is in flight, `No matches` for a zero-result query, `N+ matching` when rows are found. The filter text and the count both belong to the hook."}}},argTypes:{value:{description:"Controlled raw filter expression."},onChange:{description:"Called with the new filter text on each change."},help:{description:"Inline help text shown under the field (from the descriptor)."},placeholder:{description:"Example expression shown as the input placeholder."},matchCount:{description:"Debounced first-page match-count, or `null` while unknown."},matchCountLoading:{description:"Whether a match-count probe is in flight."},disabled:{description:"Disable the input (e.g. no context entity chosen yet)."}},args:{value:"",onChange:m(),help:"Optional Okta `search` expression (SCIM). Leave blank to export all users.",placeholder:'status eq "ACTIVE" and profile.department eq "Sales"',matchCount:null,matchCountLoading:!1,disabled:!1}},t={},a={args:{value:'status eq "ACTIVE"',matchCountLoading:!0}},s={args:{value:'status eq "ACTIVE"',matchCount:{count:200,hasMore:!0}}},r={args:{value:'status eq "TYPO"',matchCount:{count:0,hasMore:!1}}},o={args:{disabled:!0}},n={render:i=>{const c=()=>{const[e,d]=h.useState("");return u.jsx(l,{...i,value:e,onChange:d,matchCount:e.trim()?{count:200,hasMore:!0}:null})};return u.jsx(c,{})},play:async({canvasElement:i})=>{const c=x(i),e=c.getByRole("searchbox");await g.type(e,'status eq "ACTIVE"'),await p(e).toHaveValue('status eq "ACTIVE"'),await p(c.getByText("200+ matching")).toBeInTheDocument()}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source},description:{story:"Empty filter, no probe yet.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    value: 'status eq "ACTIVE"',
    matchCountLoading: true
  }
}`,...a.parameters?.docs?.source},description:{story:"A match-count probe is in flight.",...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    value: 'status eq "ACTIVE"',
    matchCount: {
      count: 200,
      hasMore: true
    }
  }
}`,...s.parameters?.docs?.source},description:{story:"Matches found, with more pages beyond the first.",...s.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    value: 'status eq "TYPO"',
    matchCount: {
      count: 0,
      hasMore: false
    }
  }
}`,...r.parameters?.docs?.source},description:{story:"The filter matched nothing.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...o.parameters?.docs?.source},description:{story:"Disabled until a context entity is chosen.",...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: args => {
    const Harness = () => {
      const [value, setValue] = useState('');
      return <ExportFilterBox {...args} value={value} onChange={setValue} matchCount={value.trim() ? {
        count: 200,
        hasMore: true
      } : null} />;
    };
    return <Harness />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('searchbox');
    await userEvent.type(field, 'status eq "ACTIVE"');
    await expect(field).toHaveValue('status eq "ACTIVE"');
    await expect(canvas.getByText('200+ matching')).toBeInTheDocument();
  }
}`,...n.parameters?.docs?.source},description:{story:`The box wired to real state and a probe: typing an expression puts it in the
field and resolves the match-count line beneath it.`,...n.parameters?.docs?.description}}};const b=["Default","Loading","Matching","NoMatches","Disabled","Typing"];export{t as Default,o as Disabled,a as Loading,s as Matching,r as NoMatches,n as Typing,b as __namedExportsOrder,v as default};
