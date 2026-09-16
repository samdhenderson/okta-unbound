import{j as s}from"./iframe-tAvKsVeF.js";import{a as i}from"./ReportRow-DXUM0Iey.js";import{F as d}from"./FigureNumber-CF_a3j6L.js";import"./preload-helper-PPVm8Dsz.js";const{expect:r,userEvent:l,within:c}=__STORYBOOK_MODULE_TEST__,y={title:"Home/ReportRow",component:i,tags:["autodocs"],parameters:{docs:{description:{component:"The row idiom Home’s reports card is built from: a leading figure, two lines, and a panel that opens in place. The header is a real `<button>` wrapping the row’s content, which buys `aria-expanded`/`aria-controls` with no extra element — every control the row offers lives in the panel, outside that button."}}},args:{rowKey:"demo",figure:s.jsx(d,{value:31}),label:"Empty groups nothing fills",note:"of 214 groups",children:s.jsx("p",{className:"text-xs text-neutral-600",children:"The panel body the caller supplies."})},decorators:[t=>s.jsx("ul",{className:"divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200 bg-white",children:s.jsx(t,{})})]},n={play:async({canvasElement:t})=>{const e=c(t);await r(e.getByRole("button",{expanded:!1})).toBeInTheDocument(),await r(e.queryByText(/panel body/)).not.toBeInTheDocument()}},a={play:async({canvasElement:t})=>{const e=c(t);await l.click(e.getByRole("button")),await r(e.getByRole("button",{expanded:!0})).toBeInTheDocument(),await r(e.getByText(/panel body/)).toBeInTheDocument()}},o={args:{note:"At least — the last read of groups did not finish.",warn:!0}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      expanded: false
    })).toBeInTheDocument();
    await expect(canvas.queryByText(/panel body/)).not.toBeInTheDocument();
  }
}`,...n.parameters?.docs?.source},description:{story:"Closed, and closed means closed: the panel is absent, not merely hidden.",...n.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
    await expect(canvas.getByRole('button', {
      expanded: true
    })).toBeInTheDocument();
    await expect(canvas.getByText(/panel body/)).toBeInTheDocument();
  }
}`,...a.parameters?.docs?.source},description:{story:"Opened by pressing the row itself.",...a.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    note: 'At least — the last read of groups did not finish.',
    warn: true
  }
}`,...o.parameters?.docs?.source},description:{story:"A read that did not finish: the note carries the warning colour, the title does not.",...o.parameters?.docs?.description}}};const w=["Closed","Opened","Warned"];export{n as Closed,a as Opened,o as Warned,w as __namedExportsOrder,y as default};
