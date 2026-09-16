import{j as e,t as n,Q as f}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:o,fn:r,userEvent:k,within:w}=__STORYBOOK_MODULE_TEST__,R={rule:r(),group:r(),user:r(),app:r(),policy:r()},F={title:"Shared/EntityLink",component:n,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'One component for every "that rule / that group / that user / that app" reference, so a cross-reference looks and behaves the same wherever it appears. The chip opens the entity on its own tab; `copyId` adds a sibling control for the raw Okta id.\n\nA chip is a proven answer. Omit `id` (a name with no id) or `name` (an id whose name never loaded) and the missing half renders as muted italic text stating the absence — never chipped, never a control that cannot work. An entity kind this build cannot reach degrades the same way, so a link is never dead.'}}},decorators:[t=>e.jsx(f,{handlers:R,children:e.jsx(t,{})})],argTypes:{type:{description:"Which kind of entity this is — picks the glyph and the destination tab."},id:{description:"The entity's Okta id. **Omit when the reference carries only a name**; the chip then renders as plain text."},name:{description:"The visible name. Truncates rather than overflowing. **Omit it** when this view loaded only the id — never pass the id here."},unresolvedLabel:{description:"The words shown in place of a missing name, in the id-only mode. Defaults to “<Type> name not loaded”."},unresolvedReason:{description:"Tooltip on that stated absence — why the name is missing here."},unlinkableReason:{description:'Why this reference cannot be opened, shown as the tooltip on the plain-text fallback. Defaults to a generic "no id available" sentence.'},copyId:{description:"Show a ghost copy-to-clipboard control for the raw `id` beside the chip. Ignored when no `id` is given."},copyIdLabel:{description:"Accessible name for the copy control. Defaults to “Copy <type> id for <name> (<id>)”."},className:{description:"Extra classes merged after the chip classes."},testId:{description:"Optional test handle."}},args:{type:"rule",id:"0prFAKERULE00001",name:"Sales territory assignment"}},s={play:async({args:t,canvasElement:a})=>{R.rule.mockClear();const I=w(a);await k.click(I.getByRole("button",{name:"Open rule Sales territory assignment"})),await o(R.rule).toHaveBeenCalledWith(t.id)}},i={render:()=>e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(n,{type:"rule",id:"0prFAKERULE00001",name:"Sales territory assignment"}),e.jsx(n,{type:"group",id:"00gFAKEGROUP0001",name:"Sales — West"}),e.jsx(n,{type:"user",id:"00uFAKEUSER00001",name:"Jane Doe"}),e.jsx(n,{type:"app",id:"0oaFAKEAPP000001",name:"Salesforce"}),e.jsx(n,{type:"policy",id:"00pFAKEPOLICY001",name:"Contractor MFA"})]})},p={args:{type:"group",id:void 0,name:"sales",unlinkableReason:"This rule matches the group by name, and a name can match groups from more than one source, so there is no single group to open."}},d={render:()=>e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsx(n,{type:"group",id:"00gFAKEGROUP0001",name:"Sales — West"}),e.jsx(n,{type:"group",name:"sales",unlinkableReason:"Matched by name only — no group id is available."})]})},c={render:()=>e.jsx("div",{className:"w-48 border border-neutral-200 p-2",children:e.jsx(n,{type:"rule",id:"0prFAKERULE00002",name:"Contractor onboarding — Workday sourced, EMEA region only"})})},l={render:t=>e.jsx(f,{handlers:{},children:e.jsx(n,{...t})}),play:async({canvasElement:t})=>{const a=w(t);await o(a.getByText("Sales territory assignment")).toBeInTheDocument(),await o(a.queryByRole("button",{name:/open rule/i})).not.toBeInTheDocument()}},m={args:{type:"group",id:"00gFAKEGROUP0001",name:"Sales — West",copyId:!0}},y={render:()=>e.jsxs("div",{className:"flex flex-col items-start gap-2",children:[e.jsx(n,{type:"rule",id:"0prFAKERULE00001",name:"Sales territory assignment",copyId:!0}),e.jsx(n,{type:"group",id:"00gFAKEGROUP0001",name:"Sales — West",copyId:!0}),e.jsx(n,{type:"user",id:"00uFAKEUSER00001",name:"Jane Doe",copyId:!0,copyIdLabel:"Copy Jane Doe's user id"})]})},u={args:{type:"group",id:void 0,name:"sales",copyId:!0,unlinkableReason:"Matched by name only — no group id is available."}},g={render:()=>e.jsx(f,{handlers:{},children:e.jsx(n,{type:"policy",id:"00pFAKEPOLICY001",name:"Contractor MFA",copyId:!0})})},h={render:()=>e.jsxs("div",{className:"flex flex-col items-start gap-2",children:[e.jsx(n,{type:"group",id:"00gFAKEGROUP0001",name:"Engineering",copyId:!0}),e.jsx(n,{type:"group",id:"00gFAKEGROUP0002",name:"Engineering",copyId:!0})]})},E={args:{type:"group",id:"00gFAKEGROUP0001",name:void 0},play:async({canvasElement:t})=>{const a=w(t);await o(a.getByRole("button",{name:"Group name not loaded — open group 00gFAKEGROUP0001"})).toBeInTheDocument(),await o(a.getByRole("button",{name:"Copy group id 00gFAKEGROUP0001"})).toBeInTheDocument()}},v={render:()=>e.jsxs("ul",{className:"flex w-72 flex-col gap-2",children:[e.jsx("li",{className:"flex min-w-0",children:e.jsx(n,{type:"group",id:"00gFAKEGROUP0001",name:"Sales — West",copyId:!0})}),e.jsx("li",{className:"flex min-w-0",children:e.jsx(n,{type:"group",id:"00gFAKEGROUP0002"})}),e.jsx("li",{className:"flex min-w-0",children:e.jsx(n,{type:"group",id:"00gFAKEGROUP0003",name:"Sales — EMEA",copyId:!0})}),e.jsx("li",{className:"flex min-w-0",children:e.jsx(n,{type:"group",id:"00gFAKEGROUP0004"})})]}),play:async({canvasElement:t})=>{const a=w(t);await o(a.getByRole("button",{name:"Open group Sales — West"})).toBeInTheDocument(),await o(a.getByRole("button",{name:"Group name not loaded — open group 00gFAKEGROUP0002"})).toBeInTheDocument(),await o(a.getByRole("button",{name:"Group name not loaded — open group 00gFAKEGROUP0004"})).toBeInTheDocument()}},b={render:()=>e.jsx(f,{handlers:{},children:e.jsx(n,{type:"app",id:"0oaFAKEAPP000001"})}),play:async({canvasElement:t})=>{const a=w(t);await o(a.getByText("App name not loaded")).toBeInTheDocument(),await o(a.queryByRole("button",{name:/open app/i})).not.toBeInTheDocument()}},A={args:{type:"app",id:"0oaFAKEAPP000002",name:void 0,unresolvedLabel:"Name not returned by Okta",unresolvedReason:"Okta returned no name for this application, so only its id is known here.",copyIdLabel:"Copy application id 0oaFAKEAPP000002"}},x={render:()=>e.jsxs("div",{className:"flex flex-col items-start gap-2",children:[e.jsx(n,{type:"rule",id:"0prFAKERULE00001"}),e.jsx(n,{type:"group",id:"00gFAKEGROUP0001"}),e.jsx(n,{type:"user",id:"00uFAKEUSER00001"}),e.jsx(n,{type:"app",id:"0oaFAKEAPP000001"}),e.jsx(n,{type:"policy",id:"00pFAKEPOLICY001"})]})};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    handlers.rule.mockClear();
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Open rule Sales territory assignment'
    }));
    await expect(handlers.rule).toHaveBeenCalledWith(args.id);
  }
}`,...s.parameters?.docs?.source},description:{story:"A navigable rule — clicking the chip jumps to it.",...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap items-center gap-2">
      <EntityLink type="rule" id="0prFAKERULE00001" name="Sales territory assignment" />
      <EntityLink type="group" id="00gFAKEGROUP0001" name="Sales — West" />
      <EntityLink type="user" id="00uFAKEUSER00001" name="Jane Doe" />
      <EntityLink type="app" id="0oaFAKEAPP000001" name="Salesforce" />
      <EntityLink type="policy" id="00pFAKEPOLICY001" name="Contractor MFA" />
    </div>
}`,...i.parameters?.docs?.source},description:{story:"One chip per entity kind, so the glyphs can be compared.",...i.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'group',
    id: undefined,
    name: 'sales',
    unlinkableReason: 'This rule matches the group by name, and a name can match groups from more than one source, so there is no single group to open.'
  }
}`,...p.parameters?.docs?.source},description:{story:`A name with no id. The rule matches the group by name, and a name can match
groups from more than one source, so there is nothing single to open.`,...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap items-center gap-2">
      <EntityLink type="group" id="00gFAKEGROUP0001" name="Sales — West" />
      <EntityLink type="group" name="sales" unlinkableReason="Matched by name only — no group id is available." />
    </div>
}`,...d.parameters?.docs?.source},description:{story:"Linkable and un-linkable side by side — the difference must be legible at a glance.",...d.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <div className="w-48 border border-neutral-200 p-2">
      <EntityLink type="rule" id="0prFAKERULE00002" name="Contractor onboarding — Workday sourced, EMEA region only" />
    </div>
}`,...c.parameters?.docs?.source},description:{story:"A long name truncates inside a narrow container rather than overflowing it.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: args => <NavigationProvider handlers={{}}>
      <EntityLink {...args} />
    </NavigationProvider>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Sales territory assignment')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: /open rule/i
    })).not.toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:`With no handler registered for the kind, the reference reports as unreachable and the
