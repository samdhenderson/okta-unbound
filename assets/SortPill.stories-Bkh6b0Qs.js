import{S as v,j as o,r as u}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:a,fn:w,userEvent:m,within:y}=__STORYBOOK_MODULE_TEST__,x={title:"Shared/SortPill",component:v,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"A sort-toggle pill: a `FilterPill` that shows a directional caret when its field is the active sort, rotating it for descending order. Generic over the caller’s sort-field union, so a filter panel gets a type-safe set of pills instead of hand-rolled buttons."}}},argTypes:{field:{description:"The sort field this pill selects."},label:{description:"Label shown on the pill."},activeField:{description:"The currently active sort field."},descending:{description:"Whether the active sort is descending."},onToggle:{description:"Called with this pill’s field when clicked."}},args:{field:"name",label:"Name",onToggle:w()}},i={args:{activeField:"status",descending:!1}},n={args:{activeField:"name",descending:!1}},r={args:{activeField:"name",descending:!0}},F=[{field:"name",label:"Name"},{field:"status",label:"Status"},{field:"factors",label:"Factor count"}],c={args:{activeField:"name",descending:!1},render:d=>{const e=()=>{const[t,f]=u.useState("name"),[g,p]=u.useState(!1),h=s=>{d.onToggle(s),s===t?p(l=>!l):(f(s),p(!1))};return o.jsxs("div",{className:"flex items-center gap-1.5",children:[F.map(({field:s,label:l})=>o.jsx(v,{field:s,label:l,activeField:t,descending:g,onToggle:h},s)),o.jsx("span",{"data-testid":"direction",children:g?"descending":"ascending"})]})};return o.jsx(e,{})},play:async({canvasElement:d})=>{const e=y(d),t=e.getByRole("button",{name:/Status/});await a(e.getByRole("button",{name:/Name/})).toHaveAttribute("aria-pressed","true"),await m.click(t),await a(t).toHaveAttribute("aria-pressed","true"),await a(e.getByRole("button",{name:/Name/})).toHaveAttribute("aria-pressed","false"),await a(e.getByTestId("direction")).toHaveTextContent("ascending"),await m.click(t),await a(e.getByTestId("direction")).toHaveTextContent("descending")}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    activeField: 'status',
    descending: false
  }
}`,...i.parameters?.docs?.source},description:{story:"Inactive — a different field is the active sort.",...i.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    activeField: 'name',
    descending: false
  }
}`,...n.parameters?.docs?.source},description:{story:"Active, ascending — the caret points up.",...n.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    activeField: 'name',
    descending: true
  }
}`,...r.parameters?.docs?.source},description:{story:"Active, descending — the caret points down.",...r.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    activeField: 'name',
    descending: false
  },
  render: args => {
    const Harness = () => {
      const [activeField, setActiveField] = useState<SortField>('name');
      const [descending, setDescending] = useState(false);
      const toggle = (field: SortField) => {
        args.onToggle(field);
        if (field === activeField) setDescending(d => !d);else {
          setActiveField(field);
          setDescending(false);
        }
      };
      return <div className="flex items-center gap-1.5">
          {FIELDS.map(({
          field,
          label
        }) => <SortPill key={field} field={field} label={label} activeField={activeField} descending={descending} onToggle={toggle} />)}
          <span data-testid="direction">{descending ? 'descending' : 'ascending'}</span>
        </div>;
    };
    return <Harness />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const status = canvas.getByRole('button', {
      name: /Status/
    });
    await expect(canvas.getByRole('button', {
      name: /Name/
    })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(status);
    await expect(status).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', {
      name: /Name/
    })).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.getByTestId('direction')).toHaveTextContent('ascending');
    await userEvent.click(status);
    await expect(canvas.getByTestId('direction')).toHaveTextContent('descending');
  }
}`,...c.parameters?.docs?.source},description:{story:"A real sort row: clicking a new field selects it, clicking it again flips direction.",...c.parameters?.docs?.description}}};const T=["Inactive","ActiveAscending","ActiveDescending","Interactive"];export{n as ActiveAscending,r as ActiveDescending,i as Inactive,c as Interactive,T as __namedExportsOrder,x as default};
