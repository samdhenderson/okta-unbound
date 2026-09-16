import{M as m}from"./MemberSourceNotes-D0AtajgE.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./RuleLinkRow-CWX4uAdz.js";import"./memberSourceBuckets-CMd9i71b.js";import"./chartPalette-Byit8206.js";const{expect:t,fn:b,userEvent:d,within:c}=__STORYBOOK_MODULE_TEST__,p={total:4,direct:1,ruleBased:3,unattributed:0,byRule:[{ruleId:"0prFAKE1",ruleName:"All Engineers",count:3}]},f={title:"Groups/MemberSourceNotes",component:m,tags:["autodocs"],parameters:{layout:"padded",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:`Commentary about one group’s membership split, rendered under the source strip in the Members tab: the per-rule accounting, plus the note explaining the indeterminate slice.

The indeterminate note is text, never a tooltip — that slice is members whose rule condition the evaluator could not resolve, not members who do not belong. A rule Okta attributed carries a different chip from one the client-side heuristic inferred, because a deduction must not read as a fact.`}}},args:{breakdown:p,onNavigateToRule:b()}},a={play:async({canvas:e})=>{await t(e.getByText("3 members")).toBeVisible(),await t(e.queryByText(/limit of the client-side evaluator/)).toBeNull()}},r={args:{breakdown:{...p,unattributed:1,total:5}},play:async({canvas:e})=>{await t(e.getByText(/limit of the client-side evaluator, not a failed match/)).toBeVisible()}},i={args:{breakdown:{total:4,direct:0,ruleBased:4,unattributed:0,byRule:[{ruleId:"0prFAKE1",ruleName:"All Engineers",count:3},{ruleId:"0prFAKE2",ruleName:"Contractors",count:1}],byRuleMembers:[{ruleId:"0prFAKE1",ruleName:"All Engineers",soleCount:3,oktaAttributedCount:3,clientAttributedCount:0},{ruleId:"0prFAKE2",ruleName:"Contractors",soleCount:1,oktaAttributedCount:0,clientAttributedCount:1}],multiRuleMembers:0}},play:async({canvas:e})=>{const n=e.getByText("Okta-attributed"),u=e.getByText("Inferred");await t(u).toHaveAttribute("title",t.stringContaining("deduction, not a fact")),await t(n).toHaveAttribute("title",t.stringContaining("Okta itself reports these members"))}},s={args:{breakdown:{total:4,direct:4,ruleBased:0,unattributed:0,byRule:[]}},play:async({canvas:e})=>{await t(e.getByText("No member was attributed to a specific rule.")).toBeVisible()}},o={args:{breakdown:{total:28,direct:0,ruleBased:28,unattributed:0,byRule:Array.from({length:7},(e,n)=>({ruleId:`0prFAKE${n+1}`,ruleName:`Feeding rule ${n+1}`,count:7-n}))}},play:async({canvas:e,canvasElement:n})=>{await t(e.getByText("Feeding rule 3")).toBeVisible(),await t(e.queryByText("Feeding rule 4")).toBeNull(),await d.click(e.getByRole("button",{name:/4 more rules/}));const u=await c(n).findByRole("dialog");await t(c(u).getByText("Feeding rule 7")).toBeVisible(),await t(c(u).getByText("Feeding rule 1")).toBeVisible()}},l={play:async({args:e,canvas:n})=>{await d.click(n.getByRole("button",{name:"Open rule All Engineers in the Rules tab"})),await t(e.onNavigateToRule).toHaveBeenCalledWith("0prFAKE1")}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByText('3 members')).toBeVisible();
    await expect(canvas.queryByText(/limit of the client-side evaluator/)).toBeNull();
  }
}`,...a.parameters?.docs?.source},description:{story:"Every member classified: the per-rule accounting only, no correction needed.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    breakdown: {
      ...breakdown,
      unattributed: 1,
      total: 5
    }
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByText(/limit of the client-side evaluator, not a failed match/)).toBeVisible();
  }
}`,...r.parameters?.docs?.source},description:{story:`Some members could not be checked against a condition. The note says what that
means in words, and points at the surface that breaks the condition down clause
by clause.`,...r.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    breakdown: {
      total: 4,
      direct: 0,
      ruleBased: 4,
      unattributed: 0,
      byRule: [{
        ruleId: '0prFAKE1',
        ruleName: 'All Engineers',
        count: 3
      }, {
        ruleId: '0prFAKE2',
        ruleName: 'Contractors',
        count: 1
      }],
      byRuleMembers: [{
        ruleId: '0prFAKE1',
        ruleName: 'All Engineers',
        soleCount: 3,
        oktaAttributedCount: 3,
        clientAttributedCount: 0
      }, {
        ruleId: '0prFAKE2',
        ruleName: 'Contractors',
        soleCount: 1,
        oktaAttributedCount: 0,
        clientAttributedCount: 1
      }],
      multiRuleMembers: 0
    }
  },
  play: async ({
    canvas
  }) => {
    const fact = canvas.getByText('Okta-attributed');
    const guess = canvas.getByText('Inferred');
    await expect(guess).toHaveAttribute('title', expect.stringContaining('deduction, not a fact'));
    await expect(fact).toHaveAttribute('title', expect.stringContaining('Okta itself reports these members'));
  }
}`,...i.parameters?.docs?.source},description:{story:`A rule Okta attributed and one the heuristic inferred, side by side: the inferred chip
says in its title that it is a deduction.`,...i.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    breakdown: {
      total: 4,
      direct: 4,
      ruleBased: 0,
      unattributed: 0,
      byRule: []
    }
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByText('No member was attributed to a specific rule.')).toBeVisible();
  }
}`,...s.parameters?.docs?.source},description:{story:"Nothing was attributable — said in words, not left as an empty list.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    breakdown: {
      total: 28,
      direct: 0,
      ruleBased: 28,
      unattributed: 0,
      byRule: Array.from({
        length: 7
      }, (_, i) => ({
        ruleId: \`0prFAKE\${i + 1}\`,
        ruleName: \`Feeding rule \${i + 1}\`,
        count: 7 - i
      }))
    }
  },
  play: async ({
    canvas,
    canvasElement
  }) => {
    await expect(canvas.getByText('Feeding rule 3')).toBeVisible();
    await expect(canvas.queryByText('Feeding rule 4')).toBeNull();
    await userEvent.click(canvas.getByRole('button', {
      name: /4 more rules/
    }));
    const dialog = await within(canvasElement).findByRole('dialog');
    await expect(within(dialog).getByText('Feeding rule 7')).toBeVisible();
    await expect(within(dialog).getByText('Feeding rule 1')).toBeVisible();
  }
}`,...o.parameters?.docs?.source},description:{story:`A group fed by seven rules: the note names the top three and defers the rest to a
reveal, with the deferred count stated rather than silently dropped.`,...o.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvas
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: 'Open rule All Engineers in the Rules tab'
    }));
    await expect(args.onNavigateToRule).toHaveBeenCalledWith('0prFAKE1');
  }
}`,...l.parameters?.docs?.source},description:{story:"Each row deep-links its rule into the Rules tab.",...l.parameters?.docs?.description}}};const x=["Default","WithIndeterminateMembers","OktaAttributedVersusInferred","NothingAttributed","ManyRulesCapsAtThree","DeepLinksARule"];export{l as DeepLinksARule,a as Default,o as ManyRulesCapsAtThree,s as NothingAttributed,i as OktaAttributedVersusInferred,r as WithIndeterminateMembers,x as __namedExportsOrder,f as default};
