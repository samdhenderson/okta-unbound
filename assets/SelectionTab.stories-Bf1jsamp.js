import{j as y}from"./iframe-tAvKsVeF.js";import T from"./SelectionTab-RGhSOxWS.js";import{s as a}from"./selectionStore-DExy1RDY.js";import{O as w}from"./OrgEntityIndexContext--wR1D6q_.js";import"./preload-helper-PPVm8Dsz.js";import"./useSelection-DlTpY3y-.js";import"./collectionStore-Bmf5ll0f.js";import"./useOktaApi.mock-bZSfZMMp.js";import"./registry-CyxUpvmG.js";import"./userDisplay-xpx41Abi.js";import"./groupRuleIndex-CUdSMoPG.js";import"./fetchGroupRulesRequest-fyQsHdKR.js";import"./ruleUtils-Vt2BA8lQ.js";import"./okta-DiqjVWpx.js";import"./types-D54cNL3h.js";import"./orgSnapshotStore-BNo8k5ja.js";import"./index-Dob3nYDb.js";import"./types-aoYpQiYS.js";import"./ruleOrphans-DKT5VstI.js";import"./memberRuleAttribution-CD0Zofjz.js";import"./undoManager-UZfuKMLz.js";import"./profileAttributes-DCAWW3PA.js";import"./dateFormat-tpkRVL7u.js";import"./profileFields-BZvCtc6D.js";import"./profileDraft-BAjvfbBV.js";import"./memberAnalytics-BqndU7JT.js";import"./entityCache-B8HCQ8hY.js";import"./keys-CUIcVywe.js";import"./costSentence-DbR6FENm.js";import"./SelectionActionBar-BsGBZJPM.js";import"./SaveCollectionModal-BTvrTX52.js";import"./SelectionPane-CrlteUf1.js";import"./ActionsPane-DMVqLRIH.js";import"./VerbList-IR5vn6Vm.js";import"./ReportsPane-Bsn-T2X9.js";import"./CollectionsPane-BrN7KyQj.js";import"./CollectionsSection-BXMhfhdX.js";import"./usePoliciesData-B9NC3cn4.js";import"./VerbRunner-Czyw7gf7.js";import"./AttributeSpreadBar-BFtTzm-q.js";import"./chartPalette-Byit8206.js";import"./BreakdownReport-RtX7G5yn.js";import"./csvUtils-DgNWYp8m.js";import"./useOrgSnapshot-XJDRwdwN.js";const{expect:t,userEvent:s,within:o}=__STORYBOOK_MODULE_TEST__,me={title:"Selection/SelectionTab",component:T,tags:["autodocs"],parameters:{layout:"fullscreen",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:"Reviews and spends the entity-selection basket (`docs/adr/0005-session-chrome.md`). The body is a `Tabs` shell over four panes — **Selection** (the roster), **Actions** (the verbs that spend a cohort), **Reports** (the read-only questions) and **Collections** (the saved cohorts) — following `GroupDetailView`’s five-pane precedent.\n\nA pane with nothing in it **stays**, stating why in a sentence: a strip that grew a seat as each verb landed, or lost one as a partition emptied, would be chrome reshuffling under the reader. Inside a pane the opposite rule still holds — an empty kind is absent rather than stated as a zero.\n\nThe tab strip is not a band; it scrolls with the body, so the rung’s sticky bands are still the header and `SelectionActionBar`, which carries the whole-basket `Save as collection` and, behind **More** with a confirm, `Clear all`. Its sub-row search filters the roster and the saved collections alike."}}},decorators:[n=>y.jsx(w,{oktaOrigin:null,targetTabId:null,enabled:!1,children:y.jsx(n,{})})],beforeEach:()=>(a.clearAll(),()=>a.clearAll())},r={play:async({canvasElement:n})=>{const e=o(n);await t(e.getByText("Nothing selected")).toBeInTheDocument(),await t(e.queryByRole("button",{name:"More"})).not.toBeInTheDocument()}},i={beforeEach:()=>(a.toggle({kind:"user",id:"00uFAKE0001",name:"Dana Example"}),a.toggle({kind:"user",id:"00uFAKE0002",name:"Rowan Example"}),()=>a.clearAll()),play:async({canvasElement:n})=>{const e=o(n);await t(e.getByText("2 users selected")).toBeInTheDocument(),await t(e.getByText("Dana Example")).toBeInTheDocument(),await t(e.getByText("Rowan Example")).toBeInTheDocument(),await t(e.queryByText("Nothing selected")).not.toBeInTheDocument()}},l={beforeEach:()=>(a.toggle({kind:"user",id:"00uFAKE0001",name:"Dana Example"}),a.toggle({kind:"group",id:"00gFAKE0001",name:"Payments Team"}),a.toggle({kind:"rule",id:"00rFAKE0001",name:"Contractors"}),a.toggle({kind:"policy",id:"00pFAKE0001",name:"MFA Enrollment"}),()=>a.clearAll()),play:async({canvasElement:n})=>{const e=o(n);await t(e.getByText("1 user selected")).toBeInTheDocument(),await t(e.getByText("1 group selected")).toBeInTheDocument(),await t(e.getByText("1 rule selected")).toBeInTheDocument(),await t(e.getByText("1 policy selected")).toBeInTheDocument()}},m={beforeEach:()=>{for(let n=0;n<40;n+=1)a.toggle({kind:"user",id:`00uFAKE${String(n).padStart(4,"0")}`,name:`User ${n}`});return()=>a.clearAll()},play:async({canvasElement:n})=>{const e=o(n);await t(e.getByText("40 users selected")).toBeInTheDocument(),await s.click(e.getByRole("button",{name:"Remove User 0 from the selection"})),await t(e.getByText("39 users selected")).toBeInTheDocument(),await t(e.queryByText("User 0")).not.toBeInTheDocument(),await t(e.getByText("User 1")).toBeInTheDocument()}},p={beforeEach:()=>(a.toggle({kind:"user",id:"00uFAKE0001",name:"Dana Example"}),a.toggle({kind:"group",id:"00gFAKE0001",name:"Payments Team"}),()=>a.clearAll()),play:async({canvasElement:n})=>{const e=o(n);await s.click(e.getByRole("button",{name:"Clear users"})),await t(e.getByText("1 user selected")).toBeInTheDocument();const c=o(e.getByRole("dialog",{name:"Clear selected user?"}));await t(c.getByText("Clear 1 selected user? This cannot be undone.")).toBeInTheDocument(),await s.click(c.getByRole("button",{name:"Cancel"})),await t(e.queryByRole("dialog")).not.toBeInTheDocument(),await t(e.getByText("1 user selected")).toBeInTheDocument(),await s.click(e.getByRole("button",{name:"Clear users"})),await s.click(e.getByRole("button",{name:"Clear"})),await t(e.queryByText(/users? selected/)).not.toBeInTheDocument(),await t(e.getByText("1 group selected")).toBeInTheDocument()}},u={beforeEach:()=>(a.toggle({kind:"user",id:"00uFAKE0001",name:"Dana Example"}),a.toggle({kind:"user",id:"00uFAKE0002",name:"Rowan Example"}),a.toggle({kind:"user",id:"00uFAKE0003",name:"Marlow Example"}),()=>a.clearAll()),play:async({canvasElement:n})=>{const e=o(n);await t(e.getByText("3 users selected")).toBeInTheDocument(),await s.type(e.getByRole("searchbox",{name:"Search the selection and saved collections"}),"dana"),await t(e.getByText("3 users selected")).toBeInTheDocument(),await t(e.getByText("Showing 1 of 3.")).toBeInTheDocument(),await t(e.getByText("Dana Example")).toBeInTheDocument(),await t(e.queryByText("Rowan Example")).not.toBeInTheDocument()}},d={beforeEach:()=>(a.toggle({kind:"group",id:"00gFAKE0001",name:"Payments Team"}),()=>a.clearAll()),play:async({canvasElement:n})=>{const e=o(n);await s.type(e.getByRole("searchbox",{name:"Search the selection and saved collections"}),"zzz"),await t(e.getByText("1 group selected")).toBeInTheDocument(),await t(e.getByText('No groups match "zzz".')).toBeInTheDocument()}},g={beforeEach:()=>(a.toggle({kind:"user",id:"00uFAKE0001",name:"Dana Example"}),a.toggle({kind:"group",id:"00gFAKE0001",name:"Payments Team"}),()=>a.clearAll()),play:async({canvasElement:n})=>{const e=o(n),c=o(e.getByRole("tablist",{name:"Selection sections"}));for(const B of["Selection","Actions","Reports","Collections"])await t(c.getByRole("tab",{name:new RegExp(`^${B}`)})).toBeInTheDocument();await t(e.getByText("1 user selected")).toBeInTheDocument(),await s.click(c.getByRole("tab",{name:/^Actions/})),await t(e.getByRole("tabpanel",{name:"Actions"})).toBeInTheDocument(),await t(e.queryByText("1 user selected")).not.toBeInTheDocument(),await s.click(c.getByRole("tab",{name:/^Reports/})),await t(e.getByRole("tabpanel",{name:"Reports"})).toBeInTheDocument(),await s.click(c.getByRole("tab",{name:/^Collections/})),await t(e.getByRole("tabpanel",{name:"Collections"})).toBeInTheDocument(),await t(e.getByText("No saved collections")).toBeInTheDocument(),await s.click(c.getByRole("tab",{name:/^Selection/})),await t(e.getByText("1 user selected")).toBeInTheDocument(),await t(e.getByText("1 group selected")).toBeInTheDocument()}},h={play:async({canvasElement:n})=>{const e=o(n),c=o(e.getByRole("tablist",{name:"Selection sections"}));await t(c.getAllByRole("tab")).toHaveLength(4),await t(e.getByText("Nothing selected")).toBeInTheDocument()}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Nothing selected')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: 'More'
    })).not.toBeInTheDocument();
  }
}`,...r.parameters?.docs?.source},description:{story:"Nothing ticked anywhere in the panel — the empty state names how selection works.",...r.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  beforeEach: () => {
    selectionStore.toggle({
      kind: 'user',
      id: '00uFAKE0001',
      name: 'Dana Example'
    });
    selectionStore.toggle({
      kind: 'user',
      id: '00uFAKE0002',
      name: 'Rowan Example'
    });
    return () => selectionStore.clearAll();
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('2 users selected')).toBeInTheDocument();
    await expect(canvas.getByText('Dana Example')).toBeInTheDocument();
    await expect(canvas.getByText('Rowan Example')).toBeInTheDocument();
    await expect(canvas.queryByText('Nothing selected')).not.toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"One kind ticked — a single section, and the whole-basket strip is live.",...i.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  beforeEach: () => {
    selectionStore.toggle({
      kind: 'user',
      id: '00uFAKE0001',
      name: 'Dana Example'
    });
    selectionStore.toggle({
      kind: 'group',
      id: '00gFAKE0001',
      name: 'Payments Team'
    });
    selectionStore.toggle({
      kind: 'rule',
      id: '00rFAKE0001',
      name: 'Contractors'
    });
    selectionStore.toggle({
      kind: 'policy',
      id: '00pFAKE0001',
      name: 'MFA Enrollment'
    });
    return () => selectionStore.clearAll();
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('1 user selected')).toBeInTheDocument();
    await expect(canvas.getByText('1 group selected')).toBeInTheDocument();
    await expect(canvas.getByText('1 rule selected')).toBeInTheDocument();
    // The irregular plural is spelled correctly at any count, singular included.
    await expect(canvas.getByText('1 policy selected')).toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:"Several kinds ticked — one section per kind, in the stable declared order.",...l.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  beforeEach: () => {
    for (let i = 0; i < 40; i += 1) {
      selectionStore.toggle({
        kind: 'user',
        id: \`00uFAKE\${String(i).padStart(4, '0')}\`,
        name: \`User \${i}\`
      });
    }
    return () => selectionStore.clearAll();
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('40 users selected')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Remove User 0 from the selection'
    }));
    await expect(canvas.getByText('39 users selected')).toBeInTheDocument();
    await expect(canvas.queryByText('User 0')).not.toBeInTheDocument();
    await expect(canvas.getByText('User 1')).toBeInTheDocument();
  }
}`,...m.parameters?.docs?.source},description:{story:`A large single partition — the count is stated in full (no rounding, no
hedge), and removing one row leaves the rest untouched.`,...m.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  beforeEach: () => {
    selectionStore.toggle({
      kind: 'user',
      id: '00uFAKE0001',
      name: 'Dana Example'
    });
    selectionStore.toggle({
      kind: 'group',
      id: '00gFAKE0001',
      name: 'Payments Team'
    });
    return () => selectionStore.clearAll();
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Pressing \`Clear\` arms the confirm — the partition is untouched so far.
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear users'
    }));
    await expect(canvas.getByText('1 user selected')).toBeInTheDocument();
    const dialog = within(canvas.getByRole('dialog', {
      name: 'Clear selected user?'
    }));
    await expect(dialog.getByText('Clear 1 selected user? This cannot be undone.')).toBeInTheDocument();

    // Cancel leaves the partition exactly as it was.
    await userEvent.click(dialog.getByRole('button', {
      name: 'Cancel'
    }));
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
    await expect(canvas.getByText('1 user selected')).toBeInTheDocument();

    // Arming it again and confirming is what actually empties the partition.
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear users'
    }));
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear'
    }));
    await expect(canvas.queryByText(/users? selected/)).not.toBeInTheDocument();
    await expect(canvas.getByText('1 group selected')).toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:"The partition's own `Clear` button asks first: pressing it does not empty\nthe partition, and Cancel leaves it untouched. Only confirming does — the\nassertion that would actually catch a regression back to the ungated verb.",...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  beforeEach: () => {
    selectionStore.toggle({
      kind: 'user',
      id: '00uFAKE0001',
      name: 'Dana Example'
    });
    selectionStore.toggle({
      kind: 'user',
      id: '00uFAKE0002',
      name: 'Rowan Example'
    });
    selectionStore.toggle({
      kind: 'user',
      id: '00uFAKE0003',
      name: 'Marlow Example'
    });
    return () => selectionStore.clearAll();
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('3 users selected')).toBeInTheDocument();
    await userEvent.type(canvas.getByRole('searchbox', {
      name: 'Search the selection and saved collections'
    }), 'dana');

    // The claim is unchanged; only the listing narrowed.
    await expect(canvas.getByText('3 users selected')).toBeInTheDocument();
    await expect(canvas.getByText('Showing 1 of 3.')).toBeInTheDocument();
    await expect(canvas.getByText('Dana Example')).toBeInTheDocument();
    await expect(canvas.queryByText('Rowan Example')).not.toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:`A filter narrows what is listed and never what is claimed.

The section title keeps stating the real partition count while a \`Showing N
of M\` line reports the filtered one. A title that quietly became the filtered
count would be exactly the confidently-wrong number \`docs/claims.md\` forbids —
and this is the assertion that would catch a regression to it.`,...u.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  beforeEach: () => {
    selectionStore.toggle({
      kind: 'group',
      id: '00gFAKE0001',
      name: 'Payments Team'
    });
    return () => selectionStore.clearAll();
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox', {
      name: 'Search the selection and saved collections'
    }), 'zzz');
    await expect(canvas.getByText('1 group selected')).toBeInTheDocument();
    await expect(canvas.getByText('No groups match "zzz".')).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"A filter matching nothing states the absence rather than emptying the section silently.",...d.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  beforeEach: () => {
    selectionStore.toggle({
      kind: 'user',
      id: '00uFAKE0001',
      name: 'Dana Example'
    });
    selectionStore.toggle({
      kind: 'group',
      id: '00gFAKE0001',
      name: 'Payments Team'
    });
    return () => selectionStore.clearAll();
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const strip = within(canvas.getByRole('tablist', {
      name: 'Selection sections'
    }));

    // All four seats are present whether or not they hold anything.
    for (const name of ['Selection', 'Actions', 'Reports', 'Collections']) {
      await expect(strip.getByRole('tab', {
        name: new RegExp(\`^\${name}\`)
      })).toBeInTheDocument();
    }

    // The roster is the pane that opens.
    await expect(canvas.getByText('1 user selected')).toBeInTheDocument();

    // Which verbs a pane holds is the registry's business and changes as verbs
    // land; that the strip swaps one pane for another is this story's.
    await userEvent.click(strip.getByRole('tab', {
      name: /^Actions/
    }));
    await expect(canvas.getByRole('tabpanel', {
      name: 'Actions'
    })).toBeInTheDocument();
    await expect(canvas.queryByText('1 user selected')).not.toBeInTheDocument();
    await userEvent.click(strip.getByRole('tab', {
      name: /^Reports/
    }));
    await expect(canvas.getByRole('tabpanel', {
      name: 'Reports'
    })).toBeInTheDocument();
    await userEvent.click(strip.getByRole('tab', {
      name: /^Collections/
    }));
    await expect(canvas.getByRole('tabpanel', {
      name: 'Collections'
    })).toBeInTheDocument();
    await expect(canvas.getByText('No saved collections')).toBeInTheDocument();

    // And back — the basket was never touched by the trip.
    await userEvent.click(strip.getByRole('tab', {
      name: /^Selection/
    }));
    await expect(canvas.getByText('1 user selected')).toBeInTheDocument();
    await expect(canvas.getByText('1 group selected')).toBeInTheDocument();
  }
}`,...g.parameters?.docs?.source},description:{story:`The pane strip: four seats, always all four, and a count badged only where
there is something to badge. Switching panes swaps the body and nothing else.`,...g.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const strip = within(canvas.getByRole('tablist', {
      name: 'Selection sections'
    }));
    await expect(strip.getAllByRole('tab')).toHaveLength(4);
    await expect(canvas.getByText('Nothing selected')).toBeInTheDocument();
  }
}`,...h.parameters?.docs?.source},description:{story:`An empty basket still shows all four seats. The Selection pane names how
selection works; nothing claims a count it does not have.`,...h.parameters?.docs?.description}}};const pe=["EmptyBasket","OneKind","MixedKinds","LargePartition","ConfirmClearPartition","FilterKeepsTheCountHonest","FilterMatchingNothingSaysSo","PaneStrip","EmptyBasketKeepsThePanes"];export{p as ConfirmClearPartition,r as EmptyBasket,h as EmptyBasketKeepsThePanes,u as FilterKeepsTheCountHonest,d as FilterMatchingNothingSaysSo,m as LargePartition,l as MixedKinds,i as OneKind,g as PaneStrip,pe as __namedExportsOrder,me as default};
