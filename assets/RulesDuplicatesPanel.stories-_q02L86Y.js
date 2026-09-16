import{R as g}from"./RulesDuplicatesPanel-qyCf_2Pj.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./ruleUtils-Vt2BA8lQ.js";const{expect:u,fn:p,userEvent:l,within:d}=__STORYBOOK_MODULE_TEST__,a=[{expression:'user.department == "Engineering"',unionGroupIds:["00g1eng","00g2eng-leads"],rules:[{id:"rul1",name:"Engineering Auto-Assign",status:"ACTIVE",type:"group_rule",created:"2025-01-10T00:00:00.000Z",lastUpdated:"2025-01-10T00:00:00.000Z",actions:{assignUserToGroups:{groupIds:["00g1eng"]}}},{id:"rul2",name:"Engineering Leads Sync",status:"INACTIVE",type:"group_rule",created:"2025-02-14T00:00:00.000Z",lastUpdated:"2025-02-14T00:00:00.000Z",actions:{assignUserToGroups:{groupIds:["00g2eng-leads"]}}}]},{expression:'user.city == "Austin"',unionGroupIds:["00g3austin"],rules:[{id:"rul3",name:"Austin Office",status:"ACTIVE",type:"group_rule",created:"2025-03-01T00:00:00.000Z",lastUpdated:"2025-03-01T00:00:00.000Z",actions:{assignUserToGroups:{groupIds:["00g3austin"]}}},{id:"rul4",name:"Austin Office Backup",status:"ACTIVE",type:"group_rule",created:"2025-03-02T00:00:00.000Z",lastUpdated:"2025-03-02T00:00:00.000Z",actions:{assignUserToGroups:{groupIds:["00g3austin"]}}}]}],v={title:"Rules/RulesDuplicatesPanel",component:g,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:`The duplicate-condition panel, opened from the rules strip's **Duplicates (N)** verb. Rules sharing a match expression but targeting different groups are redundant and can be folded into one rule carrying the union of their targets, with no change to who is matched.

Each cluster expands to reveal its shared condition and member rules, each with a "View" link that scrolls to the rule's card. Merging opens a non-destructive preview wizard — nothing is written until the admin confirms. Renders nothing with no clusters.`}}},argTypes:{clusters:{description:"Clusters of identical-expression rules (2+ each)."},onMerge:{description:"Start merging a cluster (opens the non-destructive preview wizard)."},onFocusRule:{description:'Scroll to and highlight a rule by id (its "View" link).'}},args:{clusters:a,onMerge:p(),onFocusRule:p()}},e={play:async({args:o,canvasElement:i})=>{const c=d(i);await l.click(c.getAllByRole("button",{name:/2 rules/})[0]),await u(c.getByText("Engineering Auto-Assign")).toBeInTheDocument(),await l.click(c.getAllByRole("button",{name:"View"})[0]),await u(o.onFocusRule).toHaveBeenCalledWith("rul1"),await l.click(c.getAllByRole("button",{name:"Review & merge"})[0]),await u(o.onMerge).toHaveBeenCalled()}},n={args:{clusters:[a[0]]}},s={args:{onFocusRule:void 0}},t={args:{clusters:[{...a[0],rules:[a[0].rules[0],{...a[0].rules[1],id:"rul5",name:"Engineering Contractors",status:"INVALID"}]}]},play:async({canvasElement:o})=>{const i=d(o);await l.click(i.getByRole("button",{name:/2 rules/})),await u(i.getByText("Broken")).toBeInTheDocument()}},r={args:{clusters:[]}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole('button', {
      name: /2 rules/
    })[0]);
    await expect(canvas.getByText('Engineering Auto-Assign')).toBeInTheDocument();
    await userEvent.click(canvas.getAllByRole('button', {
      name: 'View'
    })[0]);
    await expect(args.onFocusRule).toHaveBeenCalledWith('rul1');
    await userEvent.click(canvas.getAllByRole('button', {
      name: 'Review & merge'
    })[0]);
    await expect(args.onMerge).toHaveBeenCalled();
  }
}`,...e.parameters?.docs?.source},description:{story:"Two mergeable clusters: expand one, jump to a member rule, then start the merge.",...e.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    clusters: [clusters[0]]
  }
}`,...n.parameters?.docs?.source},description:{story:"A single mergeable cluster.",...n.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    onFocusRule: undefined
  }
}`,...s.parameters?.docs?.source},description:{story:'No `onFocusRule` handler — the per-rule "View" link is omitted.',...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    clusters: [{
      ...clusters[0],
      rules: [clusters[0].rules[0], {
        ...clusters[0].rules[1],
        id: 'rul5',
        name: 'Engineering Contractors',
        status: 'INVALID'
      }]
    }]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /2 rules/
    }));
    await expect(canvas.getByText('Broken')).toBeInTheDocument();
  }
}`,...t.parameters?.docs?.source},description:{story:'A cluster holding a rule Okta reports as `INVALID` — one it can no longer evaluate.\nThe mark is `danger` **Broken**, never the neutral *Inactive*: "somebody paused it"\nand "Okta cannot run it" call for opposite decisions.',...t.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    clusters: []
  }
}`,...r.parameters?.docs?.source},description:{story:"No mergeable clusters — the component renders nothing.",...r.parameters?.docs?.description}}};const T=["Default","SingleCluster","WithoutFocusLink","BrokenMemberRule","Empty"];export{t as BrokenMemberRule,e as Default,r as Empty,n as SingleCluster,s as WithoutFocusLink,T as __namedExportsOrder,v as default};
