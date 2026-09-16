import{a7 as c}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const u={title:"Shared/EntityIdentity",component:c,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:"Renders the `rows` of an `EntityIdentityDescriptor` to the design system's secondary-text contract, with a `metric`'s value emphasised and an `id` through the shared `CopyableId`. Facts inside a row wrap together, separated by a middot.\n\nAn **empty row is dropped** rather than rendered as blank space, and a `status` fact is a demoted dot-plus-label rather than the header's loud trailing badge — which stays reserved for `danger`. It renders rows only: the name, badge and Okta link belong to the header's title row."}}},argTypes:{rows:{description:"The descriptor’s fact rows, in render order. Empty rows are dropped."}}},e={args:{rows:[[{kind:"id",value:"00gFAKE1a2b3c4d5e6",copyLabel:"Copy group id"}],[{kind:"metric",icon:"users",value:"1,284",label:"members"},{kind:"metric",icon:"bolt",value:"2",label:"rules"},{kind:"metric",icon:"link",value:"3",label:"references"}],[{kind:"text",icon:"clock",text:"Created 12 Mar 2021"},{kind:"text",text:"Updated 4 days ago"}]]}},a={args:{rows:[[{kind:"id",value:"00gFAKE1a2b3c4d5e6",copyLabel:"Copy group id"}],[{kind:"metric",icon:"users",value:"1,284",label:"members"}],[{kind:"text",icon:"clock",text:"Created 12 Mar 2021"}]]}},s={args:{rows:[[{kind:"id",value:"00gFAKE1a2b3c4d5e6",copyLabel:"Copy group id"}],[{kind:"metric",icon:"users",value:"1",label:"member"}]]}},n={args:{rows:[[{kind:"status",variant:"success",text:"ACTIVE"},{kind:"id",value:"00uFAKE9z8y7x6w5v",copyLabel:"Copy user id"}],[{kind:"metric",icon:"users",value:"42",label:"groups"},{kind:"metric",icon:"bolt",value:"3",label:"rules"}],[{kind:"text",icon:"clock",text:"Last login 2 days ago"},{kind:"text",text:"Created 2 Feb 2022"}]]}},r={args:{rows:[[{kind:"status",variant:"success",text:"ACTIVE"},{kind:"status",variant:"warning",text:"PASSWORD_EXPIRED"},{kind:"id",value:"00uFAKE9z8y7x6w5v",copyLabel:"Copy user id"}],[{kind:"metric",icon:"users",value:"42",label:"groups"}]]}},t={args:r.args,parameters:{viewport:{value:"sidepanelCompact"}}},o={args:{rows:[[{kind:"id",value:"00uFAKE9z8y7x6w5v",copyLabel:"Copy user id"}],[{kind:"metric",icon:"users",value:"0",label:"groups"}],[{kind:"text",icon:"clock",text:"Last login never"}]]}},i={args:e.args,parameters:{viewport:{value:"sidepanelCompact"}}},d={args:{rows:[[],[]]}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [[{
      kind: 'id',
      value: '00gFAKE1a2b3c4d5e6',
      copyLabel: 'Copy group id'
    }], [{
      kind: 'metric',
      icon: 'users',
      value: '1,284',
      label: 'members'
    }, {
      kind: 'metric',
      icon: 'bolt',
      value: '2',
      label: 'rules'
    }, {
      kind: 'metric',
      icon: 'link',
      value: '3',
      label: 'references'
    }], [{
      kind: 'text',
      icon: 'clock',
      text: 'Created 12 Mar 2021'
    }, {
      kind: 'text',
      text: 'Updated 4 days ago'
    }]]
  }
}`,...e.parameters?.docs?.source},description:{story:"A group with everything Okta reported: id, counts, both timestamps.",...e.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [[{
      kind: 'id',
      value: '00gFAKE1a2b3c4d5e6',
      copyLabel: 'Copy group id'
    }], [{
      kind: 'metric',
      icon: 'users',
      value: '1,284',
      label: 'members'
    }], [{
      kind: 'text',
      icon: 'clock',
      text: 'Created 12 Mar 2021'
    }]]
  }
}`,...a.parameters?.docs?.source},description:{story:"The same group before its rules load: the rule facts are absent rather than zero.",...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [[{
      kind: 'id',
      value: '00gFAKE1a2b3c4d5e6',
      copyLabel: 'Copy group id'
    }], [{
      kind: 'metric',
      icon: 'users',
      value: '1',
      label: 'member'
    }]]
  }
}`,...s.parameters?.docs?.source},description:{story:"Singular labels — the builder decides `member` vs `members`, not this component.",...s.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [[{
      kind: 'status',
      variant: 'success',
      text: 'ACTIVE'
    }, {
      kind: 'id',
      value: '00uFAKE9z8y7x6w5v',
      copyLabel: 'Copy user id'
    }], [{
      kind: 'metric',
      icon: 'users',
      value: '42',
      label: 'groups'
    }, {
      kind: 'metric',
      icon: 'bolt',
      value: '3',
      label: 'rules'
    }], [{
      kind: 'text',
      icon: 'clock',
      text: 'Last login 2 days ago'
    }, {
      kind: 'text',
      text: 'Created 2 Feb 2022'
    }]]
  }
}`,...n.parameters?.docs?.source},description:{story:"A user rung: the same vocabulary, a different builder, with `ACTIVE` demoted to a dot-marked fact.",...n.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [[{
      kind: 'status',
      variant: 'success',
      text: 'ACTIVE'
    }, {
      kind: 'status',
      variant: 'warning',
      text: 'PASSWORD_EXPIRED'
    }, {
      kind: 'id',
      value: '00uFAKE9z8y7x6w5v',
      copyLabel: 'Copy user id'
    }], [{
      kind: 'metric',
      icon: 'users',
      value: '42',
      label: 'groups'
    }]]
  }
}`,...r.parameters?.docs?.source},description:{story:"Several statuses at once: each is a dot-marked fact, so they wrap with the row instead of reserving a column each.",...r.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: MultipleStatuses.args,
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...t.parameters?.docs?.source},description:{story:"The same several-status row at the narrowest supported width.",...t.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [[{
      kind: 'id',
      value: '00uFAKE9z8y7x6w5v',
      copyLabel: 'Copy user id'
    }], [{
      kind: 'metric',
      icon: 'users',
      value: '0',
      label: 'groups'
    }], [{
      kind: 'text',
      icon: 'clock',
      text: 'Last login never'
    }]]
  }
}`,...o.parameters?.docs?.source},description:{story:"A user who has never signed in — a stated answer, not a missing one.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: Group.args,
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...i.parameters?.docs?.source},description:{story:"At 360px the facts wrap within their rows rather than pushing the panel sideways.",...i.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [[], []]
  }
}`,...d.parameters?.docs?.source},description:{story:"Every row empty: renders nothing, so the header's region collapses to zero height.",...d.parameters?.docs?.description}}};const m=["Group","GroupBeforeRulesLoad","SingleMember","User","MultipleStatuses","MultipleStatusesNarrow","NeverSignedIn","Narrow","Empty"];export{d as Empty,e as Group,a as GroupBeforeRulesLoad,r as MultipleStatuses,t as MultipleStatusesNarrow,i as Narrow,o as NeverSignedIn,s as SingleMember,n as User,m as __namedExportsOrder,u as default};
