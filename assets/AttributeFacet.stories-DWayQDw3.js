import{j as m,r as b}from"./iframe-tAvKsVeF.js";import{A as v}from"./AttributeFacet-DqXk6lMS.js";import{b as S,N as w,O as E}from"./memberAnalytics-BqndU7JT.js";import{m as h}from"./fixtures-CsAiPaTu.js";import"./preload-helper-PPVm8Dsz.js";import"./chartPalette-Byit8206.js";const{expect:d,fn:p,userEvent:x,within:V}=__STORYBOOK_MODULE_TEST__,g=S(h),A=g.find(e=>e.key==="department")??g[0],l={key:"title",label:"Title",distinct:9,populated:940,total:1e3,fillRate:94,rows:[{value:"Software Engineer",label:"Software Engineer",count:320,pct:32},{value:"Product Manager",label:"Product Manager",count:210,pct:21},{value:"Designer",label:"Designer",count:150,pct:15},{value:"Support Engineer",label:"Support Engineer",count:90,pct:9},{value:w,label:"(none)",count:60,pct:6},{value:E,label:"Other (5 values)",count:170,pct:17}]},F={title:"Members/AttributeFacet",component:v,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Compact card visualizing one profile attribute's value distribution as clickable filters: a segmented spread bar plus a legend of the leading values. Every segment and legend entry toggles a member-list filter; the value count opens the full distribution."}}},argTypes:{summary:{description:"The attribute and its precomputed value distribution."},activeValues:{description:"Canonical values currently active as filters for this attribute."},onToggleValue:{description:"Toggle a value as a member-list filter."},onExpand:{description:"Open the full value distribution for this attribute."}},args:{summary:A,activeValues:new Set,onToggleValue:p(),onExpand:p()}},t={},a={args:{summary:l}},r={args:{summary:l,activeValues:new Set(["Product Manager"])}},s={args:{summary:l},render:e=>{const o=()=>{const[i,y]=b.useState(new Set);return m.jsx(v,{...e,activeValues:i,onToggleValue:u=>y(f=>{const c=new Set(f);return c.has(u.value)?c.delete(u.value):c.add(u.value),c})})};return m.jsx(o,{})},play:async({canvasElement:e})=>{const o=V(e),i=o.getByRole("button",{name:/^Product Manager/});await d(i).toHaveAttribute("aria-pressed","false"),await x.click(i),await d(o.getByRole("button",{name:/^Product Manager/})).toHaveAttribute("aria-pressed","true")}},n={args:{summary:{...l,fillRate:62}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source},description:{story:"Single-value distribution discovered from the fixture members.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    summary: manyValuesSummary
  }
}`,...a.parameters?.docs?.source},description:{story:'Several named values plus "(none)" and an aggregated "Other" tail.',...a.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    summary: manyValuesSummary,
    activeValues: new Set(['Product Manager'])
  }
}`,...r.parameters?.docs?.source},description:{story:"One value is currently active as a member-list filter.",...r.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    summary: manyValuesSummary
  },
  render: args => {
    const Harness = () => {
      const [active, setActive] = useState<Set<string>>(new Set());
      return <AttributeFacet {...args} activeValues={active} onToggleValue={row => setActive(prev => {
        const next = new Set(prev);
        if (next.has(row.value)) next.delete(row.value);else next.add(row.value);
        return next;
      })} />;
    };
    return <Harness />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const legendEntry = canvas.getByRole('button', {
      name: /^Product Manager/
    });
    await expect(legendEntry).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(legendEntry);
    await expect(canvas.getByRole('button', {
      name: /^Product Manager/
    })).toHaveAttribute('aria-pressed', 'true');
  }
}`,...s.parameters?.docs?.source},description:{story:`Wired to real filter state: clicking a legend entry marks that value as the
active filter and the card takes its selected outline.`,...s.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    summary: {
      ...manyValuesSummary,
      fillRate: 62
    }
  }
}`,...n.parameters?.docs?.source},description:{story:'Low fill rate surfaces the "% set" suffix next to the value count.',...n.parameters?.docs?.description}}};const H=["Default","ManyValues","WithActiveFilter","Filtering","LowFillRate"];export{t as Default,s as Filtering,n as LowFillRate,a as ManyValues,r as WithActiveFilter,H as __namedExportsOrder,F as default};
