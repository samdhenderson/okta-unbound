import{V as R}from"./VerbRunner-Czyw7gf7.js";import{R as x}from"./costSentence-DbR6FENm.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./AttributeSpreadBar-BFtTzm-q.js";import"./chartPalette-Byit8206.js";import"./memberAnalytics-BqndU7JT.js";import"./BreakdownReport-RtX7G5yn.js";import"./csvUtils-DgNWYp8m.js";const{expect:t,fn:l,userEvent:C,within:o}=__STORYBOOK_MODULE_TEST__,D={picked:[{kind:"group",id:"00gFAKE0001",name:"Payments Team",pickedAt:17e11},{kind:"group",id:"00gFAKE0002",name:"Contractors",pickedAt:1700000000001}]},r={id:"remove-inactive-members",label:"Remove inactive members",title:"Remove deactivated, suspended and locked-out members from these groups",path:"write",needs:["group"],cost:()=>({requests:0,walks:2,writes:0}),run:async()=>({status:"done",summary:"Done."})},T={id:"group-overlap",label:"Members these groups share",title:"Report which members these groups share",path:"read",needs:["group"],cost:()=>({requests:2,writes:0}),run:async()=>({status:"done",summary:"Done."})},s=n=>({verb:r,stage:"confirm",preflight:null,progress:"",outcome:null,error:null,fields:[],values:{},setValue:l(),isComposed:!0,isRefreshing:!1,submitFields:l(),start:l(),confirm:l(),close:l(),...n}),M={title:"Selection/run/VerbRunner",component:R,tags:["autodocs"],parameters:{layout:"centered",docs:{description:{component:"Measure → confirm → run → report, in a shared `Modal`. For a `write` verb the confirm body is the preflight’s own measured lines above the exact cost of the run those lines authorise — a confirm never quotes a projection.\n\nPast the write cap the run refuses **whole**: it never truncates to fit, because a truncated run would leave Okta holding a change nobody chose while every count on screen still read as complete. The control that would proceed is omitted, not disabled."}}},args:{basket:D,run:s({})}},c={args:{run:s({stage:"idle",verb:null})},play:async({canvasElement:n})=>{const a=o(n);await t(a.queryByRole("dialog")).not.toBeInTheDocument()}},u={args:{run:s({stage:"measuring",progress:"Counting inactive members (1/2)"})},play:async({canvasElement:n})=>{const a=o(n),e=o(a.getByRole("dialog",{name:"Measuring first"}));await t(e.getByText("Counting inactive members (1/2)")).toBeInTheDocument(),await t(e.queryByRole("button",{name:r.label})).not.toBeInTheDocument()}},d={args:{run:s({preflight:{cost:{requests:14,walks:2,writes:12},items:12,lines:["Payments Team — 9 of 340 members are deactivated, suspended or locked out","Contractors — 3 of 28 members are deactivated, suspended or locked out"]}})},play:async({canvasElement:n})=>{const a=o(n),e=o(a.getByRole("dialog",{name:r.title}));await t(e.getByText(/Payments Team — 9 of 340/)).toBeInTheDocument(),await t(e.getByText("Takes 14 requests and 2 membership walks. Changes 12 entities in Okta.")).toBeInTheDocument(),await t(e.getByText(/cannot be undone from here/)).toBeInTheDocument(),await t(e.getByRole("button",{name:r.label})).toBeInTheDocument()}},m={args:{run:s({verb:T})},play:async({canvasElement:n})=>{const a=o(n),e=o(a.getByRole("dialog",{name:T.title}));await t(e.getByText("Takes 2 requests.")).toBeInTheDocument(),await t(e.queryByText(/cannot be undone/)).not.toBeInTheDocument()}},g={args:{run:s({preflight:{cost:{requests:1200,writes:1200},items:1200,lines:[],refusal:{code:"over-write-cap",message:`This would change 1,200 entities, past the ${x.toLocaleString()} one run may change. Nothing has been changed. Narrow the selection and run it again.`}}})},play:async({canvasElement:n})=>{const a=o(n),e=o(a.getByRole("dialog",{name:r.title}));await t(e.getByText(/past the 1,000 one run may change/)).toBeInTheDocument(),await t(e.queryByRole("button",{name:r.label})).not.toBeInTheDocument(),await t(e.getByRole("button",{name:"Cancel"})).toBeInTheDocument()}},p={args:{run:s({preflight:{cost:{requests:0,writes:0},items:0,lines:[]}})},play:async({canvasElement:n})=>{const a=o(n),e=o(a.getByRole("dialog",{name:r.title}));await t(e.getByText(/Running it would change nothing/)).toBeInTheDocument(),await t(e.queryByRole("button",{name:r.label})).not.toBeInTheDocument()}},h={args:{run:s({stage:"running",progress:"Cleaning Payments Team (1/2)"})},play:async({canvasElement:n})=>{const a=o(n),e=o(a.getByRole("dialog",{name:"Running"}));await t(e.getByText(/does not stop the run/)).toBeInTheDocument(),await t(e.getByText("Cleaning Payments Team (1/2)")).toBeInTheDocument()}},y={args:{run:s({stage:"results",outcome:{status:"done",summary:"Removed 12 members from 2 groups.",detail:{filenameStem:"inactive-members-removed",headers:["Group","Outcome"],rows:[["Payments Team","success"],["Contractors","success"]]}}})},play:async({canvasElement:n})=>{const a=o(n),e=o(a.getByRole("dialog",{name:"What happened"}));await t(e.getByText("Removed 12 members from 2 groups.")).toBeInTheDocument(),await t(e.getByText("2 rows are available as a CSV.")).toBeInTheDocument(),await t(e.getByRole("button",{name:"Download CSV"})).toBeInTheDocument()}},b={args:{run:s({stage:"results",error:"The org refused the request."})},play:async({canvasElement:n})=>{const a=o(n),e=o(a.getByRole("dialog",{name:"The run stopped"}));await t(e.getByText("The org refused the request.")).toBeInTheDocument(),await t(e.queryByRole("button",{name:"Download CSV"})).not.toBeInTheDocument()}},w={args:{run:s({stage:"compose",isComposed:!1,fields:[{id:"attribute",label:"Attribute",options:[{value:"department",label:"Department"},{value:"title",label:"Title"}]},{id:"value",label:"New value",help:"Written to every ticked user."}]})},play:async({canvasElement:n,args:a})=>{const e=o(n),i=o(e.getByRole("dialog",{name:r.title}));await t(i.getByRole("combobox",{name:"Attribute"})).toBeInTheDocument(),await t(i.getByRole("textbox",{name:"New value"})).toBeInTheDocument(),await t(i.queryByRole("button",{name:"Continue"})).not.toBeInTheDocument(),await C.selectOptions(i.getByRole("combobox",{name:"Attribute"}),"title"),await t(a.run.setValue).toHaveBeenCalledWith("attribute","title")}},v={args:{run:s({stage:"compose",isComposed:!1,isRefreshing:!0,fields:[{id:"attribute",label:"Attribute",refreshesFields:!0,options:[{value:"department",label:"Department"},{value:"headcount",label:"Headcount"}]},{id:"value",label:"New Headcount",control:"number",placeholder:"A number"}],values:{attribute:"headcount"}})},play:async({canvasElement:n})=>{const a=o(n),e=o(a.getByRole("dialog",{name:r.title}));await t(e.getByRole("spinbutton",{name:"New Headcount"})).toBeInTheDocument(),await t(e.getByText("Reading what that attribute accepts…")).toBeInTheDocument(),await t(e.queryByRole("button",{name:"Continue"})).not.toBeInTheDocument()}},B={args:{run:s({stage:"compose",isComposed:!0,fields:[{id:"attribute",label:"Attribute",refreshesFields:!0,optionLayout:"list",help:"Only attributes this org lets the app write are listed.",options:[{value:"department",label:"Department",summary:"3 values · 1 empty",distribution:[{value:"Marketing",label:"Marketing",count:7,pct:58.3},{value:"Sales",label:"Sales",count:4,pct:33.3},{value:"__none__",label:"(none)",count:1,pct:8.3}]},{value:"costCenter",label:"Cost centre",summary:"1 value · 10 empty",distribution:[{value:"CC-100",label:"CC-100",count:2,pct:16.7},{value:"__none__",label:"(none)",count:10,pct:83.3}]}]},{id:"value",label:"New Department",placeholder:"The value every ticked user will hold",distribution:[{value:"Marketing",label:"Marketing",count:7,pct:58.3},{value:"Sales",label:"Sales",count:4,pct:33.3},{value:"__none__",label:"(none)",count:1,pct:8.3}]}],values:{attribute:"department",value:"Advertising"}})},play:async({canvasElement:n})=>{const a=o(n),e=o(a.getByRole("dialog",{name:r.title})),i=e.getByRole("radio",{name:/Department/});await t(i).toBeChecked(),await t(e.getByRole("radio",{name:/Cost centre/})).not.toBeChecked(),await t(e.getByText("3 values · 1 empty")).toBeInTheDocument(),await t(e.getAllByText("Marketing").length).toBeGreaterThan(0);for(const f of e.getAllByText("(none)"))await t(f.closest("button")).toBeDisabled();await t(e.getByRole("textbox",{name:"New Department"})).toHaveValue("Advertising"),await t(e.getByRole("button",{name:"Continue"})).toBeInTheDocument()}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    run: runAt({
      stage: 'idle',
      verb: null
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
  }
}`,...c.parameters?.docs?.source},description:{story:"Nothing is running — the surface renders nothing at all.",...c.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    run: runAt({
      stage: 'measuring',
      progress: 'Counting inactive members (1/2)'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const dialog = within(canvas.getByRole('dialog', {
      name: 'Measuring first'
    }));
    await expect(dialog.getByText('Counting inactive members (1/2)')).toBeInTheDocument();
    await expect(dialog.queryByRole('button', {
      name: CLEANUP.label
    })).not.toBeInTheDocument();
  }
}`,...u.parameters?.docs?.source},description:{story:"The measurement is out. Nothing is offered while it is.",...u.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    run: runAt({
      preflight: {
        cost: {
          requests: 14,
          walks: 2,
          writes: 12
        },
        items: 12,
        lines: ['Payments Team — 9 of 340 members are deactivated, suspended or locked out', 'Contractors — 3 of 28 members are deactivated, suspended or locked out']
      }
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const dialog = within(canvas.getByRole('dialog', {
      name: CLEANUP.title
    }));
    await expect(dialog.getByText(/Payments Team — 9 of 340/)).toBeInTheDocument();
    await expect(dialog.getByText('Takes 14 requests and 2 membership walks. Changes 12 entities in Okta.')).toBeInTheDocument();
    // Never "you can undo this": the bulk membership writes are declared
    // un-undoable, with reasons, in \`hooks/useUndoAction\`.
    await expect(dialog.getByText(/cannot be undone from here/)).toBeInTheDocument();
    await expect(dialog.getByRole('button', {
      name: CLEANUP.label
    })).toBeInTheDocument();
  }
}`,...d.parameters?.docs?.source},description:{story:"The confirm quotes what the preflight counted, and says the change cannot be undone here.",...d.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    run: runAt({
      verb: REPORT
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const dialog = within(canvas.getByRole('dialog', {
      name: REPORT.title
    }));
    await expect(dialog.getByText('Takes 2 requests.')).toBeInTheDocument();
    await expect(dialog.queryByText(/cannot be undone/)).not.toBeInTheDocument();
  }
}`,...m.parameters?.docs?.source},description:{story:"A read verb states its cost and carries no destructive warning.",...m.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    run: runAt({
      preflight: {
        cost: {
          requests: 1200,
          writes: 1200
        },
        items: 1200,
        lines: [],
        refusal: {
          code: 'over-write-cap',
          message: \`This would change 1,200 entities, past the \${RUN_WRITE_CAP.toLocaleString()} one run may change. Nothing has been changed. Narrow the selection and run it again.\`
        }
      }
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const dialog = within(canvas.getByRole('dialog', {
      name: CLEANUP.title
    }));
    await expect(dialog.getByText(/past the 1,000 one run may change/)).toBeInTheDocument();
    await expect(dialog.queryByRole('button', {
      name: CLEANUP.label
    })).not.toBeInTheDocument();
    await expect(dialog.getByRole('button', {
      name: 'Cancel'
    })).toBeInTheDocument();
  }
}`,...g.parameters?.docs?.source},description:{story:`Past the cap. The refusal is stated and the control that would proceed is
**omitted** — the assertion that would catch a regression to a disabled
button, or worse, a truncated run.`,...g.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    run: runAt({
      preflight: {
        cost: {
          requests: 0,
          writes: 0
        },
        items: 0,
        lines: []
      }
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const dialog = within(canvas.getByRole('dialog', {
      name: CLEANUP.title
    }));
    await expect(dialog.getByText(/Running it would change nothing/)).toBeInTheDocument();
    await expect(dialog.queryByRole('button', {
      name: CLEANUP.label
    })).not.toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source},description:{story:"Nothing in the selection needs it — an outcome, not a failure, and no run is offered.",...p.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    run: runAt({
      stage: 'running',
      progress: 'Cleaning Payments Team (1/2)'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const dialog = within(canvas.getByRole('dialog', {
      name: 'Running'
    }));
    await expect(dialog.getByText(/does not stop the run/)).toBeInTheDocument();
    await expect(dialog.getByText('Cleaning Payments Team (1/2)')).toBeInTheDocument();
  }
}`,...h.parameters?.docs?.source},description:{story:"Mid-run: closing the dialog does not stop the run, and the body says so.",...h.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    run: runAt({
      stage: 'results',
      outcome: {
        status: 'done',
        summary: 'Removed 12 members from 2 groups.',
        detail: {
          filenameStem: 'inactive-members-removed',
          headers: ['Group', 'Outcome'],
          rows: [['Payments Team', 'success'], ['Contractors', 'success']]
        }
      }
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const dialog = within(canvas.getByRole('dialog', {
      name: 'What happened'
    }));
    await expect(dialog.getByText('Removed 12 members from 2 groups.')).toBeInTheDocument();
    await expect(dialog.getByText('2 rows are available as a CSV.')).toBeInTheDocument();
    await expect(dialog.getByRole('button', {
      name: 'Download CSV'
    })).toBeInTheDocument();
  }
}`,...y.parameters?.docs?.source},description:{story:"The result, with the rows behind it offered as a CSV.",...y.parameters?.docs?.description}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    run: runAt({
      stage: 'results',
      error: 'The org refused the request.'
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const dialog = within(canvas.getByRole('dialog', {
      name: 'The run stopped'
    }));
    await expect(dialog.getByText('The org refused the request.')).toBeInTheDocument();
    await expect(dialog.queryByRole('button', {
      name: 'Download CSV'
    })).not.toBeInTheDocument();
  }
}`,...b.parameters?.docs?.source},description:{story:"A thrown error is stated, not swallowed into a cheerful summary.",...b.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    run: runAt({
      stage: 'compose',
      isComposed: false,
      fields: [{
        id: 'attribute',
        label: 'Attribute',
        options: [{
          value: 'department',
          label: 'Department'
        }, {
          value: 'title',
          label: 'Title'
        }]
      }, {
        id: 'value',
        label: 'New value',
        help: 'Written to every ticked user.'
      }]
    })
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const dialog = within(canvas.getByRole('dialog', {
      name: CLEANUP.title
    }));
    await expect(dialog.getByRole('combobox', {
      name: 'Attribute'
    })).toBeInTheDocument();
    await expect(dialog.getByRole('textbox', {
      name: 'New value'
    })).toBeInTheDocument();
    await expect(dialog.queryByRole('button', {
      name: 'Continue'
    })).not.toBeInTheDocument();
    await userEvent.selectOptions(dialog.getByRole('combobox', {
      name: 'Attribute'
    }), 'title');
    await expect(args.run.setValue).toHaveBeenCalledWith('attribute', 'title');
  }
}`,...w.parameters?.docs?.source},description:{story:"A verb that needs an answer asks for it, and withholds Continue until it has one.",...w.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    run: runAt({
      stage: 'compose',
      isComposed: false,
      isRefreshing: true,
      fields: [{
        id: 'attribute',
        label: 'Attribute',
        refreshesFields: true,
        options: [{
          value: 'department',
          label: 'Department'
        }, {
          value: 'headcount',
          label: 'Headcount'
        }]
      }, {
        id: 'value',
        label: 'New Headcount',
        control: 'number',
        placeholder: 'A number'
      }],
      values: {
        attribute: 'headcount'
      }
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const dialog = within(canvas.getByRole('dialog', {
      name: CLEANUP.title
    }));
    await expect(dialog.getByRole('spinbutton', {
      name: 'New Headcount'
    })).toBeInTheDocument();
    await expect(dialog.getByText('Reading what that attribute accepts…')).toBeInTheDocument();
    // Withheld, not disabled: against a form still being rebuilt there is no run
    // to offer.
    await expect(dialog.queryByRole('button', {
      name: 'Continue'
    })).not.toBeInTheDocument();
  }
}`,...v.parameters?.docs?.source},description:{story:`The attribute picked decides what the value question is, so a numeric
attribute is answered in a numeric field — and while that is being worked out,
the form below is not yet the real form, which is said rather than left to a
control that changes under the reader.`,...v.parameters?.docs?.description}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  args: {
    run: runAt({
      stage: 'compose',
      isComposed: true,
      fields: [{
        id: 'attribute',
        label: 'Attribute',
        refreshesFields: true,
        optionLayout: 'list',
        help: 'Only attributes this org lets the app write are listed.',
        options: [{
          value: 'department',
          label: 'Department',
          summary: '3 values · 1 empty',
          distribution: [{
            value: 'Marketing',
            label: 'Marketing',
            count: 7,
            pct: 58.3
          }, {
            value: 'Sales',
            label: 'Sales',
            count: 4,
            pct: 33.3
          }, {
            value: '__none__',
            label: '(none)',
            count: 1,
            pct: 8.3
          }]
        }, {
          value: 'costCenter',
          label: 'Cost centre',
          summary: '1 value · 10 empty',
          distribution: [{
            value: 'CC-100',
            label: 'CC-100',
            count: 2,
            pct: 16.7
          }, {
            value: '__none__',
            label: '(none)',
            count: 10,
            pct: 83.3
          }]
        }]
      }, {
        id: 'value',
        label: 'New Department',
        placeholder: 'The value every ticked user will hold',
        distribution: [{
          value: 'Marketing',
          label: 'Marketing',
          count: 7,
          pct: 58.3
        }, {
          value: 'Sales',
          label: 'Sales',
          count: 4,
          pct: 33.3
        }, {
          value: '__none__',
          label: '(none)',
          count: 1,
          pct: 8.3
        }]
      }],
      values: {
        attribute: 'department',
        value: 'Advertising'
      }
    })
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const dialog = within(canvas.getByRole('dialog', {
      name: CLEANUP.title
    }));

    // The picker is a real radio group, so the chosen attribute is announced and
    // not only painted.
    const chosen = dialog.getByRole('radio', {
      name: /Department/
    });
    await expect(chosen).toBeChecked();
    await expect(dialog.getByRole('radio', {
      name: /Cost centre/
    })).not.toBeChecked();

    // The spread is stated, for the attribute picked and for the ones not.
    await expect(dialog.getByText('3 values · 1 empty')).toBeInTheDocument();
    await expect(dialog.getAllByText('Marketing').length).toBeGreaterThan(0);

    // The distribution above the value control is a statement, not a control:
    // every one of its rows is inert.
    for (const row of dialog.getAllByText('(none)')) {
      await expect(row.closest('button')).toBeDisabled();
    }
    await expect(dialog.getByRole('textbox', {
      name: 'New Department'
    })).toHaveValue('Advertising');
    await expect(dialog.getByRole('button', {
      name: 'Continue'
    })).toBeInTheDocument();
  }
}`,...B.parameters?.docs?.source},description:{story:`The attribute question, asked as rows rather than a dropdown, because each
option carries the spread of what the ticked users hold for it now. That
spread is the thing the choice is actually about — a \`<select>\` could only
show the label, and would ask the reader to pick blind.

The chosen attribute's own distribution then renders above the value control,
inert: it states what is there, and nothing here filters against it.`,...B.parameters?.docs?.description}}};const O=["Idle","Measuring","ConfirmAWrite","ConfirmARead","RefusedPastTheCap","NothingToDo","Running","Results","Failed","ComposeWithheldUntilAnswered","ComposeRebuildingTheValueQuestion","ComposeWithSpread"];export{v as ComposeRebuildingTheValueQuestion,B as ComposeWithSpread,w as ComposeWithheldUntilAnswered,m as ConfirmARead,d as ConfirmAWrite,b as Failed,c as Idle,u as Measuring,p as NothingToDo,g as RefusedPastTheCap,y as Results,h as Running,O as __namedExportsOrder,M as default};
