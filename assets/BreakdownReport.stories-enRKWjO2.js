import{B as w}from"./BreakdownReport-RtX7G5yn.js";import{N as h,O as v}from"./memberAnalytics-BqndU7JT.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const{expect:a,fn:d,within:m}=__STORYBOOK_MODULE_TEST__,u=[{value:"Engineering",label:"Engineering",count:420,pct:42},{value:"Sales",label:"Sales",count:210,pct:21},{value:"Marketing",label:"Marketing",count:150,pct:15},{value:h,label:"(none)",count:60,pct:6},{value:v,label:"Other (4 values)",count:160,pct:16}],S={title:"Members/BreakdownReport",component:w,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:'Dependency-free list of horizontal proportion bars for a value distribution. Each row is a clickable filter toggle that highlights when its value is an active member-list filter; the aggregated "Other" row is clickable only when `onShowOther` is supplied.\n\n`rowIntent` decides what a row promises: `toggle` keeps `aria-pressed`, while `navigate` drops it and names the destination, because a row that leaves is not a toggle.'}}},argTypes:{rows:{description:'Pre-computed, sorted rows (top-N + optional "Other").'},activeValues:{description:"Canonical values currently selected as filters (for highlight)."},onRowClick:{description:"Called when a clickable value row is toggled."},onShowOther:{description:'Called when the aggregated "Other" row is clicked, to reveal its values.'},rowIntent:{description:"Whether a value row toggles a facet or navigates to the Members tab."},emptyMessage:{description:"Optional empty-state message when there are no rows."}},args:{rows:u,activeValues:new Set,onRowClick:d()}},n={},r={play:async({args:t,canvas:e,userEvent:s})=>{await s.click(e.getByRole("button",{name:/Engineering/})),await a(t.onRowClick).toHaveBeenCalledWith(u[0])}},o={args:{rows:[]}},i={args:{rows:[],emptyMessage:"No breakdown available yet."}},c={args:{activeValues:new Set(["Engineering"])}},l={args:{onShowOther:d()},play:async({args:t,canvas:e,userEvent:s})=>{await s.click(e.getByRole("button",{name:/Other \(4 values\)/})),await a(t.onShowOther).toHaveBeenCalled(),await a(e.getByRole("button",{name:/Other \(4 values\)/})).not.toHaveAttribute("aria-pressed")}},p={args:{rowIntent:"navigate"},play:async({canvasElement:t})=>{const s=m(t).getByRole("button",{name:"Filter Members by Engineering — 420 members. Opens the Members tab."});await a(s).toBeVisible(),await a(s).not.toHaveAttribute("aria-pressed")}},g={args:{activeValues:new Set(["Engineering"])},play:async({canvasElement:t})=>{const e=m(t);await a(e.getAllByRole("button",{pressed:!0})).toHaveLength(1),await a(e.queryByText(/Filter Members/)).toBeNull()}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source},description:{story:'Standard distribution with a "(none)" and an aggregated "Other" row.',...n.parameters?.docs?.description}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: /Engineering/
    }));
    await expect(args.onRowClick).toHaveBeenCalledWith(sampleRows[0]);
  }
}`,...r.parameters?.docs?.source},description:{story:"Activating a value row reports that row for toggling.",...r.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    rows: []
  }
}`,...o.parameters?.docs?.source},description:{story:"No rows at all — falls back to the empty-state message.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    rows: [],
    emptyMessage: 'No breakdown available yet.'
  }
}`,...i.parameters?.docs?.source},description:{story:"A custom empty-state message.",...i.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    activeValues: new Set(['Engineering'])
  }
}`,...c.parameters?.docs?.source},description:{story:"One row is highlighted as an active member-list filter.",...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    onShowOther: fn()
  },
  play: async ({
    args,
    canvas,
    userEvent
  }) => {
    await userEvent.click(canvas.getByRole('button', {
      name: /Other \\(4 values\\)/
    }));
    await expect(args.onShowOther).toHaveBeenCalled();
    // The aggregate is not a facet, so it never claims a pressed state.
    await expect(canvas.getByRole('button', {
      name: /Other \\(4 values\\)/
    })).not.toHaveAttribute('aria-pressed');
  }
}`,...l.parameters?.docs?.source},description:{story:'The aggregated "Other" row becomes clickable and reveals a "View →" affordance.',...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    rowIntent: 'navigate'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // The destination is on the row, not discovered by taking it.
    const row = canvas.getByRole('button', {
      name: 'Filter Members by Engineering — 420 members. Opens the Members tab.'
    });
    await expect(row).toBeVisible();

    // Not a toggle, so it must not claim a pressed state.
    await expect(row).not.toHaveAttribute('aria-pressed');
  }
}`,...p.parameters?.docs?.source},description:{story:"A row that leaves says so before it is clicked: in `navigate` intent the destination\nis on the row and in its accessible name, and `aria-pressed` is dropped.",...p.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    activeValues: new Set(['Engineering'])
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('button', {
      pressed: true
    })).toHaveLength(1);
    await expect(canvas.queryByText(/Filter Members/)).toBeNull();
  }
}`,...g.parameters?.docs?.source},description:{story:"The same rows in `toggle` intent still announce their pressed state, and promise no jump.",...g.parameters?.docs?.description}}};const B=["Default","TogglingAValue","Empty","EmptyWithCustomMessage","WithActiveRow","WithExpandableOther","NavigatesToMembers","ToggleIntentKeepsPressedState"];export{n as Default,o as Empty,i as EmptyWithCustomMessage,p as NavigatesToMembers,g as ToggleIntentKeepsPressedState,r as TogglingAValue,c as WithActiveRow,l as WithExpandableOther,B as __namedExportsOrder,S as default};
