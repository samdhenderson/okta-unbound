import{P as A,j as e,B as r,a8 as O,a7 as W,af as E}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{fn:t}=__STORYBOOK_MODULE_TEST__,C={title:"Shared/PageHeader",component:A,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The one header a tab keeps mounted: title with optional subtitle, status badge, leading slot (back button or breadcrumbs), trailing actions, and an `identity` region describing the entity being browsed. A tab driven by `useViewStack` swaps its contents in place rather than rendering a header per view; changing `identityKey` crossfades the region, while the `<h1>` and its badge never do.\n\nOn an entity rung the badge column is reserved for `danger` — a locked or deactivated entity should shout — and every calmer status is demoted to a dot-marked `status` fact inside the identity region, which is what holds the header to a constant height."}}},argTypes:{title:{description:"Page/section heading."},subtitle:{description:"Optional secondary line under the title."},actions:{description:"Optional trailing action node(s), right-aligned (e.g. a `Button`)."},badge:{description:"Optional coloured badge next to the title. Variant defaults to `neutral`."},onBack:{description:"When set, renders a leading chevron-left back button before the title."},backLabel:{description:"Accessible name / tooltip for the back button. Defaults to `Back`."},leading:{description:"Custom leading-slot node; takes precedence over the default back button."},breadcrumbs:{description:"Optional breadcrumb trail rendered above the title (e.g. a `Breadcrumbs`)."},identity:{description:"Optional expanding region below the title describing the browsed entity — normally an `EntityIdentity`."},identityKey:{description:"Stable key for the described entity. Changing it crossfades the region; leaving it alone swaps content silently."}},args:{title:"Groups"}},s={},n={args:{title:"Groups",subtitle:"Manage Okta group membership"}},i={args:{title:"Groups",badge:{text:"Beta",variant:"primary"}}},o={args:{title:"Groups",badge:{text:"Active",variant:"success"}}},c={args:{title:"Groups",badge:{text:"Caution",variant:"warning"}}},d={args:{title:"Groups",badge:{text:"Locked out",variant:"danger"}}},l={args:{title:"Groups",actions:e.jsx(r,{icon:"plus",children:"New Group"})}},p={args:{title:"Groups",subtitle:"Manage Okta group membership",badge:{text:"Beta",variant:"primary"},actions:e.jsx(r,{icon:"plus",children:"Add Group"})}},u={args:{title:"Engineering",subtitle:"184 members",onBack:t()}},g={args:{title:"Engineering",subtitle:"184 members",onBack:t(),breadcrumbs:e.jsx(O,{items:[{key:"root",label:"Groups",onSelect:t()},{key:"detail",label:"Engineering"}]}),actions:e.jsx(r,{icon:"external-link",children:"Open in Okta"})}},a={args:{title:"Engineering",onBack:t(),backLabel:"Back to groups",identityKey:"00gFAKE1a2b3c4d5e6",identity:e.jsx(W,{rows:[[{kind:"status",variant:"primary",text:"Okta group"},{kind:"id",value:"00gFAKE1a2b3c4d5e6",copyLabel:"Copy group id"}],[{kind:"metric",icon:"users",value:"1,284",label:"members"},{kind:"metric",icon:"bolt",value:"2",label:"rules"}],[{kind:"text",icon:"clock",text:"Created 12 Mar 2021"},{kind:"text",text:"Updated 4 days ago"}]]}),actions:e.jsx(r,{icon:"external-link",children:"Open in Okta"})}},m={args:{...a.args,cornerAction:e.jsx(E,{pinned:!1,onToggle:t()})}},y={args:{...a.args,cornerAction:e.jsx(E,{pinned:!0,onToggle:t()})}},b={args:{title:"Groups",subtitle:"Browse, search, and manage groups",cornerAction:e.jsx(E,{pinned:!1,onToggle:t()})}},h={args:a.args,parameters:{viewport:{value:"sidepanelCompact"}}},k={args:{title:"Priya Raman",onBack:t(),backLabel:"Back to search",identityKey:"00uFAKE9z8y7x6w5v",identity:e.jsx(W,{rows:[[{kind:"status",variant:"success",text:"ACTIVE"},{kind:"id",value:"00uFAKE9z8y7x6w5v",copyLabel:"Copy user id"}],[{kind:"metric",icon:"users",value:"42",label:"groups"}],[{kind:"text",icon:"clock",text:"Last login 2 days ago"}]]}),actions:e.jsx(r,{icon:"external-link",children:"Open in Okta"})}},x={args:{title:"Priya Raman",badge:{text:"LOCKED_OUT",variant:"danger"},onBack:t(),backLabel:"Back to search",identityKey:"00uFAKE9z8y7x6w5v",identity:e.jsx(W,{rows:[[{kind:"id",value:"00uFAKE9z8y7x6w5v",copyLabel:"Copy user id"}],[{kind:"metric",icon:"users",value:"42",label:"groups"}],[{kind:"text",icon:"clock",text:"Last login 2 days ago"}]]}),actions:e.jsx(r,{icon:"external-link",children:"Open in Okta"})}},v={args:{title:"Priya Raman",onBack:t(),backLabel:"Back to search",identityKey:"00uFAKE9z8y7x6w5v",identity:e.jsx(W,{rows:[[{kind:"status",variant:"success",text:"ACTIVE"},{kind:"status",variant:"warning",text:"PASSWORD_EXPIRED"},{kind:"id",value:"00uFAKE9z8y7x6w5v",copyLabel:"Copy user id"}],[{kind:"metric",icon:"users",value:"42",label:"groups"}],[{kind:"text",icon:"clock",text:"Last login 2 days ago"}]]}),actions:e.jsx(r,{icon:"external-link",children:"Open in Okta"})},parameters:{viewport:{value:"sidepanelCompact"}}},B={args:{title:"Groups",subtitle:"Browse, search, and manage groups",badge:{text:"1,284 Cached",variant:"success"}}},w={args:{title:"Engineering",leading:e.jsx("span",{className:"inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary-light text-sm font-semibold text-primary-text",children:"EN"})}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:"{}",...s.parameters?.docs?.source},description:{story:"Default with title only.",...s.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Groups',
    subtitle: 'Manage Okta group membership'
  }
}`,...n.parameters?.docs?.source},description:{story:"Title with a subtitle.",...n.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Groups',
    badge: {
      text: 'Beta',
      variant: 'primary'
    }
  }
}`,...i.parameters?.docs?.source},description:{story:"With a primary badge.",...i.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Groups',
    badge: {
      text: 'Active',
      variant: 'success'
    }
  }
}`,...o.parameters?.docs?.source},description:{story:"With a success badge.",...o.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Groups',
    badge: {
      text: 'Caution',
      variant: 'warning'
    }
  }
}`,...c.parameters?.docs?.source},description:{story:"With a warning badge.",...c.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Groups',
    badge: {
      text: 'Locked out',
      variant: 'danger'
    }
  }
}`,...d.parameters?.docs?.source},description:{story:"With a danger badge.",...d.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Groups',
    actions: <Button icon="plus">New Group</Button>
  }
}`,...l.parameters?.docs?.source},description:{story:"With trailing action button.",...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Groups',
    subtitle: 'Manage Okta group membership',
    badge: {
      text: 'Beta',
      variant: 'primary'
    },
    actions: <Button icon="plus">Add Group</Button>
  }
}`,...p.parameters?.docs?.source},description:{story:"Full: title, subtitle, badge, and actions.",...p.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Engineering',
    subtitle: '184 members',
    onBack: fn()
  }
}`,...u.parameters?.docs?.source},description:{story:"Drilled-in view: a back button appears in the leading slot.",...u.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Engineering',
    subtitle: '184 members',
    onBack: fn(),
    breadcrumbs: <Breadcrumbs items={[{
      key: 'root',
      label: 'Groups',
      onSelect: fn()
    }, {
      key: 'detail',
      label: 'Engineering'
    }]} />,
    actions: <Button icon="external-link">Open in Okta</Button>
  }
}`,...g.parameters?.docs?.source},description:{story:"Back button plus the breadcrumb trail from a view stack.",...g.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Engineering',
    onBack: fn(),
    backLabel: 'Back to groups',
    identityKey: '00gFAKE1a2b3c4d5e6',
    identity: <EntityIdentity rows={[[{
      kind: 'status',
      variant: 'primary',
      text: 'Okta group'
    }, {
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
    }], [{
      kind: 'text',
      icon: 'clock',
      text: 'Created 12 Mar 2021'
    }, {
      kind: 'text',
      text: 'Updated 4 days ago'
    }]]} />,
    actions: <Button icon="external-link">Open in Okta</Button>
  }
}`,...a.parameters?.docs?.source},description:{story:"The header describing a group, so the detail body opens on content instead of an identity card.",...a.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    ...WithIdentity.args,
    cornerAction: <WorkingSetPinButton pinned={false} onToggle={fn()} />
  }
}`,...m.parameters?.docs?.source},description:{story:"The corner slot holding the working-set pin, parked below the page action rather than beside it.",...m.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    ...WithIdentity.args,
    cornerAction: <WorkingSetPinButton pinned onToggle={fn()} />
  }
}`,...y.parameters?.docs?.source},description:{story:"Already on Home. The toggle reports `aria-pressed`, not a relabelled button.",...y.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Groups',
    subtitle: 'Browse, search, and manage groups',
    cornerAction: <WorkingSetPinButton pinned={false} onToggle={fn()} />
  }
}`,...b.parameters?.docs?.source},description:{story:"A header with no identity region: the corner column collapses to content height.",...b.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: WithIdentity.args,
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...h.parameters?.docs?.source},description:{story:"The same header at the narrowest supported width: with no trailing badge, the identity facts wrap within their rows.",...h.parameters?.docs?.description}}};k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Priya Raman',
    onBack: fn(),
    backLabel: 'Back to search',
    identityKey: '00uFAKE9z8y7x6w5v',
    identity: <EntityIdentity rows={[[{
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
    }], [{
      kind: 'text',
      icon: 'clock',
      text: 'Last login 2 days ago'
    }]]} />,
    actions: <Button icon="external-link">Open in Okta</Button>
  }
}`,...k.parameters?.docs?.source},description:{story:"A user rung: `ACTIVE` is not `danger`, so it is a dot-marked status fact rather than a header badge.",...k.parameters?.docs?.description}}};x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Priya Raman',
    badge: {
      text: 'LOCKED_OUT',
      variant: 'danger'
    },
    onBack: fn(),
    backLabel: 'Back to search',
    identityKey: '00uFAKE9z8y7x6w5v',
    identity: <EntityIdentity rows={[[{
      kind: 'id',
      value: '00uFAKE9z8y7x6w5v',
      copyLabel: 'Copy user id'
    }], [{
      kind: 'metric',
      icon: 'users',
      value: '42',
      label: 'groups'
    }], [{
      kind: 'text',
      icon: 'clock',
      text: 'Last login 2 days ago'
    }]]} />,
    actions: <Button icon="external-link">Open in Okta</Button>
  }
}`,...x.parameters?.docs?.source},description:{story:"A `LOCKED_OUT` user — the one status that keeps the loud badge.",...x.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Priya Raman',
    onBack: fn(),
    backLabel: 'Back to search',
    identityKey: '00uFAKE9z8y7x6w5v',
    identity: <EntityIdentity rows={[[{
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
    }], [{
      kind: 'text',
      icon: 'clock',
      text: 'Last login 2 days ago'
    }]]} />,
    actions: <Button icon="external-link">Open in Okta</Button>
  },
  parameters: {
    viewport: {
      value: 'sidepanelCompact'
    }
  }
}`,...v.parameters?.docs?.source},description:{story:"Two statuses on one entity at the narrowest width, both demoted to facts so the title keeps its width.",...v.parameters?.docs?.description}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Groups',
    subtitle: 'Browse, search, and manage groups',
    badge: {
      text: '1,284 Cached',
      variant: 'success'
    }
  }
}`,...B.parameters?.docs?.source},description:{story:"A list rung passes no identity, so the region is absent entirely.",...B.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Engineering',
    leading: <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary-light text-sm font-semibold text-primary-text">
        EN
      </span>
  }
}`,...w.parameters?.docs?.source},description:{story:"A custom leading node replaces the default back button.",...w.parameters?.docs?.description}}};const L=["Default","WithSubtitle","WithBadgePrimary","WithBadgeSuccess","WithBadgeWarning","WithBadgeDanger","WithActions","Full","WithBackButton","WithBreadcrumbs","WithIdentity","WithCornerAction","WithCornerActionPinned","CornerActionWithoutIdentity","WithIdentityNarrow","WithIdentityUser","WithIdentityUserLockedOut","WithMultipleStatusFactsNarrow","WithoutIdentity","WithCustomLeading"];export{b as CornerActionWithoutIdentity,s as Default,p as Full,l as WithActions,u as WithBackButton,d as WithBadgeDanger,i as WithBadgePrimary,o as WithBadgeSuccess,c as WithBadgeWarning,g as WithBreadcrumbs,m as WithCornerAction,y as WithCornerActionPinned,w as WithCustomLeading,a as WithIdentity,h as WithIdentityNarrow,k as WithIdentityUser,x as WithIdentityUserLockedOut,v as WithMultipleStatusFactsNarrow,n as WithSubtitle,B as WithoutIdentity,L as __namedExportsOrder,C as default};
