import{j as e,D as a,a as F,B as w,Q as C,t as d,d as E,F as S}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:i,fn:t,userEvent:j,within:B}=__STORYBOOK_MODULE_TEST__,T={title:"Shared/DetailSection",component:a,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"White card wrapper for one section of a detail view — eyebrow heading, optional explanation, optional header slot, body. Elevation comes from the 1px border alone, per the Odyssey surface model.\n\n`title` is optional: omit it when the surrounding tab already names the content. `actions` takes a verb scoped to this section's data — a verb whose object is the whole page belongs in `ActionBar`. `band` is a full-bleed slot for filter chrome, and `summary` is the headline fact a folded section states in place of its body."}}},argTypes:{title:{description:"Section heading, rendered as an uppercase eyebrow `<h2>`."},band:{description:"Full-bleed band above the body, for a section's filter chrome."},description:{description:"Optional one-line explanation under the heading."},actions:{description:"Right-aligned header node. Section-scoped verbs only."},headingId:{description:"Id for the heading, for a body region's `aria-labelledby`."},collapsible:{description:"Fold the body behind the heading. Requires `title`; the body stays mounted."},defaultOpen:{description:"Whether a `collapsible` section starts expanded. Defaults to `true`."},itemCount:{description:"Optional count rendered as a badge beside the title."},summary:{description:"The section's headline fact, shown only while it is closed."},children:{description:"Section body."}},args:{title:"App push",children:e.jsx("p",{className:"text-sm text-neutral-600",children:"No push mappings for this group."})}},p={},m={args:{title:"Membership source",description:"Splits the current members into rule-managed and manual."}},u={args:{title:"Group memberships",actions:e.jsx(F,{variant:"neutral",children:"7"})}},h={args:{title:"Membership source",description:"Splits the current members into rule-managed and manual.",actions:e.jsx(w,{variant:"secondary",size:"sm",icon:"chart",onClick:t(),children:"Analyze"}),children:e.jsx("p",{className:"text-sm text-neutral-500",children:"Not analyzed yet. Reads all 412 members once, then classifies each against the rules that assign into this group."})}},g={render:()=>e.jsx(C,{handlers:{rule:t(),app:t()},children:e.jsxs("div",{className:"space-y-3 bg-canvas p-3",children:[e.jsx(a,{title:"Rules",description:"What feeds this group, and what points at it.",children:e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsx(d,{type:"rule",id:"0prFAKERULE00001",name:"Sales territory assignment"}),e.jsx(d,{type:"rule",id:"0prFAKERULE00002",name:"Contractor onboarding"})]})}),e.jsx(a,{title:"Grants access to",actions:e.jsx(F,{variant:"neutral",children:"3"}),children:e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsx(d,{type:"app",id:"0oaFAKEAPP000001",name:"Salesforce"}),e.jsx(d,{type:"app",id:"0oaFAKEAPP000002",name:"Gong"}),e.jsx(d,{type:"app",id:"0oaFAKEAPP000003",name:"Tableau"})]})}),e.jsx(a,{title:"Metadata",children:e.jsx("p",{className:"font-mono text-xs text-neutral-500",children:"00gFAKEGROUP0001"})})]})})},x={args:{title:void 0,children:e.jsx("p",{className:"text-sm text-neutral-600",children:"The pane's content starts at the top of the card, with nothing repeating the tab's label."})}},s={args:{title:void 0,band:e.jsxs("div",{className:"space-y-3",children:[e.jsx("p",{className:"text-xs text-neutral-600",children:"62 by rule · 38 direct"}),e.jsx(E,{size:"sm",type:"search",value:"",onChange:t(),ariaLabel:"Filter members",placeholder:"Filter members…"}),e.jsxs("div",{className:"flex flex-wrap gap-1.5",children:[e.jsx(S,{active:!0,onClick:t(),children:"All 100"}),e.jsx(S,{active:!1,onClick:t(),children:"By rule 62"}),e.jsx(S,{active:!1,onClick:t(),children:"Direct 38"})]})]}),children:e.jsxs("ul",{className:"space-y-1.5 text-sm text-neutral-700",children:[e.jsx("li",{children:"Ada Lovelace"}),e.jsx("li",{children:"Alan Turing"}),e.jsx("li",{children:"Grace Hopper"})]})}},b={args:{title:"Members",actions:e.jsx(F,{variant:"neutral",children:"100"}),band:e.jsx("p",{className:"text-xs text-neutral-600",children:"62 by rule · 38 direct"}),children:e.jsx("p",{className:"text-sm text-neutral-600",children:"Roster goes here."})}},y={args:s.args,decorators:[o=>e.jsx("div",{style:{width:360},children:e.jsx(o,{})})]},r={args:{title:"About this group",collapsible:!0,children:e.jsx("p",{className:"font-mono text-xs text-neutral-500",children:"00gFAKEGROUP0001"})},play:async({canvasElement:o})=>{const c=B(o).getByRole("button",{name:/about this group/i});await i(c).toHaveAttribute("aria-expanded","true"),await j.click(c),await i(c).toHaveAttribute("aria-expanded","false"),await j.click(c),await i(c).toHaveAttribute("aria-expanded","true")}},f={args:{...r.args,defaultOpen:!1}},v={args:{title:"Attribute spread",description:"How each profile attribute is populated across this group's members.",collapsible:!0,defaultOpen:!1,itemCount:11,actions:e.jsx(w,{variant:"secondary",size:"sm",icon:"chart",onClick:t(),children:"Analyze"}),children:e.jsx("p",{className:"text-sm text-neutral-600",children:"The attribute cards go here."})}},n={args:{title:"MFA coverage",description:"Opt-in scan of each member's enrolled MFA factors. Never runs automatically.",collapsible:!0,defaultOpen:!1,itemCount:2,summary:e.jsx("p",{className:"text-sm text-neutral-600",children:"2 of 40 members have no MFA factor enrolled."}),children:e.jsx("p",{className:"text-sm text-neutral-600",children:"The coverage cards go here."})}},A={render:()=>e.jsxs("div",{className:"space-y-3 bg-canvas p-3",children:[e.jsx(a,{title:"Attribute spread",collapsible:!0,defaultOpen:!1,itemCount:11,summary:e.jsx("p",{className:"text-sm text-neutral-600",children:"11 attributes · 3 flagged"}),children:e.jsx("p",{className:"text-sm text-neutral-600",children:"Attribute cards."})}),e.jsx(a,{title:"MFA coverage",collapsible:!0,defaultOpen:!1,itemCount:2,summary:e.jsx("p",{className:"text-sm text-neutral-600",children:"2 of 40 members have no MFA factor enrolled."}),children:e.jsx("p",{className:"text-sm text-neutral-600",children:"Coverage cards."})}),e.jsx(a,{title:"About this group",collapsible:!0,defaultOpen:!1,children:e.jsx("p",{className:"font-mono text-xs text-neutral-500",children:"00gFAKEGROUP0001"})})]})},N={args:{...n.args,summary:e.jsx("p",{className:"text-sm text-neutral-600",children:"Summary: 2 of 40 have no MFA factor."}),children:e.jsx("p",{className:"text-sm text-neutral-600",children:"Body: 2 of 40 have no MFA factor."})},play:async({canvasElement:o})=>{const l=B(o);i(l.getByText("Summary: 2 of 40 have no MFA factor.")).toBeInTheDocument(),await j.click(l.getByRole("button",{name:/MFA COVERAGE/i})),i(l.queryByText("Summary: 2 of 40 have no MFA factor.")).toBeNull(),i(l.getByText("Body: 2 of 40 have no MFA factor.")).toBeInTheDocument()}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:"{}",...p.parameters?.docs?.source},description:{story:"Heading and body only.",...p.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Membership source',
    description: 'Splits the current members into rule-managed and manual.'
  }
}`,...m.parameters?.docs?.source},description:{story:"With the one-line explanation under the heading.",...m.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Group memberships',
    actions: <Badge variant="neutral">7</Badge>
  }
}`,...u.parameters?.docs?.source},description:{story:"A count in the header slot — the lightest thing that slot carries.",...u.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Membership source',
    description: 'Splits the current members into rule-managed and manual.',
    actions: <Button variant="secondary" size="sm" icon="chart" onClick={fn()}>
        Analyze
      </Button>,
    children: <p className="text-sm text-neutral-500">
        Not analyzed yet. Reads all 412 members once, then classifies each against the rules that
        assign into this group.
      </p>
  }
}`,...h.parameters?.docs?.source},description:{story:"A gated action in the header slot, scoped to this section's data.",...h.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  render: () => <NavigationProvider handlers={{
    rule: fn(),
    app: fn()
  }}>
      <div className="space-y-3 bg-canvas p-3">
        <DetailSection title="Rules" description="What feeds this group, and what points at it.">
          <div className="flex flex-wrap gap-2">
            <EntityLink type="rule" id="0prFAKERULE00001" name="Sales territory assignment" />
            <EntityLink type="rule" id="0prFAKERULE00002" name="Contractor onboarding" />
          </div>
        </DetailSection>
        <DetailSection title="Grants access to" actions={<Badge variant="neutral">3</Badge>}>
          <div className="flex flex-wrap gap-2">
            <EntityLink type="app" id="0oaFAKEAPP000001" name="Salesforce" />
            <EntityLink type="app" id="0oaFAKEAPP000002" name="Gong" />
            <EntityLink type="app" id="0oaFAKEAPP000003" name="Tableau" />
          </div>
        </DetailSection>
        <DetailSection title="Metadata">
          <p className="font-mono text-xs text-neutral-500">00gFAKEGROUP0001</p>
        </DetailSection>
      </div>
    </NavigationProvider>
}`,...g.parameters?.docs?.source},description:{story:"Several sections stacked, which is how a detail page actually reads.",...g.parameters?.docs?.description}}};x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    title: undefined,
    children: <p className="text-sm text-neutral-600">
        The pane&apos;s content starts at the top of the card, with nothing repeating the tab&apos;s
        label.
      </p>
  }
}`,...x.parameters?.docs?.source},description:{story:"Untitled: the shape a tab uses when its whole body is one section.",...x.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    title: undefined,
    band: <div className="space-y-3">
        <p className="text-xs text-neutral-600">62 by rule · 38 direct</p>
        <Input size="sm" type="search" value="" onChange={fn()} ariaLabel="Filter members" placeholder="Filter members…" />
        <div className="flex flex-wrap gap-1.5">
          <FilterPill active onClick={fn()}>
            All 100
          </FilterPill>
          <FilterPill active={false} onClick={fn()}>
            By rule 62
          </FilterPill>
          <FilterPill active={false} onClick={fn()}>
            Direct 38
          </FilterPill>
        </div>
      </div>,
    children: <ul className="space-y-1.5 text-sm text-neutral-700">
        <li>Ada Lovelace</li>
        <li>Alan Turing</li>
        <li>Grace Hopper</li>
      </ul>
  }
}`,...s.parameters?.docs?.source},description:{story:"A full-bleed filter band reaching both card edges; the body below keeps its padding.",...s.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Members',
    actions: <Badge variant="neutral">100</Badge>,
    band: <p className="text-xs text-neutral-600">62 by rule · 38 direct</p>,
    children: <p className="text-sm text-neutral-600">Roster goes here.</p>
  }
}`,...b.parameters?.docs?.source},description:{story:"A band under a titled section — both header row and band render, in that order.",...b.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: WithBand.args,
  decorators: [Story => <div style={{
    width: 360
  }}>
        <Story />
      </div>]
}`,...y.parameters?.docs?.source},description:{story:"The 360px panel floor: the band's controls wrap rather than overflowing the card.",...y.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'About this group',
    collapsible: true,
    children: <p className="font-mono text-xs text-neutral-500">00gFAKEGROUP0001</p>
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: /about this group/i
    });
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  }
}`,...r.parameters?.docs?.source},description:{story:"Folded behind its heading: the body stays mounted while closed, so nothing resets.",...r.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    ...Collapsible.args,
    defaultOpen: false
  }
}`,...f.parameters?.docs?.source},description:{story:"The state a dashboard of sections arrives in.",...f.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Attribute spread',
    description: "How each profile attribute is populated across this group's members.",
    collapsible: true,
    defaultOpen: false,
    itemCount: 11,
    actions: <Button variant="secondary" size="sm" icon="chart" onClick={fn()}>
        Analyze
      </Button>,
    children: <p className="text-sm text-neutral-600">The attribute cards go here.</p>
  }
}`,...v.parameters?.docs?.source},description:{story:"A section that folds and owns a gate button: the trigger is the heading alone.",...v.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'MFA coverage',
    description: "Opt-in scan of each member's enrolled MFA factors. Never runs automatically.",
    collapsible: true,
    defaultOpen: false,
    itemCount: 2,
    summary: <p className="text-sm text-neutral-600">2 of 40 members have no MFA factor enrolled.</p>,
    children: <p className="text-sm text-neutral-600">The coverage cards go here.</p>
  }
}`,...n.parameters?.docs?.source},description:{story:"A closed section that still states its headline fact.",...n.parameters?.docs?.description}}};A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  render: () => <div className="space-y-3 bg-canvas p-3">
      <DetailSection title="Attribute spread" collapsible defaultOpen={false} itemCount={11} summary={<p className="text-sm text-neutral-600">11 attributes · 3 flagged</p>}>
        <p className="text-sm text-neutral-600">Attribute cards.</p>
      </DetailSection>
      <DetailSection title="MFA coverage" collapsible defaultOpen={false} itemCount={2} summary={<p className="text-sm text-neutral-600">2 of 40 members have no MFA factor enrolled.</p>}>
        <p className="text-sm text-neutral-600">Coverage cards.</p>
      </DetailSection>
      <DetailSection title="About this group" collapsible defaultOpen={false}>
        <p className="font-mono text-xs text-neutral-500">00gFAKEGROUP0001</p>
      </DetailSection>
    </div>
}`,...A.parameters?.docs?.source},description:{story:"The dashboard shape: three sections, all closed, each stating its own fact.",...A.parameters?.docs?.description}}};N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`{
  args: {
    ...CollapsibleWithSummary.args,
    summary: <p className="text-sm text-neutral-600">Summary: 2 of 40 have no MFA factor.</p>,
    children: <p className="text-sm text-neutral-600">Body: 2 of 40 have no MFA factor.</p>
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // Closed: the header speaks for the section.
    expect(canvas.getByText('Summary: 2 of 40 have no MFA factor.')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: /MFA COVERAGE/i
    }));

    // Open: the header line is gone from the DOM, not merely hidden.
    expect(canvas.queryByText('Summary: 2 of 40 have no MFA factor.')).toBeNull();
    expect(canvas.getByText('Body: 2 of 40 have no MFA factor.')).toBeInTheDocument();
  }
}`,...N.parameters?.docs?.source},description:{story:"The summary yields to the body: it is unmounted once the section opens, not hidden.",...N.parameters?.docs?.description}}};const k=["Default","WithDescription","WithCountBadge","WithGatedAction","Stacked","Untitled","WithBand","TitledWithBand","NarrowWithBand","Collapsible","CollapsibleClosed","CollapsibleWithActions","CollapsibleWithSummary","ClosedStack","SummaryYieldsWhenOpened"];export{A as ClosedStack,r as Collapsible,f as CollapsibleClosed,v as CollapsibleWithActions,n as CollapsibleWithSummary,p as Default,y as NarrowWithBand,g as Stacked,N as SummaryYieldsWhenOpened,b as TitledWithBand,x as Untitled,s as WithBand,u as WithCountBadge,m as WithDescription,h as WithGatedAction,k as __namedExportsOrder,T as default};
