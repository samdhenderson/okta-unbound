import{r as w,j as f}from"./iframe-tAvKsVeF.js";import{A as S}from"./AddToGroupModal-RpkxEGg9.js";import"./preload-helper-PPVm8Dsz.js";const{expect:l,fn:o,userEvent:h,within:C}=__STORYBOOK_MODULE_TEST__,u=[{id:"g1",name:"Engineering",description:"Eng team",type:"OKTA_GROUP"},{id:"g2",name:"Design",description:"Product design",type:"OKTA_GROUP"},{id:"g3",name:"Salesforce",description:"App-assigned",type:"APP_GROUP"}],v={title:"Users/AddToGroupModal",component:S,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The Users tab's Add-to-Group modal: a debounced group type-ahead over the shared Modal. Fully controlled — `useAddToGroup` owns the query, the results, the open/searching flags and the selection. Confirm stays disabled until a group is picked, and carries its own spinner while the add is in flight."}}},args:{isOpen:!0,userFirstName:"Ada",groupSearchQuery:"",onGroupSearchQueryChange:o(),groupSearchResults:[],isSearchingGroups:!1,showGroupDropdown:!1,selectedGroup:null,onSelectGroup:o(),onClearSelectedGroup:o(),isAddingToGroup:!1,onClose:o(),onConfirm:o()},argTypes:{isOpen:{description:"Whether the modal is open."},userFirstName:{description:'First name of the user being added; the title falls back to "User" when absent.'},groupSearchQuery:{description:"Controlled group type-ahead query."},onGroupSearchQueryChange:{description:"Called with the new query string on each keystroke."},groupSearchResults:{description:"Current group search results shown in the dropdown."},isSearchingGroups:{description:"True while a debounced group search is in flight (shows the inline spinner)."},showGroupDropdown:{description:"Whether the results dropdown should be shown."},selectedGroup:{description:"The chosen group, or null when none is selected yet."},onSelectGroup:{description:"Choose a group from the dropdown."},onClearSelectedGroup:{description:"Clear the chosen group (the selected-group clear affordance)."},isAddingToGroup:{description:"True while the add request is in flight (drives the confirm button spinner)."},onClose:{description:"Close the modal (Cancel, Escape, overlay click, or header close)."},onConfirm:{description:"Confirm the add of the selected group."}}},s={},t={args:{groupSearchQuery:"e",groupSearchResults:u,showGroupDropdown:!0}},n={args:{groupSearchQuery:"eng",isSearchingGroups:!0}},a={args:{selectedGroup:u[0]}},i={args:{selectedGroup:u[0],isAddingToGroup:!0}},c={render:function(d){const[e,r]=w.useState(""),[G,m]=w.useState(null),y=e?u.filter(p=>p.name.toLowerCase().includes(e.toLowerCase())):[];return f.jsx(S,{...d,groupSearchQuery:e,onGroupSearchQueryChange:r,groupSearchResults:y,showGroupDropdown:y.length>0,selectedGroup:G,onSelectGroup:p=>{m(p),r("")},onClearSelectedGroup:()=>m(null)})},play:async({args:g,canvasElement:d})=>{const e=C(d.ownerDocument.body),r=e.getByRole("button",{name:"Add to Group"});await l(r).toBeDisabled(),await h.type(e.getByRole("textbox"),"Engineering"),await h.click(await e.findByText("Engineering")),await l(r).toBeEnabled(),await h.click(r),await l(g.onConfirm).toHaveBeenCalledTimes(1)}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"Empty type-ahead; the confirm button is disabled until a group is chosen.",...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    groupSearchQuery: 'e',
    groupSearchResults: groups,
    showGroupDropdown: true
  }
}`,...t.parameters?.docs?.source},description:{story:"A query with an open results dropdown to pick from.",...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    groupSearchQuery: 'eng',
    isSearchingGroups: true
  }
}`,...n.parameters?.docs?.source},description:{story:"The debounced search is in flight — the inline spinner shows.",...n.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    selectedGroup: groups[0]
  }
}`,...a.parameters?.docs?.source},description:{story:"A group has been chosen; the confirm button is enabled and shows the chip.",...a.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    selectedGroup: groups[0],
    isAddingToGroup: true
  }
}`,...i.parameters?.docs?.source},description:{story:"The add request is in flight — the confirm button shows its loading spinner.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: function InteractiveAddToGroup(args) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<GroupSearchResult | null>(null);
    const results = query ? groups.filter(g => g.name.toLowerCase().includes(query.toLowerCase())) : [];
    return <AddToGroupModal {...args} groupSearchQuery={query} onGroupSearchQueryChange={setQuery} groupSearchResults={results} showGroupDropdown={results.length > 0} selectedGroup={selected} onSelectGroup={group => {
      setSelected(group);
      setQuery('');
    }} onClearSelectedGroup={() => setSelected(null)} />;
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    const confirm = canvas.getByRole('button', {
      name: 'Add to Group'
    });
    await expect(confirm).toBeDisabled();
    await userEvent.type(canvas.getByRole('textbox'), 'Engineering');
    await userEvent.click(await canvas.findByText('Engineering'));
    await expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  }
}`,...c.parameters?.docs?.source},description:{story:"The whole pick-then-confirm path, driven by real state.",...c.parameters?.docs?.description}}};const E=["Default","WithResults","Searching","GroupSelected","Adding","Interactive"];export{i as Adding,s as Default,a as GroupSelected,c as Interactive,n as Searching,t as WithResults,E as __namedExportsOrder,v as default};
