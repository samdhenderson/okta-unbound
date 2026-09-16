import{R}from"./RuleCard-DOJWVDy0.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./ruleUtils-Vt2BA8lQ.js";import"./revealOnHover-DU3PDCIu.js";const{expect:t,fn:w,userEvent:T,within:s}=__STORYBOOK_MODULE_TEST__,n={id:"00rABCDEF1234567890",name:"Engineering – Auto-assign by department",status:"ACTIVE",condition:'user.department == "Engineering"',conditionExpression:'user.department == "Engineering"',groupIds:["00g1a2b3c4d5e6f7g8h9","00g9z8y7x6w5v4u3t2s1"],groupNames:["Engineering – All","Slack – Eng Channel"],allGroupNamesMap:{"00g1a2b3c4d5e6f7g8h9":"Engineering – All","00g9z8y7x6w5v4u3t2s1":"Slack – Eng Channel"},userAttributes:["department"],created:"2024-01-15T09:00:00.000Z",lastUpdated:"2026-06-01T14:30:00.000Z",affectsCurrentGroup:!1},C={title:"Rules/RuleCard",component:R,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"A single Okta group rule as a list row: name, status, the badges that say how it relates to the group you arrived from, and its condition in human-readable form. The rule detail lives on its own rung, in `RuleDetailView`.\n\nPressing anywhere on the row opens it, through a `StretchedButton` whose accessible name is identical on every row — so it points at *this* row's name via `aria-describedby`."}}},argTypes:{rule:{description:"The formatted rule to display."},onOpenRule:{description:"Open this rule's detail rung. Wired by the Rules tab, which has one to push."},onOpenInRulesTab:{description:"Jump to this rule on the Rules tab, for surfaces with no rule rung to push."},isHighlighted:{description:"When true, the row flashes once on arrival (deep-link target)."},selected:{description:"Whether this rule is in the selection basket's `rule` partition."},onToggleSelect:{description:"Toggles this rule's id in the selection basket."}},args:{rule:n,onOpenRule:w(),isHighlighted:!1,selected:!1,onToggleSelect:w()}},o={play:async({args:e,canvasElement:a})=>{const r=s(a);await T.click(r.getByRole("button",{name:"Open rule"})),await t(e.onOpenRule).toHaveBeenCalledWith(n)}},i={play:async({canvasElement:e})=>{const a=s(e),B=a.getByRole("button",{name:"Open rule"}).getAttribute("aria-describedby");await t(B).toBeTruthy(),await t(a.getByText(n.name)).toHaveAttribute("id",B)}},c={args:{rule:{...n,status:"INACTIVE"}},play:async({canvasElement:e})=>{await t(s(e).getByText("INACTIVE")).toBeInTheDocument()}},l={args:{rule:{...n,status:"INVALID"}},play:async({canvasElement:e})=>{const a=s(e);await t(a.getByText("Broken")).toBeInTheDocument(),await t(a.queryByText("INACTIVE")).not.toBeInTheDocument()}},u={args:{rule:{...n,affectsCurrentGroup:!0}}},p={args:{rule:{...n,conflicts:[{rule1:{id:n.id,name:n.name},rule2:{id:"00rZYXWVUT0987654321",name:"Contractors – Auto-assign by department"},reason:'Both rules assign users to "Engineering – All" based on overlapping conditions.',severity:"high",affectedGroups:["00g1a2b3c4d5e6f7g8h9"]}]}},play:async({canvasElement:e})=>{await t(s(e).getByText("1 Conflict")).toBeInTheDocument()}},d={args:{rule:{...n,missingGroupIds:["00g9z8y7x6w5v4u3t2s1"]}},play:async({canvasElement:e})=>{await t(s(e).getByText("Target missing")).toBeInTheDocument()}},g={args:{rule:{...n,missingGroupIds:["00g9z8y7x6w5v4u3t2s1","00g1122334455667788a"]}},play:async({canvasElement:e})=>{await t(s(e).getByText("2 targets missing")).toBeInTheDocument()}},m={args:{onOpenRule:void 0,onOpenInRulesTab:w()},play:async({args:e,canvasElement:a})=>{const r=s(a);await T.click(r.getByRole("button",{name:"Open rule in the Rules tab"})),await t(e.onOpenInRulesTab).toHaveBeenCalledWith(n.id)}},h={args:{onOpenRule:void 0},play:async({canvasElement:e})=>{await t(s(e).queryByRole("button")).not.toBeInTheDocument()}},y={args:{isHighlighted:!0}},b={play:async({args:e,canvasElement:a})=>{const r=s(a);await T.click(r.getByRole("checkbox",{name:`Select ${n.name}`})),await t(e.onToggleSelect).toHaveBeenCalledWith(n.id),await t(e.onOpenRule).not.toHaveBeenCalled()}},v={args:{selected:!0},play:async({canvasElement:e})=>{const a=s(e).getByRole("checkbox",{name:`Select ${n.name}`});await t(a).toBeChecked()}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Open rule'
    }));
    await expect(args.onOpenRule).toHaveBeenCalledWith(baseRule);
  }
}`,...o.parameters?.docs?.source},description:{story:"An active rule with no conflicts. Pressing anywhere on the row opens its rung.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const open = canvas.getByRole('button', {
      name: 'Open rule'
    });
    const describedBy = open.getAttribute('aria-describedby');
    await expect(describedBy).toBeTruthy();
    await expect(canvas.getByText(baseRule.name)).toHaveAttribute('id', describedBy);
  }
}`,...i.parameters?.docs?.source},description:{story:"The row's open control is described by this row's own heading, not just the shared label.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    rule: {
      ...baseRule,
      status: 'INACTIVE'
    }
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByText('INACTIVE')).toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"Inactive rule — the status is a neutral badge that says so, not a grey dot.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    rule: {
      ...baseRule,
      status: 'INVALID'
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Broken')).toBeInTheDocument();
    await expect(canvas.queryByText('INACTIVE')).not.toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:"`INVALID` — the rule can no longer be evaluated, so it takes a `danger` mark reading\n**Broken** rather than the neutral `INACTIVE` pill a deliberately paused rule gets.",...l.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    rule: {
      ...baseRule,
      affectsCurrentGroup: true
    }
  }
}`,...u.parameters?.docs?.source},description:{story:"Assigns into the group you arrived from — takes `ListRow`'s shared `selected` state.",...u.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    rule: {
      ...baseRule,
      conflicts: [{
        rule1: {
          id: baseRule.id,
          name: baseRule.name
        },
        rule2: {
          id: '00rZYXWVUT0987654321',
          name: 'Contractors – Auto-assign by department'
        },
        reason: 'Both rules assign users to "Engineering – All" based on overlapping conditions.',
        severity: 'high',
        affectedGroups: ['00g1a2b3c4d5e6f7g8h9']
      }]
    }
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByText('1 Conflict')).toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:"A detected conflict is counted on the row; the detail is on the rule's rung.",...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    rule: {
      ...baseRule,
      missingGroupIds: ['00g9z8y7x6w5v4u3t2s1']
    }
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByText('Target missing')).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"A rule assigning into a group the org no longer has. The badge is rendered only off a\ncompleted group walk — `missingGroupIds` stays `undefined` until the inventory can\nsupport the negative read.",...d.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    rule: {
      ...baseRule,
      missingGroupIds: ['00g9z8y7x6w5v4u3t2s1', '00g1122334455667788a']
    }
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByText('2 targets missing')).toBeInTheDocument();
  }
}`,...g.parameters?.docs?.source},description:{story:"Two gone at once — the badge counts rather than repeating itself.",...g.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    onOpenRule: undefined,
    onOpenInRulesTab: fn()
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Open rule in the Rules tab'
    }));
    await expect(args.onOpenInRulesTab).toHaveBeenCalledWith(baseRule.id);
  }
}`,...m.parameters?.docs?.source},description:{story:"The Group Detail wiring: the press leaves this tab, so the control says where it lands.",...m.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    onOpenRule: undefined
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument();
  }
}`,...h.parameters?.docs?.source},description:{story:"Neither handler wired: the row is inert by design and renders nothing that looks pressable.",...h.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    isHighlighted: true
  }
}`,...y.parameters?.docs?.source},description:{story:"A deep-link target, flashing once on arrival.",...y.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('checkbox', {
      name: \`Select \${baseRule.name}\`
    }));
    await expect(args.onToggleSelect).toHaveBeenCalledWith(baseRule.id);
    await expect(args.onOpenRule).not.toHaveBeenCalled();
  }
}`,...b.parameters?.docs?.source},description:{story:"Ticking the checkbox reports this rule's id, and does not open the row — the two\ncontrols (`StretchedButton` overlay, checkbox above it via `relative z-10`) are\nindependent. This is also the axe-clean proof that a checkbox floated over a\n`StretchedButton` overlay does not trip `nested-interactive`: the two never nest,\nthey sit as z-stacked siblings.",...b.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    selected: true
  },
  play: async ({
    canvasElement
  }) => {
    const checkbox = within(canvasElement).getByRole('checkbox', {
      name: \`Select \${baseRule.name}\`
    });
    await expect(checkbox).toBeChecked();
  }
}`,...v.parameters?.docs?.source},description:{story:"A ticked row shows its checkbox unconditionally and takes the shared `selected` state.",...v.parameters?.docs?.description}}};const O=["Default","NamesTheRuleItOpens","Inactive","Broken","AffectsCurrentGroup","WithConflicts","MissingTargetGroup","SeveralMissingTargetGroups","OpensInTheRulesTab","NotOpenable","Highlighted","TogglingSelection","Selected"];export{u as AffectsCurrentGroup,l as Broken,o as Default,y as Highlighted,c as Inactive,d as MissingTargetGroup,i as NamesTheRuleItOpens,h as NotOpenable,m as OpensInTheRulesTab,v as Selected,g as SeveralMissingTargetGroups,b as TogglingSelection,p as WithConflicts,O as __namedExportsOrder,C as default};
