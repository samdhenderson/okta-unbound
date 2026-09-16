import{j as B,r as V}from"./iframe-tAvKsVeF.js";import{P as M}from"./ProfileEditCell-DdhUiuAe.js";import"./preload-helper-PPVm8Dsz.js";const{expect:r,fn:a,userEvent:L,within:o}=__STORYBOOK_MODULE_TEST__,n=(e,t,s,R="base")=>({key:R==="system"?e:`profile.${e}`,name:e,label:t,kind:R,value:s,raw:s,isEmpty:s===""}),c=(e,t={})=>({editable:!0,control:e,required:t.required??!1,...t.options?{options:t.options}:{}}),i=(e,t,s)=>({editable:!1,reason:e,explanation:t,...s?{source:s}:{}}),H=n("department","Department","Platform Engineering"),N=n("login","Username","ada.example@example.com"),I=n("streetAddress","Street Address","4400 Northwest Cornelius Pass Road, Building 12, Suite 1400, Hillsboro, Oregon 97124"),_={title:"Users/ProfileEditCell",component:M,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:'One attribute’s **value cell**, in whichever of three states applies: read-only, an editable control, or locked with the reason said out loud.\n\n`onChange` is the mode switch. Absent, the cell renders the saved value read-only — which is every attribute outside edit mode. Present, an editable attribute gets the control its schema type calls for (`Input`, `Select`, `Checkbox`, or `Input type="number"`), and a locked one gets its value dimmed behind a padlock plus a sentence saying who owns it. **A lock is visible and explained, never a silently disabled field.**\n\nThe cell renders the value only, never the label — the control takes its accessible name from the attribute’s label — and values wrap rather than truncate.'}}},decorators:[e=>B.jsx("div",{className:"bg-canvas p-4",children:B.jsx("div",{className:"rounded-md border border-neutral-200 bg-white p-3",children:B.jsx(e,{})})})],args:{attribute:H,editability:c("text")},argTypes:{attribute:{description:"The attribute whose value this cell renders."},editability:{description:"The verdict from `attributeEditability` — how to edit, or why not."},draft:{description:"The in-flight value; absent means this attribute is untouched."},onChange:{description:"Present only in edit mode. Absent renders the cell read-only."},invalid:{description:"Validation message for this attribute, from `validateDraft`."},mono:{description:"Render the value in a monospace font (ids and similar)."}}},d={play:async({canvasElement:e})=>{const t=o(e);await r(t.getByText("Platform Engineering")).toBeInTheDocument(),await r(t.queryByRole("textbox")).not.toBeInTheDocument()}},l={args:{attribute:n("costCenter","Cost Center","")},play:async({canvasElement:e})=>{const t=o(e);await r(t.getByTitle("No value")).toBeInTheDocument()}},p={args:{attribute:n("employeeNumber","Employee Number","E-0000042"),mono:!0}},u={args:{onChange:a()},play:async({canvasElement:e})=>{const t=o(e);await r(t.getByRole("textbox",{name:"Department"})).toHaveValue("Platform Engineering")}},m={args:{onChange:a(),draft:"Security Engineering"},play:async({canvasElement:e})=>{const t=o(e);await r(t.getByRole("textbox",{name:"Department"})).toHaveValue("Security Engineering")}},h={args:{attribute:n("seats","Seats","5"),editability:c("number"),onChange:a(),draft:"12abc",invalid:"Enter a number."},play:async({canvasElement:e})=>{const t=o(e);await r(t.getByText("Enter a number.")).toBeInTheDocument()}},g={args:{attribute:n("seats","Seats","5"),editability:c("number"),onChange:a()}},y={args:{attribute:n("region","Region","EMEA"),editability:c("select",{options:[{value:"EMEA",label:"Europe, Middle East & Africa"},{value:"AMER",label:"Americas"}]}),onChange:a()},play:async({canvasElement:e})=>{const t=o(e);await r(t.getByRole("combobox",{name:"Region"})).toHaveValue("EMEA")}},b={args:{attribute:n("region","Region","LATAM"),editability:c("select",{options:[{value:"EMEA",label:"Europe, Middle East & Africa"},{value:"AMER",label:"Americas"}]}),onChange:a()},play:async({canvasElement:e})=>{const t=o(e);await r(t.getByRole("combobox",{name:"Region"})).toHaveValue("LATAM")}},v={args:{attribute:n("isContractor","Is Contractor","true"),editability:c("checkbox"),onChange:a()},play:async({canvasElement:e})=>{const t=o(e);await r(t.getByRole("checkbox",{name:"Is Contractor"})).toBeChecked()}},f={args:{attribute:n("lastLogin","Last Login","Aug 17, 2026","system"),editability:i("system","This is an account field rather than a profile attribute, so it is not edited here."),onChange:a()},play:async({canvasElement:e})=>{const t=o(e);await r(t.getByText(/not edited here/)).toBeInTheDocument(),await r(t.queryByRole("textbox")).not.toBeInTheDocument()}},E={args:{attribute:n("legacyWorkerFlag","Legacy Worker Flag","Y","custom"),editability:i("not-in-schema","The org's profile schema does not describe this attribute, so this panel will not write to it."),onChange:a()}},x={args:{attribute:n("userType","User Type","EMPLOYEE"),editability:i("read-only","Okta reports this attribute as read-only, so it is changed elsewhere."),onChange:a()}},w={args:{attribute:n("externalSecretRef","External Secret Ref",""),editability:i("write-only","Okta accepts a value for this attribute but never returns one, so there is nothing here to edit against."),onChange:a()}},A={args:{editability:i("externally-mastered","An external system masters this attribute (Active Directory), so it is changed there rather than here.","Active Directory"),onChange:a()},play:async({canvasElement:e})=>{const t=o(e);await r(t.getByText(/Active Directory/)).toBeInTheDocument()}},C={args:{attribute:N,editability:i("account-mastered","This account is mastered by Active Directory, so the sign-in name is changed there rather than here.","Active Directory"),onChange:a()}},T={args:{attribute:n("aliases","Aliases","ada,ada.example","custom"),editability:i("unsupported-type","This panel does not edit array attributes."),onChange:a()}},S={args:{onChange:a()},render:e=>{const t=()=>{const[s,R]=V.useState(void 0);return B.jsx(M,{...e,draft:s,onChange:O=>R(O)})};return B.jsx(t,{})},play:async({canvasElement:e})=>{const s=o(e).getByRole("textbox",{name:"Department"});await L.clear(s),await L.type(s,"Security Engineering"),await r(s).toHaveValue("Security Engineering")}},k={args:{attribute:I}},D={args:{attribute:I,editability:i("externally-mastered","An external system masters this attribute (Active Directory), so it is changed there rather than here.","Active Directory"),onChange:a()},parameters:{viewport:{value:"sidepanelCompact"}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Platform Engineering')).toBeInTheDocument();
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"Outside edit mode: the saved value, no control, whatever the verdict says.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: attribute('costCenter', 'Cost Center', '')
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTitle('No value')).toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:"The user has no value for this attribute. An em dash states the absence.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: attribute('employeeNumber', 'Employee Number', 'E-0000042'),
    mono: true
  }
}`,...p.parameters?.docs?.source},description:{story:"Read-only, in monospace — how an identifier-shaped attribute renders.",...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    onChange: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', {
      name: 'Department'
    })).toHaveValue('Platform Engineering');
  }
}`,...u.parameters?.docs?.source},description:{story:"Edit mode, free text. The field takes its accessible name from the attribute's label.",...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    onChange: fn(),
    draft: 'Security Engineering'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', {
      name: 'Department'
    })).toHaveValue('Security Engineering');
  }
}`,...m.parameters?.docs?.source},description:{story:"A draft differing from the saved value — what the surface's Save button is armed by.",...m.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: attribute('seats', 'Seats', '5'),
    editability: editable('number'),
    onChange: fn(),
    draft: '12abc',
    invalid: 'Enter a number.'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Enter a number.')).toBeInTheDocument();
  }
}`,...h.parameters?.docs?.source},description:{story:"A validation message, rendered through `Input`'s own error state rather than beside it.",...h.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: attribute('seats', 'Seats', '5'),
    editability: editable('number'),
    onChange: fn()
  }
}`,...g.parameters?.docs?.source},description:{story:"A number attribute: the same field, typed, so a phone keypad and the spinners appear.",...g.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: attribute('region', 'Region', 'EMEA'),
    editability: editable('select', {
      options: [{
        value: 'EMEA',
        label: 'Europe, Middle East & Africa'
      }, {
        value: 'AMER',
        label: 'Americas'
      }]
    }),
    onChange: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('combobox', {
      name: 'Region'
    })).toHaveValue('EMEA');
  }
}`,...y.parameters?.docs?.source},description:{story:"An attribute the schema enumerates, with the `oneOf` titles as the option labels.",...y.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: attribute('region', 'Region', 'LATAM'),
    editability: editable('select', {
      options: [{
        value: 'EMEA',
        label: 'Europe, Middle East & Africa'
      }, {
        value: 'AMER',
        label: 'Americas'
      }]
    }),
    onChange: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('combobox', {
      name: 'Region'
    })).toHaveValue('LATAM');
  }
}`,...b.parameters?.docs?.source},description:{story:"A saved value the schema no longer enumerates: the cell keeps it as an option rather than displaying a different one.",...b.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: attribute('isContractor', 'Is Contractor', 'true'),
    editability: editable('checkbox'),
    onChange: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('checkbox', {
      name: 'Is Contractor'
    })).toBeChecked();
  }
}`,...v.parameters?.docs?.source},description:{story:"A boolean attribute. The tickbox is bare — the surface already renders the label.",...v.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: attribute('lastLogin', 'Last Login', 'Aug 17, 2026', 'system'),
    editability: locked('system', 'This is an account field rather than a profile attribute, so it is not edited here.'),
    onChange: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/not edited here/)).toBeInTheDocument();
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
  }
}`,...f.parameters?.docs?.source},description:{story:"A top-level account field. Not a profile attribute at all, so there is nothing to edit.",...f.parameters?.docs?.description}}};E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: attribute('legacyWorkerFlag', 'Legacy Worker Flag', 'Y', 'custom'),
    editability: locked('not-in-schema', "The org's profile schema does not describe this attribute, so this panel will not write to it."),
    onChange: fn()
  }
}`,...E.parameters?.docs?.source},description:{story:"The org's schema never described it, so its type and mastering are both unknown.",...E.parameters?.docs?.description}}};x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: attribute('userType', 'User Type', 'EMPLOYEE'),
    editability: locked('read-only', 'Okta reports this attribute as read-only, so it is changed elsewhere.'),
    onChange: fn()
  }
}`,...x.parameters?.docs?.source},description:{story:"Okta reports the attribute as read-only.",...x.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: attribute('externalSecretRef', 'External Secret Ref', ''),
    editability: locked('write-only', 'Okta accepts a value for this attribute but never returns one, so there is nothing here to edit against.'),
    onChange: fn()
  }
}`,...w.parameters?.docs?.source},description:{story:"Okta accepts a value but never returns one, so there is no before-value to edit against.",...w.parameters?.docs?.description}}};A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  args: {
    editability: locked('externally-mastered', 'An external system masters this attribute (Active Directory), so it is changed there rather than here.', 'Active Directory'),
    onChange: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Active Directory/)).toBeInTheDocument();
  }
}`,...A.parameters?.docs?.source},description:{story:"A profile master owns the attribute, so it is changed at that source rather than here.",...A.parameters?.docs?.description}}};C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: login,
    editability: locked('account-mastered', 'This account is mastered by Active Directory, so the sign-in name is changed there rather than here.', 'Active Directory'),
    onChange: fn()
  }
}`,...C.parameters?.docs?.source},description:{story:"`login` is a credential, so the account's provider decides it and the sign-in name is changed there.",...C.parameters?.docs?.description}}};T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: attribute('aliases', 'Aliases', 'ada,ada.example', 'custom'),
    editability: locked('unsupported-type', 'This panel does not edit array attributes.'),
    onChange: fn()
  }
}`,...T.parameters?.docs?.source},description:{story:"A multi-value attribute. Editing it needs a repeater this panel does not have.",...T.parameters?.docs?.description}}};S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    onChange: fn()
  },
  render: args => {
    const Harness = () => {
      const [draft, setDraft] = useState<string | undefined>(undefined);
      return <ProfileEditCell {...args} draft={draft} onChange={next => setDraft(next)} />;
    };
    return <Harness />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', {
      name: 'Department'
    });
    await userEvent.clear(field);
    await userEvent.type(field, 'Security Engineering');
    await expect(field).toHaveValue('Security Engineering');
  }
}`,...S.parameters?.docs?.source},description:{story:`The editable cell wired to real draft state: typing replaces the saved value with
the draft the surface would save.`,...S.parameters?.docs?.description}}};k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: streetAddress
  }
}`,...k.parameters?.docs?.source},description:{story:"A long value wraps rather than truncating — the defect this cell's contract exists to prevent.",...k.parameters?.docs?.description}}};D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  args: {
    attribute: streetAddress,
    editability: locked('externally-mastered', 'An external system masters this attribute (Active Directory), so it is changed there rather than here.', 'Active Directory'),
    onChange: fn()
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...D.parameters?.docs?.source},description:{story:"The 360px floor, mid-edit: the field and the lock sentence both wrap rather than clipping.",...D.parameters?.docs?.description}}};const j=["Default","Empty","Mono","Editing","Dirty","ErrorState","NumberField","SelectField","SelectWithRetiredValue","CheckboxField","LockedSystem","LockedNotInSchema","LockedReadOnly","LockedWriteOnly","LockedExternallyMastered","LockedAccountMastered","LockedUnsupportedType","TypingADraft","LongValue","Compact"];export{v as CheckboxField,D as Compact,d as Default,m as Dirty,u as Editing,l as Empty,h as ErrorState,C as LockedAccountMastered,A as LockedExternallyMastered,E as LockedNotInSchema,x as LockedReadOnly,f as LockedSystem,T as LockedUnsupportedType,w as LockedWriteOnly,k as LongValue,p as Mono,g as NumberField,y as SelectField,b as SelectWithRetiredValue,S as TypingADraft,j as __namedExportsOrder,_ as default};
