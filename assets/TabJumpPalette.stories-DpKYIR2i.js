import{T as R}from"./TabJumpPalette-CgEx_Vcj.js";import"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";import"./PaletteRow-BiL1s8SJ.js";import"./jumpDestinations-CKYQltfE.js";import"./tabs-3T7DVjf-.js";const{expect:t,fn:a,userEvent:i,waitFor:S,within:s}=__STORYBOOK_MODULE_TEST__,M={title:"Sidepanel/TabJumpPalette",component:R,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"⌘K jump-to palette for the side panel's nine top-level sections, and the keyboard route to the same destinations the icon rail offers. Sections filter synchronously on a case-insensitive substring of the label; org entities — groups, apps, rules, policies, users — are handed in by the `CommandPalette` container on their own debounced schedule, so a section jump never waits on an org search.\n\nNavigation is roving focus, not a combobox: Down leaves the field for the first result, Up/Down move within one flat row list (Up off the top returns to the field), Enter or Space activates, Escape closes. Every entity prop is optional — omit them and this is the sections-only palette, which is why these stories mock nothing."}}},argTypes:{isOpen:{description:"When false the palette closes and leaves the accessible tree."},onClose:{description:"Invoked on Escape, overlay click, close button, and after a pick."},activeTab:{description:'The section on screen — marked `aria-current="page"`.'},onSelect:{description:"Called with the chosen section id — the icon rail's own handler."}},args:{isOpen:!0,onClose:a(),activeTab:"home",onSelect:a()}},b=[{kind:"group",id:"00gFAKE0000000000001",name:"Engineering",secondary:"All engineers"},{kind:"app",id:"0oaFAKE0000000000001",name:"Salesforce"},{kind:"rule",id:"0prFAKE0000000000001",name:"Feeds Engineering",secondary:"Active"},{kind:"user",id:"00uFAKE0000000000001",name:"Ada Lovelace",secondary:"ada@example.com"}],r={},c={args:{activeTab:"policies"}},l={play:async({canvasElement:n})=>{const e=s(n),o=await e.findByRole("searchbox",{name:"Search sections"});await i.type(o,"or"),await S(()=>t(e.getByRole("status")).toHaveTextContent("3 sections")),await t(e.getByRole("button",{name:/Export/})).toBeVisible(),await t(e.getByRole("button",{name:/Explorer/})).toBeVisible(),await t(e.getByRole("button",{name:/History/})).toBeVisible(),await t(e.queryByRole("button",{name:/Groups/})).not.toBeInTheDocument()}},p={play:async({canvasElement:n})=>{const e=s(n),o=await e.findByRole("searchbox",{name:"Search sections"});await i.type(o,"zzz"),await e.findByText("No sections match")}},d={args:{onEntityQueryChange:a(),entityMode:"results",entityResults:b,canReach:()=>!0,sectionMeta:{group:{fromSnapshot:!1,complete:!0},app:{fromSnapshot:!0,complete:!0},rule:{fromSnapshot:!0,complete:!0},user:{fromSnapshot:!1,complete:!0}},onEntitySelect:a()},play:async({canvasElement:n})=>{const e=s(n);await t(e.getByRole("button",{name:/^Home/})).toBeVisible(),await t(e.getByRole("button",{name:"Engineering — open in Groups"})).toBeVisible(),await t(e.getByRole("button",{name:"Salesforce — open in Apps"})).toBeVisible(),await t(e.getByRole("button",{name:"Ada Lovelace — open in Users"})).toBeVisible();const o=E=>e.getAllByRole("listitem").find(B=>!B.querySelector("a, button")&&B.textContent?.startsWith(E));await t(o("Apps")).toHaveTextContent("from snapshot"),await t(o("Rules")).toHaveTextContent("from snapshot"),await t(o("Users")).toHaveTextContent("live")}},u={args:{onEntityQueryChange:a(),entityMode:"searching",entityResults:b,canReach:()=>!0,onEntitySelect:a()},play:async({canvasElement:n})=>{const e=s(n);await t(e.getByRole("button",{name:"Engineering — open in Groups"})).toBeVisible()}},m={args:{onEntityQueryChange:a(),entityMode:"error",entityResults:[],entityError:"Search failed. Check the connection to Okta and try again.",canReach:()=>!0,onEntitySelect:a()},play:async({canvasElement:n})=>{const e=s(n);await t(await e.findByRole("alert")).toHaveTextContent("Search failed")}},y={args:{onEntityQueryChange:a(),entityMode:"results",entityResults:[b[1]],canReach:()=>!0,sectionMeta:{app:{fromSnapshot:!0,complete:!1}},onEntitySelect:a()},play:async({canvasElement:n})=>{const e=s(n);await t(e.getByText(/partial snapshot/)).toBeVisible()}},h={args:{onEntityQueryChange:a(),entityMode:"idle",entityResults:[],canReach:()=>!0,onEntitySelect:a()},play:async({canvasElement:n})=>{const e=s(n),o=await e.findByRole("searchbox",{name:"Search sections"});await i.type(o,"ex"),await t(e.getByRole("button",{name:/^Export/})).toBeVisible(),await t(e.getByRole("button",{name:/^Explorer/})).toBeVisible(),await t(e.queryByRole("button",{name:/^Home/})).not.toBeInTheDocument(),await t(e.getByText("Type 3 characters to search the org.")).toBeVisible()}},g={args:{onEntityQueryChange:a(),entityMode:"results",entityResults:b,canReach:()=>!1,oktaOrigin:"https://example.okta.com",onEntitySelect:a()},play:async({canvasElement:n})=>{const e=s(n),o=e.getByRole("link",{name:"Engineering — open in Okta"});await t(o).toHaveAttribute("href","https://example.okta.com/admin/group/00gFAKE0000000000001"),await t(o.querySelector("a, button")).toBeNull(),await t(e.queryByRole("link",{name:/Feeds Engineering/})).toBeNull()}},w={play:async({canvasElement:n,args:e})=>{const E=await s(n).findByRole("searchbox",{name:"Search sections"});await i.click(E),await i.keyboard("{ArrowDown}"),await S(()=>t(E).not.toHaveFocus()),await i.keyboard("{Enter}"),await t(e.onSelect).toHaveBeenCalledTimes(1),await t(e.onClose).toHaveBeenCalled()}},v={args:{isOpen:!1}},f={parameters:{motion:"on"},globals:{viewport:{value:"sidepanelDefault"}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source},description:{story:"Freshly opened: the unfiltered list of every section in the rail.",...r.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    activeTab: 'policies'
  }
}`,...c.parameters?.docs?.source},description:{story:'Opened from a different section, so a different row carries the "Current" marker.',...c.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole('searchbox', {
      name: 'Search sections'
    });
    await userEvent.type(field, 'or');

    // Named, not just counted: a bare count rots the moment a section is added.
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('3 sections'));
    await expect(canvas.getByRole('button', {
      name: /Export/
    })).toBeVisible();
    await expect(canvas.getByRole('button', {
      name: /Explorer/
    })).toBeVisible();
    await expect(canvas.getByRole('button', {
      name: /History/
    })).toBeVisible();
    await expect(canvas.queryByRole('button', {
      name: /Groups/
    })).not.toBeInTheDocument();
  }
}`,...l.parameters?.docs?.source},description:{story:'"or" appears mid-label in every match, which is the substring (not prefix) behaviour.',...l.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole('searchbox', {
      name: 'Search sections'
    });
    await userEvent.type(field, 'zzz');
    await canvas.findByText('No sections match');
  }
}`,...p.parameters?.docs?.source},description:{story:"No section matches — the shared `EmptyState`, not a blank panel.",...p.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    onEntityQueryChange: fn(),
    entityMode: 'results',
    entityResults: ENTITY_RESULTS,
    canReach: () => true,
    sectionMeta: {
      group: {
        fromSnapshot: false,
        complete: true
      },
      app: {
        fromSnapshot: true,
        complete: true
      },
      rule: {
        fromSnapshot: true,
        complete: true
      },
      user: {
        fromSnapshot: false,
        complete: true
      }
    },
    onEntitySelect: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: /^Home/
    })).toBeVisible();
    await expect(canvas.getByRole('button', {
      name: 'Engineering — open in Groups'
    })).toBeVisible();
    await expect(canvas.getByRole('button', {
      name: 'Salesforce — open in Apps'
    })).toBeVisible();
    await expect(canvas.getByRole('button', {
      name: 'Ada Lovelace — open in Users'
    })).toBeVisible();

    // A heading is separated structurally, not textually: it is the one \`<li>\`
    // in the list holding no control at all.
    const heading = (name: string) => canvas.getAllByRole('listitem').find(li => !li.querySelector('a, button') && li.textContent?.startsWith(name));
    await expect(heading('Apps')).toHaveTextContent('from snapshot');
    await expect(heading('Rules')).toHaveTextContent('from snapshot');
    await expect(heading('Users')).toHaveTextContent('live');
  }
}`,...d.parameters?.docs?.source},description:{story:"Both halves at once: sections on top, then org results grouped by kind.",...d.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    onEntityQueryChange: fn(),
    entityMode: 'searching',
    entityResults: ENTITY_RESULTS,
    canReach: () => true,
    onEntitySelect: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    // Held across a refining search rather than emptied mid-word.
    await expect(canvas.getByRole('button', {
      name: 'Engineering — open in Groups'
    })).toBeVisible();
  }
}`,...u.parameters?.docs?.source},description:{story:"Mid-search: the spinner is in the field and the previous rows are held.",...u.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    onEntityQueryChange: fn(),
    entityMode: 'error',
    entityResults: [],
    entityError: 'Search failed. Check the connection to Okta and try again.',
    canReach: () => true,
    onEntitySelect: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Search failed');
  }
}`,...m.parameters?.docs?.source},description:{story:'The org search failed — a `danger` banner, not a list that reads as "nothing".',...m.parameters?.docs?.description}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    onEntityQueryChange: fn(),
    entityMode: 'results',
    entityResults: [ENTITY_RESULTS[1]],
    canReach: () => true,
    sectionMeta: {
      app: {
        fromSnapshot: true,
        complete: false
      }
    },
    onEntitySelect: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/partial snapshot/)).toBeVisible();
  }
}`,...y.parameters?.docs?.source},description:{story:"A snapshot walk that has not finished: the heading says so.",...y.parameters?.docs?.description}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    onEntityQueryChange: fn(),
    entityMode: 'idle',
    entityResults: [],
    canReach: () => true,
    onEntitySelect: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole('searchbox', {
      name: 'Search sections'
    });
    // \`ex\`, not \`en\`: it has to be a query that actually matches a section, or
    // this asserts the empty state and calls it "sections still filter".
    await userEvent.type(field, 'ex');

    // Sections still filter instantly at two characters — only the org search waits.
    await expect(canvas.getByRole('button', {
      name: /^Export/
    })).toBeVisible();
    await expect(canvas.getByRole('button', {
      name: /^Explorer/
    })).toBeVisible();
    await expect(canvas.queryByRole('button', {
      name: /^Home/
    })).not.toBeInTheDocument();
    await expect(canvas.getByText('Type 3 characters to search the org.')).toBeVisible();
  }
}`,...h.parameters?.docs?.source},description:{story:"Below the character floor: the palette says what it is waiting for.",...h.parameters?.docs?.description}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    onEntityQueryChange: fn(),
    entityMode: 'results',
    entityResults: ENTITY_RESULTS,
    canReach: () => false,
    oktaOrigin: 'https://example.okta.com',
    onEntitySelect: fn()
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // The whole row becomes the link, rather than a link nested inside the row's
    // button — which is a \`nested-interactive\` violation axe caught here.
    const link = canvas.getByRole('link', {
      name: 'Engineering — open in Okta'
    });
    await expect(link).toHaveAttribute('href', 'https://example.okta.com/admin/group/00gFAKE0000000000001');
    await expect(link.querySelector('a, button')).toBeNull();

    // A rule has no admin-console route, so it stays a plain row rather than
    // gaining a link that goes nowhere.
    await expect(canvas.queryByRole('link', {
      name: /Feeds Engineering/
    })).toBeNull();
  }
}`,...g.parameters?.docs?.source},description:{story:"A kind this build cannot open renders a working Okta link, not a control that refuses.",...g.parameters?.docs?.description}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole('searchbox', {
      name: 'Search sections'
    });
    await userEvent.click(field);
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(field).not.toHaveFocus());
    await userEvent.keyboard('{Enter}');
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
    await expect(args.onClose).toHaveBeenCalled();
  }
}`,...w.parameters?.docs?.source},description:{story:"The roving-focus model: Down enters the list, Down moves, Enter jumps and closes.",...w.parameters?.docs?.description}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    isOpen: false
  }
}`,...v.parameters?.docs?.source},description:{story:"Closed: the palette renders nothing at all.",...v.parameters?.docs?.description}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  parameters: {
    motion: 'on'
  },
  globals: {
    viewport: {
      value: 'sidepanelDefault'
    }
  }
}`,...f.parameters?.docs?.source},description:{story:"Motion enabled, so the entrance runs at its real duration. No `play`: it would race.",...f.parameters?.docs?.description}}};const V=["Default","ActiveSectionMarked","Filtered","Empty","WithEntityResults","EntitySearching","EntityError","PartialSnapshot","BelowMinChars","UnreachableKind","KeyboardNavigation","Closed","MotionShowcase"];export{c as ActiveSectionMarked,h as BelowMinChars,v as Closed,r as Default,p as Empty,m as EntityError,u as EntitySearching,l as Filtered,w as KeyboardNavigation,f as MotionShowcase,y as PartialSnapshot,g as UnreachableKind,d as WithEntityResults,V as __namedExportsOrder,M as default};
