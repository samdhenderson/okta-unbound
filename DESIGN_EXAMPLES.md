# Design Examples - Visual Reference

## Component Showcase

### Header Component
```
╔═══════════════════════════════════════════════════════════════╗
║  [Gradient Mesh Background - Deep Blue to Light Blue]         ║
║                                                                ║
║  Okta Unbound              ┌─────────────────┐                ║
║  Advanced Identity         │  ●  Connected   │                ║
║  Management                └─────────────────┘                ║
║                             [Glass badge with                 ║
║                              animated pulse]                   ║
╚═══════════════════════════════════════════════════════════════╝
```

**Design Features:**
- Gradient mesh background with radial patterns
- Pulsing status indicator (connects/disconnects)
- Glass morphism status badge
- Premium typography (DM Sans)
- Subtle edge highlight

---

### Tab Navigation
```
┌───────────────────────────────────────────────────────────────┐
│ ◆ Overview  ⚡ Rules  👥 Users  🛡 Security  📦 Groups  🎯 Apps │
│ ═══════                                                        │
│ [Active tab has gradient underline with glow]                 │
└───────────────────────────────────────────────────────────────┘
```

**Design Features:**
- Contextual icons for each tab
- Animated gradient indicator (slides on tab change)
- Hover states with icon scale
- Glass effect backdrop
- Okta blue for active state

---

### Group Banner
```
┌───────────────────────────────────────────────────────────────┐
│                                                                │
│  ●  DevOps Engineering Team                  ┌──────────────┐ │
│     ID: 00g7x9k2l3m4n5p6                     │ 🔗 Edit Okta  │ │
│     [Monospace font for ID]                  └──────────────┘ │
│                                              [Hover: lifts up] │
└───────────────────────────────────────────────────────────────┘
```

**Design Features:**
- Status dot indicator (blue = active, spinner = loading, warning = error)
- Monospace typography for technical IDs
- Elevated button with icon
- Subtle gradient background
- Smooth hover animations

---

### Stat Cards
```
┌─────────────────────┐  ┌─────────────────────┐
│ TOTAL MEMBERS       │  │ ACTIVE RULES        │
│                   [📊]│  │                   [⚡]│
│ 247                 │  │ 12                  │
│                     │  │                     │
│ Updated 5m ago      │  │ All passing         │
└─────────────────────┘  └─────────────────────┘
  [Okta Blue Theme]      [Success Green Theme]
```

**Design Features:**
- Gradient overlay with color-matched glow
- Icon badges with subtle background
- Large, bold numbers (DM Sans)
- Hover states with lift effect
- Edge highlights
- Color-coded by type (primary/success/warning/error)

---

## Color Palette in Action

### Primary (Okta Blue)
```
Background: White → Light Blue gradient
Border: Okta Blue 20% opacity
Shadow: Okta Blue 10% glow
Icon: Okta Blue solid
Text: Dark gray
```

### Success (Emerald)
```
Background: White → Light Green gradient
Border: Emerald 40% opacity
Shadow: Emerald 10% glow
Icon: Emerald solid
Text: Dark gray
```

### Warning (Amber)
```
Background: White → Light Amber gradient
Border: Amber 40% opacity
Shadow: Amber 10% glow
Icon: Amber solid
Text: Dark gray
```

---

## Animation Examples

### 1. Tab Switch Animation
```
Step 1: User clicks new tab
Step 2: Old indicator fades out (150ms)
Step 3: New indicator slides in from left (300ms)
Step 4: Icon scales up slightly (200ms)
Result: Smooth, polished transition
```

### 2. Card Hover
```
Initial:  Shadow: 10px, Y: 0
Hover:    Shadow: 25px, Y: -2px
Duration: 300ms ease-out
Result:   Cards "lift" on hover
```

### 3. Status Indicator Pulse
```
0%:   Opacity: 1, Shadow: 0
50%:  Opacity: 0.9, Shadow: 15px glow
100%: Opacity: 1, Shadow: 0
Duration: 2s infinite
Result: Gentle, attention-grabbing pulse
```

---

## Typography Scale

### Headers
```
H1 (Header Title):  24px bold, -0.3px tracking
H2 (Section):       20px semibold, tight tracking
H3 (Card Title):    16px semibold
```

### Body Text
```
Body:        14px regular, 1.6 line-height
Small:       12px medium
Tiny:        10px bold uppercase (labels)
```

### Monospace
```
IDs:         12px, wide tracking
Code:        13px regular
Data:        14px medium
```

---

## Interactive States

### Buttons
```
Default:  Okta Blue, white text
Hover:    Darker blue, lift -1px, larger shadow
Active:   Even darker, no transform
Disabled: 50% opacity, cursor not-allowed
```

### Cards
```
Default:  Light shadow, no transform
Hover:    Larger shadow, lift -2px, border glow
Click:    Brief scale down to 0.98
```

### Tabs
```
Inactive: Gray text, no indicator
Hover:    Dark gray, subtle bg tint, icon scale 1.05
Active:   Okta blue, gradient indicator, icon scale 1.1
```

---

## Design Principles Applied

### 1. **Depth Through Layering**
- Base layer: Subtle gradient backgrounds
- Mid layer: Cards with shadows
- Top layer: Raised elements on hover
- Atmosphere: Gradient overlays and glows

### 2. **Motion with Purpose**
- Tab changes: Indicate navigation clearly
- Hovers: Suggest interactivity
- Status: Communicate system state
- Loads: Show progress and activity

### 3. **Color as Communication**
- Blue: Okta brand, primary actions, information
- Green: Success, completion, healthy states
- Amber: Warnings, attention needed
- Red: Errors, critical issues
- Gray: Neutral, secondary content

### 4. **Typography as Hierarchy**
- Bold weights: Important information
- Monospace: Technical data (IDs, codes)
- Uppercase tiny: Labels and categories
- Large sizes: Key metrics and numbers

---

## Browser Compatibility

✅ Chrome/Edge (Chromium): Full support
✅ Firefox: Full support
✅ Safari: Full support (with prefixes)
✅ All modern browsers with ES2020+ support

---

## Performance Considerations

- CSS-only animations (GPU accelerated)
- Minimal JavaScript for interactions
- Optimized font loading (swap strategy)
- Efficient gradient rendering
- No layout thrashing
- Smooth 60fps animations

---

## Responsive Behavior

The design scales beautifully:
- Cards stack on narrow viewports
- Tabs remain scrollable horizontally
- Text truncates gracefully with ellipsis
- Buttons maintain touch-friendly sizes
- Icons scale proportionally

---

## Dark Mode Ready

The design system is structured to easily support dark mode:
- CSS variables for all colors
- Gradient directions can be inverted
- Shadow colors can be adjusted
- All color combinations tested for contrast

To enable (future):
```css
[data-theme="dark"] {
  --color-bg: #0f1419;
  --color-okta-blue-light: #3d9dd9; /* More vibrant in dark */
  /* ... other dark mode colors */
}
```
