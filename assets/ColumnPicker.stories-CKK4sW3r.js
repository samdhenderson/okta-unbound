import{j as i,r as f}from"./iframe-tAvKsVeF.js";import{C as p}from"./ColumnPicker-BD3tvQ2E.js";import"./preload-helper-PPVm8Dsz.js";const{expect:l,fn:E,userEvent:u,within:w}=__STORYBOOK_MODULE_TEST__,m=[{id:"id",label:"User ID",group:"base",defaultEnabled:!0,accessor:()=>"00uFAKE"},{id:"status",label:"Status",group:"base",defaultEnabled:!0,accessor:()=>"ACTIVE"},{id:"created",label:"Created",group:"base",defaultEnabled:!1,accessor:()=>""},{id:"email",label:"Email",group:"profile",defaultEnabled:!0,accessor:()=>"user@example.com"},{id:"firstName",label:"First Name",group:"profile",defaultEnabled:!0,accessor:()=>"Ada"},{id:"department",label:"Department",group:"profile",defaultEnabled:!1,accessor:()=>"Engineering"}],y={title:"Export/ColumnPicker",component:p,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Groups the descriptor's catalog into `Identity`, `Profile` and `Custom` buckets — empty buckets are skipped — and renders each column as a toggle chip. Fully controlled: the enabled set and the toggling belong to the Export tab hook."}}},argTypes:{catalog:{description:"The descriptor's full column catalog (grouped and rendered as chips)."},enabled:{description:"Ids of the currently enabled columns."},onToggle:{description:"Toggle a single column on/off by id."}},args:{catalog:m,enabled:new Set(["id","status","email","firstName"]),onToggle:E()}},t={},r={args:{enabled:new Set(["email"])}},s={args:{enabled:new Set(m.map(a=>a.id))}},n={render:a=>{const d=()=>{const[e,b]=f.useState(new Set(["id","status","email","firstName"]));return i.jsx(p,{...a,enabled:e,onToggle:c=>b(g=>{const o=new Set(g);return o.has(c)?o.delete(c):o.add(c),o})})};return i.jsx(d,{})},play:async({canvasElement:a})=>{const e=w(a).getByRole("button",{name:"Created"});await l(e).toHaveAttribute("aria-pressed","false"),await u.click(e),await l(e).toHaveAttribute("aria-pressed","true"),await u.click(e),await l(e).toHaveAttribute("aria-pressed","false")}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source},description:{story:"Default selection: the descriptor's `defaultEnabled` columns.",...t.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    enabled: new Set(['email'])
  }
}`,...r.parameters?.docs?.source},description:{story:"Only a single column enabled.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    enabled: new Set(catalog.map(column => column.id))
  }
}`,...s.parameters?.docs?.source},description:{story:"Every column enabled.",...s.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: args => {
    const Harness = () => {
      const [enabled, setEnabled] = useState(new Set(['id', 'status', 'email', 'firstName']));
      return <ColumnPicker {...args} enabled={enabled} onToggle={id => setEnabled(previous => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);else next.add(id);
        return next;
      })} />;
    };
    return <Harness />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const created = canvas.getByRole('button', {
      name: 'Created'
    });
    await expect(created).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(created);
    await expect(created).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(created);
    await expect(created).toHaveAttribute('aria-pressed', 'false');
  }
}`,...n.parameters?.docs?.source},description:{story:`The picker driven by real state, so the chips respond — an off column can be
switched on and the header count follows.`,...n.parameters?.docs?.description}}};const S=["Default","Minimal","AllEnabled","Interactive"];export{s as AllEnabled,t as Default,n as Interactive,r as Minimal,S as __namedExportsOrder,y as default};
