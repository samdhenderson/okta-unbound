import{E as d}from"./ExportContextBar-Kptm7WPs.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:c,fn:g,userEvent:i,within:h}=__STORYBOOK_MODULE_TEST__,u=async e=>[{id:"00gFAKE001",label:"Engineering",sublabel:"OKTA_GROUP"},{id:"00gFAKE002",label:"Engineering Managers",sublabel:"OKTA_GROUP"},{id:"00gFAKE003",label:"Sales",sublabel:"APP_GROUP"}].filter(o=>o.label.toLowerCase().includes(e.toLowerCase())),y={title:"Export/ExportContextBar",component:d,tags:["autodocs"],parameters:{layout:"centered",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:"For descriptors scoped to a parent entity (a group, an app), the admin picks that entity here before any rows are fetched. The type-ahead is debounced and needs two characters; the chosen option goes to the tab hook, and clearing reports `null`."}}},argTypes:{label:{description:"Field label for the picker (e.g. `Group`)."},placeholder:{description:"Placeholder for the search input."},search:{description:"Type-ahead search over candidate context entities."},onSelect:{description:"Called with the chosen entity, or `null` when the selection is cleared."}},args:{label:"Group",placeholder:"Search groups…",search:u,onSelect:g()}},a={},t={play:async({canvasElement:e,args:s})=>{const o=h(e),l=o.getByPlaceholderText("Search groups…");await i.type(l,"Eng");const p=await o.findByText("Engineering Managers");await i.click(p),await c(s.onSelect).toHaveBeenCalledWith(c.objectContaining({id:"00gFAKE002",label:"Engineering Managers"}))}},n={args:{initialSelected:{id:"00gFAKE001",label:"Engineering",sublabel:"OKTA_GROUP"}}},r={args:{label:"App",placeholder:"Search apps…",search:async e=>[{id:"0oaFAKE001",label:"Salesforce",sublabel:"SAML 2.0"},{id:"0oaFAKE002",label:"Slack",sublabel:"OIDC"}].filter(s=>s.label.toLowerCase().includes(e.toLowerCase()))}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:"{}",...a.parameters?.docs?.source},description:{story:"Empty picker — type at least two characters to search.",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('Search groups…');
    await userEvent.type(input, 'Eng');
    const match = await canvas.findByText('Engineering Managers');
    await userEvent.click(match);
    await expect(args.onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: '00gFAKE002',
      label: 'Engineering Managers'
    }));
  }
}`,...t.parameters?.docs?.source},description:{story:"Typing runs the debounced type-ahead, opens the dropdown, and reports the pick.",...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    initialSelected: {
      id: '00gFAKE001',
      label: 'Engineering',
      sublabel: 'OKTA_GROUP'
    }
  }
}`,...n.parameters?.docs?.source},description:{story:"Pre-seeded selection — how the picker opens when deep-linked already scoped.",...n.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'App',
    placeholder: 'Search apps…',
    search: async (query: string): Promise<EntityContextOption[]> => [{
      id: '0oaFAKE001',
      label: 'Salesforce',
      sublabel: 'SAML 2.0'
    }, {
      id: '0oaFAKE002',
      label: 'Slack',
      sublabel: 'OIDC'
    }].filter(option => option.label.toLowerCase().includes(query.toLowerCase()))
  }
}`,...r.parameters?.docs?.source},description:{story:"The same picker scoped to apps instead of groups.",...r.parameters?.docs?.description}}};const S=["Default","WithResults","PreSelected","AppContext"];export{r as AppContext,a as Default,n as PreSelected,t as WithResults,S as __namedExportsOrder,y as default};
