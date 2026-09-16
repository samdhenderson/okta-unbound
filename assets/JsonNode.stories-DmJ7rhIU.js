import{ac as m}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:a,userEvent:p,within:d}=__STORYBOOK_MODULE_TEST__,u={id:"00uFAKE0000000000001",status:"ACTIVE",created:"2026-01-15T09:00:00.000Z",activated:null,profile:{login:"user@example.com",email:"user@example.com",firstName:"Ada",lastName:"Lovelace",department:"Platform Engineering",mobilePhone:null},credentials:{provider:{type:"OKTA",name:"OKTA"},recovery_question:{question:"Favourite compiler?"}},_links:{groups:{href:"https://example.okta.com/api/v1/users/00uFAKE0000000000001/groups"}}},v={title:"Shared/JsonNode",component:m,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"One row of a JSON tree: a primitive leaf coloured by type, or an expandable object/array node whose children are more `JsonNode`s. The toggle is a real `<button>` carrying `aria-expanded`, and a collapsed node states how many keys or items it is holding rather than hiding the count.\n\nOpen/collapsed state is uncontrolled and starts open for the first two levels, collapsed deeper — Okta responses nest a few levels (`_embedded.users[].profile`), and opening all of them at once is unreadable."}}},argTypes:{keyLabel:{description:"Object key or array index this node sits under; omitted for the root."},value:{description:"The value to render — a primitive leaf, or an object/array to recurse into."},depth:{description:"Nesting depth, driving indentation and the default open state."}},args:{value:u,depth:0}},n={},r={args:{value:{aString:"ACTIVE",aNumber:42,aBoolean:!0,aNull:null}}},s={args:{keyLabel:"factors",value:["Okta Verify","SMS","WebAuthn"],depth:0}},i={args:{keyLabel:"status",value:"ACTIVE",depth:0},play:async({canvasElement:o})=>{const e=d(o);await a(e.getByText('"ACTIVE"')).toBeInTheDocument(),await a(e.queryByRole("button")).toBeNull()}},c={args:{keyLabel:"provider",value:{type:"OKTA",name:"OKTA"},depth:3},play:async({canvasElement:o})=>{const e=d(o),t=e.getByRole("button");await a(t).toHaveAttribute("aria-expanded","false"),await a(e.getByText(/2 keys/)).toBeInTheDocument()}},l={args:{keyLabel:"profile",value:u.profile,depth:2},play:async({canvasElement:o})=>{const e=d(o),t=e.getByRole("button",{name:/profile/});await a(t).toHaveAttribute("aria-expanded","false"),await a(e.queryByText("login:")).toBeNull(),await p.click(t),await a(t).toHaveAttribute("aria-expanded","true"),await a(e.getByText("login:")).toBeInTheDocument(),await p.click(t),await a(e.queryByText("login:")).toBeNull(),await a(e.getByText(/6 keys/)).toBeInTheDocument()}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:"A response root: open two levels down, collapsed below that.",...n.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    value: {
      aString: 'ACTIVE',
      aNumber: 42,
      aBoolean: true,
      aNull: null
    }
  }
}`,...r.parameters?.docs?.source},description:{story:"Each primitive type takes its own colour, `null` included.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    keyLabel: 'factors',
    value: ['Okta Verify', 'SMS', 'WebAuthn'],
    depth: 0
  }
}`,...s.parameters?.docs?.source},description:{story:"An array node: entries are indexed, and the count rides the collapsed bracket.",...s.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    keyLabel: 'status',
    value: 'ACTIVE',
    depth: 0
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('"ACTIVE"')).toBeInTheDocument();
    await expect(canvas.queryByRole('button')).toBeNull();
  }
}`,...i.parameters?.docs?.source},description:{story:"A leaf on its own — no toggle, because there is nothing to disclose.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    keyLabel: 'provider',
    value: {
      type: 'OKTA',
      name: 'OKTA'
    },
    depth: 3
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.getByText(/2 keys/)).toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"Past the second level a node arrives collapsed, stating its key count.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    keyLabel: 'profile',
    value: userResponse.profile,
    depth: 2
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', {
      name: /profile/
    });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryByText('login:')).toBeNull();
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('login:')).toBeInTheDocument();
    await userEvent.click(toggle);
    await expect(canvas.queryByText('login:')).toBeNull();
    await expect(canvas.getByText(/6 keys/)).toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:"The disclosure driven the way a reader drives it: opening `profile` reveals the\nkeys underneath, and closing it puts the count back.",...l.parameters?.docs?.description}}};const h=["Default","Primitives","ArrayNode","PrimitiveLeaf","DeepNodeStartsCollapsed","TogglingANode"];export{s as ArrayNode,c as DeepNodeStartsCollapsed,n as Default,i as PrimitiveLeaf,r as Primitives,l as TogglingANode,h as __namedExportsOrder,v as default};
