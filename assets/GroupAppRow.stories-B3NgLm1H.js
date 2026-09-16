import{j as l,r as x}from"./iframe-tAvKsVeF.js";import{G as h}from"./GroupAppRow-BL6kdfYQ.js";import"./preload-helper-PPVm8Dsz.js";import"./dateFormat-tpkRVL7u.js";const{expect:t,fn:B,userEvent:g}=__STORYBOOK_MODULE_TEST__,u={id:"0oaFAKE1",label:"Slack",status:"ACTIVE",statusVariant:"success",signOnMode:"SAML_2_0",lastUpdated:new Date("2025-11-14T09:30:00Z"),push:{state:"not-pushed"}},k={title:"Groups/GroupAppRow",component:h,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:'One assigned app: what it is, whether it is live, and — behind the disclosure — how it is wired. Every field comes from the group’s own apps response, so the row costs no extra request.\n\nAbsent is absent: a row that reported no status gets no badge rather than one reading "Unknown". Push is three-state, and `unknown` says nothing at all — `GroupPushSection` remains the complete account, because a group can be pushed to an app it is not assigned to.'}}},argTypes:{row:{description:"The row's whole rendered model, derived by `groupAppSource`."},expanded:{description:"Whether this row's disclosure is open. Owned by the list."},onToggle:{description:"Called with the app's id when the disclosure control is pressed."}},args:{row:u,expanded:!1,onToggle:B(),oktaOrigin:"https://example.okta.com"},decorators:[e=>l.jsx("ul",{className:"max-w-md space-y-1.5",children:l.jsx(e,{})})]},n={},s={args:{expanded:!0}},o={args:{row:{...u,status:"INACTIVE",statusVariant:"neutral"}}},r={args:{expanded:!0,row:{id:"0oaFAKE2",label:"Wiki",statusVariant:"neutral",push:{state:"not-pushed"}}},play:async({canvas:e})=>{await t(e.queryByText(/unknown/i)).toBeNull(),await t(e.queryByText("Sign-on mode")).toBeNull(),await t(e.queryByText("Last updated")).toBeNull()}},i={args:{expanded:!0,row:{...u,push:{state:"pushed",targetGroupName:"eng-team",priority:2}}},play:async({canvas:e})=>{await t(e.getByText("Pushed")).toBeVisible(),await t(e.getByText(/Writes into eng-team\./)).toBeVisible(),await t(e.getByText(/Priority 2\./)).toBeVisible()}},p={args:{expanded:!0,row:{...u,push:{state:"unknown"}}},play:async({canvas:e})=>{await t(e.queryByText("Pushed")).toBeNull(),await t(e.queryByText(/not pushed to this app/)).toBeNull()}},d={render:function(a){const[c,m]=x.useState(!1);return l.jsx(h,{...a,expanded:c,onToggle:w=>{a.onToggle(w),m(y=>!y)}})},play:async({args:e,canvas:a})=>{const c=a.getByRole("button",{name:"Show details for Slack"});await t(c).toHaveAttribute("aria-expanded","false"),await g.click(c),await t(e.onToggle).toHaveBeenCalledWith("0oaFAKE1"),await t(a.getByRole("button",{expanded:!0})).toBeVisible(),await g.click(a.getByRole("button",{expanded:!0})),await t(a.getByRole("button",{name:"Show details for Slack"})).toHaveAttribute("aria-expanded","false")}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"Collapsed: label, sign-on mode and status.",...n.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    expanded: true
  }
}`,...s.parameters?.docs?.source},description:{story:"Open: the app id, how it signs on, when it changed, and the way out to Okta.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    row: {
      ...row,
      status: 'INACTIVE',
      statusVariant: 'neutral'
    }
  }
}`,...o.parameters?.docs?.source},description:{story:"A deactivated app still lists — its status is the point.",...o.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    expanded: true,
    row: {
      id: '0oaFAKE2',
      label: 'Wiki',
      statusVariant: 'neutral',
      push: {
        state: 'not-pushed'
      }
    }
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.queryByText(/unknown/i)).toBeNull();
    await expect(canvas.queryByText('Sign-on mode')).toBeNull();
    await expect(canvas.queryByText('Last updated')).toBeNull();
  }
}`,...r.parameters?.docs?.source},description:{story:'A row that reported no status, sign-on mode or timestamp: absent, never "Unknown".',...r.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    expanded: true,
    row: {
      ...row,
      push: {
        state: 'pushed',
        targetGroupName: 'eng-team',
        priority: 2
      }
    }
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByText('Pushed')).toBeVisible();
    await expect(canvas.getByText(/Writes into eng-team\\./)).toBeVisible();
    await expect(canvas.getByText(/Priority 2\\./)).toBeVisible();
  }
}`,...i.parameters?.docs?.source},description:{story:"This group's membership is pushed into a group inside the app.",...i.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    expanded: true,
    row: {
      ...row,
      push: {
        state: 'unknown'
      }
    }
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.queryByText('Pushed')).toBeNull();
    await expect(canvas.queryByText(/not pushed to this app/)).toBeNull();
  }
}`,...p.parameters?.docs?.source},description:{story:"The push enrichment never ran: the row says nothing about push rather than implying none.",...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: function Disclosure(args) {
    const [expanded, setExpanded] = useState(false);
    return <GroupAppRow {...args} expanded={expanded} onToggle={id => {
      args.onToggle(id);
      setExpanded(open => !open);
    }} />;
  },
  play: async ({
    args,
    canvas
  }) => {
    const toggle = canvas.getByRole('button', {
      name: 'Show details for Slack'
    });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(args.onToggle).toHaveBeenCalledWith('0oaFAKE1');
    await expect(canvas.getByRole('button', {
      expanded: true
    })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', {
      expanded: true
    }));
    await expect(canvas.getByRole('button', {
      name: 'Show details for Slack'
    })).toHaveAttribute('aria-expanded', 'false');
  }
}`,...d.parameters?.docs?.source},description:{story:"The chevron owns the disclosure, driven here against real expansion state.",...d.parameters?.docs?.description}}};const E=["Default","Expanded","Inactive","NothingReported","Pushed","PushUnknown","TogglesFromTheChevron"];export{n as Default,s as Expanded,o as Inactive,r as NothingReported,p as PushUnknown,i as Pushed,d as TogglesFromTheChevron,E as __namedExportsOrder,k as default};
