import{M as g}from"./MemberFilterPanel-fb43Reif.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./MfaScanButton-B10gRaS5.js";const{expect:o,fn:e,userEvent:d,within:m}=__STORYBOOK_MODULE_TEST__,f=[{value:"ACTIVE",label:"ACTIVE",count:240,pct:96},{value:"SUSPENDED",label:"SUSPENDED",count:5,pct:2},{value:"DEPROVISIONED",label:"DEPROVISIONED",count:5,pct:2}],l=new Map([["user1",{userId:"user1",factors:[],enrolled:!0,factorCount:2,factorLabels:["Okta Verify (Fastpass)","SMS"]}],["user2",{userId:"user2",factors:[],enrolled:!1,factorCount:0,factorLabels:[]}]]),S=[{dimension:"status",value:"ACTIVE",label:"Status: ACTIVE"},{dimension:"mfa",value:"has:SMS",label:"Has SMS"}],E={title:"Members/MemberFilterPanel",component:g,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"Status, MFA-factor and sort controls for the member list. Fully presentational: it reflects the active filter set into pressed pill states and reports every change through callbacks. The MFA scan trigger sits inline beside the factor filters it enables, and those filters stay hidden until scan results exist."}}},argTypes:{filters:{description:"Active facet filters, reflected into pressed pill states."},statusRows:{description:"Status distribution (value + count) used to build status pills."},mfaResults:{description:"Per-member MFA scan results, or null before a scan has run."},factorLabels:{description:"Observed factor labels across the group, for per-factor toggles."},memberCount:{description:"Member count; drives the scan button's disabled/confirm behaviour."},scanStatus:{description:"Current MFA scan lifecycle status."},onRunScanClick:{description:"Start (or confirm) the MFA scan."},sortBy:{description:"Current sort field."},sortDesc:{description:"Whether the current sort is descending."},onToggleStatus:{description:"Toggle a status value as a filter."},onClearStatus:{description:"Clear all status filters."},onToggleMfaValue:{description:"Toggle a count-based MFA value (e.g. 'none', 'multiple')."},onSetFactorMode:{description:"Set a per-factor has/missing/off mode."},onToggleSort:{description:"Toggle the sort field (or flip direction if already selected)."}},args:{filters:[],statusRows:f,mfaResults:null,factorLabels:[],memberCount:250,scanStatus:"idle",onRunScanClick:e(),sortBy:"name",sortDesc:!1,onToggleStatus:e(),onClearStatus:e(),onToggleMfaValue:e(),onSetFactorMode:e(),onToggleSort:e()}},t={play:async({args:c,canvasElement:i})=>{const u=m(i),p=u.getByRole("button",{name:"ACTIVE (240)"});await o(p).toHaveAttribute("aria-pressed","false"),await d.click(p),await o(c.onToggleStatus).toHaveBeenCalledWith(f[0]),await d.click(u.getByRole("button",{name:"Name"})),await o(c.onToggleSort).toHaveBeenCalledWith("name")}},a={args:{mfaResults:l,factorLabels:["Okta Verify (Fastpass)","SMS"],scanStatus:"complete"}},s={args:{filters:S,mfaResults:l,factorLabels:["Okta Verify (Fastpass)","SMS"],scanStatus:"complete"},play:async({canvasElement:c})=>{const i=m(c);await o(i.getByRole("button",{name:"ACTIVE (240)"})).toHaveAttribute("aria-pressed","true"),await o(i.getByRole("button",{name:"SUSPENDED (5)"})).toHaveAttribute("aria-pressed","false")}},r={args:{mfaResults:l,factorLabels:["Okta Verify (Fastpass)","SMS"],scanStatus:"complete",sortBy:"factors",sortDesc:!0}},n={args:{scanStatus:"scanning"}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const active = canvas.getByRole('button', {
      name: 'ACTIVE (240)'
    });
    await expect(active).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(active);
    await expect(args.onToggleStatus).toHaveBeenCalledWith(statusRows[0]);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Name'
    }));
    await expect(args.onToggleSort).toHaveBeenCalledWith('name');
  }
}`,...t.parameters?.docs?.source},description:{story:"No scan yet run: status/sort controls active, MFA section prompts to run a scan.",...t.parameters?.docs?.description}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    mfaResults,
    factorLabels: ['Okta Verify (Fastpass)', 'SMS'],
    scanStatus: 'complete'
  }
}`,...a.parameters?.docs?.source},description:{story:"MFA scan complete: per-factor has/missing toggles and quick counts are active.",...a.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    filters: activeFilters,
    mfaResults,
    factorLabels: ['Okta Verify (Fastpass)', 'SMS'],
    scanStatus: 'complete'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'ACTIVE (240)'
    })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', {
      name: 'SUSPENDED (5)'
    })).toHaveAttribute('aria-pressed', 'false');
  }
}`,...s.parameters?.docs?.source},description:{story:"Active filters are reflected back into the pills that set them.",...s.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    mfaResults,
    factorLabels: ['Okta Verify (Fastpass)', 'SMS'],
    scanStatus: 'complete',
    sortBy: 'factors',
    sortDesc: true
  }
}`,...r.parameters?.docs?.source},description:{story:"Sorting by factor count, descending.",...r.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    scanStatus: 'scanning'
  }
}`,...n.parameters?.docs?.source},description:{story:"A scan in progress: the trigger shows its loading state.",...n.parameters?.docs?.description}}};const M=["Default","WithMfaResults","WithActiveFilters","SortedByFactors","Scanning"];export{t as Default,n as Scanning,r as SortedByFactors,s as WithActiveFilters,a as WithMfaResults,M as __namedExportsOrder,E as default};
