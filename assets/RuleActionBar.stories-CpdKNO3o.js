import{r as y,j as b}from"./iframe-tAvKsVeF.js";import{R as w}from"./RuleActionBar-DQ_mx6ls.js";import"./preload-helper-PPVm8Dsz.js";import"./RuleLifecycleActions-g2yb4uXB.js";const{expect:a,fn:r,userEvent:h,within:g}=__STORYBOOK_MODULE_TEST__,v=(t={})=>({id:"00rFAKE0000000000001",name:"Engineering – Auto-assign by department",status:"ACTIVE",condition:'user.department == "Engineering"',conditionExpression:'user.department == "Engineering"',groupIds:["00g1a2b3c4d5e6f7g8h9","00g9z8y7x6w5v4u3t2s1"],groupNames:["Engineering – All","Slack – Eng Channel"],userAttributes:["department"],created:"2024-01-15T09:00:00.000Z",lastUpdated:"2026-06-01T14:30:00.000Z",...t}),B={title:"Rules/RuleActionBar",component:w,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"Every verb whose object is the whole rule. The row holds only what is read-only — *Preview impact*, which works out who would stop being attributed and writes nothing, and which is therefore also the `primary`.\n\nActivate and deactivate look like a reversible pair and are not: Okta’s rule engine only ever adds, so activating writes memberships deactivating will not take back, and deactivating strands memberships reactivating will not re-attribute. Both start behind **More**, with the consequence stated beside the control, as does *Add target group* — a wizard in front of a verb does not move it into the row. There is no Delete and no Edit condition because neither has a live handler."}}},args:{rule:v(),onPreviewImpact:r(),tierOpen:!1,onTierOpenChange:r(),isLifecycleLoading:!1,isConfirmingActivate:!1,onRequestActivate:r(),onCancelActivate:r(),onConfirmActivate:r(),onRequestDeactivate:r(),onAddTargetGroup:r(),sticky:!1},argTypes:{rule:{description:"The rule every verb in the strip acts on."},onPreviewImpact:{description:"Opens the read-only impact preview."},tierOpen:{description:"Whether the disclosure tier is showing. Owned by the tab."},onTierOpenChange:{description:"Called with the tier’s next open state."},isLifecycleLoading:{description:"True while a confirmed lifecycle write is in flight."},isConfirmingActivate:{description:"Whether the activation confirm is armed."},onAddTargetGroup:{description:"Starts the consolidation wizard."},sticky:{description:"Pin the strip below the header."}}},o={},i={args:{tierOpen:!0}},s={args:{tierOpen:!0,rule:v({status:"INACTIVE"})}},c={args:{tierOpen:!0,rule:v({status:"INACTIVE"}),isConfirmingActivate:!0},play:async({canvasElement:t,args:e})=>{const n=g(t.ownerDocument.body);await a(n.getByRole("dialog")).toBeVisible(),await h.click(n.getByRole("button",{name:"Activate"})),await a(e.onConfirmActivate).toHaveBeenCalledTimes(1)}},p={args:{tierOpen:!0,isLifecycleLoading:!0}},d={args:{tierOpen:!0,onAddTargetGroup:void 0},play:async({canvasElement:t})=>{const e=g(t);await a(e.queryByRole("button",{name:"Add target group"})).not.toBeInTheDocument(),await a(e.getByRole("button",{name:/Deactivate rule/})).toBeInTheDocument()}},u={args:{rule:v({groupIds:[],groupNames:[]}),onPreviewImpact:void 0},play:async({canvasElement:t})=>{const e=g(t);await a(e.queryByRole("button",{name:"Preview impact"})).not.toBeInTheDocument(),await a(e.getByRole("button",{name:"More"})).toBeInTheDocument()}},l={render:t=>{const[e,n]=y.useState(!1);return b.jsx(w,{...t,tierOpen:e,onTierOpenChange:n})},play:async({canvasElement:t})=>{const e=g(t),n=e.getByRole("button",{name:"More"});await a(n).toHaveAttribute("aria-expanded","false"),await h.click(n),await a(n).toHaveAttribute("aria-expanded","true"),await a(e.getByRole("button",{name:/Deactivate rule/})).toBeVisible(),await h.click(n),await a(n).toHaveAttribute("aria-expanded","false")}},m={args:{tierOpen:!0},parameters:{viewport:{value:"sidepanelCompact"}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:"{}",...o.parameters?.docs?.source},description:{story:"The row only: one read-only verb, with everything that writes behind **More**.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    tierOpen: true
  }
}`,...i.parameters?.docs?.source},description:{story:"An ACTIVE rule with the tier open — the lifecycle verb is the destructive one.",...i.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    tierOpen: true,
    rule: rule({
      status: 'INACTIVE'
    })
  }
}`,...s.parameters?.docs?.source},description:{story:"An INACTIVE rule: the same row offers activation, and says what activating costs.",...s.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    tierOpen: true,
    rule: rule({
      status: 'INACTIVE'
    }),
    isConfirmingActivate: true
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole('dialog')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Activate'
    }));
    await expect(args.onConfirmActivate).toHaveBeenCalledTimes(1);
  }
}`,...c.parameters?.docs?.source},description:{story:"The activation confirm is armed, so its modal is open and states the consequence.",...c.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    tierOpen: true,
    isLifecycleLoading: true
  }
}`,...p.parameters?.docs?.source},description:{story:"A lifecycle write is in flight — every verb in the tier is disabled.",...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    tierOpen: true,
    onAddTargetGroup: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: 'Add target group'
    })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: /Deactivate rule/
    })).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"Consolidation is not wired, so the tier offers no *Add target group* row at all.",...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    rule: rule({
      groupIds: [],
      groupNames: []
    }),
    onPreviewImpact: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: 'Preview impact'
    })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'More'
    })).toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:"A rule assigning to no groups: *Preview impact* is omitted rather than disabled.",...u.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: args => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- a story render fn is a component
    const [open, setOpen] = useState(false);
    return <RuleActionBar {...args} tierOpen={open} onTierOpenChange={setOpen} />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const more = canvas.getByRole('button', {
      name: 'More'
    });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByRole('button', {
      name: /Deactivate rule/
    })).toBeVisible();
    await userEvent.click(more);
    await expect(more).toHaveAttribute('aria-expanded', 'false');
  }
}`,...l.parameters?.docs?.source},description:{story:"**More** is a real disclosure: `aria-expanded` flips and the tier it controls appears.",...l.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    tierOpen: true
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...m.parameters?.docs?.source},description:{story:"The 360px floor with the tier open: consequence sentences wrap beside their buttons.",...m.parameters?.docs?.description}}};const E=["Default","TierOpenActive","TierOpenInactive","ConfirmingActivate","TierOpenLifecycleRunning","WithoutConsolidation","NoTargetGroups","MoreIsADisclosure","NarrowTierOpen"];export{c as ConfirmingActivate,o as Default,l as MoreIsADisclosure,m as NarrowTierOpen,u as NoTargetGroups,i as TierOpenActive,s as TierOpenInactive,p as TierOpenLifecycleRunning,d as WithoutConsolidation,E as __namedExportsOrder,B as default};
