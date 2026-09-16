import{j as e,M as E,B as r,r as B,ae as T}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:i,fn:w,userEvent:x,waitFor:q,within:C}=__STORYBOOK_MODULE_TEST__,D={title:"Shared/Modal",component:E,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'The canonical overlay for all pop-up UI: `role="dialog"` + `aria-modal`, a Tab focus-trap, autofocus into the panel, focus restoration on close, and Escape / overlay-click to dismiss. Four width presets and an optional footer bar. Always use this rather than a bespoke overlay.\n\nClosing is animated: the panel is held in the DOM for one exit animation, but is `aria-hidden` + `inert` for that window and focus returns to the trigger at once, so `isOpen === false` means "gone" to every consumer from the first frame.'}}},argTypes:{isOpen:{description:"When false the modal closes — the panel is held for its exit animation (hidden from the accessible tree), then unmounted."},onClose:{description:"Invoked on Escape, overlay click, or the header close button."},title:{description:"Dialog title; wired to `aria-labelledby`."},children:{description:"Body content."},footer:{description:"Optional footer node (typically action buttons), shown in a styled footer bar."},size:{description:"Max-width preset for the panel. Defaults to `md`."}},args:{isOpen:!0,onClose:w(),title:"Modal Title",children:e.jsx("p",{children:"Modal content goes here."})}},c={},l={args:{children:e.jsx("p",{children:"Are you sure you want to delete this item? This action cannot be undone."}),title:"Confirm deletion",footer:e.jsxs(e.Fragment,{children:[e.jsx(r,{variant:"ghost",onClick:w(),children:"Cancel"}),e.jsx(r,{variant:"danger",onClick:w(),children:"Delete"})]})}},d={args:{size:"sm",title:"Small modal"}},m={args:{size:"lg",title:"Large modal"}},u={args:{size:"xl",title:"Extra-large modal"}},p={args:{title:"Terms and Conditions",children:e.jsxs("div",{className:"flex flex-col gap-4",children:[e.jsx("p",{children:"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."}),e.jsx("p",{children:"Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."}),e.jsx("p",{children:"Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo."}),e.jsx("p",{children:"Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt."})]}),footer:e.jsx(r,{variant:"primary",children:"Accept"})}},h={args:{isOpen:!1}},O=a=>{const[t,o]=B.useState(!1);return e.jsxs("div",{className:"p-6",children:[e.jsx(r,{onClick:()=>o(!0),children:"Open modal"}),e.jsx(E,{...a,isOpen:t,onClose:()=>o(!1),footer:e.jsx(r,{variant:"ghost",onClick:()=>o(!1),children:"Cancel"})})]})},g={parameters:{motion:"on"},args:{title:"Confirm removal",children:e.jsx("p",{children:"Closing this dialog animates it out; focus returns to the trigger at once."})},render:a=>e.jsx(O,{...a})},v={args:{title:"Confirm removal",children:e.jsx("p",{children:"This dialog is opened and dismissed by the interaction test."})},render:a=>e.jsx(O,{...a}),play:async({canvasElement:a})=>{const t=C(a),o=t.getByRole("button",{name:"Open modal"});await x.click(o);const n=await t.findByRole("dialog");await x.click(t.getByRole("button",{name:"Cancel"})),await q(()=>i(n.isConnected).toBe(!1)),i(t.queryByRole("dialog")).toBeNull(),i(document.activeElement).toBe(o)}},f={args:{title:"Confirm removal",children:e.jsx("p",{children:"Tab cycles inside this dialog; Escape dismisses it."})},render:a=>e.jsx(O,{...a}),play:async({canvasElement:a})=>{const t=C(a),o=t.getByRole("button",{name:"Open modal"});await x.click(o);const n=await t.findByRole("dialog");for(let s=0;s<5;s+=1)await x.tab(),i(n.contains(document.activeElement)).toBe(!0);await x.keyboard("{Escape}"),await q(()=>i(t.queryByRole("dialog")).toBeNull()),i(document.activeElement).toBe(o)}},S=a=>{const[t,o]=B.useState(!1),n=B.useCallback(()=>o(!0),[]);return e.jsxs("div",{className:"h-screen bg-canvas",children:[e.jsx(E,{...a,isOpen:t,onClose:()=>o(!1)}),e.jsx("div",{"data-testid":"activity-bar-stand-in",className:"fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white px-5 py-1 text-xs text-neutral-700",children:"Idle · 0 queued — stands in for the fixed ActivityBar band"}),e.jsx("div",{id:T,ref:n})]})},y={args:{title:"Confirm removal",children:e.jsx("div",{className:"flex flex-col gap-4",children:Array.from({length:12},(a,t)=>e.jsxs("p",{children:["Removing this group takes its ",t+1," members with it. Scroll to the end to confirm — the footer actions must stay clickable over the activity bar."]},t))}),footer:e.jsxs(e.Fragment,{children:[e.jsx(r,{variant:"ghost",children:"Cancel"}),e.jsx(r,{variant:"danger",children:"Confirm"})]})},render:a=>e.jsx(S,{...a}),play:async({canvasElement:a})=>{const t=C(a),o=await t.findByRole("dialog"),n=t.getByTestId("activity-bar-stand-in");await i(!!(n.compareDocumentPosition(o)&n.DOCUMENT_POSITION_FOLLOWING)).toBe(!0);const s=t.getByRole("button",{name:"Confirm"}),b=s.getBoundingClientRect(),j=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);await i(s.contains(j)).toBe(!0)}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:"{}",...c.parameters?.docs?.source},description:{story:"Basic modal with content only.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    children: <p>Are you sure you want to delete this item? This action cannot be undone.</p>,
    title: 'Confirm deletion',
    footer: <>
        <Button variant="ghost" onClick={fn()}>
          Cancel
        </Button>
        <Button variant="danger" onClick={fn()}>
          Delete
        </Button>
      </>
  }
}`,...l.parameters?.docs?.source},description:{story:"With a footer containing action buttons.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'sm',
    title: 'Small modal'
  }
}`,...d.parameters?.docs?.source},description:{story:"Small size variant.",...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'lg',
    title: 'Large modal'
  }
}`,...m.parameters?.docs?.source},description:{story:"Large size variant.",...m.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'xl',
    title: 'Extra-large modal'
  }
}`,...u.parameters?.docs?.source},description:{story:"Extra-large size variant.",...u.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Terms and Conditions',
    children: <div className="flex flex-col gap-4">
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat.
        </p>
        <p>
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
          nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia
          deserunt mollit anim id est laborum.
        </p>
        <p>
          Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
          laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi
          architecto beatae vitae dicta sunt explicabo.
        </p>
        <p>
          Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia
          consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
        </p>
      </div>,
    footer: <Button variant="primary">Accept</Button>
  }
}`,...p.parameters?.docs?.source},description:{story:"With long scrollable content.",...p.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    isOpen: false
  }
}`,...h.parameters?.docs?.source},description:{story:"Closed state (renders nothing).",...h.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  parameters: {
    motion: 'on'
  },
  args: {
    title: 'Confirm removal',
    children: <p>Closing this dialog animates it out; focus returns to the trigger at once.</p>
  },
  render: args => <ExitDemo {...args} />
}`,...g.parameters?.docs?.source},description:{story:"Motion showcase — open it, then dismiss with Escape, the overlay, or Cancel to watch\nthe exit. It deliberately has no `play` function, which would race the animation.",...g.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Confirm removal',
    children: <p>This dialog is opened and dismissed by the interaction test.</p>
  },
  render: args => <ExitDemo {...args} />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: 'Open modal'
    });
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole('dialog');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Cancel'
    }));

    // The hold releases and the panel leaves the DOM.
    await waitFor(() => expect(dialog.isConnected).toBe(false));
    expect(canvas.queryByRole('dialog')).toBeNull();

    // Focus went back to the trigger. This is the contract that matters: focus
    // restore is keyed on \`isOpen\`, not on the hold, so a keyboard user is never
    // stranded for the length of the exit.
    expect(document.activeElement).toBe(trigger);
  }
}`,...v.parameters?.docs?.source},description:{story:"The exit mount-hold running: the panel leaves the DOM and focus returns to the trigger.",...v.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Confirm removal',
    children: <p>Tab cycles inside this dialog; Escape dismisses it.</p>
  },
  render: args => <ExitDemo {...args} />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: 'Open modal'
    });
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole('dialog');

    // Tab all the way round: focus never escapes the panel.
    for (let i = 0; i < 5; i += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  }
}`,...f.parameters?.docs?.source},description:{story:"Escape closes the dialog, and Tab never leaves it while it is open.",...f.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Confirm removal',
    children: <div className="flex flex-col gap-4">
        {Array.from({
        length: 12
      }, (_, i) => <p key={i}>
            Removing this group takes its {i + 1} members with it. Scroll to the end to confirm —
            the footer actions must stay clickable over the activity bar.
          </p>)}
      </div>,
    footer: <>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger">Confirm</Button>
      </>
  },
  render: args => <OverActivityBar {...args} />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const dialog = await canvas.findByRole('dialog');
    const activityBar = canvas.getByTestId('activity-bar-stand-in');

    // Later in the document at an equal z-index = painted on top.
    await expect(Boolean(activityBar.compareDocumentPosition(dialog) & activityBar.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    // Real layout, real hit testing: whatever is under the footer's primary action
    // has to be that button, not the bar.
    const confirm = canvas.getByRole('button', {
      name: 'Confirm'
    });
    const box = confirm.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    await expect(confirm.contains(hit)).toBe(true);
  }
}`,...y.parameters?.docs?.source},description:{story:"The overlay portals into the shell's modal layer, which is mounted after the fixed\n`ActivityBar` band, so the footer actions stay clickable over it. The content is long\nenough that the panel reaches its `max-h` and the footer sits in the bar's band.",...y.parameters?.docs?.description}}};const L=["Default","WithFooter","Small","Large","ExtraLarge","WithLongContent","Closed","MotionShowcase","ExitInteraction","EscapeAndFocusTrap","OverTheActivityBar"];export{h as Closed,c as Default,f as EscapeAndFocusTrap,v as ExitInteraction,u as ExtraLarge,m as Large,g as MotionShowcase,y as OverTheActivityBar,d as Small,l as WithFooter,p as WithLongContent,L as __namedExportsOrder,D as default};
