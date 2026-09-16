import{j as e}from"./iframe-tAvKsVeF.js";import{u as s,M as t}from"./blocks-CxSch1eI.js";import"./preload-helper-PPVm8Dsz.js";function o(r){const n={code:"code",h1:"h1",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...s(),...r.components};return e.jsxs(e.Fragment,{children:[e.jsx(t,{title:"Getting Started"}),`
`,e.jsx(n.h1,{id:"okta-unbound--component-explorer--docs",children:"Okta Unbound — component explorer & docs"}),`
`,e.jsx(n.p,{children:`One place for everything: the UI component library, the backend/internals API
reference, and the project's written specs.`}),`
`,e.jsx(n.h2,{id:"sections",children:"Sections"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Components"}),` — every shared primitive and feature component, with live
variants, controls, and autodocs generated from their TSDoc. These surface as
feature-named sidebar roots (`,e.jsx(n.code,{children:"Shared"}),", ",e.jsx(n.code,{children:"Groups"}),", ",e.jsx(n.code,{children:"Users"}),", ",e.jsx(n.code,{children:"Overview"}),", ",e.jsx(n.code,{children:"Rules"}),`,
`,e.jsx(n.code,{children:"Export"}),", ",e.jsx(n.code,{children:"Sidepanel"}),`) rather than one literal "Components" folder. Hook-coupled
containers render against a mocked `,e.jsx(n.code,{children:"useOktaApi"})," + a fake ",e.jsx(n.code,{children:"chrome"}),"."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Internals"}),` — the auto-generated API reference for the non-component code
(hooks, scheduler & messaging, cache, shared utilities, types, background,
content script), produced from the source TSDoc by TypeDoc and refreshed with
`,e.jsx(n.code,{children:"npm run docs"}),"."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Documentation"}),` — the project specs (architecture, design system, testing,
…) and the Architecture Decision Records (ADRs), rendered from `,e.jsx(n.code,{children:"docs/"}),"."]}),`
`]}),`
`,e.jsx(n.h2,{id:"running--testing",children:"Running & testing"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{children:`npm run storybook        # this explorer, on http://localhost:6006
npm run build-storybook  # static build (deployed to GitHub Pages)
npm run test:storybook   # run every story as a headless-browser render test
`})}),`
`,e.jsxs(n.p,{children:["Every new or changed shared/leaf component ships a co-located ",e.jsx(n.code,{children:".stories.tsx"}),`
(see `,e.jsx(n.strong,{children:"Documentation → Component Explorer"}),")."]})]})}function h(r={}){const{wrapper:n}={...s(),...r.components};return n?e.jsx(n,{...r,children:e.jsx(o,{...r})}):o(r)}export{h as default};
