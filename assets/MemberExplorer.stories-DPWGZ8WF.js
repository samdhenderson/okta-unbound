import{M as k}from"./MemberExplorer-CzoKVp7t.js";import{m as B}from"./fixtures-CsAiPaTu.js";import{s as f}from"./selectionStore-DExy1RDY.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./useDebouncedValue-gYL4cHMr.js";import"./useMemberMfaScan-BWVC8bU_.js";import"./useOktaApi.mock-bZSfZMMp.js";import"./entityCache-B8HCQ8hY.js";import"./keys-CUIcVywe.js";import"./useRungSelection-DALqsLn1.js";import"./useSelection-DlTpY3y-.js";import"./userDisplay-xpx41Abi.js";import"./MemberSearchBar-CN-EWnJT.js";import"./useMemberFilters-LFYkVxqR.js";import"./MemberFilterPanel-fb43Reif.js";import"./MfaScanButton-B10gRaS5.js";import"./MemberSourceFilterBar-Dx0w3ZXE.js";import"./AttributeFilterList-URvyoqeI.js";import"./memberAnalytics-BqndU7JT.js";import"./ActiveFilterChips-DX7-p1iN.js";import"./CopyMembersModal-D36olA9y.js";import"./BreakdownDetailsModal-BoybENQd.js";import"./BreakdownReport-RtX7G5yn.js";import"./MemberList-DciIOLLY.js";import"./useStaggerReveal-XqT17AGi.js";import"./MemberRow-Dl-pQSx-.js";import"./status-Bn0B6Ou-.js";import"./revealOnHover-DU3PDCIu.js";import"./MembershipRuleEvidence-B1QOrUY6.js";import"./ruleExpression-nPAdgj2W.js";import"./GroupMembershipsListProof-DQATbCdY.js";import"./sourceLine-CmzUZZG7.js";import"./membershipAnalysis-CAnarCAG.js";import"./provenance-C1K7H2p2.js";import"./membershipVerdict-79Na81vF.js";const{expect:a,fn:w,userEvent:r,within:h}=__STORYBOOK_MODULE_TEST__,v=new Map(B.map((e,t)=>[e.id,{userId:e.id,factors:[],enrolled:t%4!==0,factorCount:t%4===0?0:t%4+1,factorLabels:t%4===0?[]:["Okta Verify (Fastpass)"].concat(t%4>=2?["SMS"]:[])}])),oe={title:"Members/MemberExplorer",component:k,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"Orchestrator for in-group member search, faceting, MFA, and listing. One control band carries search, the filter-drawer trigger, the active filters as chips, and how much of the roster survived them; every other control lives in `MemberFilterDrawer`.\n\nIt owns the client-side state (debounced search, sort, the paged window), but MFA scan results belong to the caller, so the scan lifecycle is driven by props. Row checkboxes write to the panel-wide selection basket, and *Select all* replaces the basket's user partition with the **filtered** cohort — ids resolve against the full roster, and a batch the cap refuses adds nothing and says so."}}},beforeEach:()=>(f.clearAll(),()=>f.clearAll()),argTypes:{members:{description:"The group's full member set (the explorer filters/sorts locally)."},isReloading:{description:"True while the member set is being re-fetched behind the explorer; the list swaps to skeleton rows."},mfaResults:{description:"Per-member MFA scan results, or null before a scan has run."},scanStatus:{description:"Current MFA scan lifecycle status."},onRunScan:{description:"Start the MFA scan."},onRequestConfirm:{description:"Request the confirmation gate (used for large groups)."},onCancelConfirm:{description:"Dismiss the confirmation gate."},oktaOrigin:{description:"Okta org origin for member Admin Console links (null when unknown)."}},args:{members:B,isReloading:!1,mfaResults:null,scanStatus:"idle",onRunScan:w(),onRequestConfirm:w(),onCancelConfirm:w(),oktaOrigin:null}},o={},s={args:{scanStatus:"confirming"}},i={args:{scanStatus:"scanning"}},c={args:{mfaResults:v,scanStatus:"complete"}},l={args:{members:[]}},y=Array.from({length:30},(e,t)=>({id:`spread${t+1}`,status:"ACTIVE",profile:{login:`spread${t+1}@example.com`,email:`spread${t+1}@example.com`,firstName:`First${t+1}`,lastName:`Last${t+1}`,department:["Engineering","Support","Finance"][t%3],title:t%2===0?"Manager":"Individual Contributor"}})),p={args:{members:y},play:async({canvas:e,canvasElement:t})=>{const n=e.getByRole("button",{name:"Filters"});await a(n).toHaveAttribute("aria-expanded","false"),await r.click(n),await a(n).toHaveAttribute("aria-expanded","true"),await r.click(e.getByRole("button",{name:"Department: choose a value to filter by"}));const b=await h(t.ownerDocument.body).findByRole("dialog");await r.click(h(b).getByText("Support")),await a(e.getByText("Department: Support")).toBeVisible(),await a(e.getByText("10 of 30")).toBeVisible()}},m={args:{members:y},play:async({canvas:e,canvasElement:t})=>{await r.click(e.getByRole("button",{name:"Filters"})),await r.click(e.getByRole("button",{name:"Department: choose a value to filter by"}));const n=await h(t.ownerDocument.body).findByRole("dialog");await r.click(h(n).getByText("Support")),await r.click(h(n).getByRole("button",{name:"Done"})),await r.click(e.getByRole("button",{name:"Filters, 1 applied"})),await r.click(e.getByRole("button",{name:"Remove Department: Support filter"})),await a(e.queryByText("Department: Support")).toBeNull(),await a(e.getByText("30 of 30")).toBeVisible()}},d={args:{members:y},play:async({canvas:e,canvasElement:t})=>{const n=e.getByRole("button",{name:"Filters"}),b=t.ownerDocument.getElementById(n.getAttribute("aria-controls"));await a(b).toHaveAttribute("inert"),await r.click(n),await a(b).not.toHaveAttribute("inert")}},u={args:{members:y},play:async({canvas:e})=>{await r.type(e.getByRole("searchbox"),"spread7@"),await a(await e.findByText("1 of 30")).toBeVisible(),await r.click(e.getByRole("button",{name:"Select all"})),await a(e.getByRole("checkbox",{name:"Select First7 Last7"})).toBeChecked(),await r.click(e.getByRole("button",{name:"Clear search"})),await a(await e.findByText("30 of 30")).toBeVisible(),await a(e.getByRole("checkbox",{name:"Select First7 Last7"})).toBeChecked(),await a(e.getByRole("checkbox",{name:"Select First1 Last1"})).not.toBeChecked()}},g={args:{members:y},play:async({canvas:e})=>{await a(e.queryByRole("button",{name:"Deselect all"})).toBeNull(),await r.click(e.getByRole("checkbox",{name:"Select First1 Last1"}));const t=await e.findByRole("button",{name:"Deselect all"});await a(t).toHaveAttribute("title","Clear every selected user, including any picked on another screen"),await r.click(t),await a(e.getByRole("checkbox",{name:"Select First1 Last1"})).not.toBeChecked(),await a(e.queryByRole("button",{name:"Deselect all"})).toBeNull()}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:"{}",...o.parameters?.docs?.source},description:{story:"No MFA scan yet run: search, composition, and the member list are all live.",...o.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    scanStatus: 'confirming'
  }
}`,...s.parameters?.docs?.source},description:{story:"Confirmation gate shown before scanning a large group.",...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    scanStatus: 'scanning'
  }
}`,...i.parameters?.docs?.source},description:{story:"MFA scan in progress.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    mfaResults,
    scanStatus: 'complete'
  }
}`,...c.parameters?.docs?.source},description:{story:"MFA scan complete: the drawer's factor filters and per-member factor tags are live.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    members: []
  }
}`,...l.parameters?.docs?.source},description:{story:"An empty group renders the explorer's empty state throughout.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    members: spreadMembers
  },
  play: async ({
    canvas,
    canvasElement
  }) => {
    const trigger = canvas.getByRole('button', {
      name: 'Filters'
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Department: choose a value to filter by'
    }));
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await userEvent.click(within(dialog).getByText('Support'));
    await expect(canvas.getByText('Department: Support')).toBeVisible();
    await expect(canvas.getByText('10 of 30')).toBeVisible();
  }
}`,...p.parameters?.docs?.source},description:{story:"The drawer end to end: open it, pick an attribute, pick a value, and the filter arrives as a chip on the visible line.",...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    members: spreadMembers
  },
  play: async ({
    canvas,
    canvasElement
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: 'Filters'
    }));
    await userEvent.click(canvas.getByRole('button', {
      name: 'Department: choose a value to filter by'
    }));
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await userEvent.click(within(dialog).getByText('Support'));
    await userEvent.click(within(dialog).getByRole('button', {
      name: 'Done'
    }));

    // Close the drawer: the chip is on the line above it, not inside it.
    await userEvent.click(canvas.getByRole('button', {
      name: 'Filters, 1 applied'
    }));
    await userEvent.click(canvas.getByRole('button', {
      name: 'Remove Department: Support filter'
    }));
    await expect(canvas.queryByText('Department: Support')).toBeNull();
    await expect(canvas.getByText('30 of 30')).toBeVisible();
  }
}`,...m.parameters?.docs?.source},description:{story:"The chip sits on the visible line, names the filter it drops, and removes it without reopening the drawer.",...m.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    members: spreadMembers
  },
  play: async ({
    canvas,
    canvasElement
  }) => {
    const trigger = canvas.getByRole('button', {
      name: 'Filters'
    });
    const region = canvasElement.ownerDocument.getElementById(trigger.getAttribute('aria-controls') as string);
    await expect(region).toHaveAttribute('inert');
    await userEvent.click(trigger);
    await expect(region).not.toHaveAttribute('inert');
  }
}`,...d.parameters?.docs?.source},description:{story:"Closed, the drawer's controls are `inert` while staying mounted, so the panel\nkeeps its state across an open/close. This asserts the DOM contract only.",...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    members: spreadMembers
  },
  play: async ({
    canvas
  }) => {
    await userEvent.type(canvas.getByRole('searchbox'), 'spread7@');
    await expect(await canvas.findByText('1 of 30')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Select all'
    }));
    await expect(canvas.getByRole('checkbox', {
      name: 'Select First7 Last7'
    })).toBeChecked();

    // Widen the filter all the way back out: the pick is still there, and it is
    // still the only one.
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear search'
    }));
    await expect(await canvas.findByText('30 of 30')).toBeVisible();
    await expect(canvas.getByRole('checkbox', {
      name: 'Select First7 Last7'
    })).toBeChecked();
    await expect(canvas.getByRole('checkbox', {
      name: 'Select First1 Last1'
    })).not.toBeChecked();
  }
}`,...u.parameters?.docs?.source},description:{story:`Select-all acts on the **filtered** cohort, and the pick then outlives the
filter that produced it.

The two lists are deliberately different: \`Select all\` is handed the ids the
filters left on screen, while \`useRungSelection\` resolves those ids against the
group's full roster. Widening the filter back out therefore leaves the pick
standing — which is the whole reason the basket is keyed by entity rather than
owned by the list drawing it.`,...u.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    members: spreadMembers
  },
  play: async ({
    canvas
  }) => {
    await expect(canvas.queryByRole('button', {
      name: 'Deselect all'
    })).toBeNull();
    await userEvent.click(canvas.getByRole('checkbox', {
      name: 'Select First1 Last1'
    }));
    const deselect = await canvas.findByRole('button', {
      name: 'Deselect all'
    });
    await expect(deselect).toHaveAttribute('title', 'Clear every selected user, including any picked on another screen');
    await userEvent.click(deselect);
    await expect(canvas.getByRole('checkbox', {
      name: 'Select First1 Last1'
    })).not.toBeChecked();
    await expect(canvas.queryByRole('button', {
      name: 'Deselect all'
    })).toBeNull();
  }
}`,...g.parameters?.docs?.source},description:{story:"`Deselect all` appears only once something is ticked — a verb with nothing to\nact on is not a verb yet — and it empties the basket's whole user partition,\nwhich its `title` says out loud because members ticked on another screen go\nwith it.",...g.parameters?.docs?.description}}};const se=["Default","ConfirmingScan","Scanning","ScanComplete","Empty","PickAValueThroughTheDrawer","ChipRemovesTheFilterWithoutTheDrawer","ClosedDrawerIsInert","SelectAllTakesTheFilteredSet","DeselectAllAppearsWithTheSelection"];export{m as ChipRemovesTheFilterWithoutTheDrawer,d as ClosedDrawerIsInert,s as ConfirmingScan,o as Default,g as DeselectAllAppearsWithTheSelection,l as Empty,p as PickAValueThroughTheDrawer,c as ScanComplete,i as Scanning,u as SelectAllTakesTheFilteredSet,se as __namedExportsOrder,oe as default};
