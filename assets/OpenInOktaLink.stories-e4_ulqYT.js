import{O as i}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const c={title:"Shared/OpenInOktaLink",component:i,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'Shared “Open in Okta” deep link that opens an entity’s Admin Console page in a new tab, used by the context banner, group overview and user profile card. It renders nothing when the org origin or any part of the target is missing, so callers can drop it in unconditionally; the URL is built from the validated `oktaOrigin` and opened with `rel="noopener noreferrer"`.'}}},argTypes:{oktaOrigin:{description:"Okta org origin used to build the admin URL; the link hides when absent."},target:{description:"What to deep-link to; an app target also carries the app type key (`name`), which its Admin Console route needs."},label:{description:"Link text. Defaults to `Open in Okta`."},size:{description:"Compact (`sm`) or standard (`md`) sizing. Defaults to `sm`."},className:{description:"Extra classes merged onto the anchor."}},args:{oktaOrigin:"https://example.okta.com",target:{type:"group",id:"00g1abcdEXAMPLE"}}},e={},r={args:{target:{type:"user",id:"00u1abcdEXAMPLE"}}},a={args:{target:{type:"app",id:"0oa1abcdEXAMPLE",name:"salesforce"}}},t={args:{target:{type:"app",id:"0oa1abcdEXAMPLE",name:void 0}}},s={args:{size:"md"}},o={args:{label:"Open in Admin Console",size:"md"}},n={args:{oktaOrigin:null}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source},description:{story:"Default compact link to a group.",...e.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    target: {
      type: 'user',
      id: '00u1abcdEXAMPLE'
    }
  }
}`,...r.parameters?.docs?.source},description:{story:"Link to a user entity.",...r.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    target: {
      type: 'app',
      id: '0oa1abcdEXAMPLE',
      name: 'salesforce'
    }
  }
}`,...a.parameters?.docs?.source},description:{story:"Link to an app. The route is keyed on the app *type* (`salesforce`) as well as\nthe instance id — an id-only app URL is an error page.",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    target: {
      type: 'app',
      id: '0oa1abcdEXAMPLE',
      name: undefined
    }
  }
}`,...t.parameters?.docs?.source},description:{story:`An app whose org reported no type key. The link is withheld rather than built
from the id twice, so this story renders nothing.`,...t.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    size: 'md'
  }
}`,...s.parameters?.docs?.source},description:{story:"Standard (md) size.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Open in Admin Console',
    size: 'md'
  }
}`,...o.parameters?.docs?.source},description:{story:"Custom label.",...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    oktaOrigin: null
  }
}`,...n.parameters?.docs?.source},description:{story:"Hidden entirely when the org origin is unknown (renders nothing).",...n.parameters?.docs?.description}}};const m=["Default","User","App","AppWithoutTypeKey","Medium","CustomLabel","NoOrigin"];export{a as App,t as AppWithoutTypeKey,o as CustomLabel,e as Default,s as Medium,n as NoOrigin,r as User,m as __namedExportsOrder,c as default};
