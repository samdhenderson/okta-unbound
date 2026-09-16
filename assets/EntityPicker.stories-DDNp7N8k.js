import{E as i}from"./EntityPicker-jBCPLf1x.js";import{u as o}from"./types-D54cNL3h.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:c,fn:p,userEvent:d,within:l}=__STORYBOOK_MODULE_TEST__,u=[{id:"users",displayName:"Users",icon:"user",description:"All users in the org with identity and profile attributes.",context:{kind:"whole-org"},endpoint:"/api/v1/users",defaultQuery:{},schema:o(),columnCatalog:[],filter:{kind:"none"}},{id:"group-memberships",displayName:"Group Memberships",icon:"users",description:"Members of a specific group you choose.",context:{kind:"search-to-select",label:"Group",placeholder:"Search groups…",endpoint:s=>`/api/v1/groups/${s}/users`},defaultQuery:{},schema:o(),columnCatalog:[],filter:{kind:"none"}}],f={title:"Export/EntityPicker",component:i,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The Export tab's entity hub: one selectable card (icon + name + description) per registered entity descriptor. Selecting a card hands its id back to the tab, which enters the `configure` phase; with no descriptors it renders the shared `EmptyState`."}}},argTypes:{descriptors:{description:"Ordered descriptors to offer, one selectable row each."},onSelect:{description:"Invoked with the chosen descriptor id when a row is clicked."}},args:{descriptors:u,onSelect:p()}},e={},t={play:async({args:s,canvasElement:a})=>{const n=l(a);await d.click(n.getAllByRole("button")[0]),await c(s.onSelect).toHaveBeenCalledWith("users")}},r={args:{descriptors:[]}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:"The populated hub.",...e.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole('button')[0]);
    await expect(args.onSelect).toHaveBeenCalledWith('users');
  }
}`,...t.parameters?.docs?.source},description:{story:"Choosing an entity reports its descriptor id — the tab's cue to start configuring.",...t.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    descriptors: []
  }
}`,...r.parameters?.docs?.source},description:{story:"No descriptors registered — the empty state.",...r.parameters?.docs?.description}}};const b=["Default","Selecting","Empty"];export{e as Default,r as Empty,t as Selecting,b as __namedExportsOrder,f as default};
