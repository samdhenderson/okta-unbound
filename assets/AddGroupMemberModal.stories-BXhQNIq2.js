import{A as y}from"./AddGroupMemberModal-DdRXzanx.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./userDisplay-xpx41Abi.js";const{expect:f,fn:r,userEvent:b,within:h}=__STORYBOOK_MODULE_TEST__;function u(l,e,p){return{id:l,status:"ACTIVE",profile:{login:`${e.toLowerCase()}@example.com`,email:`${e.toLowerCase()}@example.com`,firstName:e,lastName:p}}}const c=[u("00uFAKE1","Ada","Lovelace"),u("00uFAKE2","Grace","Hopper"),u("00uFAKE3","Katherine","Johnson")],C={title:"Groups/AddGroupMemberModal",component:y,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The Group Detail view's Add-member modal: a debounced user type-ahead over the shared Modal — the group-side mirror of the Users tab's AddToGroupModal.\n\nFully controlled: the parent (via `useAddGroupMember`) owns the query, the debounced results with the current roster already excluded, the searching flags, and the selected user. The confirm button stays disabled until a user is picked."}}},args:{isOpen:!0,groupName:"Engineering",addQuery:"",onAddQueryChange:r(),addResults:[],isSearchingToAdd:!1,addSearchError:null,selectedUser:null,onSelectUser:r(),onClearSelectedUser:r(),isAddingMember:!1,onClose:r(),onConfirm:r(),addMemberError:null},argTypes:{isOpen:{description:"Whether the modal is open."},groupName:{description:'Name of the group members are being added to; the title falls back to "Group" when absent.'},addQuery:{description:"Controlled user type-ahead query."},onAddQueryChange:{description:"Called with the new query string on each keystroke."},addResults:{description:"Current user search results shown in the dropdown, with existing members already excluded."},isSearchingToAdd:{description:"True while a debounced user search is in flight (shows the inline spinner)."},addSearchError:{description:"Error message from the debounced search, if any."},selectedUser:{description:"The chosen user, or null when none is selected yet."},onSelectUser:{description:"Choose a user from the dropdown."},onClearSelectedUser:{description:"Clear the chosen user (the selected-user clear affordance)."},isAddingMember:{description:"True while the add request is in flight (drives the confirm button spinner)."},onClose:{description:"Close the modal (Cancel, Escape, overlay click, or header close)."},onConfirm:{description:"Confirm the add of the selected user."},addMemberError:{description:"Error from a failed add attempt (the mutation, not the search)."}}},s={},a={args:{addQuery:"a",addResults:c},play:async({canvasElement:l,args:e})=>{const m=await h(l).findByRole("dialog"),g=h(m).getByRole("button",{name:/Katherine Johnson/});await b.click(g),await f(e.onSelectUser).toHaveBeenCalledWith(c[2])}},t={args:{addQuery:"ada",isSearchingToAdd:!0}},o={args:{selectedUser:c[0]}},n={args:{selectedUser:c[0],isAddingMember:!0}},d={args:{addQuery:"ada",addSearchError:"Failed to search users. Please try again."}},i={args:{selectedUser:c[0],addMemberError:"Failed to add member."}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"Empty type-ahead; the confirm button is disabled until a user is chosen.",...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    addQuery: 'a',
    addResults: users
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const dialog = await canvas.findByRole('dialog');
    const lastResult = within(dialog).getByRole('button', {
      name: /Katherine Johnson/
    });
    await userEvent.click(lastResult);
    await expect(args.onSelectUser).toHaveBeenCalledWith(users[2]);
  }
}`,...a.parameters?.docs?.source},description:{story:"A query with an open results list; the play function picks the last row, which must be reachable.",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    addQuery: 'ada',
    isSearchingToAdd: true
  }
}`,...t.parameters?.docs?.source},description:{story:"The debounced search is in flight — the inline spinner shows.",...t.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    selectedUser: users[0]
  }
}`,...o.parameters?.docs?.source},description:{story:"A user has been chosen; the confirm button is enabled and shows the chip.",...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    selectedUser: users[0],
    isAddingMember: true
  }
}`,...n.parameters?.docs?.source},description:{story:"The add request is in flight — the confirm button shows its loading spinner.",...n.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    addQuery: 'ada',
    addSearchError: 'Failed to search users. Please try again.'
  }
}`,...d.parameters?.docs?.source},description:{story:"The debounced search failed — an inline danger alert shows below the field.",...d.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    selectedUser: users[0],
    addMemberError: 'Failed to add member.'
  }
}`,...i.parameters?.docs?.source},description:{story:"The add mutation itself failed after confirming — a distinct alert from a search failure.",...i.parameters?.docs?.description}}};const T=["Default","WithResults","Searching","UserSelected","Adding","SearchError","AddError"];export{i as AddError,n as Adding,s as Default,d as SearchError,t as Searching,o as UserSelected,a as WithResults,T as __namedExportsOrder,C as default};
