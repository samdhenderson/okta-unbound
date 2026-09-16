import{j as e,y as i,a as p}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:o,userEvent:m,within:h}=__STORYBOOK_MODULE_TEST__,b={title:"Shared/InsightCard",component:i,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"The anatomy every card on an insights surface shares: a name, the badges saying why it ranks where it does, a headline that reads without a click, and one disclosure holding the detail. Severity is carried by order and badges — never by giving a flagged card a different shape — and the badges render collapsed as well as expanded.\n\nThe disclosure is a real `<button>` scoped to the header, carrying `aria-expanded`/`aria-controls`, and its accessible name includes `subject` so a grid of cards does not name every control identically."}}},argTypes:{title:{description:"Render prop for the card's name, given the `titleId` the disclosure points at."},subject:{description:"Plain-text subject folded into the disclosure's accessible name."},revealName:{description:"What the disclosure reveals, as a noun phrase."},badges:{description:"Why this card ranks where it does; omit when nothing is flagged."},headline:{description:"The always-visible summary under the badges."},children:{description:"The disclosed body."},defaultExpanded:{description:"Starts the card expanded."}},args:{title:a=>e.jsx("span",{id:a,className:"truncate text-sm font-semibold text-neutral-900",children:"Enrollment"}),subject:"MFA enrollment",revealName:"bucket breakdown",badges:e.jsxs("ul",{className:"flex flex-wrap gap-1.5",children:[e.jsx("li",{children:e.jsx(p,{variant:"warning",children:"2 unprotected"})}),e.jsx("li",{children:e.jsx(p,{variant:"neutral",children:"7 on a single factor"})})]}),headline:e.jsx("p",{className:"text-xs text-neutral-600",children:"40 of 40 members scanned · 3 buckets"}),children:e.jsxs("ul",{className:"space-y-1 text-xs text-neutral-700",children:[e.jsx("li",{children:"No factors enrolled — 2 (5%)"}),e.jsx("li",{children:"One factor — 7 (18%)"}),e.jsx("li",{children:"Two or more factors — 31 (78%)"})]})}},s={},r={args:{defaultExpanded:!0}},t={args:{title:a=>e.jsx("span",{id:a,className:"truncate text-sm font-semibold text-neutral-900",children:"Factor types"}),subject:"factor types",revealName:"factor list",badges:void 0,headline:e.jsx("p",{className:"text-xs text-neutral-600",children:"4 types in use"})}},n={play:async({canvasElement:a})=>{const c=h(a),l=c.getByRole("button",{name:"Show the bucket breakdown for MFA enrollment"});o(l).toHaveAttribute("aria-expanded","false"),await m.tab(),o(l).toHaveFocus(),await m.keyboard("{Enter}"),o(c.getByRole("button",{name:"Hide the bucket breakdown for MFA enrollment"})).toHaveAttribute("aria-expanded","true")}},d={render:a=>e.jsxs("div",{className:"grid grid-cols-1 gap-3 bg-canvas p-3 sm:grid-cols-2",children:[e.jsx(i,{...a}),e.jsx(i,{...a,...t.args})]})};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"How a card arrives: name, badges and headline, with the detail folded away.",...s.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    defaultExpanded: true
  }
}`,...r.parameters?.docs?.source},description:{story:"The disclosure open, showing the body.",...r.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    title: (titleId: string) => <span id={titleId} className="truncate text-sm font-semibold text-neutral-900">
        Factor types
      </span>,
    subject: 'factor types',
    revealName: 'factor list',
    badges: undefined,
    headline: <p className="text-xs text-neutral-600">4 types in use</p>
  }
}`,...t.parameters?.docs?.source},description:{story:"Nothing is flagged, so the badge strip is omitted rather than rendered empty.",...t.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: 'Show the bucket breakdown for MFA enrollment'
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.tab();
    expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(canvas.getByRole('button', {
      name: 'Hide the bucket breakdown for MFA enrollment'
    })).toHaveAttribute('aria-expanded', 'true');
  }
}`,...n.parameters?.docs?.source},description:{story:"The header overlay is a real button: reachable by Tab and toggled by Enter.",...n.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: args => <div className="grid grid-cols-1 gap-3 bg-canvas p-3 sm:grid-cols-2">
      <InsightCard {...args} />
      <InsightCard {...args} {...NoBadges.args} />
    </div>
}`,...d.parameters?.docs?.source},description:{story:"Two cards side by side, which is how the MFA coverage section reads.",...d.parameters?.docs?.description}}};const x=["Collapsed","Expanded","NoBadges","KeyboardOperable","InAGrid"];export{s as Collapsed,r as Expanded,d as InAGrid,n as KeyboardOperable,t as NoBadges,x as __namedExportsOrder,b as default};
