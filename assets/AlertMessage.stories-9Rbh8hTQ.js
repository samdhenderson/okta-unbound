import{A as d}from"./iframe-tAvKsVeF.js";import{A as p}from"./useActorNotice-Cg6X6cVk.js";import"./preload-helper-PPVm8Dsz.js";const{fn:c}=__STORYBOOK_MODULE_TEST__,u={title:"Shared/AlertMessage",component:d,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'Inline alert/notification banner with a status icon and optional dismiss (×) button and inline action.\n\nColour and icon are driven by the canonical `StatusType` vocabulary (`success | warning | danger | info`), and it renders with `role="alert"`. A `danger` message forces its action button into destructive styling regardless of the action’s own `variant`.'}}},argTypes:{message:{description:"The alert text plus its `StatusType` severity, which selects the icon and colours."},onDismiss:{description:"When provided, renders a dismiss (×) button that invokes this callback."},action:{description:"Optional inline call-to-action button (e.g. “Retry”, “Undo”)."},className:{description:"Extra classes merged onto the outer container."}},args:{message:{text:"This is an informational message.",type:"info"},onDismiss:c()}},e={},s={args:{message:{text:"Changes saved successfully.",type:"success"}}},t={args:{message:{text:"This action will affect multiple users.",type:"warning"}}},a={args:{message:{text:"Failed to update user permissions.",type:"danger"}}},n={args:{message:{text:"Connection lost.",type:"warning"},action:{label:"Retry",onClick:c()}}},r={args:{message:{text:"This will delete all selected users.",type:"danger"},action:{label:"Confirm Delete",onClick:c(),variant:"danger"}}},o={args:{message:p}},i={args:{message:{text:"Information message without dismiss option.",type:"info"},onDismiss:void 0}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:"Default info-level message.",...e.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    message: {
      text: 'Changes saved successfully.',
      type: 'success'
    }
  }
}`,...s.parameters?.docs?.source},description:{story:"Success status with green styling.",...s.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    message: {
      text: 'This action will affect multiple users.',
      type: 'warning'
    }
  }
}`,...t.parameters?.docs?.source},description:{story:"Warning status with amber styling.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    message: {
      text: 'Failed to update user permissions.',
      type: 'danger'
    }
  }
}`,...a.parameters?.docs?.source},description:{story:"Danger status with red styling.",...a.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    message: {
      text: 'Connection lost.',
      type: 'warning'
    },
    action: {
      label: 'Retry',
      onClick: fn()
    }
  }
}`,...n.parameters?.docs?.source},description:{story:"With an inline action button.",...n.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    message: {
      text: 'This will delete all selected users.',
      type: 'danger'
    },
    action: {
      label: 'Confirm Delete',
      onClick: fn(),
      variant: 'danger'
    }
  }
}`,...r.parameters?.docs?.source},description:{story:"Danger message with danger-styled action button.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    message: ACTOR_UNAVAILABLE_NOTICE
  }
}`,...o.parameters?.docs?.source},description:{story:"The shared audited-without-an-actor notice: the write succeeded, only its attribution is missing.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    message: {
      text: 'Information message without dismiss option.',
      type: 'info'
    },
    onDismiss: undefined
  }
}`,...i.parameters?.docs?.source},description:{story:"Without dismiss button.",...i.parameters?.docs?.description}}};const y=["Default","Success","Warning","Danger","WithAction","DangerWithAction","ActorUnavailable","NoDismiss"];export{o as ActorUnavailable,a as Danger,r as DangerWithAction,e as Default,i as NoDismiss,s as Success,t as Warning,n as WithAction,y as __namedExportsOrder,u as default};
