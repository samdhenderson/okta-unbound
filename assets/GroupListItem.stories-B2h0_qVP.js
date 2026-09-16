import{j as D,r as M}from"./iframe-tAvKsVeF.js";import{G as F}from"./GroupListItem-CtwRBpIQ.js";import{r as K}from"./entityCache-B8HCQ8hY.js";import{w as W}from"./memberSourceCache-BoDWg628.js";import"./preload-helper-PPVm8Dsz.js";import"./revealOnHover-DU3PDCIu.js";import"./groupSourceSummary-srPaUr-6.js";import"./memberSourceBuckets-CMd9i71b.js";import"./chartPalette-Byit8206.js";import"./GroupListItemDetails-BhMiS0RE.js";import"./MemberSourceMeter-BZ5AAva_.js";import"./dateFormat-tpkRVL7u.js";import"./keys-CUIcVywe.js";const{expect:s,fn:S,userEvent:C,waitFor:U,within:O}=__STORYBOOK_MODULE_TEST__,t={id:"00gFAKE000000000001",name:"Engineering",description:"All engineering staff across every team.",type:"OKTA_GROUP",memberCount:128,hasRules:!1,ruleCount:0,usedInRuleCount:0,created:new Date("2023-01-15"),lastUpdated:new Date("2026-06-01")},A={...t,id:"00gFAKE000000000002",name:"Contractors",description:"Non-employee workers with time-boxed access.",memberCount:34,hasRules:!0,ruleCount:1,usedInRuleCount:0},R={...t,id:"00gFAKE000000000003",name:"EU Employees",description:"Everyone whose work location is in the EU.",memberCount:412,hasRules:!0,ruleCount:2,usedInRuleCount:3},I={id:"00gFAKE000000000004",name:"Salesforce Users",description:"Mastered by Salesforce and pushed to AD.",type:"APP_GROUP",memberCount:42,hasRules:!1,ruleCount:0,usedInRuleCount:0,sourceAppId:"0oaFAKEapp000000001",sourceAppName:"Salesforce",created:new Date("2022-08-02"),lastUpdated:new Date("2026-05-11"),pushMappings:[{mappingId:"apm000000000000001",sourceUserGroupId:"00gFAKE000000000004",targetGroupName:"AD — Salesforce Users",priority:0,appId:"0oaFAKEapp000000002",appName:"Active Directory"},{mappingId:"apm000000000000002",sourceUserGroupId:"00gFAKE000000000004",targetGroupName:"Workday — Salesforce Users",priority:1,appId:"0oaFAKEapp000000003",appName:"Workday"}]},H={...t,id:"00gFAKE000000000005",name:"Legacy VPN Access",description:"Retired in the 2025 network migration.",memberCount:0},z={...t,id:"00gFAKE000000000006",name:"temp-group-2",description:""},G={...t,id:"00gFAKE000000000007",name:"A Very Long Group Name That Describes A Highly Specific Cross-Functional Access Boundary",description:"A correspondingly long description explaining the purpose, scope, and ownership of this group in more detail than the row can possibly show."},N={total:34,direct:6,ruleBased:28,unattributed:0,byRule:[{ruleId:"0prFAKE000000000001",ruleName:"Contractor onboarding",count:28}]},L={total:412,direct:32,ruleBased:380,unattributed:90,byRule:[{ruleId:"0prFAKE000000000002",ruleName:"EU work location",count:250},{ruleId:"0prFAKE000000000003",ruleName:"EU contractor sync",count:40}]},T=(r,o)=>()=>{W(r,o)},oe={title:"Groups/GroupListItem",component:F,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'One compact row in the groups list, built around a single question: where do this group’s members come from? The signal line carries the member-source meter, the member count, and the rule and push facts — with "fed by" (rules that assign into the group) and "used in" (rules that merely test membership) kept apart.\n\n**The meter never fetches.** A split costs `ceil(N/200)` member requests, so the row renders one only when the Group Detail view has already banked it; otherwise it says "Source not analyzed" and offers an explicit analyze action. Two open affordances carry two names: the chevron expands an inline preview, the row body drills into the detail view.'}}},argTypes:{group:{description:"The group to render."},selected:{description:"Whether this row is selected — a selected row shows its checkbox always."},onToggleSelect:{description:"Toggles selection for this group's id."},oktaOrigin:{description:'Okta origin, enabling the "Open in Okta" deep link when present.'},onOpenDetail:{description:"Drills into this group's read-only detail view (the row-body affordance)."},onAnalyzeSource:{description:"Requests the (paid) member-source analysis; offered only while none is cached."},isHighlighted:{description:"When true, the row auto-expands and shows a highlight ring (deep-link target)."}},args:{group:t,selected:!1,onToggleSelect:S(),onOpenDetail:S(),onAnalyzeSource:S()},beforeEach:()=>{K()}},n={},i={args:{group:A}},c={args:{group:R}},p={args:{group:R},beforeEach:T(R.id,L)},d={args:{group:A},beforeEach:T(A.id,N)},u={args:{group:R}},l={args:{group:R,onAnalyzeSource:void 0}},m={args:{group:I}},g={args:{group:H}},h={args:{group:z}},y={args:{selected:!0}},a={args:{group:I},play:async({canvasElement:r,args:o})=>{const e=O(r),{name:B}=o.group;await C.click(e.getByRole("button",{name:`Expand ${B}`})),await U(()=>s(e.getByRole("button",{name:`Collapse ${B}`})).toHaveAttribute("aria-expanded","true"))}},w={args:{group:A},beforeEach:T(A.id,N),play:a.play},b={args:{isHighlighted:!0}},f={args:{oktaOrigin:"https://example.okta.com"}},x={args:{onOpenDetail:void 0}},_=()=>{const[r,o]=M.useState(!1);return D.jsx(F,{group:t,selected:r,onToggleSelect:()=>o(e=>!e),onOpenDetail:S(),onAnalyzeSource:S()})},k={render:()=>D.jsx(_,{}),play:async({canvasElement:r})=>{const e=O(r).getByRole("checkbox",{name:`Select ${t.name}`});await s(e).not.toBeChecked(),await C.click(e),await s(e).toBeChecked(),await C.click(e),await s(e).not.toBeChecked()}},v={parameters:{pseudo:{hover:!0}}},E={args:{group:G},parameters:{viewport:{value:"sidepanelCompact"}},play:async({canvasElement:r})=>{const e=O(r).getByText(G.name);await s(e).toBeInTheDocument(),await s(e).toHaveAttribute("title",G.name)}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"No rules, no push, no analysis yet — the quietest a row gets.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    group: oneRuleGroup
  }
}`,...i.parameters?.docs?.source},description:{story:"Fed by exactly one rule; the fact is singular, and still not a sum.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    group: multiRuleGroup
  }
}`,...c.parameters?.docs?.source},description:{story:`Two feeding rules *and* three rules that reference the group in a condition: different
questions, so they stay separate facts rather than one summed badge.`,...c.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    group: multiRuleGroup
  },
  beforeEach: withBreakdown(multiRuleGroup.id, indeterminateSplit)
}`,...p.parameters?.docs?.source},description:{story:`A split already computed by the detail view, where 90 of the 380 rule-managed members
could not be confirmed client-side: an *Indeterminate* segment carved out of the
rule-managed bucket, never added alongside it.`,...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    group: oneRuleGroup
  },
  beforeEach: withBreakdown(oneRuleGroup.id, cleanSplit)
}`,...d.parameters?.docs?.source},description:{story:"A clean, fully-attributed split: every member is confirmed one way or the other.",...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    group: multiRuleGroup
  }
}`,...u.parameters?.docs?.source},description:{story:`Nothing has been analyzed for this group, which is the state a freshly loaded
list is in for every row. The row says so instead of implying a split, and
offers the analyze action rather than fetching.`,...u.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    group: multiRuleGroup,
    onAnalyzeSource: undefined
  }
}`,...l.parameters?.docs?.source},description:{story:"No analyze handler wired — the row states the gap without offering an action.",...l.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    group: appGroup
  }
}`,...m.parameters?.docs?.source},description:{story:"An app-mastered group: source-app chip plus a push fact.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    group: emptyGroup
  }
}`,...g.parameters?.docs?.source},description:{story:"An empty group — nothing to attribute, so the meter stays silent.",...g.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    group: undescribedGroup
  }
}`,...h.parameters?.docs?.source},description:{story:"Blank description — the identity line falls back to the group id, in mono.",...h.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    selected: true
  }
}`,...y.parameters?.docs?.source},description:{story:"Selected: primary border, and the checkbox stays visible without hover.",...y.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    group: appGroup
  },
  // The disclosure control names its group, so this play reads the name off \`args\`:
  // \`ExpandedWithMeter\` below reuses this exact function against a different group.
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const {
      name
    } = args.group;
    await userEvent.click(canvas.getByRole('button', {
      name: \`Expand \${name}\`
    }));
    await waitFor(() => expect(canvas.getByRole('button', {
      name: \`Collapse \${name}\`
    })).toHaveAttribute('aria-expanded', 'true'));
  }
}`,...a.parameters?.docs?.source},description:{story:"Expanded through the chevron, showing the inline record preview.",...a.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    group: oneRuleGroup
  },
  beforeEach: withBreakdown(oneRuleGroup.id, cleanSplit),
  play: Expanded.play
}`,...w.parameters?.docs?.source},description:{story:"Expanded with a computed split — the full meter legend joins the preview.",...w.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    isHighlighted: true
  }
}`,...b.parameters?.docs?.source},description:{story:"Auto-expands and shows a highlight ring (deep-linked from the Rules tab).",...b.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    oktaOrigin: 'https://example.okta.com'
  }
}`,...f.parameters?.docs?.source},description:{story:'`oktaOrigin` present — adds the "Open in Okta" action to the icon cluster.',...f.parameters?.docs?.description}}};x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    onOpenDetail: undefined
  }
}`,...x.parameters?.docs?.source},description:{story:"No detail view to drill into — the row body is inert; the chevron still works.",...x.parameters?.docs?.description}}};k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  render: () => <SelectableRow />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox', {
      name: \`Select \${plainGroup.name}\`
    });
    await expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    await expect(checkbox).not.toBeChecked();
  }
}`,...k.parameters?.docs?.source},description:{story:"Ticking the row's checkbox selects it; ticking again clears it.",...k.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  parameters: {
    pseudo: {
      hover: true
    }
  }
}`,...v.parameters?.docs?.source},description:{story:"Hover state (forced): the checkbox and action icons fade in.",...v.parameters?.docs?.description}}};E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    group: longTextGroup
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByText(longTextGroup.name);
    await expect(name).toBeInTheDocument();
    await expect(name).toHaveAttribute('title', longTextGroup.name);
  }
}`,...E.parameters?.docs?.source},description:{story:"Long name and description, exercising truncation: the name's `title` carries the\nuntruncated text, so it stays reachable once `truncate` clips it at the 360px floor.",...E.parameters?.docs?.description}}};const ae=["Default","OneFeedingRule","MultipleRuleRelationships","MeterWithIndeterminateMembers","MeterComputed","MeterNotComputed","MeterNotComputedWithoutAction","AppGroup","Empty","WithoutDescription","Selected","Expanded","ExpandedWithMeter","Highlighted","WithOktaLink","WithoutOpenDetail","Selecting","Hover","LongText"];export{m as AppGroup,n as Default,g as Empty,a as Expanded,w as ExpandedWithMeter,b as Highlighted,v as Hover,E as LongText,d as MeterComputed,u as MeterNotComputed,l as MeterNotComputedWithoutAction,p as MeterWithIndeterminateMembers,c as MultipleRuleRelationships,i as OneFeedingRule,y as Selected,k as Selecting,f as WithOktaLink,h as WithoutDescription,x as WithoutOpenDetail,ae as __namedExportsOrder,oe as default};
