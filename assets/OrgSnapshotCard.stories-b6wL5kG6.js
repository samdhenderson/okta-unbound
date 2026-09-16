import{O as A}from"./OrgSnapshotCard-FNNmwykZ.js";import{b as R,a as I,c as D}from"./orgFigures-Cf-XQIgx.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./dateFormat-tpkRVL7u.js";const{expect:n,fn:B,userEvent:T,within:o}=__STORYBOOK_MODULE_TEST__,k=Date.now(),a=(t={})=>({isReading:!1,complete:!0,lastFullWalkAt:k-1200*1e3,count:0,error:null,...t}),O={paused:0,emptyUnfilled:0},s=(t,e,r=O)=>{const l={source:t,noun:"groups"},x={source:e,noun:"group rules"};return[R(D("rules","Group rules","bolt",e),"rules","group rules",[I({key:"rules-paused",label:"Group rules paused",icon:"pause",counted:x,count:r.paused,request:{tab:"rules",view:"paused"}})]),R(D("groups","Groups","users",t),"groups","groups",[I({key:"groups-empty-unfilled",label:"Groups with no members that no rule fills",icon:"users",counted:l,gates:[x],count:r.emptyUnfilled,request:{tab:"groups",view:"empty-no-rules"}})])]},F={title:"Home/OrgSnapshotCard",component:A,tags:["autodocs"],parameters:{layout:"fullscreen",a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:`What is worth fixing in this org, as a findings list two rows long. Each row is one actionable count — *4 group rules paused* — and pressing it opens that tab with the matching filter applied; the collection totals sit underneath as a caption. Everything is read from the background-owned org snapshot, so a warm org renders the whole card at zero requests.

A figure is a number **only** when its collection’s last walk finished. Anything else gets its own copy — a skeleton while reading, a floor when the walk was interrupted, an em dash and a sentence naming the missing read when nothing was read — and only a finished figure is ever a control. The footnote quotes the **oldest** walk behind the card, and says so rather than guessing when any collection is unwalked.`}}},argTypes:{boxes:{description:"One entry per collection: its total, and the findings drawn from it."},readAt:{description:"Oldest finished walk, or null when there is none."},onRefresh:{description:"Force a full walk of every collection behind the card."},canRefresh:{description:"False with no connected Okta tab."},onOpenTab:{description:"Open a tab unfiltered — what a total in the caption does."},onOpenListView:{description:"Open a tab filtered — what a finding does."}},args:{onRefresh:B(),onOpenTab:B(),onOpenListView:B(),isRefreshing:!1,canRefresh:!0,readAt:k-1200*1e3,boxes:s(a({count:412}),a({count:38}),{paused:4,emptyUnfilled:31})}},c={play:async({canvasElement:t})=>{const e=o(t);await n(e.getByRole("button",{name:"Group rules paused — 4"})).toBeInTheDocument(),await n(e.getByRole("button",{name:"Groups with no members that no rule fills — 31"})).toBeInTheDocument(),await n(e.getByText(/Counts as Okta reports them/)).toBeInTheDocument()}},i={args:{boxes:s(a(),a())},play:async({canvasElement:t})=>{const e=o(t);await n(e.getAllByText("0")).toHaveLength(2),await n(e.queryByRole("button",{name:/Group rules paused/})).not.toBeInTheDocument()}},u={args:{boxes:s(a({count:1}),a({count:1}),{paused:1,emptyUnfilled:1})},play:async({canvasElement:t})=>{const e=o(t);await n(e.getByText("of 1 group")).toBeInTheDocument(),await n(e.getByText("of 1 group rule")).toBeInTheDocument(),await n(e.queryByText(/of 1 \w+s\b/)).not.toBeInTheDocument()}},p={args:{readAt:null,boxes:s(a({isReading:!0}),a({isReading:!0}))},play:async({canvasElement:t})=>{const e=o(t);await n(e.getByRole("status",{name:"Reading Group rules paused"})).toBeVisible(),await n(e.queryByText("0")).not.toBeInTheDocument(),await n(e.queryByRole("button",{name:/paused/})).not.toBeInTheDocument()}},d={args:{readAt:null,boxes:s(a({complete:!1,lastFullWalkAt:null}),a({complete:!1,lastFullWalkAt:null}))},play:async({canvasElement:t})=>{const e=o(t);await n(e.getByText("Group rules have not been read yet.")).toBeInTheDocument(),await n(e.getByText(/No age stated/)).toBeInTheDocument(),await n(e.queryByText(/ago/)).not.toBeInTheDocument(),await n(e.queryByRole("button",{name:/groups$/})).not.toBeInTheDocument()}},m={args:{readAt:null,boxes:s(a({complete:!1,lastFullWalkAt:null}),a({complete:!1,lastFullWalkAt:null}))},play:async({canvasElement:t,args:e})=>{const l=o(t).getByText("Group rules paused").closest("li");await n(l).not.toBeNull(),await n(o(l).queryByRole("button")).not.toBeInTheDocument(),await T.click(l),await n(e.onOpenListView).not.toHaveBeenCalled()}},h={args:{boxes:s(a({count:120,complete:!1}),a({count:38}),{paused:4,emptyUnfilled:31})},play:async({canvasElement:t})=>{const e=o(t);await n(e.getByText("At least — the last read of groups did not finish.")).toBeInTheDocument(),await n(e.getByRole("button",{name:"Groups with no members that no rule fills — 31"})).toBeInTheDocument(),await n(e.getByRole("button",{name:"at least 120 groups"})).toBeInTheDocument()}},g={args:{readAt:null,boxes:s(a({count:412}),a({complete:!1,lastFullWalkAt:null}),{paused:0,emptyUnfilled:412})},play:async({canvasElement:t})=>{const e=o(t);await n(e.queryByText("412")).not.toBeInTheDocument(),await n(e.queryByRole("button",{name:/Groups with no members/})).not.toBeInTheDocument(),await n(e.getByText("Needs group rules, which have not been read.")).toBeInTheDocument()}},y={play:async({canvasElement:t,args:e})=>{const r=o(t);await T.click(r.getByRole("button",{name:"Groups with no members that no rule fills — 31"})),await n(e.onOpenListView).toHaveBeenCalledWith({tab:"groups",view:"empty-no-rules"})}},w={play:async({canvasElement:t,args:e})=>{const r=o(t);await T.click(r.getByRole("button",{name:"412 groups"})),await n(e.onOpenTab).toHaveBeenCalledWith("groups")}},b={args:{readAt:null,boxes:s(a({count:412}),a({complete:!1,lastFullWalkAt:null,error:"Failed to load from Okta"}),{paused:0,emptyUnfilled:0})},play:async({canvasElement:t})=>{const e=o(t);await n(e.getByText("Group rules have not been read yet.")).toBeInTheDocument(),await n(e.queryByText(/403/)).not.toBeInTheDocument()}},f={args:{isRefreshing:!0}},v={args:{canRefresh:!1}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Group rules paused — 4'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Groups with no members that no rule fills — 31'
    })).toBeInTheDocument();
    await expect(canvas.getByText(/Counts as Okta reports them/)).toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"A warm org: every number is exact, both rows are controls, and each announces its count in its name.",...c.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    boxes: boxes(read(), read())
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('0')).toHaveLength(2);
    await expect(canvas.queryByRole('button', {
      name: /Group rules paused/
    })).not.toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:"A genuinely empty org — the one legitimate zero. A walked `0` is an answer, so the row renders it, uncontrolled.",...i.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    boxes: boxes(read({
      count: 1
    }), read({
      count: 1
    }), {
      paused: 1,
      emptyUnfilled: 1
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('of 1 group')).toBeInTheDocument();
    await expect(canvas.getByText('of 1 group rule')).toBeInTheDocument();
    await expect(canvas.queryByText(/of 1 \\w+s\\b/)).not.toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:"An org with exactly one of everything: each finding's note agrees with its own number, singular included.",...u.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    readAt: null,
    boxes: boxes(read({
      isReading: true
    }), read({
      isReading: true
    }))
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status', {
      name: 'Reading Group rules paused'
    })).toBeVisible();
    await expect(canvas.queryByText('0')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: /paused/
    })).not.toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:"The first read is still in flight: skeleton lines and a placeholder holding the number slot's width. Never a zero.",...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    readAt: null,
    boxes: boxes(read({
      complete: false,
      lastFullWalkAt: null
    }), read({
      complete: false,
      lastFullWalkAt: null
    }))
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Group rules have not been read yet.')).toBeInTheDocument();
    // The card says why there is no age rather than going quiet — but it still
    // states none, which is what the rule is actually about. Nothing renders a
    // relative time, and the totals caption is absent entirely.
    await expect(canvas.getByText(/No age stated/)).toBeInTheDocument();
    await expect(canvas.queryByText(/ago/)).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: /groups$/
    })).not.toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:`A cold org, nothing walked yet: em dashes, a sentence per row naming the missing
read, and no age line. The rows stay, so "nothing to fix" and "nothing known"
never look identical.`,...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    readAt: null,
    boxes: boxes(read({
      complete: false,
      lastFullWalkAt: null
    }), read({
      complete: false,
      lastFullWalkAt: null
    }))
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByText('Group rules paused').closest('li');
    await expect(row).not.toBeNull();
    await expect(within(row as HTMLElement).queryByRole('button')).not.toBeInTheDocument();

    // Pressing where the control would have been does nothing at all.
    await userEvent.click(row as HTMLElement);
    await expect(args.onOpenListView).not.toHaveBeenCalled();
  }
}`,...m.parameters?.docs?.source},description:{story:"An unreadable finding offers nothing to press: no button, no chevron, only the sentence naming the missing read.",...m.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    boxes: boxes(read({
      count: 120,
      complete: false
    }), read({
      count: 38
    }), {
      paused: 4,
      emptyUnfilled: 31
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('At least — the last read of groups did not finish.')).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Groups with no members that no rule fills — 31'
    })).toBeInTheDocument();
    // The caption says it too, rather than quoting the floor as a total.
    await expect(canvas.getByRole('button', {
      name: 'at least 120 groups'
    })).toBeInTheDocument();
  }
}`,...h.parameters?.docs?.source},description:{story:'The group walk was interrupted, so the count survives as a floor that says "at least" — and stays a control.',...h.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    readAt: null,
    boxes: boxes(read({
      count: 412
    }), read({
      complete: false,
      lastFullWalkAt: null
    }), {
      paused: 0,
      emptyUnfilled: 412
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // The absence is the assertion: 412 must not appear as the unfilled count,
    // and the row must not be a control.
    await expect(canvas.queryByText('412')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: /Groups with no members/
    })).not.toBeInTheDocument();
    await expect(canvas.getByText('Needs group rules, which have not been read.')).toBeInTheDocument();
  }
}`,...g.parameters?.docs?.source},description:{story:`Groups walked cleanly and rules were never read, so row 2 states no number rather
than reporting all 412 groups as unfilled: an incomplete rule list corrupts that
answer instead of shortening it.`,...g.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Groups with no members that no rule fills — 31'
    }));
    await expect(args.onOpenListView).toHaveBeenCalledWith({
      tab: 'groups',
      view: 'empty-no-rules'
    });
  }
}`,...y.parameters?.docs?.source},description:{story:"Pressing a finding opens the filtered list it counted: the figure and its destination are one descriptor.",...y.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: '412 groups'
    }));
    await expect(args.onOpenTab).toHaveBeenCalledWith('groups');
  }
}`,...w.parameters?.docs?.source},description:{story:"The caption's totals open their tab unfiltered.",...w.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    readAt: null,
    boxes: boxes(read({
      count: 412
    }), read({
      complete: false,
      lastFullWalkAt: null,
      error: 'Failed to load from Okta'
    }), {
      paused: 0,
      emptyUnfilled: 0
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Group rules have not been read yet.')).toBeInTheDocument();
    await expect(canvas.queryByText(/403/)).not.toBeInTheDocument();
  }
}`,...b.parameters?.docs?.source},description:{story:"A read that failed with no status behind it: the copy says what is known and stops.",...b.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    isRefreshing: true
  }
}`,...f.parameters?.docs?.source},description:{story:"Refresh in flight — a real, forced walk. One control for the whole card, not\none per row: `syncSnapshot` is org-wide and coalesces concurrent callers, so a\nper-row refresh could not refresh only that row.",...f.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    canRefresh: false
  }
}`,...v.parameters?.docs?.source},description:{story:"No Okta tab connected: the stored figures still show, Refresh cannot run.",...v.parameters?.docs?.description}}};const C=["Warm","EmptyOrg","SingleItemOrg","Reading","NeverRead","UnavailableRowIsNotAControl","PartialWalk","CrossCollectionSuppressed","FindingOpensTheList","TotalOpensTheTab","ReadFailed","Refreshing","Disconnected"];export{g as CrossCollectionSuppressed,v as Disconnected,i as EmptyOrg,y as FindingOpensTheList,d as NeverRead,h as PartialWalk,b as ReadFailed,p as Reading,f as Refreshing,u as SingleItemOrg,w as TotalOpensTheTab,m as UnavailableRowIsNotAControl,c as Warm,C as __namedExportsOrder,F as default};
