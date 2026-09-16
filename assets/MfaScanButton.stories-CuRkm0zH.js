import{M as d}from"./MfaScanButton-B10gRaS5.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:o,fn:p,userEvent:u,within:r}=__STORYBOOK_MODULE_TEST__,m=new Map([["u1",{userId:"u1",factors:[],enrolled:!0,factorCount:2,factorLabels:[]}]]),S={title:"Members/MfaScanButton",component:d,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Shared trigger for the group MFA factor scan: `Run MFA scan` before a scan, a loading `Scanning…` while one runs, `Rescan` once results exist, and disabled for an empty group. The large-group confirmation gate is owned by the caller via `onScanClick`."}}},argTypes:{mfaResults:{description:"Per-member MFA scan results, or null before a scan has run."},scanStatus:{description:"Current MFA scan lifecycle status."},memberCount:{description:"Member count; scanning is disabled for an empty group."},onScanClick:{description:"Start (or confirm) the scan."},size:{description:"Button size; defaults to `sm`."}},args:{mfaResults:null,scanStatus:"idle",memberCount:250,onScanClick:p()}},e={play:async({canvasElement:a,args:n})=>{const i=r(a);await u.click(i.getByRole("button",{name:/run mfa scan/i})),await o(n.onScanClick).toHaveBeenCalledTimes(1)}},t={args:{scanStatus:"scanning"},play:async({canvasElement:a,args:n})=>{const l=r(a).getByRole("button");await o(l).toBeDisabled(),await u.click(l),await o(n.onScanClick).not.toHaveBeenCalled()}},s={args:{mfaResults:m,scanStatus:"complete"}},c={args:{memberCount:0},play:async({canvasElement:a})=>{const n=r(a);await o(n.getByRole("button")).toBeDisabled()}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: /run mfa scan/i
    }));
    await expect(args.onScanClick).toHaveBeenCalledTimes(1);
  }
}`,...e.parameters?.docs?.source},description:{story:'Before any scan — primary "Run MFA scan". Pressing it asks the caller to start one.',...e.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    scanStatus: 'scanning'
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await expect(button).toBeDisabled();
    await userEvent.click(button);
    await expect(args.onScanClick).not.toHaveBeenCalled();
  }
}`,...t.parameters?.docs?.source},description:{story:"A scan in progress: the button is disabled, so a second scan cannot be queued.",...t.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    mfaResults,
    scanStatus: 'complete'
  }
}`,...s.parameters?.docs?.source},description:{story:'After a completed scan — secondary "Rescan".',...s.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    memberCount: 0
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeDisabled();
  }
}`,...c.parameters?.docs?.source},description:{story:"Empty group — nothing to scan, so the button is disabled.",...c.parameters?.docs?.description}}};const f=["NotScanned","Scanning","Scanned","Disabled"];export{c as Disabled,e as NotScanned,s as Scanned,t as Scanning,f as __namedExportsOrder,S as default};
