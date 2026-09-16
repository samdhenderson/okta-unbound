import{r as f,j as y}from"./iframe-tAvKsVeF.js";import{P as d}from"./ProfileDisplayOptions-BbWoDSJc.js";import{a as m,b as g}from"./profileDisplayStoryFixture-5h2bzOG7.js";import"./preload-helper-PPVm8Dsz.js";import"./profileDisplayStore-CVAj7s6I.js";import"./index-Dob3nYDb.js";const{expect:h,fn:u,userEvent:l,within:w}=__STORYBOOK_MODULE_TEST__,k={title:"Users/ProfileDisplayOptions",component:d,tags:["autodocs"],parameters:{a11y:{config:{rules:[{id:"heading-order",enabled:!1}]}},docs:{description:{component:`The four display options at the top of the Profile pane's customize mode: the layout, and the three marks the attribute list can carry. Every control is driven by the caller's draft config — this component holds no state. The "show attributes with no value" checkbox states the exact count it governs, so the option is never a guess about a profile the admin cannot see.`}}},argTypes:{attributes:{description:"Every attribute on the profile — the source of the empty count."},config:{description:"The draft configuration being edited."},onLayoutChange:{description:"Set the attribute list's layout."},onShowApiNamesChange:{description:"Show the raw Okta key beside each label."},onShowRuleChipsChange:{description:"Mark each attribute a group rule reads."},onShowEmptyChange:{description:"Render attributes that are empty on this user."}},args:{attributes:g,config:m,onLayoutChange:u(),onShowApiNamesChange:u(),onShowRuleChipsChange:u(),onShowEmptyChange:u()}},s={},n={args:{config:{...m,layout:"compact",showApiNames:!0}}},r={render:function(o){const[p,e]=f.useState(o.config);return y.jsx(d,{...o,config:p,onLayoutChange:t=>e(a=>({...a,layout:t})),onShowApiNamesChange:t=>e(a=>({...a,showApiNames:t})),onShowRuleChipsChange:t=>e(a=>({...a,showRuleChips:t})),onShowEmptyChange:t=>e(a=>({...a,showEmpty:t}))})},play:async({canvasElement:c})=>{const o=w(c),p=o.getByRole("button",{name:"Compact rows"});await l.click(p),await h(p).toHaveAttribute("aria-pressed","true"),await h(o.getByRole("button",{name:"Label + value rows"})).toHaveAttribute("aria-pressed","false");const e=o.getByRole("checkbox",{name:/Show Okta attribute names/});await l.click(e),await h(e).toBeChecked()}},i={args:{attributes:g.filter(c=>!c.isEmpty),config:{...m,showEmpty:!1}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"The shipped defaults: rows layout, rule chips on, empty attributes shown.",...s.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    config: {
      ...fixtureConfig,
      layout: 'compact',
      showApiNames: true
    }
  }
}`,...n.parameters?.docs?.source},description:{story:"Compact rows, with the Okta names revealed beside every label.",...n.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: function InteractiveOptions(args) {
    const [config, setConfig] = useState(args.config);
    return <ProfileDisplayOptions {...args} config={config} onLayoutChange={layout => setConfig(previous => ({
      ...previous,
      layout
    }))} onShowApiNamesChange={showApiNames => setConfig(previous => ({
      ...previous,
      showApiNames
    }))} onShowRuleChipsChange={showRuleChips => setConfig(previous => ({
      ...previous,
      showRuleChips
    }))} onShowEmptyChange={showEmpty => setConfig(previous => ({
      ...previous,
      showEmpty
    }))} />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const compact = canvas.getByRole('button', {
      name: 'Compact rows'
    });
    await userEvent.click(compact);
    await expect(compact).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', {
      name: 'Label + value rows'
    })).toHaveAttribute('aria-pressed', 'false');
    const apiNames = canvas.getByRole('checkbox', {
      name: /Show Okta attribute names/
    });
    await userEvent.click(apiNames);
    await expect(apiNames).toBeChecked();
  }
}`,...r.parameters?.docs?.source},description:{story:"Driven by real state, so the pills and checkboxes respond to a click.",...r.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    attributes: fixtureAttributes.filter(attribute => !attribute.isEmpty),
    config: {
      ...fixtureConfig,
      showEmpty: false
    }
  }
}`,...i.parameters?.docs?.source},description:{story:"A profile with nothing empty on it — the count says so rather than hiding.",...i.parameters?.docs?.description}}};const A=["Default","CompactWithApiNames","Interactive","NothingEmpty"];export{n as CompactWithApiNames,s as Default,r as Interactive,i as NothingEmpty,A as __namedExportsOrder,k as default};
