import{J as m}from"./JumpResultRow-C0dNkF2a.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./jumpDestinations-CKYQltfE.js";import"./tabs-3T7DVjf-.js";const{expect:d,fn:u,userEvent:g,within:p}=__STORYBOOK_MODULE_TEST__,A={title:"Home/JumpResultRow",component:m,tags:["autodocs"],parameters:{docs:{description:{component:"One row in the Home tab’s jump-bar results. The list mixes kinds, so every row names its destination on the right edge and pressing one is never a surprise.\n\nA kind this build cannot navigate to is never a disabled row: it falls back to an `OpenInOktaLink`, a real route to the same entity. A rule has no admin-console route of its own, so an unreachable rule row shows no link rather than a fabricated one."}}},argTypes:{result:{description:"The resolved entity to render."},onSelect:{description:'Open the entity on its owning tab. Omit to render the unreachable "Open in Okta" form.'},oktaOrigin:{description:"Org origin for the Okta deep link. Fake in these stories."}},args:{onSelect:u(),oktaOrigin:"https://example.okta.com",result:{kind:"group",id:"00gFAKE0000000000001",name:"Engineering"}}},a={play:async({args:n,canvasElement:e})=>{const l=p(e);await g.click(l.getByRole("button",{name:"Engineering — open in Groups"})),await d(n.onSelect).toHaveBeenCalledTimes(1)}},t={args:{result:{kind:"user",id:"00uFAKE0000000000001",name:"Ada Lovelace",secondary:"ada@example.com"}}},r={args:{result:{kind:"rule",id:"0prFAKE0000000000001",name:"Eng — All ICs",secondary:"Paused"}}},o={args:{onSelect:void 0,result:{kind:"app",id:"0oaFAKE0000000000001",name:"Datadog",appName:"datadog_app"}},play:async({canvasElement:n})=>{const e=p(n);await d(e.queryByRole("button")).not.toBeInTheDocument(),await d(e.getByRole("link")).toHaveAttribute("rel","noopener noreferrer")}},s={args:{onSelect:void 0,result:{kind:"rule",id:"0prFAKE0000000000001",name:"Eng — All ICs",secondary:"Active"}}},i={args:{result:{kind:"group",id:"00gFAKE0000000000002",name:"Engineering — Platform — Identity and Access Management — On-call rotation",secondary:"Every engineer carrying the identity pager, across all regions and time zones"}}},c={args:{onSelect:void 0,result:{kind:"app",id:"0oaFAKE0000000000001",name:"Datadog"}},play:async({canvasElement:n})=>{const e=p(n);await d(e.getByText("Datadog")).toBeInTheDocument(),await d(e.queryByRole("link")).not.toBeInTheDocument()}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Engineering — open in Groups'
    }));
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
  }
}`,...a.parameters?.docs?.source},description:{story:"A reachable group: the right edge names the tab it opens, and pressing it opens there.",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    result: {
      kind: 'user',
      id: '00uFAKE0000000000001',
      name: 'Ada Lovelace',
      secondary: 'ada@example.com'
    }
  }
}`,...t.parameters?.docs?.source},description:{story:"A user, with the email carried on the secondary line.",...t.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    result: {
      kind: 'rule',
      id: '0prFAKE0000000000001',
      name: 'Eng — All ICs',
      secondary: 'Paused'
    }
  }
}`,...r.parameters?.docs?.source},description:{story:`A rule resolved from the local snapshot, which carries its status for free —
the fact an admin looking up a rule most often wants.`,...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    onSelect: undefined,
    result: {
      kind: 'app',
      id: '0oaFAKE0000000000001',
      name: 'Datadog',
      appName: 'datadog_app'
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(canvas.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
  }
}`,...o.parameters?.docs?.source},description:{story:`An app, which this build cannot open in-panel. The row degrades to a real Okta
link rather than to a dead or disabled control.`,...o.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    onSelect: undefined,
    result: {
      kind: 'rule',
      id: '0prFAKE0000000000001',
      name: 'Eng — All ICs',
      secondary: 'Active'
    }
  }
}`,...s.parameters?.docs?.source},description:{story:`An unreachable rule. The admin console has no single-rule route, so the row
shows no link at all rather than inventing one.`,...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    result: {
      kind: 'group',
      id: '00gFAKE0000000000002',
      name: 'Engineering — Platform — Identity and Access Management — On-call rotation',
      secondary: 'Every engineer carrying the identity pager, across all regions and time zones'
    }
  }
}`,...i.parameters?.docs?.source},description:{story:"Long names truncate rather than wrapping the row or pushing the mark off.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    onSelect: undefined,
    result: {
      kind: 'app',
      id: '0oaFAKE0000000000001',
      name: 'Datadog'
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Datadog')).toBeInTheDocument();
    await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:`The same app with no type key reported. The Admin Console route needs one, so the
link is withheld rather than built wrong — the row states the app and stops.`,...c.parameters?.docs?.description}}};const E=["Group","User","PausedRule","UnreachableApp","UnreachableRule","LongName","UnreachableAppWithoutTypeKey"];export{a as Group,i as LongName,r as PausedRule,o as UnreachableApp,c as UnreachableAppWithoutTypeKey,s as UnreachableRule,t as User,E as __namedExportsOrder,A as default};
