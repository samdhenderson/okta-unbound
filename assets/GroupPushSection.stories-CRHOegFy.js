import{j as c,Q as g}from"./iframe-tAvKsVeF.js";import{G as h}from"./GroupPushSection-DqaD8zzP.js";import"./preload-helper-PPVm8Dsz.js";const{expect:i,fn:n,within:u}=__STORYBOOK_MODULE_TEST__,l={rule:n(),group:n(),user:n(),app:n(),policy:n()},m={mappingId:"0pgFAKE1",sourceUserGroupId:"00gFAKEGROUP0001",appId:"0oaFAKEAPP000001",appName:"Salesforce",targetGroupName:"eng-team",priority:2},d={mappingId:"0pgFAKE2",sourceUserGroupId:"00gFAKEGROUP0001",appId:"0oaFAKEAPP000002",targetGroupName:"eng-team-mirror"},f={title:"Groups/GroupPushSection",component:h,tags:["autodocs"],parameters:{docs:{description:{component:'Apps this group\'s membership is pushed out to, and the target group each push writes into. No activation status: the apps-groups endpoint returns none, so a pill here would be an inference dressed as an Okta fact — `priority` is the real field and is labelled as one.\n\nUnknown is not zero: an empty array (pushed nowhere) and `undefined` (the enrichment never ran) are different sentences. A target is either named through an `EntityLink` or says "App name not loaded" beside its raw id.'}}},decorators:[a=>c.jsx(g,{handlers:l,children:c.jsx("div",{className:"max-w-[380px]",children:c.jsx(a,{})})})],argTypes:{mappings:{description:"The group's push mappings. `undefined` means the enrichment did not run for this group and is rendered as unknown, not as “none”."}},args:{mappings:[m]}},t={play:async({canvasElement:a})=>{const e=u(a);await i(e.getByRole("button",{name:"Open app Salesforce"})).toBeInTheDocument(),await i(e.getByRole("button",{name:`Copy application id ${m.appId}`})).toBeInTheDocument()}},o={args:{mappings:[d]},play:async({canvasElement:a})=>{const e=u(a);await i(e.getByText("App name not loaded")).toBeInTheDocument(),await i(e.getByRole("button",{name:`Copy application id ${d.appId}`})).toBeInTheDocument(),await i(e.getByRole("button",{name:`App name not loaded — open app ${d.appId}`})).toBeInTheDocument()}},s={args:{mappings:[m,d]}},p={args:{mappings:[]}},r={args:{mappings:void 0}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
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
}`,...t.parameters?.docs?.source},description:{story:"One named push target: the app opens from the chip, and the copy control names the id.",...t.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    mappings: [unnamedMapping]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('App name not loaded')).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: \`Copy application id \${unnamedMapping.appId}\`
    })).toBeInTheDocument();
    // The name is missing; the destination is not. The row is still never presented
    // *as* a name — "App name not loaded" above is what pins that.
    await expect(canvas.getByRole('button', {
      name: \`App name not loaded — open app \${unnamedMapping.appId}\`
    })).toBeInTheDocument();
  }
}`,...o.parameters?.docs?.source},description:{story:"A mapping with no `appName`: the gap is stated rather than papered over with the\nid, the id is copyable, and the app still opens — a valid id is a valid destination.",...o.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    mappings: [namedMapping, unnamedMapping]
  }
}`,...s.parameters?.docs?.source},description:{story:"Both states side by side — the difference has to be legible at a glance.",...s.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    mappings: []
  }
}`,...p.parameters?.docs?.source},description:{story:"A loaded fact: this group's membership is pushed nowhere.",...p.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    mappings: undefined
  }
}`,...r.parameters?.docs?.source},description:{story:"Not `Empty`: the enrichment never ran, so the section says so rather than reporting zero.",...r.parameters?.docs?.description}}};const A=["Default","UnnamedApp","NamedAndUnnamed","Empty","NotLoaded"];export{t as Default,p as Empty,s as NamedAndUnnamed,r as NotLoaded,o as UnnamedApp,A as __namedExportsOrder,f as default};
