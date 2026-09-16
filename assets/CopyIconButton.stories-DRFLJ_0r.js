import{ab as p}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:s,userEvent:l,waitFor:d,within:c}=__STORYBOOK_MODULE_TEST__,y={title:"Shared/CopyIconButton",component:p,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"A ghost `IconButton` whose glyph and accessible name flip to a confirmation for ~1.5s after a click, shared by `CopyableId` and `EntityLink`. It carries no visible text, so the label must name *what* is being copied rather than the bare verb."}}},argTypes:{value:{description:"The raw value written to the clipboard on click."},label:{description:"Resting accessible name, e.g. “Copy group id”."},className:{description:"Extra classes merged onto the button. Defaults to `shrink-0`."}},args:{value:"00gFAKE1a2b3c4d5e6",label:"Copy group id"}},e={play:async({canvasElement:o})=>{const n=c(o);await s(n.getByRole("button",{name:"Copy group id"})).toBeInTheDocument()}},t={args:{value:"00uFAKE9z8y7x6w5v4",label:"Copy user id for ana@example.com"}},a={play:async({canvasElement:o})=>{const n=[];Object.defineProperty(navigator,"clipboard",{configurable:!0,value:{writeText:i=>(n.push(i),Promise.resolve())}});const r=c(o);await l.click(r.getByRole("button",{name:"Copy group id"})),await d(()=>s(r.getByRole("button",{name:"Copied!"})).toBeInTheDocument()),await s(n).toEqual(["00gFAKE1a2b3c4d5e6"])}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Copy group id'
    })).toBeInTheDocument();
  }
}`,...e.parameters?.docs?.source},description:{story:"Resting state: the clipboard glyph, named by its label.",...e.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    value: '00uFAKE9z8y7x6w5v4',
    label: 'Copy user id for ana@example.com'
  }
}`,...t.parameters?.docs?.source},description:{story:`The label names the entity, not just the verb — several copy controls can
share a screen, and "Copy" alone would make them indistinguishable.`,...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
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
      name: 'Copy group id'
    }));
    await waitFor(() => expect(canvas.getByRole('button', {
      name: 'Copied!'
    })).toBeInTheDocument());
    await expect(written).toEqual(['00gFAKE1a2b3c4d5e6']);
  }
}`,...a.parameters?.docs?.source},description:{story:"The click writes the value and the accessible name flips to the confirmation.",...a.parameters?.docs?.description}}};const g=["Default","NamesWhatItCopies","Copying"];export{a as Copying,e as Default,t as NamesWhatItCopies,g as __namedExportsOrder,y as default};
