import{j as p,r as d}from"./iframe-tAvKsVeF.js";import{M as u}from"./MemberSearchBar-CN-EWnJT.js";import"./preload-helper-PPVm8Dsz.js";const{expect:s,fn:m,userEvent:l,within:h}=__STORYBOOK_MODULE_TEST__,w={title:"Members/MemberSearchBar",component:u,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Search input for the member list: a thin controlled wrapper over the shared `Input`, with a leading search icon and a clear button that appears only when the query is non-empty. The parent (`MemberExplorer`) owns the value and debounces it before filtering."}}},argTypes:{value:{description:"Current query text (controlled)."},onChange:{description:"Called with the new query on each change / clear."},placeholder:{description:"Optional placeholder override."}},args:{value:"",onChange:m()}},a={},r={args:{placeholder:"Search…"}},t={args:{value:"jane.doe"}},n={args:{value:"a very long search query that a user might paste into the box by mistake"}},y=()=>{const[c,e]=d.useState("");return p.jsx(u,{value:c,onChange:e})},o={render:()=>p.jsx(y,{}),play:async({canvasElement:c})=>{const e=h(c),i=e.getByRole("searchbox");await s(e.queryByRole("button",{name:"Clear search"})).not.toBeInTheDocument(),await l.type(i,"jane"),await s(i).toHaveValue("jane"),await l.click(e.getByRole("button",{name:"Clear search"})),await s(i).toHaveValue(""),await s(e.queryByRole("button",{name:"Clear search"})).not.toBeInTheDocument()}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:"{}",...a.parameters?.docs?.source},description:{story:"Empty query — placeholder text shown, no clear button.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    placeholder: 'Search…'
  }
}`,...r.parameters?.docs?.source},description:{story:"Custom placeholder override.",...r.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    value: 'jane.doe'
  }
}`,...t.parameters?.docs?.source},description:{story:"Non-empty query — the clear button appears.",...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    value: 'a very long search query that a user might paste into the box by mistake'
  }
}`,...n.parameters?.docs?.source},description:{story:"A long query still truncates/renders cleanly.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <SearchHarness />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('searchbox');
    await expect(canvas.queryByRole('button', {
      name: 'Clear search'
    })).not.toBeInTheDocument();
    await userEvent.type(field, 'jane');
    await expect(field).toHaveValue('jane');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear search'
    }));
    await expect(field).toHaveValue('');
    await expect(canvas.queryByRole('button', {
      name: 'Clear search'
    })).not.toBeInTheDocument();
  }
}`,...o.parameters?.docs?.source},description:{story:"Typing reveals the clear button; clicking it empties the field and hides the button again.",...o.parameters?.docs?.description}}};const x=["Default","CustomPlaceholder","WithValue","LongText","TypingAndClearing"];export{r as CustomPlaceholder,a as Default,n as LongText,o as TypingAndClearing,t as WithValue,x as __namedExportsOrder,w as default};
