---
name: Blog 3D Embed UX Analysis
description: Comprehensive UX analysis for interactive 3D model embeds in blog posts — loading, affordance, scroll hijack, fallback, fullscreen, mobile, multi-embed, author syntax, accessibility
type: project
---

Feature: `::scene{src="model.glb" height="400" controls="orbit"}` markdown directive renders an interactive 3D viewer inline in blog posts.

**Why:** Authors want to illustrate spatial concepts, product designs, or interactive demos without leaving the reading flow.

**How to apply:** Use this analysis as the design brief before implementing the Scene embed component and any Renderer.svelte changes.

---

## Loading States
- Two-phase: skeleton rect (matches embed height) → fade-in canvas once ready. No spinner — it looks like the scene stalled.
- If `thumbnail` is present on the model config, blur-up the thumbnail behind the skeleton (same technique as image lazy loading). The model already has `thumbnail?: string` on Model3D.
- Progress tracking: Threlte/Three.js loader events expose a `progress` fraction. Show a thin 2px bottom-border progress bar inside the skeleton — subtle, not disruptive to prose.
- If load exceeds 8 seconds, transition to a "Taking longer than expected — tap to retry" state within the embed frame. Never leave the reader with a forever-spinner.
- The skeleton must match the configured height exactly so prose does not jump when the scene loads (layout shift = trust destroyer).

## Interaction Affordance
- Dormant state (before first click): the scene auto-rotates slowly on Y axis (already supported via `autoRotation` in config). Motion = hint that this is alive.
- A persistent "Drag to orbit" badge appears in the bottom-left corner of the embed, using a `i-lucide-rotate-3d` icon + the label. It fades after the first pointer-down event and never reappears.
- Cursor: `grab` on hover, `grabbing` on pointer-down. CSS `cursor` property, not custom cursors.
- Touch devices: replace "Drag to orbit" badge with "Touch to explore" (single finger orbit) + pinch icon for zoom.
- Do NOT rely on hover state to reveal the hint — touch users never hover.

## Scroll Hijacking — Click-to-Activate Pattern
This is the most critical UX decision for inline 3D.

**Recommended: click-to-activate with visual dormant/active states.**

- Dormant state: auto-rotate plays, orbit controls disabled, touch-action: auto (scroll passes through).
  - The embed has a transparent overlay div with `pointer-events: all` that intercepts clicks.
  - Clicking anywhere on the embed activates it.
- Active state: overlay removed, OrbitControls fully enabled, touch-action: none on the canvas.
  - An "Activated" badge appears briefly (500ms) confirming the mode switch.
  - A small "×" dismiss pill in the top-right corner deactivates and returns to dormant (scroll resumes).
- Deactivation triggers: clicking the dismiss pill, pressing Escape, or scrolling more than 200px away from the embed (use IntersectionObserver with a generous rootMargin).
- This is the exact pattern used by Google Maps and Mapbox embeds in articles. Readers understand it from muscle memory.

**Why not always-on?** A reader scrolling through a long post with a 3D scene will have their scroll hijacked the moment they enter the scene bounds. This is infuriating on trackpad and touch. Always-on is only appropriate for fullscreen viewers (ViewerDialog already does this correctly).

## Fallback Experience
- The existing `svelte:boundary` + `BoundaryFallback` pattern is exactly right. Re-use it.
- The BoundaryFallback should show: the `thumbnail` image (if present) as a static preview, the model name, and "3D viewer requires WebGL" explanation.
- If thumbnail is absent: a `var(--color-subtle)` filled rect with a centered `i-lucide-box` icon at 32px and the model name. No blank grey box with nothing.
- JS disabled (SSR-only context): emit a `<noscript>` inside the embed with a static `<img>` from thumbnail or a text description of the scene. The `::scene` directive should always include an `alt` attribute for this reason.
- Slow connection: the skeleton phase already covers this gracefully.

## Fullscreen Expand
- Yes, include a fullscreen expand button — it's already built as ViewerDialog. This is a genuine enhancement, not noise.
- The expand button (`i-lucide-expand`) lives in the top-right corner of the embed, visible on hover (desktop) and always-visible (touch, because no hover state).
- On click, open ViewerDialog with the same model config. The dialog's existing ViewerOverlay provides Close + animation controls.
- The expand icon must not overlap with the dismiss-pill (deactivate button). Use top-right for expand, bottom-left for the orbit hint badge, and a subtle active-indicator in the corner.
- Keyboard: `F` key while the embed is focused should trigger fullscreen (matching the existing ViewerDialog escape-key convention).

