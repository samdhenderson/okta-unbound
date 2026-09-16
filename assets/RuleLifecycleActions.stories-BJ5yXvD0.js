import{r as h,j as w}from"./iframe-tAvKsVeF.js";import{R as y}from"./RuleLifecycleActions-g2yb4uXB.js";import"./preload-helper-PPVm8Dsz.js";const{expect:n,fn:r,userEvent:p,within:a}=__STORYBOOK_MODULE_TEST__,v=(t={})=>({id:"00rFAKE0000000000001",name:"Engineering – Auto-assign by department",status:"ACTIVE",condition:'user.department == "Engineering"',conditionExpression:'user.department == "Engineering"',groupIds:["00g1a2b3c4d5e6f7g8h9","00g9z8y7x6w5v4u3t2s1"],groupNames:["Engineering – All","Slack – Eng Channel"],userAttributes:["department"],created:"2024-01-15T09:00:00.000Z",lastUpdated:"2026-06-01T14:30:00.000Z",...t}),B={title:"Rules/RuleLifecycleActions",component:y,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"What sits behind **More** on the rule rung. Shown here on its own; in the app it is the `expansion` slot of `RuleActionBar`.\n\nBoth lifecycle verbs live here because neither undoes the other: Okta's rule engine only ever adds, so deactivating leaves every membership the rule wrote exactly where it is. Only one of the two is ever offered — the other is not something you can do to a rule in this state, so it is absent rather than disabled."}}},args:{rule:v(),isLifecycleLoading:!1,isConfirmingActivate:!1,onRequestActivate:r(),onCancelActivate:r(),onConfirmActivate:r(),onRequestDeactivate:r(),onAddTargetGroup:r()},argTypes:{rule:{description:"The rule these verbs act on."},isLifecycleLoading:{description:"True while a confirmed write is in flight — disables every trigger."},isConfirmingActivate:{description:"Whether the activation confirm is armed."},onAddTargetGroup:{description:"Starts the consolidation wizard. Omitted when not wired."}}},s={play:async({canvasElement:t})=>{const e=a(t);await n(e.getByRole("button",{name:/Deactivate rule/})).toBeInTheDocument(),await n(e.queryByRole("button",{name:/Activate rule/})).not.toBeInTheDocument(),await n(e.getByText(/Everyone it already added stays/)).toBeInTheDocument()}},i={args:{rule:v({status:"INACTIVE"})},play:async({canvasElement:t})=>{const e=a(t);await n(e.getByRole("button",{name:/Activate rule/})).toBeInTheDocument(),await n(e.getByText(/removes nobody/)).toBeInTheDocument()}},c={args:{rule:v({status:"INACTIVE"}),isConfirmingActivate:!0},play:async({canvasElement:t})=>{const e=a(t.ownerDocument.body).getByRole("dialog");await n(e).toHaveTextContent(/only ever adds members/)}},l={args:{isLifecycleLoading:!0},play:async({canvasElement:t})=>{const e=a(t);await n(e.getByRole("button",{name:/Deactivate rule/})).toBeDisabled(),await n(e.getByRole("button",{name:"Add target group"})).toBeDisabled()}},d={args:{onAddTargetGroup:void 0},play:async({canvasElement:t})=>{const e=a(t);await n(e.queryByRole("button",{name:"Add target group"})).not.toBeInTheDocument(),await n(e.queryByText(/Creates a replacement rule/)).not.toBeInTheDocument()}},u={name:"The confirm actually gates the write",args:{rule:v({status:"INACTIVE"})},render:t=>{const[e,o]=h.useState(!1);return w.jsx(y,{...t,isConfirmingActivate:e,onRequestActivate:()=>o(!0),onCancelActivate:()=>o(!1),onConfirmActivate:()=>{o(!1),t.onConfirmActivate()}})},play:async({args:t,canvasElement:e})=>{const o=a(e),g=a(e.ownerDocument.body);await p.click(o.getByRole("button",{name:/Activate rule/})),await p.click(g.getByRole("button",{name:"Cancel"})),await n(t.onConfirmActivate).not.toHaveBeenCalled(),await p.click(o.getByRole("button",{name:/Activate rule/})),await p.click(g.getByRole("button",{name:"Activate"})),await n(t.onConfirmActivate).toHaveBeenCalled()}},m={parameters:{viewport:{value:"sidepanelCompact"}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: /Deactivate rule/
    })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: /Activate rule/
    })).not.toBeInTheDocument();
    await expect(canvas.getByText(/Everyone it already added stays/)).toBeInTheDocument();
  }
}`,...s.parameters?.docs?.source},description:{story:"An ACTIVE rule: the lifecycle row offers the destructive verb, and says what it leaves behind.",...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    rule: rule({
      status: 'INACTIVE'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: /Activate rule/
    })).toBeInTheDocument();
    await expect(canvas.getByText(/removes nobody/)).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"An INACTIVE rule: the consequence sentence names the groups this rule would start filling.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    rule: rule({
      status: 'INACTIVE'
    }),
    isConfirmingActivate: true
  },
  play: async ({
    canvasElement
  }) => {
    const dialog = within(canvasElement.ownerDocument.body).getByRole('dialog');
    await expect(dialog).toHaveTextContent(/only ever adds members/);
  }
}`,...c.parameters?.docs?.source},description:{story:"The activation confirm states the fact that makes the press irreversible, in the band's own words.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    isLifecycleLoading: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: /Deactivate rule/
    })).toBeDisabled();
    await expect(canvas.getByRole('button', {
      name: 'Add target group'
    })).toBeDisabled();
  }
}`,...l.parameters?.docs?.source},description:{story:"A confirmed write is in flight — every trigger is disabled until it settles.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    onAddTargetGroup: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: 'Add target group'
    })).not.toBeInTheDocument();
    await expect(canvas.queryByText(/Creates a replacement rule/)).not.toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"Consolidation is not wired, so its row and divider are absent rather than disabled.",...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: 'The confirm actually gates the write',
  args: {
    rule: rule({
      status: 'INACTIVE'
    })
  },
  render: args => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- a story render fn is a component
    const [armed, setArmed] = useState(false);
    return <RuleLifecycleActions {...args} isConfirmingActivate={armed} onRequestActivate={() => setArmed(true)} onCancelActivate={() => setArmed(false)} onConfirmActivate={() => {
      setArmed(false);
      args.onConfirmActivate();
    }} />;
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', {
      name: /Activate rule/
    }));
    await userEvent.click(body.getByRole('button', {
      name: 'Cancel'
    }));
    await expect(args.onConfirmActivate).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', {
      name: /Activate rule/
    }));
    await userEvent.click(body.getByRole('button', {
      name: 'Activate'
    }));
    await expect(args.onConfirmActivate).toHaveBeenCalled();
  }
}`,...u.parameters?.docs?.source},description:{story:"Arming and dismissing the confirm, with the write firing only on the second press.",...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...m.parameters?.docs?.source},description:{story:"The 360px panel floor: each consequence sentence wraps above its button rather than crowding it.",...m.parameters?.docs?.description}}};const T=["Active","Inactive","ConfirmingActivate","LifecycleRunning","WithoutConsolidation","ConfirmGatesTheWrite","Narrow"];export{s as Active,u as ConfirmGatesTheWrite,c as ConfirmingActivate,i as Inactive,l as LifecycleRunning,m as Narrow,d as WithoutConsolidation,T as __namedExportsOrder,B as default};
