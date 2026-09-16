import{j as I}from"./iframe-tAvKsVeF.js";import{G as P}from"./GroupMembershipsList-q3jce_D6.js";import{s as G}from"./selectionStore-DExy1RDY.js";import"./preload-helper-PPVm8Dsz.js";import"./GroupMembershipRow-DUICEuop.js";import"./revealOnHover-DU3PDCIu.js";import"./MembershipRuleEvidence-B1QOrUY6.js";import"./ruleExpression-nPAdgj2W.js";import"./GroupMembershipsListProof-DQATbCdY.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./provenance-C1K7H2p2.js";import"./membershipVerdict-79Na81vF.js";import"./useRungSelection-DALqsLn1.js";import"./useSelection-DlTpY3y-.js";import"./groupContext-D0LcfWax.js";import"./groupRuleIndex-CUdSMoPG.js";import"./useGroupNameResolver-D8p1YH0d.js";import"./fetchGroupRulesRequest-fyQsHdKR.js";import"./ruleUtils-Vt2BA8lQ.js";import"./okta-DiqjVWpx.js";import"./types-D54cNL3h.js";import"./orgSnapshotStore-BNo8k5ja.js";import"./index-Dob3nYDb.js";import"./types-aoYpQiYS.js";import"./ruleOrphans-DKT5VstI.js";import"./useOktaApi.mock-bZSfZMMp.js";import"./entityCache-B8HCQ8hY.js";import"./keys-CUIcVywe.js";const{expect:t,userEvent:n,within:r}=__STORYBOOK_MODULE_TEST__,M={id:"00uFAKE00000000000001",status:"ACTIVE",profile:{login:"user@example.com",email:"user@example.com",firstName:"Ada",lastName:"Lovelace",department:"Engineering",title:"Intern"}},c=(a,e,i)=>({id:a,name:e,status:"ACTIVE",conditionExpression:i}),s={group:{id:"00gFAKE00000000000001",type:"OKTA_GROUP",profile:{name:"Engineering Staff",description:"All engineering employees"}},membershipType:"RULE_BASED",attribution:"exact",rules:[c("0prFAKErule00001","Auto-add Engineers",'user.department == "Engineering"')]},U={group:{id:"00gFAKE00000000000002",type:"OKTA_GROUP",profile:{name:"Platform On-call"}},membershipType:"RULE_BASED",attribution:"inferred",rules:[c("0prFAKErule00002","On-call rotation",'user.department == "Engineering" && isMemberOfGroup("00gFAKE00000000000009")')]},p={group:{id:"00gFAKE00000000000003",type:"OKTA_GROUP",profile:{name:"Security Reviewers"}},membershipType:"RULE_BASED",attribution:"ambiguous",rules:[c("0prFAKErule00003","Reviewers — by title",'user.title == "Intern"'),c("0prFAKErule00004","Reviewers — by group",'isMemberOfGroup("00gFAKE00000000000009")')]},o={group:{id:"00gFAKE00000000000004",type:"OKTA_GROUP",profile:{name:"Ops Handbook"}},membershipType:"DIRECT",attribution:"exact",rules:[]},L={group:{id:"00gFAKE00000000000005",type:"OKTA_GROUP",profile:{name:"Travel Policy"}},membershipType:"DIRECT",attribution:"inferred",rules:[]},K={group:{id:"00gFAKE00000000000006",type:"APP_GROUP",profile:{name:"Salesforce Users"}},membershipType:"RULE_BASED",attribution:"exact",rules:[]},C={group:{id:"00gFAKE00000000000007",type:"OKTA_GROUP",profile:{name:"Finance Readers"}},membershipType:"UNKNOWN",attribution:"ambiguous",rules:[]},N={group:{id:"00gFAKE00000000000008",type:"OKTA_GROUP",profile:{name:"VPN Access"}},membershipType:"RULE_BASED",attribution:"ambiguous",rules:[c("0prFAKErule00005","Contractors → VPN",'user.userType == "Contractor"'),c("0prFAKErule00006","Engineers → VPN",'user.department == "Engineering"')],provenance:{source:"okta",rules:[{id:"0prFAKErule00006",name:"Engineers → VPN"}]}},d=[s,U,p,o,L,K,C,N],ye={title:"Users/GroupMembershipsList",component:P,tags:["autodocs"],parameters:{layout:"fullscreen",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:"The Groups pane of the user-detail rung: every group the user is in, what put them there, and how much that answer is worth. A row says exactly two things — one verdict badge (`Rule`, `Rule · n`, `Direct`, `App`, `Unresolved`) and one source line.\n\nEverything else is behind the row’s disclosure: the full explanation, a card per attributed rule with its condition checked clause by clause against the user, any apps the group also grants, the **Ask Okta** proof action, and the Okta deep link. The badges are deductions — the user-groups read carries no attribution embed — and a row carrying `provenance` is the exception: that is Okta’s own answer."}}},decorators:[a=>I.jsx("div",{className:"bg-canvas p-4",children:I.jsx("div",{className:"overflow-hidden rounded-md border border-neutral-200 bg-white",children:I.jsx(a,{})})})],args:{memberships:[s,o,K],user:M,isLoading:!1},beforeEach:()=>(G.clearAll(),()=>G.clearAll()),argTypes:{memberships:{description:"The user's group memberships, each already classified as direct or rule-based."},user:{description:"The user the memberships belong to; enables the per-clause explanation of each rule condition."},isLoading:{description:"When true, shows row skeletons instead of the list."},currentGroupId:{description:'Group id to mark as the group being browsed elsewhere in the panel — the row is highlighted and carries an "On page" badge.'},oktaOrigin:{description:'Okta origin used to build admin-console deep links; the disclosure’s "Open in Okta" link hides when absent.'},recentlyAddedGroupId:{description:"Id of a group just successfully added this session; its row plays a one-shot `animate-affirm-flash` success flash."},appsByGroupId:{description:'Applications each group grants, keyed by group id. **Absent is not empty** — a group with no entry renders no "Also grants" line rather than claiming it grants none.'},onProveMembershipSource:{description:'Asks Okta which rules manage one membership. Each opened row gains an "Ask Okta" action, and the pane asks automatically for every unsettled row — one call per row, never for a settled one.'}}},m={},l={args:{memberships:d}},u={args:{memberships:[s,o],oktaOrigin:"https://example.okta.com",onProveMembershipSource:async()=>({state:"no-rules"})},play:async({canvasElement:a})=>{const e=r(a);await n.click(e.getByRole("button",{name:"Show how Engineering Staff was granted"})),await t(e.getByRole("button",{name:"Hide how Engineering Staff was granted"})).toHaveAttribute("aria-expanded","true")}},h={args:{memberships:[{...s,rules:[c("0prFAKErule00007","Handbook readers → Engineering",'isMemberOfAnyGroup("00gFAKE00000000000004")')]},o]},play:async({canvasElement:a})=>{const e=r(a);await n.click(e.getByRole("button",{name:"Show how Engineering Staff was granted"})),await t(e.getByText("Rule matches this user")).toBeInTheDocument(),await t(e.queryByText("Cannot be determined")).not.toBeInTheDocument()}},g={args:{memberships:[],isLoading:!0}},y={args:{memberships:[]}},w={args:{memberships:d},play:async({canvasElement:a})=>{const e=r(a);await n.type(e.getByLabelText("Filter group memberships"),"no-such-group"),await t(await e.findByText("No memberships match")).toBeInTheDocument()}},b={args:{memberships:d},play:async({canvasElement:a})=>{const e=r(a);await n.type(e.getByLabelText("Filter group memberships"),"auto-add"),await t(e.getByRole("heading",{name:"Engineering Staff"})).toBeInTheDocument(),await t(e.queryByRole("heading",{name:"Ops Handbook"})).not.toBeInTheDocument()}},v={args:{memberships:d},play:async({canvasElement:a})=>{const e=r(a);await n.click(e.getByRole("button",{name:"Direct"})),await t(e.getByRole("heading",{name:"Ops Handbook"})).toBeInTheDocument()}},k={args:{memberships:d,currentGroupId:s.group.id}},f={args:{oktaOrigin:"https://example.okta.com"}},E={args:{memberships:[s,o],appsByGroupId:{[s.group.id]:["Salesforce","Figma"]}},play:async({canvasElement:a})=>{const e=r(a);await n.click(e.getByRole("button",{name:"Show how Engineering Staff was granted"})),await t(e.getByText(/Salesforce, Figma/)).toBeInTheDocument()}},A={args:{isActive:!1,memberships:[p,o],onProveMembershipSource:async()=>({state:"rules",rules:[{id:"0prFAKErule00003",name:"Reviewers — by title"}]})},play:async({canvasElement:a})=>{const e=r(a);await n.click(e.getByRole("button",{name:"Show how Security Reviewers was granted"}));const i=e.getByRole("heading",{name:"Security Reviewers"}).closest("[data-group-id]"),D=r(i);await n.click(D.getByRole("button",{name:/Ask Okta/})),await t(await D.findByText(/Okta confirms/)).toBeInTheDocument()}},B={args:{isActive:!1,memberships:[p],onProveMembershipSource:async()=>({state:"no-rules"})},play:async({canvasElement:a})=>{const e=r(a);await n.click(e.getByRole("button",{name:"Show how Security Reviewers was granted"})),await n.click(e.getByRole("button",{name:/Ask Okta/})),await t(await e.findByText("Okta confirms: added directly")).toBeInTheDocument()}},T={args:{isActive:!1,memberships:[p],onProveMembershipSource:async()=>({state:"unknown"})},play:async({canvasElement:a})=>{const e=r(a);await n.click(e.getByRole("button",{name:"Show how Security Reviewers was granted"})),await n.click(e.getByRole("button",{name:/Ask Okta/})),await t(await e.findByText(/Okta did not answer/)).toBeInTheDocument()}},S={args:{memberships:[p,s],onProveMembershipSource:async()=>({state:"rules",rules:[{id:"0prFAKErule00003",name:"Reviewers — by title"}]})},play:async({canvasElement:a})=>{const e=r(a);await n.click(e.getByRole("button",{name:"Show how Security Reviewers was granted"})),await t(await e.findByText(/Okta confirms/)).toBeInTheDocument()}},R={args:{memberships:[s],user:void 0},play:async({canvasElement:a})=>{const e=r(a);await n.click(e.getByRole("button",{name:"Show how Engineering Staff was granted"})),await t(e.getByText('user.department == "Engineering"')).toBeInTheDocument()}},x={args:{recentlyAddedGroupId:o.group.id},parameters:{motion:"on"}},O={args:{memberships:[s,o]},play:async({canvasElement:a})=>{const i=r(a).getByRole("checkbox",{name:"Select Engineering Staff"});await t(i).not.toBeChecked(),await n.click(i),await t(i).toBeChecked()}},F={args:{memberships:d,currentGroupId:p.group.id},parameters:{viewport:{value:"sidepanelCompact"}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:"{}",...m.parameters?.docs?.source},description:{story:"A rule-fed, a direct and an app-mastered membership.",...m.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: everyVerdict
  }
}`,...l.parameters?.docs?.source},description:{story:"Every verdict on screen at once. Read down the badges: an answer is `primary` or\n`success`, a deduction is `warning`, and the proven row (`VPN Access`) is an answer.",...l.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: [ruleExact, direct],
    oktaOrigin: 'https://example.okta.com',
    onProveMembershipSource: async () => ({
      state: 'no-rules'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show how Engineering Staff was granted'
    }));
    await expect(canvas.getByRole('button', {
      name: 'Hide how Engineering Staff was granted'
    })).toHaveAttribute('aria-expanded', 'true');
  }
}`,...u.parameters?.docs?.source},description:{story:`One row opened. The disclosure is the whole explanation, in order: the caveat,
the rule that granted the membership with the attributes its condition reads,
the "Ask Okta" proof action, and the Okta link.`,...u.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: [{
      ...ruleExact,
      rules: [rule('0prFAKErule00007', 'Handbook readers → Engineering', 'isMemberOfAnyGroup("00gFAKE00000000000004")')]
    }, direct]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show how Engineering Staff was granted'
    }));
    await expect(canvas.getByText('Rule matches this user')).toBeInTheDocument();
    await expect(canvas.queryByText('Cannot be determined')).not.toBeInTheDocument();
  }
}`,...h.parameters?.docs?.source},description:{story:"A condition asking whether the user is in *another* group. The pane holds their whole\nmembership list, so it hands that list to the checklist and the clause resolves — the\ngroup named (`Ops Handbook`) is a row further down this same list.",...h.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: [],
    isLoading: true
  }
}`,...g.parameters?.docs?.source},description:{story:"Skeleton rows while the memberships load, so nothing shifts when they land.",...g.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: []
  }
}`,...y.parameters?.docs?.source},description:{story:"The user belongs to no groups at all — no filter, no pills, one sentence.",...y.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: everyVerdict
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Filter group memberships'), 'no-such-group');
    await expect(await canvas.findByText('No memberships match')).toBeInTheDocument();
  }
}`,...w.parameters?.docs?.source},description:{story:"The other empty state: memberships exist, none matches the filter, and it offers the way back.",...w.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: everyVerdict
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Filter group memberships'), 'auto-add');
    await expect(canvas.getByRole('heading', {
      name: 'Engineering Staff'
    })).toBeInTheDocument();
    await expect(canvas.queryByRole('heading', {
      name: 'Ops Handbook'
    })).not.toBeInTheDocument();
  }
}`,...b.parameters?.docs?.source},description:{story:`The filter reads the source line as well as the group name, so a rule name
finds the group it granted even when the two share no words.`,...b.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: everyVerdict
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Direct'
    }));
    await expect(canvas.getByRole('heading', {
      name: 'Ops Handbook'
    })).toBeInTheDocument();
  }
}`,...v.parameters?.docs?.source},description:{story:"One bucket at a time. The pills are the summary line's own terms.",...v.parameters?.docs?.description}}};k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: everyVerdict,
    currentGroupId: ruleExact.group.id
  }
}`,...k.parameters?.docs?.source},description:{story:'The group being browsed elsewhere in the panel: highlighted, and marked "On page".',...k.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    oktaOrigin: 'https://example.okta.com'
  }
}`,...f.parameters?.docs?.source},description:{story:"With an org origin known, each opened row can deep-link into the Admin Console.",...f.parameters?.docs?.description}}};E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: [ruleExact, direct],
    appsByGroupId: {
      [ruleExact.group.id]: ['Salesforce', 'Figma']
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show how Engineering Staff was granted'
    }));
    await expect(canvas.getByText(/Salesforce, Figma/)).toBeInTheDocument();
  }
}`,...E.parameters?.docs?.source},description:{story:"`appsByGroupId` comes from whoever already knows the answer — this pane never fetches\nit — and a group with no entry renders no line rather than claiming it grants nothing.",...E.parameters?.docs?.description}}};A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  args: {
    // Rendered off screen so the automatic backstop stays inert and this story
    // shows what the *click* does. \`AskedAutomatically\` covers the other path.
    isActive: false,
    memberships: [ruleAmbiguous, direct],
    onProveMembershipSource: async () => ({
      state: 'rules',
      rules: [{
        id: '0prFAKErule00003',
        name: 'Reviewers — by title'
      }]
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show how Security Reviewers was granted'
    }));
    // Scoped to the row: every row carries its own action, and the proof is
    // deliberately about this membership alone.
    const rowElement = canvas.getByRole('heading', {
      name: 'Security Reviewers'
    }).closest('[data-group-id]') as HTMLElement;
    const row = within(rowElement);
    await userEvent.click(row.getByRole('button', {
      name: /Ask Okta/
    }));
    await expect(await row.findByText(/Okta confirms/)).toBeInTheDocument();
  }
}`,...A.parameters?.docs?.source},description:{story:`The way out of a guess. The action lives inside the disclosure, so the request is
offered to a reader who has already opened the row they care about.`,...A.parameters?.docs?.description}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  args: {
    // Rendered off screen so the automatic backstop stays inert and this story
    // shows what the *click* does. \`AskedAutomatically\` covers the other path.
    isActive: false,
    memberships: [ruleAmbiguous],
    onProveMembershipSource: async () => ({
      state: 'no-rules'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show how Security Reviewers was granted'
    }));
    await userEvent.click(canvas.getByRole('button', {
      name: /Ask Okta/
    }));
    await expect(await canvas.findByText('Okta confirms: added directly')).toBeInTheDocument();
  }
}`,...B.parameters?.docs?.source},description:{story:'Okta answering "no rule manages this membership" is an **authoritative manual\nadd**. Okta saying *nothing* is a different story (`ProofUnanswered`) and must\nnever be shown this way.',...B.parameters?.docs?.description}}};T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    // Rendered off screen so the automatic backstop stays inert and this story
    // shows what the *click* does. \`AskedAutomatically\` covers the other path.
    isActive: false,
    memberships: [ruleAmbiguous],
    onProveMembershipSource: async () => ({
      state: 'unknown'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show how Security Reviewers was granted'
    }));
    await userEvent.click(canvas.getByRole('button', {
      name: /Ask Okta/
    }));
    await expect(await canvas.findByText(/Okta did not answer/)).toBeInTheDocument();
  }
}`,...T.parameters?.docs?.source},description:{story:`The honest failure mode: Okta was asked and did not answer, so the row's own
hedged classification stands untouched and the action can be retried.`,...T.parameters?.docs?.description}}};S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: [ruleAmbiguous, ruleExact],
    onProveMembershipSource: async () => ({
      state: 'rules',
      rules: [{
        id: '0prFAKErule00003',
        name: 'Reviewers — by title'
      }]
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show how Security Reviewers was granted'
    }));
    // No click on "Ask Okta" anywhere above: the answer is already there.
    await expect(await canvas.findByText(/Okta confirms/)).toBeInTheDocument();
  }
}`,...S.parameters?.docs?.source},description:{story:`Nobody clicks anything: a membership the pane could not settle is asked about on
arrival, once per unsettled row, so the row already carries Okta's answer when opened.`,...S.parameters?.docs?.description}}};R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: [ruleExact],
    user: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Show how Engineering Staff was granted'
    }));
    await expect(canvas.getByText('user.department == "Engineering"')).toBeInTheDocument();
  }
}`,...R.parameters?.docs?.source},description:{story:`No user to explain the conditions against, so each rule card falls back to the
raw condition text — an explanation would have nothing to evaluate.`,...R.parameters?.docs?.description}}};x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    recentlyAddedGroupId: direct.group.id
  },
  parameters: {
    motion: 'on'
  }
}`,...x.parameters?.docs?.source},description:{story:`The row for a just-added group plays a one-shot success flash, so the confirmation
lands on the group that changed rather than only in a banner above the fold.`,...x.parameters?.docs?.description}}};O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: [ruleExact, direct]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByRole('checkbox', {
      name: 'Select Engineering Staff'
    });
    await expect(box).not.toBeChecked();
    await userEvent.click(box);
    await expect(box).toBeChecked();
  }
}`,...O.parameters?.docs?.source},description:{story:`Every row carries a checkbox, backed by the panel-wide selection basket. Ticking one
here is the same basket entry as ticking that group on the Groups tab.`,...O.parameters?.docs?.description}}};F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  args: {
    memberships: everyVerdict,
    currentGroupId: ruleAmbiguous.group.id
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...F.parameters?.docs?.source},description:{story:`The 360px floor, where a verdict badge and a group name compete for one line — which
is why the labels are two words at most.`,...F.parameters?.docs?.description}}};const we=["Default","AllVerdicts","OpenDisclosure","GroupClauseResolvedFromMemberships","Loading","Empty","FilteredToNothing","FilteredByRuleName","FilteredToOneBucket","CurrentGroupHighlighted","WithOktaOriginLinks","WithAppGrants","ProvableAgainstOkta","ProvenManualAdd","ProofUnanswered","AskedAutomatically","WithoutUser","RecentlyAddedGroupFlash","Selectable","Compact"];export{l as AllVerdicts,S as AskedAutomatically,F as Compact,k as CurrentGroupHighlighted,m as Default,y as Empty,b as FilteredByRuleName,w as FilteredToNothing,v as FilteredToOneBucket,h as GroupClauseResolvedFromMemberships,g as Loading,u as OpenDisclosure,T as ProofUnanswered,A as ProvableAgainstOkta,B as ProvenManualAdd,x as RecentlyAddedGroupFlash,O as Selectable,E as WithAppGrants,f as WithOktaOriginLinks,R as WithoutUser,we as __namedExportsOrder,ye as default};
