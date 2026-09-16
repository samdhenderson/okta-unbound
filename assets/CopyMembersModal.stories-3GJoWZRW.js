import{C as l}from"./CopyMembersModal-D36olA9y.js";import{m}from"./fixtures-CsAiPaTu.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./memberAnalytics-BqndU7JT.js";const{expect:o,fn:d,userEvent:u,within:y}=__STORYBOOK_MODULE_TEST__,v={title:"Members/CopyMembersModal",component:l,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'Modal for copying the current member list as a chosen identifier (full name, email, username, or `name <email>`), one per line, with a live preview truncated by an "…and N more" summary. Blank identifiers are dropped so the count reflects only copyable lines.'}}},argTypes:{isOpen:{description:"Whether the modal is open."},onClose:{description:"Close the modal."},members:{description:"The members to copy (already filtered/sorted by the caller)."}},args:{isOpen:!0,onClose:d(),members:m.slice(0,20)}},e={},r={args:{members:m}},t={args:{members:[]}},a={args:{isOpen:!1}},s={play:async({canvasElement:p})=>{const n=y(p.ownerDocument.body),i=n.getByRole("button",{name:/Email/});await o(i).toHaveAttribute("aria-pressed","true");const c=n.getByRole("button",{name:/Full name/});await u.click(c),await o(c).toHaveAttribute("aria-pressed","true"),await o(i).toHaveAttribute("aria-pressed","false")}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:'Default "email" format with a live preview.',...e.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    members: mockUsers
  }
}`,...r.parameters?.docs?.source},description:{story:'A large member set truncates the preview with an "…and N more" summary.',...r.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    members: []
  }
}`,...t.parameters?.docs?.source},description:{story:"No members to copy — the preview and copy button both reflect the empty state.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    isOpen: false
  }
}`,...a.parameters?.docs?.source},description:{story:"Closed state renders nothing.",...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    const email = canvas.getByRole('button', {
      name: /Email/
    });
    await expect(email).toHaveAttribute('aria-pressed', 'true');
    const fullName = canvas.getByRole('button', {
      name: /Full name/
    });
    await userEvent.click(fullName);
    await expect(fullName).toHaveAttribute('aria-pressed', 'true');
    await expect(email).toHaveAttribute('aria-pressed', 'false');
  }
}`,...s.parameters?.docs?.source},description:{story:"Picking a different format moves the selection and rewrites the preview.",...s.parameters?.docs?.description}}};const E=["Default","LongList","Empty","Closed","SwitchingFormat"];export{a as Closed,e as Default,t as Empty,r as LongList,s as SwitchingFormat,E as __namedExportsOrder,v as default};
