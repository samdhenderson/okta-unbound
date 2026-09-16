import{j as r,q as p,Q as l}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:g,fn:x,userEvent:h,within:y}=__STORYBOOK_MODULE_TEST__,G={"00gFAKEGROUP0001":"Engineering — Platform","00gFAKEGROUP0002":"Contractors — EMEA"},f=e=>G[e],u=x(),O={title:"Shared/RuleExpressionText",component:p,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'Rule-condition text with its group-id literals resolved to named badges, so `isMemberOfAnyGroup("00gFAKEGROUP0001")` reads as the group rather than an opaque id. It fetches nothing: a literal becomes a badge only when the host’s `resolveGroupName` returns a name for it, so a non-group literal prints as source.\n\nThe type treatment is fixed — the only axis a host picks is `tone`, and `className` takes layout and spacing only. Expression text is untrusted tenant data and is split into React text, never parsed into markup.'}}},decorators:[e=>r.jsx(l,{handlers:{group:u},children:r.jsx(e,{})})],argTypes:{text:{description:"The condition text to render — a clause's reconstructed expression text."},resolveGroupName:{description:"Names the group ids inside the text. Omitted, or returning `undefined`, the literal keeps its raw quoted form."},tone:{description:"Reading role. `default` for the condition the surface is about; `subdued` for one printed under another it qualifies."},className:{description:"Layout and spacing only — `min-w-0`, `flex-1`, a margin. Type and colour are not overridable."}},args:{text:'isMemberOfAnyGroup("00gFAKEGROUP0001")',resolveGroupName:f}},t={play:async({canvasElement:e})=>{const m=y(e);await h.click(m.getByRole("button",{name:"Open group Engineering — Platform"})),await g(u).toHaveBeenCalledWith("00gFAKEGROUP0001")}},s={args:{resolveGroupName:void 0}},o={args:{text:'isMemberOfGroup("00gFAKEGROUP0009")'}},a={args:{text:'isMemberOfAnyGroup("00gFAKEGROUP0001", "00gFAKEGROUP0009", "00gFAKEGROUP0002")'}},n={args:{text:'user.department == "Engineering" && user.title != "Intern"'}},i={decorators:[e=>r.jsx(l,{handlers:{},children:r.jsx(e,{})})]},d={args:{text:'isMemberOfAnyGroup("00gFAKEGROUP0001") && !isMemberOfAnyGroup("00gFAKEGROUP0002") && String.stringContains(user.department, "Engineering-Platform-Infrastructure")'}},c={render:e=>r.jsxs("div",{className:"max-w-md space-y-2",children:[r.jsx(p,{...e,text:'isMemberOfAnyGroup("00gFAKEGROUP0001")'}),r.jsxs("div",{className:"border-l-2 border-neutral-200 pl-3",children:[r.jsx("p",{className:"text-xs font-medium text-neutral-600",children:"Any one of these satisfies it:"}),r.jsx(p,{...e,tone:"subdued",text:'isMemberOfAnyGroup("00gFAKEGROUP0002")'})]})]})};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Open group Engineering — Platform'
    }));
    await expect(navigateToGroup).toHaveBeenCalledWith('00gFAKEGROUP0001');
  }
}`,...t.parameters?.docs?.source},description:{story:"One resolvable id: the badge opens the group and can copy the raw id.",...t.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    resolveGroupName: undefined
  }
}`,...s.parameters?.docs?.source},description:{story:"No resolver at all — every literal stays exactly as the clause reconstructed it.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    text: 'isMemberOfGroup("00gFAKEGROUP0009")'
  }
}`,...o.parameters?.docs?.source},description:{story:"A resolver with no name for this id: the same fallback, rather than a half-labelled badge.",...o.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    text: 'isMemberOfAnyGroup("00gFAKEGROUP0001", "00gFAKEGROUP0009", "00gFAKEGROUP0002")'
  }
}`,...a.parameters?.docs?.source},description:{story:"Some named, some not — one expression can legitimately be both.",...a.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    text: 'user.department == "Engineering" && user.title != "Intern"'
  }
}`,...n.parameters?.docs?.source},description:{story:"A non-group literal resolves to no name, so the comparison prints as source.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  decorators: [Story => <NavigationProvider handlers={{}}>
        <Story />
      </NavigationProvider>]
}`,...i.parameters?.docs?.source},description:{story:"With no group navigation handler the badge degrades to text rather than a dead control.",...i.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    text: 'isMemberOfAnyGroup("00gFAKEGROUP0001") && !isMemberOfAnyGroup("00gFAKEGROUP0002") && String.stringContains(user.department, "Engineering-Platform-Infrastructure")'
  }
}`,...d.parameters?.docs?.source},description:{story:"A long condition wraps inside its row instead of overflowing the side panel.",...d.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: args => <div className="max-w-md space-y-2">
      <RuleExpressionText {...args} text='isMemberOfAnyGroup("00gFAKEGROUP0001")' />
      <div className="border-l-2 border-neutral-200 pl-3">
        <p className="text-xs font-medium text-neutral-600">Any one of these satisfies it:</p>
        <RuleExpressionText {...args} tone="subdued" text='isMemberOfAnyGroup("00gFAKEGROUP0002")' />
      </div>
    </div>
}`,...c.parameters?.docs?.source},description:{story:"Both tones in context: a clause, and beneath it the subdued condition qualifying it.",...c.parameters?.docs?.description}}};const b=["ResolvedGroupId","NoResolver","UnresolvedGroupId","PartiallyResolved","NonGroupLiteralsUntouched","Unlinkable","LongExpression","TonesInContext"];export{d as LongExpression,s as NoResolver,n as NonGroupLiteralsUntouched,a as PartiallyResolved,t as ResolvedGroupId,c as TonesInContext,i as Unlinkable,o as UnresolvedGroupId,b as __namedExportsOrder,O as default};
