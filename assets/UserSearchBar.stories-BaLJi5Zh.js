import{j as t,r as d}from"./iframe-tAvKsVeF.js";import{U as p}from"./UserSearchBar-DY0fUkzs.js";import"./preload-helper-PPVm8Dsz.js";const{expect:a,fn:h,userEvent:u,within:m}=__STORYBOOK_MODULE_TEST__,B={title:"Users/UserSearchBar",component:p,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Controlled search input for user search. The parent owns the query; the bar shows an inline spinner while a search is in flight and a clear button that both clears the query and refocuses the input."}}},args:{searchQuery:"",onSearchChange:h(),onClear:h(),isSearching:!1,showClearButton:!1},argTypes:{searchQuery:{description:"Current search text (controlled)."},onSearchChange:{description:"Called with the new query on every keystroke."},onClear:{description:"Clears the query; also refocuses the input."},isSearching:{description:"When true, shows the inline loading spinner."},showClearButton:{description:"When true, shows the clear (×) button."},placeholder:{description:"Placeholder text; defaults to a generic email/name/login hint."}},decorators:[e=>t.jsx("div",{style:{width:400},children:t.jsx(e,{})})]},s={},n={args:{searchQuery:"jane.doe@example.com",showClearButton:!0}},o={args:{searchQuery:"jane",showClearButton:!0,isSearching:!0}},c={args:{placeholder:"Find a user by employee ID..."}},y=()=>{const[e,r]=d.useState("");return t.jsxs(t.Fragment,{children:[t.jsx(p,{searchQuery:e,onSearchChange:r,onClear:()=>r(""),isSearching:!1,showClearButton:e.length>0}),t.jsx("p",{className:"mt-2 text-xs text-neutral-600",children:e?`Searching for ${e}`:"No query"})]})},i={render:()=>t.jsx(y,{}),play:async({canvasElement:e})=>{const r=m(e),l=r.getByRole("textbox");await a(r.queryByRole("button",{name:"Clear search"})).not.toBeInTheDocument(),await u.type(l,"jane"),await a(r.getByText("Searching for jane")).toBeInTheDocument(),await u.click(r.getByRole("button",{name:"Clear search"})),await a(l).toHaveValue(""),await a(l).toHaveFocus(),await a(r.getByText("No query")).toBeInTheDocument()}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"Empty input showing the placeholder.",...s.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'jane.doe@example.com',
    showClearButton: true
  }
}`,...n.parameters?.docs?.source},description:{story:"Input with text entered; the clear button is now shown.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    searchQuery: 'jane',
    showClearButton: true,
    isSearching: true
  }
}`,...o.parameters?.docs?.source},description:{story:"Loading spinner shown while a search is in flight.",...o.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    placeholder: 'Find a user by employee ID...'
  }
}`,...c.parameters?.docs?.source},description:{story:"Custom placeholder text.",...c.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <LiveUserSearchBar />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox');
    await expect(canvas.queryByRole('button', {
      name: 'Clear search'
    })).not.toBeInTheDocument();
    await userEvent.type(field, 'jane');
    await expect(canvas.getByText('Searching for jane')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear search'
    }));
    await expect(field).toHaveValue('');
    await expect(field).toHaveFocus();
    await expect(canvas.getByText('No query')).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"Typing reveals the clear button; pressing it empties the field and refocuses it.",...i.parameters?.docs?.description}}};const C=["Default","WithQuery","Searching","CustomPlaceholder","TypeThenClear"];export{c as CustomPlaceholder,s as Default,o as Searching,i as TypeThenClear,n as WithQuery,C as __namedExportsOrder,B as default};
