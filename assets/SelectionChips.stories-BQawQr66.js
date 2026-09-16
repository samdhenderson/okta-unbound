import{ag as v,j as y,r as E}from"./iframe-tAvKsVeF.js";import{m as t}from"./fixtures-CsAiPaTu.js";import"./preload-helper-PPVm8Dsz.js";const{expect:h,fn:d,userEvent:f,within:b}=__STORYBOOK_MODULE_TEST__,u=e=>e,A={title:"Shared/SelectionChips",component:v,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Renders a set of selected items as removable chips — the display half of a multi-select.\n\nGeneric over the item type `T`; `getKey`/`getLabel` project each item. Shows `emptyMessage` when empty, and a “Clear all” link only when more than one item is selected."}}},argTypes:{items:{description:"Selected items to render as chips."},getKey:{description:"Stable React key for an item."},getLabel:{description:"Visible chip label for an item."},onRemove:{description:"Called to remove a single item (its × button)."},onClearAll:{description:"Optional “Clear all” handler; the link shows only when >1 item is selected."},emptyMessage:{description:"Placeholder text shown when there are no items."},className:{description:"Extra classes merged onto the outer container."}},args:{items:[],getKey:e=>u(e).id,getLabel:e=>{const s=u(e);return`${s.profile.firstName} ${s.profile.lastName}`},onRemove:d()}},a={},n={args:{emptyMessage:"No users assigned"}},o={args:{items:[t[0]]}},i={args:{items:t.slice(0,3)}},c={args:{items:t.slice(0,5),onClearAll:d()}},l={args:{items:[t[0]],onClearAll:d()}},m={args:{items:t.slice(0,10),onClearAll:d()}},p={args:{items:t.slice(0,3),onClearAll:d()},render:e=>{const s=()=>{const[g,r]=E.useState(e.items);return y.jsx(v,{...e,items:g,onRemove:S=>r(C=>C.filter(w=>w!==S)),onClearAll:()=>r([])})};return y.jsx(s,{})},play:async({canvasElement:e})=>{const s=b(e),g=u(t[0]),r=`${g.profile.firstName} ${g.profile.lastName}`;await f.click(s.getByRole("button",{name:`Remove ${r}`})),await h(s.queryByText(r)).not.toBeInTheDocument(),await f.click(s.getByRole("button",{name:"Clear all"})),await h(s.getByText("No items selected")).toBeInTheDocument()}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:"{}",...a.parameters?.docs?.source},description:{story:"Empty state.",...a.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    emptyMessage: 'No users assigned'
  }
}`,...n.parameters?.docs?.source},description:{story:"Empty with custom message.",...n.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    items: [mockUsers[0]]
  }
}`,...o.parameters?.docs?.source},description:{story:"Single item.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    items: mockUsers.slice(0, 3)
  }
}`,...i.parameters?.docs?.source},description:{story:"Multiple items.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    items: mockUsers.slice(0, 5),
    onClearAll: fn()
  }
}`,...c.parameters?.docs?.source},description:{story:"Multiple items with clear all.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    items: [mockUsers[0]],
    onClearAll: fn()
  }
}`,...l.parameters?.docs?.source},description:{story:"Single item without clear all (only shows with >1 item).",...l.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    items: mockUsers.slice(0, 10),
    onClearAll: fn()
  }
}`,...m.parameters?.docs?.source},description:{story:"Many items.",...m.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    items: mockUsers.slice(0, 3),
    onClearAll: fn()
  },
  render: args => {
    const Harness = () => {
      const [items, setItems] = useState<unknown[]>(args.items);
      return <SelectionChips {...args} items={items} onRemove={item => setItems(prev => prev.filter(candidate => candidate !== item))} onClearAll={() => setItems([])} />;
    };
    return <Harness />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const first = asUser(mockUsers[0]);
    const label = \`\${first.profile.firstName} \${first.profile.lastName}\`;
    await userEvent.click(canvas.getByRole('button', {
      name: \`Remove \${label}\`
    }));
    await expect(canvas.queryByText(label)).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Clear all'
    }));
    await expect(canvas.getByText('No items selected')).toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:`Wired to real state: removing a chip drops it, and “Clear all” disappears once
a single item is left.`,...p.parameters?.docs?.description}}};const I=["Empty","EmptyWithMessage","SingleItem","MultipleItems","WithClearAll","SingleNoHiddenClearAll","ManyItems","Removing"];export{a as Empty,n as EmptyWithMessage,m as ManyItems,i as MultipleItems,p as Removing,o as SingleItem,l as SingleNoHiddenClearAll,c as WithClearAll,I as __namedExportsOrder,A as default};
