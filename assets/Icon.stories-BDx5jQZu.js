import{b as h,j as y}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:x,within:S}=__STORYBOOK_MODULE_TEST__,v={title:"Shared/Icon",component:h,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Inline SVG icon registry: maps an icon name to a Tailwind-sized, `currentColor`-stroked SVG, so call sites reference glyphs by name with no external icon library. Sizes are `xs` (12px), `sm` (16px), `md` (20px), `lg` (24px), `xl` (32px); pass a colour token through `className`. See `AllIcons` for the catalog.\n\nEvery glyph is `aria-hidden` unless `label` says it carries meaning of its own. `label` is **not** how an icon-only control gets its name — that comes from the control (`IconButton`'s `label`, or an `aria-label`)."}}},argTypes:{type:{description:"Which glyph to render (see the `AllIcons` catalog)."},className:{description:"Extra classes merged after the size class (e.g. a color token)."},size:{description:"Preset square dimensions: xs=12px, sm=16px, md=20px, lg=24px, xl=32px."},label:{description:"Accessible name, for the rare glyph that *is* the answer. Omit it and the icon leaves the accessibility tree."}},args:{type:"check"}},r={play:async({canvasElement:e})=>{await x(S(e).queryByRole("img")).not.toBeInTheDocument()}},a={args:{type:"shield",label:"MFA enrolled"},play:async({canvasElement:e})=>{const s=S(e);await x(s.getByRole("img",{name:"MFA enrolled"})).toBeInTheDocument()}},t={args:{size:"xs"}},o={args:{size:"sm"}},n={args:{size:"lg"}},c={args:{size:"xl"}},i={args:{type:"users"}},l={args:{type:"alert"}},p={args:{type:"settings"}},d={args:{type:"upload"}},m={args:{type:"pencil"}},g={args:{type:"bolt",className:"text-primary"}},u={render:()=>{const e=["users","user","check","alert","bolt","chart","app","building","home","lock","refresh","download","upload","settings","trash","pencil","grip","eye","eye-off","plus","minus","search","link","list","hand","key","sparkles","pause","shield","clipboard","clipboard-check","chevron-left","chevron-down","chevron-right"];return y.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(5, 1fr)",gap:16},children:e.map(s=>y.jsxs("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:8},children:[y.jsx(h,{type:s,size:"lg"}),y.jsx("span",{style:{fontSize:12,textAlign:"center"},children:s})]},s))})}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).queryByRole('img')).not.toBeInTheDocument();
  }
}`,...r.parameters?.docs?.source},description:{story:"Default icon (check, medium size) — decorative, and absent from the accessibility tree.",...r.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'shield',
    label: 'MFA enrolled'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', {
      name: 'MFA enrolled'
    })).toBeInTheDocument();
  }
}`,...a.parameters?.docs?.source},description:{story:'The opt-out: a glyph standing alone as a status takes `role="img"` and the name it is given.',...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'xs'
  }
}`,...t.parameters?.docs?.source},description:{story:"Extra-small size.",...t.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'sm'
  }
}`,...o.parameters?.docs?.source},description:{story:"Small size.",...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'lg'
  }
}`,...n.parameters?.docs?.source},description:{story:"Large size.",...n.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'xl'
  }
}`,...c.parameters?.docs?.source},description:{story:"Extra-large size.",...c.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'users'
  }
}`,...i.parameters?.docs?.source},description:{story:"Users icon.",...i.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'alert'
  }
}`,...l.parameters?.docs?.source},description:{story:"Alert icon.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'settings'
  }
}`,...p.parameters?.docs?.source},description:{story:"Settings icon.",...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'upload'
  }
}`,...d.parameters?.docs?.source},description:{story:"Upload icon.",...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'pencil'
  }
}`,...m.parameters?.docs?.source},description:{story:"Pencil (edit/rename) icon.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'bolt',
    className: 'text-primary'
  }
}`,...g.parameters?.docs?.source},description:{story:"With custom color class.",...g.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  render: () => {
    const iconTypes: IconType[] = ['users', 'user', 'check', 'alert', 'bolt', 'chart', 'app', 'building', 'home', 'lock', 'refresh', 'download', 'upload', 'settings', 'trash', 'pencil', 'grip', 'eye', 'eye-off', 'plus', 'minus', 'search', 'link', 'list', 'hand', 'key', 'sparkles', 'pause', 'shield', 'clipboard', 'clipboard-check', 'chevron-left', 'chevron-down', 'chevron-right'];
    return <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 16
    }}>
        {iconTypes.map(type => <div key={type} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8
      }}>
            <Icon type={type} size="lg" />
            <span style={{
          fontSize: 12,
          textAlign: 'center'
        }}>{type}</span>
          </div>)}
      </div>;
  }
}`,...u.parameters?.docs?.source},description:{story:"Icon grid showing all available types.",...u.parameters?.docs?.description}}};const z=["Default","NamedWhenTheGlyphIsTheAnswer","ExtraSmall","Small","Large","ExtraLarge","Users","Alert","Settings","Upload","Pencil","WithCustomColor","AllIcons"];export{l as Alert,u as AllIcons,r as Default,c as ExtraLarge,t as ExtraSmall,n as Large,a as NamedWhenTheGlyphIsTheAnswer,m as Pencil,p as Settings,o as Small,d as Upload,i as Users,g as WithCustomColor,z as __namedExportsOrder,v as default};
