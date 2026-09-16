import{j as p,a3 as b,r as x,C as v}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:r,userEvent:m,within:f}=__STORYBOOK_MODULE_TEST__,k={title:"Shared/CollapsibleSection",component:b,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Bordered card whose clickable header toggles its body open or closed. It owns its open state (uncontrolled, seeded by `defaultOpen`), and the header button carries `aria-expanded`/`aria-controls` for the body region.\n\nThe body animates via the shared `.disclose` grid wrapper, so children **stay mounted while collapsed** — held out of the tab order and the accessible tree with `inert`. Don't rely on collapsing to reset or unmount body state."}}},argTypes:{title:{description:"Header label."},defaultOpen:{description:"Whether the section starts expanded. Defaults to `true`."},children:{description:"Body content. Stays mounted (and `inert`) while the section is collapsed."},itemCount:{description:"Optional count rendered as a small badge next to the title."}},args:{title:"Advanced Filters",defaultOpen:!0,children:p.jsx(g,{options:["Option A","Option B"]})}};function g({options:u}){const[t,e]=x.useState([]);return p.jsx("div",{className:"flex flex-col gap-2",children:u.map(a=>p.jsx(v,{label:a,checked:t.includes(a),onChange:y=>e(h=>y?[...h,a]:h.filter(w=>w!==a))},a))})}const s={},o={args:{defaultOpen:!1}},n={args:{itemCount:3}},i={args:{itemCount:0}},c={play:async({canvasElement:u})=>{const t=f(u),e=t.getByRole("button",{name:/Advanced Filters/});await r(e).toHaveAttribute("aria-expanded","true"),await m.click(t.getByLabelText("Option A")),await r(t.getByLabelText("Option A")).toBeChecked(),await m.click(e),await r(e).toHaveAttribute("aria-expanded","false"),await m.click(e),await r(e).toHaveAttribute("aria-expanded","true"),await r(t.getByLabelText("Option A")).toBeChecked()}},d={parameters:{motion:"on"},args:{title:"Advanced Filters",defaultOpen:!1,itemCount:2}},l={args:{title:"Permissions",children:p.jsx(g,{options:["View users","Edit users","Delete users","Manage groups","View reports"]})}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"Default (open).",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    defaultOpen: false
  }
}`,...o.parameters?.docs?.source},description:{story:"Starts in closed state.",...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    itemCount: 3
  }
}`,...n.parameters?.docs?.source},description:{story:"With item count badge.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    itemCount: 0
  }
}`,...i.parameters?.docs?.source},description:{story:"Zero count badge.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole('button', {
      name: /Advanced Filters/
    });
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(canvas.getByLabelText('Option A'));
    await expect(canvas.getByLabelText('Option A')).toBeChecked();
    await userEvent.click(header);
    await expect(header).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(header);
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    // Collapsing does not unmount, so the tick survives.
    await expect(canvas.getByLabelText('Option A')).toBeChecked();
  }
}`,...c.parameters?.docs?.source},description:{story:`Operate the header, and prove the body stays mounted: a ticked box is still ticked
after a fold and an unfold.`,...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  parameters: {
    motion: 'on'
  },
  args: {
    title: 'Advanced Filters',
    defaultOpen: false,
    itemCount: 2
  }
}`,...d.parameters?.docs?.source},description:{story:"Motion showcase — click the header to watch the body's height animate and the chevron\nrotate. Every other story runs with motion suppressed, and this one carries no `play`,\nwhich would race the animation.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Permissions',
    children: <FilterOptions options={['View users', 'Edit users', 'Delete users', 'Manage groups', 'View reports']} />
  }
}`,...l.parameters?.docs?.source},description:{story:"With longer content.",...l.parameters?.docs?.description}}};const S=["Default","Closed","WithItemCount","WithZeroCount","TogglingTheSection","MotionShowcase","WithLongContent"];export{o as Closed,s as Default,d as MotionShowcase,c as TogglingTheSection,n as WithItemCount,l as WithLongContent,i as WithZeroCount,S as __namedExportsOrder,k as default};
