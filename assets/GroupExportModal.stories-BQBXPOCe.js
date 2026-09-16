import{G as d}from"./GroupExportModal-C0l356Pz.js";import{m}from"./fixtures-CsAiPaTu.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./csvUtils-DgNWYp8m.js";const{expect:c,fn:i,userEvent:l,within:p}=__STORYBOOK_MODULE_TEST__,u=[{id:"00g1",name:"Engineering",description:"All engineering staff",type:"OKTA_GROUP",memberCount:128,hasRules:!0,ruleCount:2,created:new Date("2023-01-15"),lastUpdated:new Date("2026-06-01")},{id:"00g2",name:"Salesforce Users",description:"Mastered by the Salesforce app",type:"APP_GROUP",memberCount:42,hasRules:!1,ruleCount:0,sourceAppId:"app1",sourceAppName:"Salesforce",created:new Date("2022-11-03"),lastUpdated:new Date("2026-05-20")},{id:"00g3",name:"Everyone",type:"BUILT_IN",memberCount:1450,hasRules:!1,ruleCount:0,created:new Date("2020-01-01")}],g=Array.from({length:25},(r,e)=>({id:`00g${e+1}`,name:`Group ${e+1}`,type:"OKTA_GROUP",memberCount:(e+1)*10,hasRules:e%3===0,ruleCount:e%3===0?1:0})),w={title:"Groups/GroupExportModal",component:d,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"Modal for exporting a set of groups (and optionally their members) to CSV, from either an ad-hoc selection or a saved collection — the latter names the title and filename.\n\nExport is blocked when no Okta tab is connected (`targetTabId` null), and the modal renders nothing when closed."}}},argTypes:{isOpen:{description:"Whether the modal is visible."},onClose:{description:"Closes the modal."},groups:{description:"Groups included in the export."},targetTabId:{description:"Connected Okta tab id; export is blocked when null."},exportType:{description:"Whether the source is an ad-hoc selection or a saved collection (affects filename)."},collectionName:{description:"Collection name, used for the title/filename when `exportType` is `collection`."},onFetchMembers:{description:"Fetches a group's members for the optional member-list CSV."}},args:{isOpen:!0,onClose:i(),groups:u,targetTabId:1,exportType:"selection",onFetchMembers:i(async()=>m.slice(0,5))}},t={},a={args:{exportType:"collection",collectionName:"Q3 Access Review"}},o={args:{targetTabId:null},play:async({canvasElement:r})=>{const e=p(r);await l.click(e.getByRole("button",{name:/Export \(3\)/})),await e.findByText("No Okta tab connected")}},n={args:{groups:g},play:async({canvasElement:r})=>{const e=p(r);await c(e.queryByText(/may take a while/)).not.toBeInTheDocument(),await l.click(e.getByRole("checkbox",{name:/Include member list/})),await c(await e.findByText(/Exporting members for 25 groups/)).toBeInTheDocument()}},s={args:{isOpen:!1}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source},description:{story:"Default export of an ad-hoc group selection.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    exportType: 'collection',
    collectionName: 'Q3 Access Review'
  }
}`,...a.parameters?.docs?.source},description:{story:"Exporting a saved collection uses the collection name for the title/filename.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    targetTabId: null
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /Export \\(3\\)/
    }));
    await canvas.findByText('No Okta tab connected');
  }
}`,...o.parameters?.docs?.source},description:{story:"No Okta tab connected — attempting an export surfaces the inline error notice.",...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    groups: manyGroups
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/may take a while/)).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('checkbox', {
      name: /Include member list/
    }));
    await expect(await canvas.findByText(/Exporting members for 25 groups/)).toBeInTheDocument();
  }
}`,...n.parameters?.docs?.source},description:{story:'Enabling "Include member list" past 20 groups raises the "may take a while" warning.',...n.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    isOpen: false
  }
}`,...s.parameters?.docs?.source},description:{story:"Closed state — renders nothing.",...s.parameters?.docs?.description}}};const T=["Default","Collection","Disabled","LargeExport","Closed"];export{s as Closed,a as Collection,t as Default,o as Disabled,n as LargeExport,T as __namedExportsOrder,w as default};
