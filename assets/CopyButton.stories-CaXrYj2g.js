import{w as d,j as p}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:g,userEvent:y,waitFor:x,within:h}=__STORYBOOK_MODULE_TEST__,f={title:"Shared/CopyButton",component:d,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Copy-to-clipboard button that confirms success by swapping its icon and label to `success` styling for ~1.5s. Text is produced lazily via `getText()` on click, so large lists aren’t built until needed, and a blocked clipboard fails silently rather than throwing."}}},argTypes:{getText:{description:"Text to copy, computed lazily on click so large lists aren’t built until needed."},label:{description:"Idle label, e.g. “Copy all”."},copiedLabel:{description:"Label shown briefly after a successful copy."},disabled:{description:"Disables the button."},title:{description:"Native tooltip text for the button."},variant:{description:"Idle-state button variant (the confirmed state always uses `success`). Defaults to `secondary`."},size:{description:"Button size passed through to `Button`. Defaults to `sm`."},className:{description:"Extra classes merged onto the button."}},args:{getText:()=>`user1@example.com
user2@example.com
user3@example.com`,label:"Copy emails"}},s={},t={args:{variant:"primary"}},a={args:{disabled:!0}},r={args:{size:"md"}},o={args:{size:"lg"}},i={args:{copiedLabel:"Copied to clipboard!"}},n={args:{title:"Copy all selected user emails"}},c={args:{copiedLabel:"Copied 3 emails"},play:async({canvasElement:e})=>{const m=[];Object.defineProperty(navigator,"clipboard",{configurable:!0,value:{writeText:b=>(m.push(b),Promise.resolve())}});const u=h(e);await y.click(u.getByRole("button",{name:"Copy emails"})),await x(()=>g(u.getByRole("button",{name:"Copied 3 emails"})).toBeInTheDocument()),await g(m).toEqual([`user1@example.com
user2@example.com
user3@example.com`])}},l={render:e=>p.jsxs("div",{className:"flex items-center gap-3",children:[p.jsx(d,{...e,size:"sm",label:"Small"}),p.jsx(d,{...e,size:"md",label:"Medium"}),p.jsx(d,{...e,size:"lg",label:"Large"})]}),args:{variant:"primary"}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"Default small secondary button.",...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    variant: 'primary'
  }
}`,...t.parameters?.docs?.source},description:{story:"Primary variant.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...a.parameters?.docs?.source},description:{story:"Disabled state.",...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'md'
  }
}`,...r.parameters?.docs?.source},description:{story:"Medium size.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'lg'
  }
}`,...o.parameters?.docs?.source},description:{story:"Large size.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    copiedLabel: 'Copied to clipboard!'
  }
}`,...i.parameters?.docs?.source},description:{story:"With custom copied label.",...i.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Copy all selected user emails'
  }
}`,...n.parameters?.docs?.source},description:{story:"With title tooltip.",...n.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    copiedLabel: 'Copied 3 emails'
  },
  play: async ({
    canvasElement
  }) => {
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => (written.push(text), Promise.resolve())
      }
    });
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Copy emails'
    }));
    await waitFor(() => expect(canvas.getByRole('button', {
      name: 'Copied 3 emails'
    })).toBeInTheDocument());
    await expect(written).toEqual(['user1@example.com\\nuser2@example.com\\nuser3@example.com']);
  }
}`,...c.parameters?.docs?.source},description:{story:`The copy running: the click writes the lazily-built text and the button flips to
its confirmed label. The clipboard is stubbed so the story is deterministic.`,...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex items-center gap-3">
      <CopyButton {...args} size="sm" label="Small" />
      <CopyButton {...args} size="md" label="Medium" />
      <CopyButton {...args} size="lg" label="Large" />
    </div>,
  args: {
    variant: 'primary'
  }
}`,...l.parameters?.docs?.source},description:{story:"All sizes together.",...l.parameters?.docs?.description}}};const w=["Default","Primary","Disabled","Medium","Large","CustomCopiedLabel","WithTitle","Copying","AllSizes"];export{l as AllSizes,c as Copying,i as CustomCopiedLabel,s as Default,a as Disabled,o as Large,r as Medium,t as Primary,n as WithTitle,w as __namedExportsOrder,f as default};
