import{j as i,Q as F,R as W}from"./iframe-tAvKsVeF.js";import{G as U}from"./GroupMembershipRow-DUICEuop.js";import"./preload-helper-PPVm8Dsz.js";import"./revealOnHover-DU3PDCIu.js";import"./MembershipRuleEvidence-B1QOrUY6.js";import"./ruleExpression-nPAdgj2W.js";import"./GroupMembershipsListProof-DQATbCdY.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./provenance-C1K7H2p2.js";import"./membershipVerdict-79Na81vF.js";const{expect:t,fn:n,userEvent:N,within:c}=__STORYBOOK_MODULE_TEST__,L={rule:n(),group:n(),user:n(),app:n(),policy:n()},j={id:"00uFAKE00000000000001",status:"ACTIVE",profile:{login:"user@example.com",email:"user@example.com",firstName:"Ada",lastName:"Lovelace",department:"Engineering",title:"Intern"}},H=(e,r,a)=>({id:e,name:r,status:"ACTIVE",conditionExpression:a}),I={group:{id:"00gFAKE00000000000001",type:"OKTA_GROUP",profile:{name:"Engineering Staff",description:"All engineering employees"}},membershipType:"RULE_BASED",attribution:"exact",rules:[H("0prFAKErule00001","Auto-add Engineers",'user.department == "Engineering"')]},s={group:{id:"00gFAKE00000000000003",type:"OKTA_GROUP",profile:{name:"Security Reviewers"}},membershipType:"RULE_BASED",attribution:"ambiguous",rules:[H("0prFAKErule00003","Reviewers — by title",'user.title == "Intern"'),H("0prFAKErule00004","Reviewers — by group",'isMemberOfGroup("00gFAKE00000000000009")')]},_={group:{id:"00gFAKE00000000000004",type:"OKTA_GROUP",profile:{name:"Ops Handbook"}},membershipType:"DIRECT",attribution:"exact",rules:[]},M={group:{id:"00gFAKE00000000000005",type:"OKTA_GROUP",profile:{name:"Travel Policy"}},membershipType:"DIRECT",attribution:"inferred",rules:[]},q={group:{id:"00gFAKE00000000000006",type:"APP_GROUP",profile:{name:"Salesforce Users"}},membershipType:"RULE_BASED",attribution:"exact",rules:[]},Q={group:{id:"00gFAKE00000000000007",type:"OKTA_GROUP",profile:{name:"Finance Readers"}},membershipType:"UNKNOWN",attribution:"ambiguous",rules:[]},K={...s,group:{id:"00gFAKE00000000000008",type:"OKTA_GROUP",profile:{name:"EMEA Engineering — Platform Infrastructure On-Call Escalation"}}},V={...s,provenance:{source:"okta",rules:[{id:"0prFAKErule00003",name:"Reviewers — by title"}]}},oe={title:"Users/GroupMembershipRow",component:U,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"One membership, reduced to two statements: a **verdict badge** (`Rule`, `Rule · n`, `Direct`, `App`, `Unresolved`, from `membershipVerdict`) and one **source line** worded by `shared/membership/sourceLine`. Everything past those two lives behind the disclosure — the full explanation, a card per attributed rule, any apps the group also grants, the **Ask Okta** proof action, and the Okta deep link.\n\nThe disclosure is closed by default and held `inert` while closed, which keeps the proof action — one API call per press — off a row nobody has opened. Expansion is owned by the pane, not the row, so filtering the list cannot close a row the reader opened."}}},decorators:[e=>i.jsx(F,{handlers:L,children:i.jsx("div",{className:"bg-canvas p-4",children:i.jsx("div",{className:"overflow-hidden rounded-md border border-neutral-200 bg-white",children:i.jsx(e,{})})})})],args:{membership:I,user:j,isCurrentGroup:!1,expanded:!1,onToggle:n(),oktaOrigin:"https://example.okta.com",proofEnabled:!1,onProve:n()},argTypes:{membership:{description:"The membership this row is about, as the classifier produced it."},user:{description:"The user it belongs to; each rule condition is explained clause by clause against them."},isCurrentGroup:{description:"Whether this is the group being browsed elsewhere in the panel."},expanded:{description:"Whether the disclosure is open. Owned by the pane, so filtering cannot close a row."},onToggle:{description:"Toggles this row's disclosure, by group id."},oktaOrigin:{description:"Origin for the admin-console deep link; the link hides without it."},flash:{description:"One-shot success flash for a group that was just added this session."},appNames:{description:"Apps this group also grants; absent omits the line rather than claiming none."},proofEnabled:{description:"Whether the surface can prove a membership at all (a resolver was supplied)."},proofOutcome:{description:"Where this row's proof request has got to, or `undefined` before anyone asked."},onProve:{description:"Asks Okta about this one membership — one API call, from a press only."},selected:{description:"Whether this group is in the selection basket; a ticked row paints ListRow's selected state."},onToggleSelect:{description:"Tick or untick this group. Omitted ⇒ no checkbox renders at all."}}},p={},d={},l={args:{membership:s}},u={args:{membership:_}},m={args:{membership:M}},g={args:{membership:q}},h={args:{membership:Q}},b={args:{membership:V}},w={args:{expanded:!1}},f={args:{expanded:!0}},y={args:{isCurrentGroup:!0}},v={args:{membership:_,flash:!0},parameters:{motion:"on"}},x={args:{expanded:!0,appNames:["Salesforce","Figma"]},play:async({canvasElement:e})=>{const r=c(e);await t(r.getByText("Also grants:")).toBeInTheDocument()}},E={args:{expanded:!0},play:async({canvasElement:e})=>{const r=c(e);await t(r.queryByText("Also grants:")).toBeNull()}},T={args:{membership:s,expanded:!0,proofEnabled:!1}},A={args:{membership:s,expanded:!0,proofEnabled:!0},play:async({args:e,canvasElement:r})=>{const a=c(r);await N.click(a.getByRole("button",{name:"Ask Okta"})),await t(e.onProve).toHaveBeenCalledWith(s)}},S={args:{membership:s,expanded:!0,proofEnabled:!0,proofOutcome:{status:"pending"}}},R={args:{membership:s,expanded:!0,proofEnabled:!0,proofOutcome:{status:"proven",membership:V}}},k={args:{membership:s,expanded:!0,proofEnabled:!0,proofOutcome:{status:"unanswered"}}},O={args:{expanded:!1},play:async({args:e,canvasElement:r})=>{const o=c(r).getByRole("button",{name:"Show how Engineering Staff was granted"});await t(o).toHaveAttribute("aria-expanded","false"),await N.click(o),await t(e.onToggle).toHaveBeenCalledWith(I.group.id)}},Y=e=>{const[r,a]=W.useState(!1);return i.jsx(U,{...e,expanded:r,onToggle:()=>a(o=>!o)})},B={render:e=>i.jsx(Y,{...e}),play:async({canvasElement:e})=>{const r=c(e),a=r.getByRole("button",{name:"Show how Engineering Staff was granted"});await N.click(a);const o=await r.findByRole("button",{name:"Hide how Engineering Staff was granted"});await t(o).toHaveAttribute("aria-expanded","true"),await N.click(o),await t(await r.findByRole("button",{name:"Show how Engineering Staff was granted"})).toHaveAttribute("aria-expanded","false")}},C={args:{membership:s,isCurrentGroup:!0},parameters:{viewport:{value:"sidepanelCompact"}}},D={args:{membership:K,isCurrentGroup:!0},parameters:{viewport:{value:"sidepanelCompact"}},play:async({canvasElement:e})=>{const r=c(e),a=r.getByText(K.group.profile.name);await t(a).toBeInTheDocument(),await t(a).toHaveAttribute("title",K.group.profile.name),await t(r.getByText("Rule · 2")).toBeInTheDocument(),await t(r.getByText("On page")).toBeInTheDocument()}},P={args:{onToggleSelect:n()},play:async({args:e,canvas:r})=>{const a=r.getByRole("checkbox",{name:"Select Engineering Staff"});await t(a).not.toBeChecked(),await N.click(a),await t(e.onToggleSelect).toHaveBeenCalledWith(I.group.id)}},G={args:{onToggleSelect:n(),selected:!0},play:async({canvas:e})=>{await t(e.getByRole("checkbox",{name:"Select Engineering Staff"})).toBeChecked()}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:"{}",...p.parameters?.docs?.source},description:{story:"A rule-fed membership, collapsed: the name, the source line, and the badge.",...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:"{}",...d.parameters?.docs?.source},description:{story:"`Rule` — a single rule provably matches this user.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    membership: ruleAmbiguous
  }
}`,...l.parameters?.docs?.source},description:{story:"`Rule · 2` — two candidates, none of them credited. The count is the candidate set.",...l.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    membership: direct
  }
}`,...u.parameters?.docs?.source},description:{story:"`Direct` — no rule targets the group and every condition was evaluable.",...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    membership: directDeduced
  }
}`,...m.parameters?.docs?.source},description:{story:"`Direct`, in `warning` — the classifier deduced the manual add rather than proving it.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    membership: appMastered
  }
}`,...g.parameters?.docs?.source},description:{story:"`App` — the application masters the group, which is the whole explanation.",...g.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    membership: unresolved
  }
}`,...h.parameters?.docs?.source},description:{story:'`Unresolved` — never classified. Not "direct", and not a failure of the group.',...h.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    membership: proven
  }
}`,...b.parameters?.docs?.source},description:{story:"Okta's own answer, attached: a proven `Rule` on a membership that was `Rule · 2`.",...b.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    expanded: false
  }
}`,...w.parameters?.docs?.source},description:{story:"Closed, which is how every row starts — twelve open clause checklists is the state this avoids.",...w.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    expanded: true
  }
}`,...f.parameters?.docs?.source},description:{story:"Open: the caveat in full, the rule card with its clause-by-clause explanation, and the Okta link.",...f.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    isCurrentGroup: true
  }
}`,...y.parameters?.docs?.source},description:{story:'The group being browsed elsewhere in the panel: highlighted, and marked "On page".',...y.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    membership: direct,
    flash: true
  },
  parameters: {
    motion: 'on'
  }
}`,...v.parameters?.docs?.source},description:{story:"The one-shot success flash a just-added group plays, so the confirmation lands on the row that changed.",...v.parameters?.docs?.description}}};x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    expanded: true,
    appNames: ['Salesforce', 'Figma']
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Also grants:')).toBeInTheDocument();
  }
}`,...x.parameters?.docs?.source},description:{story:"`Also grants:` — the caller already knew the answer; this row never fetches it.",...x.parameters?.docs?.description}}};E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    expanded: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Also grants:')).toBeNull();
  }
}`,...E.parameters?.docs?.source},description:{story:"The same row with no `appNames`: the line is gone rather than claiming the group grants nothing.",...E.parameters?.docs?.description}}};T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    membership: ruleAmbiguous,
    expanded: true,
    proofEnabled: false
  }
}`,...T.parameters?.docs?.source},description:{story:"No resolver was supplied, so the row offers no action it could not honour.",...T.parameters?.docs?.description}}};A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  args: {
    membership: ruleAmbiguous,
    expanded: true,
    proofEnabled: true
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Ask Okta'
    }));
    await expect(args.onProve).toHaveBeenCalledWith(ruleAmbiguous);
  }
}`,...A.parameters?.docs?.source},description:{story:"The action, before anyone has spent the request. One call, from this press only.",...A.parameters?.docs?.description}}};S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    membership: ruleAmbiguous,
    expanded: true,
    proofEnabled: true,
    proofOutcome: {
      status: 'pending'
    }
  }
}`,...S.parameters?.docs?.source},description:{story:"In flight. The button carries its own spinner rather than blanking the row.",...S.parameters?.docs?.description}}};R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  args: {
    membership: ruleAmbiguous,
    expanded: true,
    proofEnabled: true,
    proofOutcome: {
      status: 'proven',
      membership: proven
    }
  }
}`,...R.parameters?.docs?.source},description:{story:"Okta answered and named the rule — stated as a fact, in the same vocabulary as the row.",...R.parameters?.docs?.description}}};k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  args: {
    membership: ruleAmbiguous,
    expanded: true,
    proofEnabled: true,
    proofOutcome: {
      status: 'unanswered'
    }
  }
}`,...k.parameters?.docs?.source},description:{story:"Okta was asked and said nothing, so the row's classification stands and the action can be pressed again.",...k.parameters?.docs?.description}}};O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  args: {
    expanded: false
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: 'Show how Engineering Staff was granted'
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(args.onToggle).toHaveBeenCalledWith(ruleExact.group.id);
  }
}`,...O.parameters?.docs?.source},description:{story:"The disclosure opening, driven from the chevron the way a reader opens it.",...O.parameters?.docs?.description}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  render: args => <ExpandableRow {...args} />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const open = canvas.getByRole('button', {
      name: 'Show how Engineering Staff was granted'
    });
    await userEvent.click(open);
    const close = await canvas.findByRole('button', {
      name: 'Hide how Engineering Staff was granted'
    });
    await expect(close).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(close);
    await expect(await canvas.findByRole('button', {
      name: 'Show how Engineering Staff was granted'
    })).toHaveAttribute('aria-expanded', 'false');
  }
}`,...B.parameters?.docs?.source},description:{story:"Operate the disclosure end to end: open it, read the explanation, fold it back.",...B.parameters?.docs?.description}}};C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    membership: ruleAmbiguous,
    isCurrentGroup: true
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...C.parameters?.docs?.source},description:{story:'The 360px floor, where the name, the verdict and the "On page" badge share one line.',...C.parameters?.docs?.description}}};D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  args: {
    membership: longName,
    isCurrentGroup: true
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
    const name = canvas.getByText(longName.group.profile.name);
    await expect(name).toBeInTheDocument();
    await expect(name).toHaveAttribute('title', longName.group.profile.name);
    await expect(canvas.getByText('Rule · 2')).toBeInTheDocument();
    await expect(canvas.getByText('On page')).toBeInTheDocument();
  }
}`,...D.parameters?.docs?.source},description:{story:"The worst case for the name line: a long group name, both badges, and the narrow floor.\nThe badges wrap under the name, and the name's `title` keeps the full text reachable.",...D.parameters?.docs?.description}}};P.parameters={...P.parameters,docs:{...P.parameters?.docs,source:{originalSource:`{
  args: {
    onToggleSelect: fn()
  },
  play: async ({
    args,
    canvas
  }) => {
    const box = canvas.getByRole('checkbox', {
      name: 'Select Engineering Staff'
    });
    await expect(box).not.toBeChecked();
    await userEvent.click(box);
    await expect(args.onToggleSelect).toHaveBeenCalledWith(ruleExact.group.id);
  }
}`,...P.parameters?.docs?.source},description:{story:"The checkbox costs this row nothing: it has never been its own click target,\nso a box beside the chevron is purely additive. The name says which group\n(`Select Engineering Staff`).",...P.parameters?.docs?.description}}};G.parameters={...G.parameters,docs:{...G.parameters?.docs,source:{originalSource:`{
  args: {
    onToggleSelect: fn(),
    selected: true
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.getByRole('checkbox', {
      name: 'Select Engineering Staff'
    })).toBeChecked();
  }
}`,...G.parameters?.docs?.source},description:{story:"Ticked. The checkbox is drawn unconditionally — `REVEAL_ON_HOVER` exempts an\nactive control, or a selection would vanish while scrolling — and the row\ntakes `ListRow`'s `selected` state.",...G.parameters?.docs?.description}}};const ie=["Default","VerdictRule","VerdictRuleAmbiguous","VerdictDirect","VerdictDirectDeduced","VerdictAppMastered","VerdictUnresolved","VerdictProven","Collapsed","Expanded","CurrentGroupHighlighted","RecentlyAddedFlash","WithAppGrants","WithoutAppGrants","ProofDisabled","ProofIdle","ProofPending","ProofResolved","ProofUnanswered","OpeningTheDisclosure","DisclosureRoundTrip","Compact","LongGroupName","Selectable","Selected"];export{w as Collapsed,C as Compact,y as CurrentGroupHighlighted,p as Default,B as DisclosureRoundTrip,f as Expanded,D as LongGroupName,O as OpeningTheDisclosure,T as ProofDisabled,A as ProofIdle,S as ProofPending,R as ProofResolved,k as ProofUnanswered,v as RecentlyAddedFlash,P as Selectable,G as Selected,g as VerdictAppMastered,u as VerdictDirect,m as VerdictDirectDeduced,b as VerdictProven,d as VerdictRule,l as VerdictRuleAmbiguous,h as VerdictUnresolved,x as WithAppGrants,E as WithoutAppGrants,ie as __namedExportsOrder,oe as default};
