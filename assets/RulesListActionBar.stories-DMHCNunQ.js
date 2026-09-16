import{j as R}from"./iframe-tAvKsVeF.js";import{R as T}from"./RulesListActionBar-BDM6rflF.js";import{R as x}from"./RulesSearchRow-Dfi82CYt.js";import"./preload-helper-PPVm8Dsz.js";const{expect:n,fn:w,userEvent:D,within:a}=__STORYBOOK_MODULE_TEST__,G={title:"Rules/RulesListActionBar",component:T,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"The verb strip for the rules-list rung: the three analysis surfaces are panels this bar toggles, and the search row rides beneath it as the `subRow`. **Export rules** holds `primary`; no verb here fetches, and a host that leaves the export unwired gets no `primary` at all.\n\nNo verb is ever shipped without an object — no duplicate clusters means no *Duplicates*, no loaded rules means no *Stats*. *This group* is gated on a **detected group** rather than on the relation count, because “no loaded rule assigns users to this group” is itself a finding."}}},args:{hasRules:!0,duplicateClusterCount:3,hasCurrentGroup:!0,currentGroupRelationCount:2,activePanel:"none",onTogglePanel:w(),onExportRules:w(),search:R.jsx(x,{searchQuery:"",onSearchChange:w(),filtersOpen:!1,onToggleFilters:w(),activeFilterCount:0})},argTypes:{hasRules:{description:"Whether any rules are loaded — gates Stats."},duplicateClusterCount:{description:"Duplicate-condition clusters found. 0 omits the verb."},hasCurrentGroup:{description:"Whether a group is detected — what This group acts on."},currentGroupRelationCount:{description:"Distinct related rules. Rides the label above 0."},activePanel:{description:"Which panel is open; its trigger says Hide … and is pinned."},onTogglePanel:{description:"Toggles the given panel open/closed."},onExportRules:{description:"Opens the Export tab. This rung's `primary` when wired."},search:{description:"The rung's search row, rendered inside the band beneath the verbs."}}},o=async t=>{const e=t.queryByRole("button",{name:"More"});e&&e.getAttribute("aria-expanded")!=="true"&&await D.click(e)},E=t=>{const v=a(t).queryByRole("button",{name:"More"})?.getAttribute("aria-controls");return v?t.ownerDocument.getElementById(v):null},b=async t=>{await n(t.queryByRole("button",{name:/refresh/i})).not.toBeInTheDocument(),await n(t.queryByRole("button",{name:/^load/i})).not.toBeInTheDocument()},s={play:async({canvasElement:t})=>{const e=a(t);await n(e.getByRole("button",{name:"Export rules"})).toBeInTheDocument(),await b(e)}},r={play:async({canvasElement:t})=>{const e=a(t);await o(e);const v=e.getByRole("button",{name:"Export rules"}),B=E(t);await n(B).not.toBeNull(),await n(B?.contains(e.getByRole("button",{name:/^Duplicates/}))).toBe(!0),await n(B?.contains(v)).toBe(!1),await b(e)}},c={args:{hasRules:!1,duplicateClusterCount:0,hasCurrentGroup:!1,currentGroupRelationCount:0,search:void 0},play:async({canvasElement:t})=>{const e=a(t);await n(e.getByRole("button",{name:"Export rules"})).toBeInTheDocument(),await b(e),await n(e.queryByRole("button",{name:"More"})).not.toBeInTheDocument(),await n(e.queryByRole("button",{name:/^Stats/})).not.toBeInTheDocument(),await n(e.queryByRole("button",{name:/^Duplicates/})).not.toBeInTheDocument()}},i={args:{hasRules:!1,duplicateClusterCount:0,currentGroupRelationCount:0,search:void 0},play:async({canvasElement:t})=>{const e=a(t);await o(e),await n(e.getByRole("button",{name:"This group"})).toBeInTheDocument(),await n(e.queryByRole("button",{name:/^Stats/})).not.toBeInTheDocument()}},u={args:{activePanel:"duplicates"},play:async({canvasElement:t})=>{const e=a(t);await n(e.getByRole("button",{name:"Hide duplicates"})).toBeInTheDocument(),await o(e),await n(e.queryByRole("button",{name:/^Duplicates/})).not.toBeInTheDocument()}},p={args:{activePanel:"currentGroup"},play:async({canvasElement:t})=>{const e=a(t);await n(e.getByRole("button",{name:"Hide this group"})).toBeInTheDocument()}},l={args:{activePanel:"stats"}},d={args:{duplicateClusterCount:0},play:async({canvasElement:t})=>{const e=a(t);await o(e),await n(e.queryByRole("button",{name:/^Duplicates/})).not.toBeInTheDocument(),await n(e.getByRole("button",{name:/^This group/})).toBeInTheDocument()}},h={args:{currentGroupRelationCount:0},play:async({canvasElement:t})=>{const e=a(t);await o(e),await n(e.getByRole("button",{name:"This group"})).toBeInTheDocument()}},m={args:{hasCurrentGroup:!1,currentGroupRelationCount:0},play:async({canvasElement:t})=>{const e=a(t);await o(e),await n(e.queryByRole("button",{name:/This group/})).not.toBeInTheDocument(),await n(e.getByRole("button",{name:/^Duplicates/})).toBeInTheDocument()}},y={args:{onExportRules:void 0},play:async({canvasElement:t})=>{const e=a(t);await n(e.queryByRole("button",{name:"Export rules"})).not.toBeInTheDocument(),await o(e),await b(e),await n(e.getByRole("button",{name:/^Duplicates/})).toBeInTheDocument()}},g={parameters:{viewport:{value:"sidepanelCompact"}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Export rules'
    })).toBeInTheDocument();
    await expectNoFetchVerb(canvas);
  }
}`,...s.parameters?.docs?.source},description:{story:"The loaded rung: **Export rules** is the row's one verb, and the three analysis verbs rest behind **More**.",...s.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await openTier(canvas);
    const exportVerb = canvas.getByRole('button', {
      name: 'Export rules'
    });
    const tier = tierRegion(canvasElement);
    await expect(tier).not.toBeNull();
    // The panel toggles really are in the tier, so the export's absence from it below
    // is a placement fact and not an empty-tier vacuity.
    await expect(tier?.contains(canvas.getByRole('button', {
      name: /^Duplicates/
    }))).toBe(true);
    await expect(tier?.contains(exportVerb)).toBe(false);
    await expectNoFetchVerb(canvas);
  }
}`,...r.parameters?.docs?.source},description:{story:`Two structural claims: the export is pinned to the row even with the tier open,
and no verb on this rung fetches in any state.`,...r.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    hasRules: false,
    duplicateClusterCount: 0,
    hasCurrentGroup: false,
    currentGroupRelationCount: 0,
    search: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Export rules'
    })).toBeInTheDocument();
    await expectNoFetchVerb(canvas);
    // No tier at all: with every panel verb omitted there is nothing to disclose.
    await expect(canvas.queryByRole('button', {
      name: 'More'
    })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: /^Stats/
    })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: /^Duplicates/
    })).not.toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"Nothing loaded and no group in context: every panel toggle is gone, so the strip is\nthe export and nothing else, with no tier at all. The initial load lives in\n`RulesListPanel`'s empty state, not here.",...c.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    hasRules: false,
    duplicateClusterCount: 0,
    currentGroupRelationCount: 0,
    search: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await openTier(canvas);
    await expect(canvas.getByRole('button', {
      name: 'This group'
    })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: /^Stats/
    })).not.toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source},description:{story:`Nothing loaded, but a group is detected: *This group* is offered before a rule is
fetched, while *Stats* — whose object is the loaded rules — is omitted.`,...i.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    activePanel: 'duplicates'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // Pinned into the row while open, so the control that closes the panel can never be
    // the thing hiding behind More.
    await expect(canvas.getByRole('button', {
      name: 'Hide duplicates'
    })).toBeInTheDocument();
    await openTier(canvas);
    await expect(canvas.queryByRole('button', {
      name: /^Duplicates/
    })).not.toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:"Opening a panel changes what the control says, and pins the closer into the row.",...u.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    activePanel: 'currentGroup'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Hide this group'
    })).toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:"The current-group panel open, with its own label swap.",...p.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    activePanel: 'stats'
  }
}`,...l.parameters?.docs?.source},description:{story:"The stats panel open.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    duplicateClusterCount: 0
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await openTier(canvas);
    await expect(canvas.queryByRole('button', {
      name: /^Duplicates/
    })).not.toBeInTheDocument();
    // The sibling verbs are still there — proving the tier really did open, so the
    // absence above is an absence and not a closed disclosure.
    await expect(canvas.getByRole('button', {
      name: /^This group/
    })).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"No duplicates found: *Duplicates* is omitted, not disabled.",...d.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    currentGroupRelationCount: 0
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await openTier(canvas);
    await expect(canvas.getByRole('button', {
      name: 'This group'
    })).toBeInTheDocument();
  }
}`,...h.parameters?.docs?.source},description:{story:"A group is in context but nothing relates to it: the verb stays, uncounted, because that is itself a finding.",...h.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    hasCurrentGroup: false,
    currentGroupRelationCount: 0
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await openTier(canvas);
    await expect(canvas.queryByRole('button', {
      name: /This group/
    })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: /^Duplicates/
    })).toBeInTheDocument();
  }
}`,...m.parameters?.docs?.source},description:{story:"No group detected — the question has no subject, so the verb is gone.",...m.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    onExportRules: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', {
      name: 'Export rules'
    })).not.toBeInTheDocument();
    await openTier(canvas);
    await expectNoFetchVerb(canvas);
    await expect(canvas.getByRole('button', {
      name: /^Duplicates/
    })).toBeInTheDocument();
  }
}`,...y.parameters?.docs?.source},description:{story:"Export not wired by the host: the descriptor is omitted rather than shipped dead, and\nthe rung carries no `primary` at all rather than promoting something to fill the slot.",...y.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...g.parameters?.docs?.source},description:{story:"At the narrow end of the panel's drag range, where the fit ladder actually runs.",...g.parameters?.docs?.description}}};const N=["Default","TheRungsPrimaryIsItsExport","NothingLoaded","NothingLoadedWithGroupInContext","TheOpenPanelSaysSo","CurrentGroupPanelOpen","StatsPanelOpen","NoDuplicates","CurrentGroupWithNoRelations","NoCurrentGroup","WithoutExport","AtPanelWidth"];export{g as AtPanelWidth,p as CurrentGroupPanelOpen,h as CurrentGroupWithNoRelations,s as Default,m as NoCurrentGroup,d as NoDuplicates,c as NothingLoaded,i as NothingLoadedWithGroupInContext,l as StatsPanelOpen,u as TheOpenPanelSaysSo,r as TheRungsPrimaryIsItsExport,y as WithoutExport,N as __namedExportsOrder,G as default};