## Mobile UX
- **Static preview with tap-to-activate** is the correct mobile default, not an always-on interactive scene.
- The auto-rotate dormant state still plays (it's a canvas, not an image) but controls are disabled until tap.
- Pinch-to-zoom: when active, pinch zooms the 3D scene. This will conflict with page zoom. Prevent with `touch-action: none` only when active. In dormant state, `touch-action: auto` so page pinch-zoom is unaffected.
- One-finger drag (orbit) vs two-finger scroll (page scroll): OrbitControls handles this if `touches.ONE = THREE.TOUCH.ROTATE` and `touches.TWO = THREE.TOUCH.DOLLY_PAN`. Threlte's OrbitControls passthrough already maps this correctly.
- Battery/performance: use `renderMode: 'on-demand'` for static models in embeds. Only animated models need `'always'`. This halves GPU work for most embeds.
- If the reader's device is a low-end mobile (detect via `navigator.deviceMemory < 2` or `navigator.hardwareConcurrency <= 2`), show a static thumbnail with a "Tap to load 3D" prompt instead of auto-loading the Canvas. This is progressive enhancement, not degradation — the 3D is still accessible on demand.

## Multiple Embeds
- Lazy initialize: use IntersectionObserver with `rootMargin: "200px"` to mount the Canvas only when the embed nears the viewport. Unmounted embeds show the skeleton.
- Staggered: only initialize one Canvas at a time. If two are entering the viewport simultaneously, queue the second with a 300ms delay. Three.js context creation is expensive.
- Suspend all non-focused embeds: when one embed is activated (click-to-activate), pause auto-rotation on all others (set `renderMode: 'on-demand'` dynamically). Resume when deactivated.
- Maximum concurrent active WebGL contexts: browsers typically allow 8–16. Unmounting off-screen embeds (100px below viewport) protects against context exhaustion.
- Cognitive load: more than 2 embeds in a single article is an authoring problem, not a rendering problem. The editor should warn authors (soft limit of 3).

## Author Syntax
`::scene{src="model.glb" height="400" controls="orbit" alt="A damaged space helmet with PBR textures" camera="3,3,3" target="0,0,0"}`

- `src`: required. Path relative to /models or a full R2 URL (consistent with image handling).
- `height`: optional, defaults to 400px. Authors think in pixels. Accept integer only.
- `controls`: optional, defaults to `"orbit"`. Future values: `"none"` (static preview only), `"pan"` (orbit + pan).
- `alt`: required for accessibility and fallback. The editor should enforce this and show an inline validation error if absent.
- `camera` and `target`: optional, comma-separated XYZ. Defaults to the model config defaults. For blog authors, these are advanced — consider hiding behind an "Advanced" disclosure in the editor insert dialog.
- `autorotate`: optional boolean string (`"true"` / `"false"`). Defaults to true in dormant state.
- Do NOT expose `lighting`, `renderMode`, or `fov` in the markdown syntax. These are implementation details, not author concerns.

**In-editor preview**: The blog editor already has a preview API at `/api/blog/preview/`. For the editor split-pane, render a non-interactive thumbnail (the `thumbnail` image or a static canvas snapshot). Full interactive 3D in the editor preview is a distraction from writing and an unnecessary performance cost. Label the preview region "3D embed — interactive in published post" so authors understand what readers will see.

## Screen Readers
- The canvas element must have `role="img"` and `aria-label` derived from the `alt` attribute in the directive. Example: `aria-label="A damaged space helmet with PBR textures"`.
- Surround the canvas with a `<figure>` element. A `<figcaption>` can optionally display the model's `credit` attribution (already in Model3D config), visible to all users.
- The activate/deactivate overlay must announce state changes: `aria-live="polite"` region that announces "3D viewer activated — use arrow keys to orbit" and "3D viewer deactivated".
- The expand button needs `aria-label="Open [model name] in fullscreen 3D viewer"`.

## Keyboard Navigation
- Tab order: embed container is focusable (`tabindex="0"`). Tab into it focuses the container.
- While focused (before activation): Space or Enter activates the embed.
- While activated: Arrow keys map to orbit (left/right = Y-axis orbit, up/down = X-axis orbit). `+`/`-` keys zoom. `R` resets camera. Escape deactivates.
- Tab out: Shift+Tab or Tab exits the embed and moves to the next focusable element. Focus must NOT be trapped inside the embed unless it's in fullscreen mode (ViewerDialog, which already handles focus trap via Bits UI Dialog).
- Visible focus ring on the container: `outline: 2px solid var(--color-primary); outline-offset: 2px` — consistent with the existing scene-card:focus-visible pattern.

## Reduced Motion
- `@media (prefers-reduced-motion: reduce)`: disable auto-rotation entirely. The dormant state becomes static.
- Disable camera transition easing on activation (instant snap, not smooth orbit-to-position).
- The existing SceneCard already respects this (`transition: none` on hover). Apply the same discipline here.
- The "Activated" badge fade should also be instant (no opacity transition).
