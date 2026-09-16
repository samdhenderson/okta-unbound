import{G as c}from"./GroupAccessSection-Bf58aySx.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./GroupAppRow-BL6kdfYQ.js";import"./dateFormat-tpkRVL7u.js";import"./appFilters-B4zycet6.js";import"./okta-DiqjVWpx.js";import"./types-D54cNL3h.js";const{expect:l}=__STORYBOOK_MODULE_TEST__,p=[{id:"0oaFAKEAPP1",label:"Salesforce",status:"ACTIVE",signOnMode:"SAML_2_0",lastUpdated:new Date("2025-11-14T09:30:00Z")},{id:"0oaFAKEAPP2",label:"Slack",status:"INACTIVE",signOnMode:"BOOKMARK"}],u=[{mappingId:"0pgFAKE1",sourceUserGroupId:"00gFAKEgroup00001",appId:"0oaFAKEAPP1",appName:"Salesforce",targetGroupName:"eng-team",priority:2}],d=[{id:"raFAKEROLE1",label:"Application Administrator"},{id:"raFAKEROLE2",label:"Help Desk Administrator"}],E={title:"Groups/GroupAccessSection",component:c,tags:["autodocs"],parameters:{docs:{description:{component:"What membership in this group buys: the apps it is assigned to, plus any admin roles it grants every member. Each role carries a \"scope not shown\" caveat badge, because the roles endpoint reports the role type without the resources it is scoped to.\n\nA failed roles read (`rolesStatus: 'unavailable'`, commonly a 403) hides the subsection; a confirmed empty list (`'available'` with `roles: []`) states that no admin role is granted. Those two are never collapsed into one rendering."}}},argTypes:{apps:{description:"Apps this group is assigned to."},pushMappings:{description:"Joined onto the app rows; `undefined` means the enrichment never ran, `[]` that the group is pushed nowhere."},appsStatus:{description:"Status of the app-assignment read ('loading'/'done'/'error')."},appsError:{description:"Error message when the app-assignment read failed."},roles:{description:"Admin roles granted to every member of this group."},rolesStatus:{description:"'loading' while in flight, 'available' once the read succeeds, 'unavailable' when it failed."}},args:{apps:[],appsStatus:"loading",appsError:null,roles:[],rolesStatus:"loading"}},e={},s={args:{appsStatus:"done",apps:[],rolesStatus:"available",roles:[]}},a={args:{appsStatus:"error",appsError:"App assignments could not be loaded.",rolesStatus:"available",roles:[]}},r={args:{appsStatus:"done",apps:p,rolesStatus:"available",roles:d}},t={args:{appsStatus:"done",apps:p,rolesStatus:"unavailable",roles:[]}},o={args:{appsStatus:"done",apps:p,rolesStatus:"available",roles:d,pushMappings:u},play:async({canvas:i})=>{await l(i.getByText("Pushed")).toBeVisible()}},n={args:{appsStatus:"done",apps:p,rolesStatus:"available",roles:d,pushMappings:void 0},play:async({canvas:i})=>{await l(i.queryByText("Pushed")).toBeNull()}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:"Both the app-assignment and admin-roles reads are still in flight.",...e.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    appsStatus: 'done',
    apps: [],
    rolesStatus: 'available',
    roles: []
  }
}`,...s.parameters?.docs?.source},description:{story:'Confirmed: no app assignment and no admin role — a real "grants nothing" answer.',...s.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    appsStatus: 'error',
    appsError: 'App assignments could not be loaded.',
    rolesStatus: 'available',
    roles: []
  }
}`,...a.parameters?.docs?.source},description:{story:"The app-assignment read failed.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    appsStatus: 'done',
    apps,
    rolesStatus: 'available',
    roles
  }
}`,...r.parameters?.docs?.source},description:{story:"Assigned to two apps and carries two admin roles, each with its scope caveat.",...r.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    appsStatus: 'done',
    apps,
    rolesStatus: 'unavailable',
    roles: []
  }
}`,...t.parameters?.docs?.source},description:{story:"The roles read 403'd for this session, so the subsection is hidden rather than shown empty.",...t.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    appsStatus: 'done',
    apps,
    rolesStatus: 'available',
    roles,
    pushMappings
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByText('Pushed')).toBeVisible();
  }
}`,...o.parameters?.docs?.source},description:{story:"One of the assigned apps is a push target, so its row carries a `Pushed` badge.",...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    appsStatus: 'done',
    apps,
    rolesStatus: 'available',
    roles,
    pushMappings: undefined
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.queryByText('Pushed')).toBeNull();
  }
}`,...n.parameters?.docs?.source},description:{story:"The push enrichment never ran, so no row claims anything about push.",...n.parameters?.docs?.description}}};const w=["Loading","Empty","ErrorState","AppsAndRoles","RolesUnavailable","WithPushMappings","PushNeverLoaded"];export{r as AppsAndRoles,s as Empty,a as ErrorState,e as Loading,n as PushNeverLoaded,t as RolesUnavailable,o as WithPushMappings,w as __namedExportsOrder,E as default};
