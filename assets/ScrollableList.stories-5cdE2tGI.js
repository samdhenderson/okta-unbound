import{e as u,j as e,f as h}from"./iframe-tAvKsVeF.js";import"./preload-helper-PPVm8Dsz.js";const f={title:"Shared/ScrollableList",component:u,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"Independently scrollable list container with built-in loading and empty states.\n\nRenders a `LoadingSpinner` while `loading`, the `emptyState` node when it has no children, otherwise a scroll region (its own scrollbar) that by default flex-grows to fill available space so surrounding chrome stays visible. A caller whose loading state has a known shape can pass a `Skeleton` via `skeleton` instead of the default spinner."}}},argTypes:{children:{description:"The list items to render."},className:{description:"Additional CSS classes for the container."},emptyState:{description:"Content to show when there are no children."},loading:{description:"Shows a loading spinner when true."},loadingMessage:{description:"Custom message for the loading state."},skeleton:{description:"Known-shape placeholder shown instead of the spinner while `loading`."},maxHeight:{description:'Optional explicit max-height (e.g. "400px", "50vh").'},fillAvailable:{description:"If true (default), uses flex-grow to fill remaining space."},testId:{description:"Test id applied to the container."}},args:{children:null}},a={args:{children:e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"p-3 bg-white border border-neutral-200 rounded-md",children:"Item 1"}),e.jsx("div",{className:"p-3 bg-white border border-neutral-200 rounded-md",children:"Item 2"}),e.jsx("div",{className:"p-3 bg-white border border-neutral-200 rounded-md",children:"Item 3"})]})}},t={args:{loading:!0,children:null}},s={args:{loading:!0,loadingMessage:"Fetching groups...",children:null}},o={args:{loading:!0,skeleton:e.jsx(h,{variant:"row",count:4,label:"Loading groups"}),children:null}},i={args:{children:null,emptyState:e.jsx("div",{className:"py-8 text-center text-neutral-500",children:e.jsx("p",{className:"text-sm",children:"No items found"})})}},n={args:{maxHeight:"300px",fillAvailable:!1,children:e.jsx(e.Fragment,{children:Array.from({length:10},(g,r)=>e.jsxs("div",{className:"p-3 bg-white border border-neutral-200 rounded-md",children:["Item ",r+1]},r))})}},l={args:{loading:!0,className:"mt-4",maxHeight:"300px",fillAvailable:!1,skeleton:e.jsx(h,{variant:"row",count:4,label:"Loading groups"}),children:null}},d={args:{loading:!0,maxHeight:"160px",fillAvailable:!1,skeleton:e.jsx(h,{variant:"row",count:3,label:"Loading groups"}),children:null}},c={args:{maxHeight:"160px",fillAvailable:!1,children:e.jsx(e.Fragment,{children:Array.from({length:12},(g,r)=>e.jsxs("div",{className:"p-3 bg-white border border-neutral-200 rounded-md",children:["Item ",r+1]},r))})}},m={args:{className:"mt-4",maxHeight:"300px",fillAvailable:!1,children:e.jsx(e.Fragment,{children:Array.from({length:4},(g,r)=>e.jsxs("div",{className:"p-3 bg-white border border-neutral-200 rounded-md",children:["Item ",r+1]},r))})}},p={args:{fillAvailable:!0,children:e.jsx(e.Fragment,{children:Array.from({length:5},(g,r)=>e.jsxs("div",{className:"p-3 bg-white border border-neutral-200 rounded-md",children:["Item ",r+1]},r))})}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    children: <>
        <div className="p-3 bg-white border border-neutral-200 rounded-md">Item 1</div>
        <div className="p-3 bg-white border border-neutral-200 rounded-md">Item 2</div>
        <div className="p-3 bg-white border border-neutral-200 rounded-md">Item 3</div>
      </>
  }
}`,...a.parameters?.docs?.source},description:{story:"Default with list items.",...a.parameters?.docs?.description}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true,
    children: null
  }
}`,...t.parameters?.docs?.source},description:{story:"Loading state with spinner.",...t.parameters?.docs?.description}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true,
    loadingMessage: 'Fetching groups...',
    children: null
  }
}`,...s.parameters?.docs?.source},description:{story:"Loading with custom message.",...s.parameters?.docs?.description}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true,
    skeleton: <Skeleton variant="row" count={4} label="Loading groups" />,
    children: null
  }
}`,...o.parameters?.docs?.source},description:{story:"Loading with a `Skeleton` shown instead of the default spinner.",...o.parameters?.docs?.description}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    children: null,
    emptyState: <div className="py-8 text-center text-neutral-500">
        <p className="text-sm">No items found</p>
      </div>
  }
}`,...i.parameters?.docs?.source},description:{story:"Empty state.",...i.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    maxHeight: '300px',
    fillAvailable: false,
    children: <>
        {Array.from({
        length: 10
      }, (_, i) => <div key={i} className="p-3 bg-white border border-neutral-200 rounded-md">
            Item {i + 1}
          </div>)}
      </>
  }
}`,...n.parameters?.docs?.source},description:{story:"With explicit max height.",...n.parameters?.docs?.description}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true,
    className: 'mt-4',
    maxHeight: '300px',
    fillAvailable: false,
    skeleton: <Skeleton variant="row" count={4} label="Loading groups" />,
    children: null
  }
}`,...l.parameters?.docs?.source},description:{story:"The loading placeholder occupies the same box as the loaded list. This story and\n{@link BoxParityLoaded} differ only in `loading`; the top edge of the first row must\nnot move between them.",...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true,
    maxHeight: '160px',
    fillAvailable: false,
    skeleton: <Skeleton variant="row" count={3} label="Loading groups" />,
    children: null
  }
}`,...d.parameters?.docs?.source},description:{story:"The same pair with a scrollbar in play: the reserved channel\n(`scrollbar-gutter: stable`) is on both branches, so flipping between this story and\n{@link GutterParityLoaded} must not move the left edge of the content.",...d.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    maxHeight: '160px',
    fillAvailable: false,
    children: <>
        {Array.from({
        length: 12
      }, (_, i) => <div key={i} className="p-3 bg-white border border-neutral-200 rounded-md">
            Item {i + 1}
          </div>)}
      </>
  }
}`,...c.parameters?.docs?.source},description:{story:"The loaded counterpart of {@link GutterParityLoading} — enough rows to scroll.",...c.parameters?.docs?.description}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    className: 'mt-4',
    maxHeight: '300px',
    fillAvailable: false,
    children: <>
        {Array.from({
        length: 4
      }, (_, i) => <div key={i} className="p-3 bg-white border border-neutral-200 rounded-md">
            Item {i + 1}
          </div>)}
      </>
  }
}`,...m.parameters?.docs?.source},description:{story:"The loaded counterpart of {@link BoxParityLoading} — same box, real rows.",...m.parameters?.docs?.description}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    fillAvailable: true,
    children: <>
        {Array.from({
        length: 5
      }, (_, i) => <div key={i} className="p-3 bg-white border border-neutral-200 rounded-md">
            Item {i + 1}
          </div>)}
      </>
  }
}`,...p.parameters?.docs?.source},description:{story:"Multiple items filling available space.",...p.parameters?.docs?.description}}};const y=["Default","Loading","LoadingWithMessage","LoadingWithSkeleton","Empty","WithMaxHeight","BoxParityLoading","GutterParityLoading","GutterParityLoaded","BoxParityLoaded","FillAvailable"];export{m as BoxParityLoaded,l as BoxParityLoading,a as Default,i as Empty,p as FillAvailable,c as GutterParityLoaded,d as GutterParityLoading,t as Loading,s as LoadingWithMessage,o as LoadingWithSkeleton,n as WithMaxHeight,y as __namedExportsOrder,f as default};
