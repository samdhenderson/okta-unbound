import{j as w,Q as A}from"./iframe-tAvKsVeF.js";import{R as T}from"./RuleDetailView-DBCGpw4L.js";import"./preload-helper-PPVm8Dsz.js";import"./RuleActionBar-DQ_mx6ls.js";import"./RuleLifecycleActions-g2yb4uXB.js";const{expect:r,fn:t,within:y}=__STORYBOOK_MODULE_TEST__,a="00g1a2b3c4d5e6f7g8h9",v="00g9z8y7x6w5v4u3t2s1",E={rule:t(),group:t(),user:t(),app:t(),policy:t()},s=(e={})=>({id:"00rFAKE0000000000001",name:"Engineering – Auto-assign by department",status:"ACTIVE",condition:'user.department == "Engineering"',conditionExpression:'user.department == "Engineering"',groupIds:[a,v],groupNames:["Engineering – All","Slack – Eng Channel"],allGroupNamesMap:{[a]:"Engineering – All",[v]:"Slack – Eng Channel"},userAttributes:["department"],created:"2024-01-15T09:00:00.000Z",lastUpdated:"2026-06-01T14:30:00.000Z",...e}),x={title:"Rules/RuleDetailView",component:T,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"One rule's condition, targets, conflicts and provenance, as a stack of `DetailSection`s with a `RuleActionBar` above them. It fetches nothing — everything shown is already on the `FormattedRule` the list was rendering, which is what lets the tab push this rung straight from a row with no loading state.\n\nThere is no header here: `RulesTab` keeps one `PageHeader` and feeds it `ruleIdentity`, so this view never repeats the rule’s name, status, id or counts. In the explorer that header is absent and these stories start at the strip."}}},decorators:[e=>w.jsx(A,{handlers:E,children:w.jsx("div",{className:"p-(--sp-gutter)",children:w.jsx(e,{})})})],args:{rule:s(),oktaOrigin:"https://example.okta.com",onPreviewImpact:t(),tierOpen:!1,onTierOpenChange:t(),isLifecycleLoading:!1,isConfirmingActivate:!1,onRequestActivate:t(),onCancelActivate:t(),onConfirmActivate:t(),onRequestDeactivate:t(),onAddTargetGroup:t(),sticky:!1},argTypes:{rule:{description:"The rule being browsed."},oktaOrigin:{description:"Okta org origin, for the Admin Console rules-page link."},onPreviewImpact:{description:"Opens the impact preview. Omitted when the rule targets no groups."},tierOpen:{description:"Whether the strip’s disclosure tier is open."},sticky:{description:"Pin the strip below the header. `false` in stories — nothing scrolls."}}},o={},i={play:async({canvasElement:e})=>{const n=y(e);await r(n.getByRole("button",{name:"Open group Engineering – All"})).toBeInTheDocument(),await r(n.getByRole("button",{name:`Copy group id ${a}`})).toBeInTheDocument()}},c={args:{rule:s({groupNames:void 0,allGroupNamesMap:{}})},play:async({canvasElement:e})=>{const n=y(e);await r(n.getAllByText("Group name not loaded")).toHaveLength(2),await r(n.getAllByRole("button",{name:/^Group name not loaded — open group 00g/})).toHaveLength(2)}},p={args:{rule:s({groupNames:["Engineering – All",v],allGroupNamesMap:{[a]:"Engineering – All"},missingGroupIds:[v]})},play:async({canvasElement:e})=>{const n=y(e);await r(n.getByText("Group no longer exists")).toBeInTheDocument(),await r(n.getByText(/One target no longer exists/)).toBeInTheDocument(),await r(n.getByRole("button",{name:"Open group Engineering – All"})).toBeInTheDocument()}},l={args:{rule:s({condition:`isMemberOfAnyGroup("${a}")`,conditionExpression:`isMemberOfAnyGroup("${a}")`})}},u={args:{rule:s({groupIds:[],groupNames:[]}),onPreviewImpact:void 0},play:async({canvasElement:e})=>{const n=y(e);await r(n.getByText(/assigns to no groups/)).toBeInTheDocument(),await r(n.queryByRole("button",{name:"Preview impact"})).not.toBeInTheDocument()}},g={args:{rule:s({conflicts:[{rule1:{id:"00rFAKE0000000000001",name:"Engineering – Auto-assign by department"},rule2:{id:"00rFAKE0000000000002",name:"Contractors – Auto-assign by department"},reason:'Both rules assign users to "Engineering – All" based on overlapping conditions.',severity:"high",affectedGroups:[a]}]})}},d={args:{tierOpen:!0}},m={args:{oktaOrigin:null},play:async({canvasElement:e})=>{await r(y(e).queryByRole("link",{name:/Open the rules page/})).not.toBeInTheDocument()}},h={args:{rule:s({conditionExpression:'user.department == "Engineering" AND user.employeeType == "Full-Time" AND user.countryCode == "GB"'})},parameters:{viewport:{value:"sidepanelCompact"}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:"{}",...o.parameters?.docs?.source},description:{story:"An active rule with two named target groups.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Open group Engineering – All'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: \`Copy group id \${GROUP_A}\`
    })).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"Every target resolved: an openable chip whose copy control names the id, not the group.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    rule: rule({
      groupNames: undefined,
      allGroupNamesMap: {}
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('Group name not loaded')).toHaveLength(2);
    // No chip presents the id as a name; the "Group name not loaded" count pins that.
    await expect(canvas.getAllByRole('button', {
      name: /^Group name not loaded — open group 00g/
    })).toHaveLength(2);
  }
}`,...c.parameters?.docs?.source},description:{story:`The same rule with no names resolved: the gap is stated, the raw id sits in the
identifier register rather than where a name belongs, and the group still opens by id.`,...c.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    rule: rule({
      groupNames: ['Engineering – All', GROUP_B],
      allGroupNamesMap: {
        [GROUP_A]: 'Engineering – All'
      },
      missingGroupIds: [GROUP_B]
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Group no longer exists')).toBeInTheDocument();
    // Said once in the chip and once in the section's description, so the fact is
    // legible whether the reader is scanning the list or reading the sentence.
    await expect(canvas.getByText(/One target no longer exists/)).toBeInTheDocument();
    // The surviving target is unaffected and still openable.
    await expect(canvas.getByRole('button', {
      name: 'Open group Engineering – All'
    })).toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:"A target group that no longer exists — *nothing left to name*, as against\n`UnresolvedTargetGroups`, where the name simply has not been learned. It carries a\nwarning's weight because `missingGroupIds` is only set off a complete group walk.",...p.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    rule: rule({
      condition: \`isMemberOfAnyGroup("\${GROUP_A}")\`,
      conditionExpression: \`isMemberOfAnyGroup("\${GROUP_A}")\`
    })
  }
}`,...l.parameters?.docs?.source},description:{story:"A condition naming a group by id: the literal is replaced by the chip it resolves to.",...l.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
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
    await expect(canvas.getByText(/assigns to no groups/)).toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: 'Preview impact'
    })).not.toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:"A rule that assigns to no groups: the finding is stated, and *Preview impact* is absent.",...u.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    rule: rule({
      conflicts: [{
        rule1: {
          id: '00rFAKE0000000000001',
          name: 'Engineering – Auto-assign by department'
        },
        rule2: {
          id: '00rFAKE0000000000002',
          name: 'Contractors – Auto-assign by department'
        },
        reason: 'Both rules assign users to "Engineering – All" based on overlapping conditions.',
        severity: 'high',
        affectedGroups: [GROUP_A]
      }]
    })
  }
}`,...g.parameters?.docs?.source},description:{story:"A detected conflict against another loaded rule, with its severity and reason.",...g.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    tierOpen: true
  }
}`,...d.parameters?.docs?.source},description:{story:"The strip's tier open, over the rule's content.",...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    oktaOrigin: null
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).queryByRole('link', {
      name: /Open the rules page/
    })).not.toBeInTheDocument();
  }
}`,...m.parameters?.docs?.source},description:{story:'No org origin, so the "In Okta" section is absent rather than rendering a dead link.',...m.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    rule: rule({
      conditionExpression: 'user.department == "Engineering" AND user.employeeType == "Full-Time" AND user.countryCode == "GB"'
    })
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...h.parameters?.docs?.source},description:{story:"The 360px floor: the condition scrolls inside its own box rather than widening the page.",...h.parameters?.docs?.description}}};const I=["Default","NamedTargetGroups","UnresolvedTargetGroups","MissingTargetGroup","ConditionNamesAGroup","NoTargetGroups","WithConflicts","TierOpen","WithoutOktaOrigin","Narrow"];export{l as ConditionNamesAGroup,o as Default,p as MissingTargetGroup,i as NamedTargetGroups,h as Narrow,u as NoTargetGroups,d as TierOpen,c as UnresolvedTargetGroups,g as WithConflicts,m as WithoutOktaOrigin,I as __namedExportsOrder,x as default};