chip degrades to plain text — which is what makes it safe in any host.`,...l.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'group',
    id: '00gFAKEGROUP0001',
    name: 'Sales — West',
    copyId: true
  }
}`,...m.parameters?.docs?.source},description:{story:"`copyId` — the name badge, a copy control for the raw id, and the open action,\nall from one import.",...m.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col items-start gap-2">
      <EntityLink type="rule" id="0prFAKERULE00001" name="Sales territory assignment" copyId />
      <EntityLink type="group" id="00gFAKEGROUP0001" name="Sales — West" copyId />
      <EntityLink type="user" id="00uFAKEUSER00001" name="Jane Doe" copyId copyIdLabel="Copy Jane Doe's user id" />
    </div>
}`,...y.parameters?.docs?.source},description:{story:"The copy control's accessible name says copy *what*, so several on one screen stay\ndistinguishable. Override the default with `copyIdLabel` where the surrounding text\nalready establishes which entity is meant.",...y.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'group',
    id: undefined,
    name: 'sales',
    copyId: true,
    unlinkableReason: 'Matched by name only — no group id is available.'
  }
}`,...u.parameters?.docs?.source},description:{story:"A reference with no id, asked for `copyId` anyway: there is nothing to copy, so no\ncopy control is rendered at all rather than one that cannot work.",...u.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  render: () => <NavigationProvider handlers={{}}>
      <EntityLink type="policy" id="00pFAKEPOLICY001" name="Contractor MFA" copyId />
    </NavigationProvider>
}`,...g.parameters?.docs?.source},description:{story:`An id that exists but that this build cannot navigate to. Opening degrades to plain
text; copying still works, because the id is right there.`,...g.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col items-start gap-2">
      <EntityLink type="group" id="00gFAKEGROUP0001" name="Engineering" copyId />
      <EntityLink type="group" id="00gFAKEGROUP0002" name="Engineering" copyId />
    </div>
}`,...h.parameters?.docs?.source},description:{story:"Two groups sharing a display name. Both the chip's `aria-label` and the copy\ncontrol's default fold the id in, so all four controls stay distinguishable.",...h.parameters?.docs?.description}}};E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'group',
    id: '00gFAKEGROUP0001',
    name: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Group name not loaded — open group 00gFAKEGROUP0001'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Copy group id 00gFAKEGROUP0001'
    })).toBeInTheDocument();
  }
}`,...E.parameters?.docs?.source},description:{story:"Known only by an id: the absence is stated where the name would be, and it still opens.",...E.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  render: () => <ul className="flex w-72 flex-col gap-2">
      <li className="flex min-w-0">
        <EntityLink type="group" id="00gFAKEGROUP0001" name="Sales — West" copyId />
      </li>
      <li className="flex min-w-0">
        <EntityLink type="group" id="00gFAKEGROUP0002" />
      </li>
      <li className="flex min-w-0">
        <EntityLink type="group" id="00gFAKEGROUP0003" name="Sales — EMEA" copyId />
      </li>
      <li className="flex min-w-0">
        <EntityLink type="group" id="00gFAKEGROUP0004" />
      </li>
    </ul>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Open group Sales — West'
    })).toBeInTheDocument();
    // Two unresolved rows, and no name to tell them apart — so the id does that job here.
    await expect(canvas.getByRole('button', {
      name: 'Group name not loaded — open group 00gFAKEGROUP0002'
    })).toBeInTheDocument();
    await expect(canvas.getByRole('button', {
      name: 'Group name not loaded — open group 00gFAKEGROUP0004'
    })).toBeInTheDocument();
  }
}`,...v.parameters?.docs?.source},description:{story:`Resolved and unresolved references in one list: the chip carries an answer's weight,
the un-chipped muted italic row must never be mistaken for a name. Both open.`,...v.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  render: () => <NavigationProvider handlers={{}}>
      <EntityLink type="app" id="0oaFAKEAPP000001" />
    </NavigationProvider>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('App name not loaded')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', {
      name: /open app/i
    })).not.toBeInTheDocument();
  }
}`,...b.parameters?.docs?.source},description:{story:`An unresolved reference to a kind this build cannot reach: the stated absence stays,
the id stays copyable, and nothing pretends to be a control.`,...b.parameters?.docs?.description}}};A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'app',
    id: '0oaFAKEAPP000002',
    name: undefined,
    unresolvedLabel: 'Name not returned by Okta',
    unresolvedReason: 'Okta returned no name for this application, so only its id is known here.',
    copyIdLabel: 'Copy application id 0oaFAKEAPP000002'
  }
}`,...A.parameters?.docs?.source},description:{story:"The wording is a prop: a caller that knows *why* the name is missing can say so.",...A.parameters?.docs?.description}}};x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col items-start gap-2">
      <EntityLink type="rule" id="0prFAKERULE00001" />
      <EntityLink type="group" id="00gFAKEGROUP0001" />
      <EntityLink type="user" id="00uFAKEUSER00001" />
      <EntityLink type="app" id="0oaFAKEAPP000001" />
      <EntityLink type="policy" id="00pFAKEPOLICY001" />
    </div>
}`,...x.parameters?.docs?.source},description:{story:"One unresolved reference per entity kind, so the glyphs can be compared.",...x.parameters?.docs?.description}}};const P=["Default","EveryType","NotLinkable","LinkableVersusNot","Truncates","NoNavigationAvailable","WithCopyId","CopyIdEveryType","CopyIdWithoutAnId","CopyIdWhenNotNavigable","DuplicateNamesStayDistinguishable","KnownOnlyByAnId","ResolvedAndUnresolvedInOneList","KnownOnlyByAnIdNotNavigable","UnresolvedWordingOverridden","KnownOnlyByAnIdEveryType"];export{y as CopyIdEveryType,g as CopyIdWhenNotNavigable,u as CopyIdWithoutAnId,s as Default,h as DuplicateNamesStayDistinguishable,i as EveryType,E as KnownOnlyByAnId,x as KnownOnlyByAnIdEveryType,b as KnownOnlyByAnIdNotNavigable,d as LinkableVersusNot,l as NoNavigationAvailable,p as NotLinkable,v as ResolvedAndUnresolvedInOneList,c as Truncates,A as UnresolvedWordingOverridden,m as WithCopyId,P as __namedExportsOrder,F as default};
