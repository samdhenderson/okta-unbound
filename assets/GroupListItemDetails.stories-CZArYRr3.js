import{j as u,Q as h}from"./iframe-tAvKsVeF.js";import{G as y}from"./GroupListItemDetails-BhMiS0RE.js";import"./preload-helper-PPVm8Dsz.js";import"./MemberSourceMeter-BZ5AAva_.js";import"./memberSourceBuckets-CMd9i71b.js";import"./chartPalette-Byit8206.js";import"./dateFormat-tpkRVL7u.js";const{expect:d,fn:n,within:l}=__STORYBOOK_MODULE_TEST__,w={rule:n(),group:n(),user:n(),app:n(),policy:n()},g={mappingId:"0pgFAKE1",sourceUserGroupId:"00gFAKEGROUP0001",appId:"0oaFAKEAPP000001",appName:"Salesforce",targetGroupName:"eng-team",priority:2},m={mappingId:"0pgFAKE2",sourceUserGroupId:"00gFAKEGROUP0001",appId:"0oaFAKEAPP000002",targetGroupName:"eng-team-mirror"},c={id:"00gFAKEGROUP0001",name:"Engineering — All",description:"Everyone in the Engineering org, fed by the department rule.",type:"OKTA_GROUP",memberCount:412,hasRules:!0,ruleCount:1,created:new Date("2024-01-15T09:00:00Z"),lastUpdated:new Date("2026-06-01T14:30:00Z")},P={title:"Groups/GroupListItemDetails",component:y,tags:["autodocs"],parameters:{docs:{description:{component:`The preview a group row reveals when its chevron is expanded — the untruncated description, the copyable group id, Okta's own timestamps, the push mappings, and the member-source legend *if* one is already cached.

Deliberately a preview and not a second detail view: nothing here fetches, and every field shown is already on the loaded \`GroupSummary\`. Anything that costs a request lives in the full Group Detail view, which the row body opens.

A push target is named, or its name is stated as missing: a named mapping renders as an \`EntityLink\`, an un-named one says "App name not loaded" beside its raw id. The id is never printed in the name's own slot.`}}},decorators:[a=>u.jsx(h,{handlers:w,children:u.jsx("div",{className:"max-w-[380px]",children:u.jsx(a,{})})})],argTypes:{group:{description:"The group whose record is being previewed."},breakdown:{description:"An already-computed member-source split, or `null` when none is cached."}},args:{group:c,breakdown:null}},t={},r={args:{group:{...c,pushMappings:[g]}},play:async({canvasElement:a})=>{const e=l(a);await d(e.getByRole("button",{name:"Open app Salesforce"})).toBeInTheDocument(),await d(e.getByRole("button",{name:`Copy application id ${g.appId}`})).toBeInTheDocument()}},o={args:{group:{...c,pushMappings:[m]}},play:async({canvasElement:a})=>{const e=l(a);await d(e.getByText("App name not loaded")).toBeInTheDocument(),await d(e.getByRole("button",{name:`Copy application id ${m.appId}`})).toBeInTheDocument(),await d(e.getByRole("button",{name:`App name not loaded — open app ${m.appId}`})).toBeInTheDocument()}},s={args:{group:{...c,pushMappings:[g,m]}}},p={args:{group:{...c,type:"APP_GROUP",sourceAppId:"0oaFAKEAPP000001",sourceAppName:"Salesforce",description:void 0}}},i={args:{breakdown:{total:412,direct:12,ruleBased:400,unattributed:0,byRule:[{ruleId:"00rFAKERULE00001",ruleName:"Engineering by department",count:400}]}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source},description:{story:"Description, id and timestamps, with no push mappings on the record.",...t.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    group: {
      ...baseGroup,
      pushMappings: [namedMapping]
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Open app Salesforce'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: \`Copy application id \${namedMapping.appId}\`
    })).toBeInTheDocument();
  }
}`,...r.parameters?.docs?.source},description:{story:"A push mapping whose app came back named: it opens from the chip, and the copy control names the id.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    group: {
      ...baseGroup,
      pushMappings: [unnamedMapping]
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('App name not loaded')).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: \`Copy application id \${unnamedMapping.appId}\`
    })).toBeInTheDocument();
    // A valid id is a valid destination even with no name attached, and the
    // control says so rather than presenting the id as the app's name.
    await expect(canvas.getByRole('button', {
      name: \`App name not loaded — open app \${unnamedMapping.appId}\`
    })).toBeInTheDocument();
  }
}`,...o.parameters?.docs?.source},description:{story:"The same mapping with no `appName`: the gap is stated, the id stays copyable, and the app still opens.",...o.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    group: {
      ...baseGroup,
      pushMappings: [namedMapping, unnamedMapping]
    }
  }
}`,...s.parameters?.docs?.source},description:{story:"Both states side by side — the difference has to be legible at a glance.",...s.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    group: {
      ...baseGroup,
      type: 'APP_GROUP',
      sourceAppId: '0oaFAKEAPP000001',
      sourceAppName: 'Salesforce',
      description: undefined
    }
  }
}`,...p.parameters?.docs?.source},description:{story:"An app-sourced group, which names the application it mirrors.",...p.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    breakdown: {
      total: 412,
      direct: 12,
      ruleBased: 400,
      unattributed: 0,
      byRule: [{
        ruleId: '00rFAKERULE00001',
        ruleName: 'Engineering by department',
        count: 400
      }]
    }
  }
}`,...i.parameters?.docs?.source},description:{story:"A cached member-source split, rendered as the legend; the row shows a meter only when the answer is already banked.",...i.parameters?.docs?.description}}};const G=["Default","NamedPushTarget","UnnamedPushTarget","NamedAndUnnamedPushTargets","AppSourcedGroup","WithMemberSourceBreakdown"];export{p as AppSourcedGroup,t as Default,s as NamedAndUnnamedPushTargets,r as NamedPushTarget,o as UnnamedPushTarget,i as WithMemberSourceBreakdown,G as __namedExportsOrder,P as default};
