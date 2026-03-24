---
name: Blog 3D Embed — Final Interaction Specification
description: Definitive state machine for inline 3D scene embeds in blog posts, integrating findings from ARCHY, SVEY, DATY, RESY, and SCOUT rounds. Covers alt semantics, exact loading states, mobile strategy, fullscreen transfer vs re-mount, and accessibility annotations.
type: project
---

Feature: `::scene` markdown directive renders an interactive 3D model inline in a blog post.

**Why:** Authors need spatial illustration without breaking reading flow. Reader experience must be frictionless — no scroll hijack, no surprise context switches, no broken state.

**How to apply:** Use this as the binding implementation contract for the SceneEmbed component and any related blog rendering changes. Supersedes the earlier blog-3d-embed-ux.md analysis where the two conflict.

---

## 1. Resolved Questions

### 1a. `alt` — Optional, Not Required

Decision: `alt` is **optional** on `::scene`.

Rationale:
- Unlike `<img>`, a 3D scene has no established textual equivalent. A description of "a damaged space helmet with PBR textures" tells a screen reader user nothing useful about the scene's purpose in the article.
- The author-written prose surrounding the embed is the correct accessibility context. The embed exists to enrich prose, not replace it.
- Forcing `alt` on every embed will produce low-quality filler text ("3D model of X") that is worse than silence.
- The `<figure>` + `<figcaption>` pattern (from Model3D.credit) provides attribution context visible to all users.

What we do instead:
- If `alt` is provided: use it as `aria-label` on the canvas and as `<noscript>` fallback text.
- If `alt` is absent: the canvas gets `aria-label="{model.name} — interactive 3D model"` constructed from the model's configured name. This is adequate.
- The surrounding `<figure>` always has `role="figure"`. The `<figcaption>` is rendered when `credit` exists on the model config.
- The editor should **suggest** alt text (not require it) with an inline prompt: "Describe what the reader should understand from this model (optional)."

### 1b. Fullscreen — Re-mount, Not Transfer

Decision: Fullscreen opens a **new Canvas in ViewerDialog** (re-mount). The inline embed is not destroyed — it pauses to `renderMode="on-demand"` while the dialog is open.

Rationale:
- Transferring a live WebGL context between DOM nodes is possible via `canvas.transferControlToOffscreen()` but requires a complete rewrite of Threlte's rendering loop and has no precedent in the ecosystem.
- Re-mount means the model re-downloads only if not cached. With content-addressed R2 keys (immutable caching from DATY), the second load is a cache hit — effectively instant.
- The Svelte action lifecycle (from SVEY) mounts/unmounts cleanly. A second Canvas creation is cheap when the .glb is already in the browser cache.
- ViewerDialog already works correctly and handles focus trap, Escape, and animation controls. Re-using it is zero additional cost.
- The inline embed pausing (not destroying) during fullscreen preserves its state — when the dialog closes, the embed resumes from the same camera position.

Implementation note: When ViewerDialog opens from a SceneEmbed, pass `renderMode="on-demand"` to the inline Canvas until `open` returns false. On dialog close, restore `renderMode="always"` (or `"on-demand"` if dormant — see state machine below).

### 1c. Mobile Strategy — Always Poster + Tap, With One Exception

Decision: On mobile, **always show poster + tap-to-load** regardless of device capability. The `navigator.deviceMemory` heuristic is dropped for mobile.

Rationale:
- Firefox mobile caps at 2 WebGL contexts. With multi-embed posts, auto-loading even two embeds on mobile Firefox will exhaust the limit and cause silent failures.
- The tap-to-load pattern matches the gold standard (Sketchfab, YouTube embeds). Mobile readers expect it.
- `navigator.deviceMemory` is not available in Firefox at all (privacy concern). Using it as the only gate creates inconsistent behavior.
- Progressive enhancement: the model is still fully accessible on mobile — it just requires an intentional tap. This is appropriate for optional enrichment content.

Exception: If the embed has `controls="none"` (static preview mode), the model auto-loads on mobile because it will never activate OrbitControls and cannot exhaust scroll or context budget.

### 1d. Poster Source

The `poster` image used in States 0–3 comes from Model3D's `thumbnail` field (already populated from DATY's `poster_asset_id` FK). The embed component reads `model.thumbnail` directly. No new prop needed in the markdown directive — the model config is the source of truth.

---

## 2. State Machine

Seven states. Transitions are explicit. No implicit state changes.

```
IDLE ──(viewport enters +200px)──▶ PRE_LOAD
      (mobile OR tap-to-load)──▶  POSTER_ONLY [terminal until tap]

PRE_LOAD ──(JS mounted, Canvas created)──▶ LOADING
LOADING ──(model ready)──▶ DORMANT
LOADING ──(timeout >8s)──▶ ERROR
DORMANT ──(click/Enter/Space)──▶ ACTIVE
DORMANT ──(F key / expand button)──▶ FULLSCREEN [ViewerDialog]
ACTIVE ──(Escape / dismiss pill / scroll >200px away)──▶ DORMANT
ACTIVE ──(F key / expand button)──▶ FULLSCREEN [ViewerDialog]
FULLSCREEN ──(dialog closes)──▶ DORMANT
ERROR ──(retry click)──▶ PRE_LOAD
```

---

## 3. State Definitions

### State 0: IDLE (SSR / Off-Screen)

What renders: The ARCHY placeholder — a `<div>` with fixed height from embed attrs, dashed border, "Scene embed" label. This is the server-rendered HTML, visible before any JS runs and while the embed is far from viewport.

Properties:
- Height set from `height` attribute (default 400px) as `style="height: {height}px"` on the wrapper
- No Canvas, no animation, no network requests
- The dashed border and "Scene embed" text are CSS-only (no JS required)
- Screen readers: `<figure>` wrapper with descriptive aria-label already in DOM

Transition trigger: IntersectionObserver fires when embed enters viewport + 200px rootMargin (SVEY confirmed this value). On mobile: never auto-transitions from IDLE — waits for tap.

### State 1: POSTER_ONLY (Mobile Default)

What renders: The poster image (from `model.thumbnail`) at full embed height. A centered "Tap to load 3D" button overlays it, using a `i-lucide-box` icon + label. If no poster exists, use a `var(--color-subtle)` filled rect with the same button.

Properties:
- No Canvas, no WebGL context
- `touch-action: auto` — page scroll fully functional
- The "Tap to load 3D" button is the only interactive element, `tabindex="0"`, keyboard-accessible
- On tap: transitions to PRE_LOAD → LOADING → DORMANT

When used: Always on mobile (viewport width < 768px) unless `controls="none"`.

### State 2: PRE_LOAD (Transitioning)

What renders: Two-phase appearance.
- Immediately: skeleton rect filling the embed height, matching `var(--color-subtle)` background. If `model.thumbnail` exists, it appears blurred (CSS `filter: blur(8px) brightness(0.8)`) behind the skeleton as a content hint.
- The thin 2px progress bar along the bottom edge appears once the Three.js loader fires its first progress event (never show it before progress begins — a bar stuck at 0% is worse than no bar).

Properties:
- Canvas is created but hidden (`visibility: hidden` NOT `display: none` — SCOUT confirmed `display: none` prevents WebGL context initialization in model-viewer; same applies here)
- `renderMode="on-demand"` (SVEY confirmed correct for blog embeds)
- Auto-rotation NOT yet running
- Network: .glb download begins

### State 3: LOADING (Rendering in Background)

What renders: Same as PRE_LOAD — skeleton + blurred poster + progress bar advancing.

Properties:
- Canvas exists, scene is populating
- Progress bar advances from loader events
- If load exceeds 8 seconds: transition to ERROR state
- Once `$gltf` resolves: fade skeleton out (150ms opacity transition), reveal canvas

Note on transition: The skeleton fades out at the same time the canvas fades in (crossfade, not sequential), preventing any flash of background color.

### State 4: DORMANT (Loaded, Not Activated)

What renders: Full canvas visible. Model is rendering.

Properties:
- `renderMode="on-demand"` unless model has continuous animation (`model.animations` populated), in which case `"always"`
- Auto-rotation enabled (Y axis, `config.autoRotation.speed`) — motion signals interactivity
- `@media (prefers-reduced-motion: reduce)`: auto-rotation disabled entirely; scene is static
- OrbitControls exist but are **disabled** (`enableOrbit: false` or equivalent)
- Transparent overlay div covers the canvas: `pointer-events: all`, `cursor: pointer`
  - This overlay intercepts all pointer events and prevents scroll hijack
  - `touch-action: auto` on the overlay so page scroll flows through on touch
- "Drag to orbit" badge visible in bottom-left: `i-lucide-rotate-3d` icon + text
  - Touch devices: "Touch to explore" label
  - `@media (prefers-reduced-motion: reduce)`: badge still shows (it's the affordance, not the animation)
- Expand button (`i-lucide-expand`) in top-right corner:
  - Desktop: opacity 0 by default, opacity 1 on hover (`:hover` on the embed wrapper)
  - Touch: always visible (opacity 1) because there is no hover state
- `aria-label` on the wrapper: "{model.name} — interactive 3D model. Press Space or Enter to activate controls."
- `tabindex="0"` on the wrapper container

Transition to ACTIVE: click on overlay, or Space/Enter while the wrapper is focused.
Transition to FULLSCREEN: F key while focused, or click of expand button.

### State 5: ACTIVE (Controls Enabled)

What renders: Canvas fully interactive.

Properties:
- Overlay div removed (or `pointer-events: none`)
- `touch-action: none` on the canvas — OrbitControls takes over all pointer events
- OrbitControls enabled (`enableOrbit: true`, `enableZoom: true`, `enablePan` per config)
- Auto-rotation **paused** (orbit controls conflict with auto-rotation; THREE.js standard)
- "Drag to orbit" badge gone (fades out on first pointer-down in dormant state, never returns)
- A dismiss pill appears in top-right (replaces expand icon while active): `×` + "Click to scroll" label
  - Dismiss pill: `position: absolute`, `top: var(--spacing-3)`, `right: var(--spacing-3)`
  - `background: color-mix(in srgb, var(--color-bg) 80%, transparent)`
  - `border: 1px solid var(--color-border)`, `border-radius: var(--radius-full)`
  - `padding: 2px var(--spacing-2)`, `font-size: var(--text-xs)`
- All other embeds on the page: pause auto-rotation (`renderMode="on-demand"` set dynamically via a shared `$state` store in a `.svelte.ts` module)
- `aria-live="polite"` region announces: "3D viewer activated — use arrow keys to orbit, plus and minus to zoom, R to reset, Escape to exit"
- Keyboard orbit map (applied to the embed container via `onkeydown`):
  - ArrowLeft / ArrowRight: Y-axis orbit (±0.05 rad per keypress)
  - ArrowUp / ArrowDown: X-axis orbit (±0.05 rad per keypress)
  - `+` / `=`: zoom in
  - `-`: zoom out
  - `r` / `R`: reset camera to initial position (smooth tween, 300ms)
  - Escape: deactivate → DORMANT
  - Tab / Shift+Tab: deactivate and move focus to next/previous element (do NOT trap focus)

Transition to DORMANT: Escape key, dismiss pill click, or scroll detection.

Scroll deactivation: IntersectionObserver with `rootMargin: "-200px"` (negative margin = embed must be at least 200px from viewport edge). When the embed leaves this inner margin while active, auto-deactivate. This prevents the reader scrolling away and then back to find controls still engaged.

### State 6: FULLSCREEN (ViewerDialog Open)

What renders: ViewerDialog opens with the same model config. Inline embed pauses.

Properties:
- Inline Canvas: `renderMode="on-demand"` (paused, no rendering cost)
- Inline overlay: restored if not already present (embed returns to DORMANT appearance while dialog is open)
- ViewerDialog: opens via `open = true` binding. All controls live inside the dialog (existing ViewerOverlay handles this correctly).
- Model re-mounts in dialog canvas. .glb is served from content-addressed R2 URL — browser cache hit on return visit, near-instant on same session.
- Dialog provides its own focus trap (Bits UI Dialog handles this).
- On dialog close: inline embed transitions to DORMANT. `renderMode` restored per model type.
- `F` key binding: active only when the inline embed container is focused (not globally) to avoid conflicts with the editor's own `F` bindings.

### State 7: ERROR

What renders: Error state inside the embed frame.

Properties:
- Skeleton replaced by: `var(--color-subtle)` background, centered `i-lucide-alert-triangle` at 24px in `var(--color-muted)` color, message "Taking longer than expected", retry button using the project's Button component (`variant="outline"`, size="sm"`).
- Frame height preserved (no layout shift).
- On retry: transitions to PRE_LOAD.
- `role="alert"` on the error message region.

---

## 4. Render Mode Strategy

| Condition | renderMode |
|-----------|------------|
| IDLE / POSTER_ONLY | No canvas |
| PRE_LOAD / LOADING | `on-demand` (hidden canvas initializing) |
| DORMANT, no animations | `on-demand` (auto-rotation writes via useTask, so renders per frame when rotating) |
| DORMANT, has animations | `always` |
| ACTIVE | `always` (user is interacting) |
| FULLSCREEN open (inline embed) | `on-demand` (paused) |
| FULLSCREEN dialog canvas | `always` |
| ERROR | No canvas |

Note: `on-demand` with `useTask` for auto-rotation means Threlte renders every frame during rotation but only when rotation is occurring. This is the correct behavior — pausing auto-rotation on reduced-motion also stops rendering, saving GPU/battery.

---

## 5. Multi-Embed Coordination

Implemented as a lightweight shared `.svelte.ts` store:

```typescript
// $lib/stores/scene-embeds.svelte.ts
let activeEmbedId = $state<string | null>(null);

export function activateEmbed(id: string) {
  activeEmbedId = id;
}

export function deactivateEmbed(id: string) {
  if (activeEmbedId === id) activeEmbedId = null;
}

export function getActiveEmbedId() {
  return activeEmbedId;
}
```

Each SceneEmbed reads `getActiveEmbedId()`. When not the active embed, auto-rotation pauses. This is reactive — `$derived(getActiveEmbedId() !== embedId)` controls the auto-rotation flag.

Canvas initialization: staggered via a 300ms delay when IntersectionObserver fires for two embeds within the same frame. Use a module-level queue (not per-instance state) to serialize Canvas creation.

Maximum concurrent active contexts: unmount Canvas when embed scrolls more than 300px below the viewport (negative `rootMargin: "-300px 0px -300px 0px"`). Re-mount on re-entry. This protects the WebGL context limit on Firefox mobile.

---

## 6. Author Syntax (Final)

```
::scene{src="model.glb" height="400" controls="orbit" alt="Optional description" camera="3,3,3" target="0,0,0" autorotate="true"}
```

Required: `src`
Optional, with defaults:
- `height`: 400 (px, integer only)
- `controls`: "orbit" | "none"
- `alt`: undefined (see §1a)
- `camera`: uses model config default
- `target`: uses model config default
- `autorotate`: "true" (dormant state auto-rotation)

Not exposed in syntax (implementation details): `lighting`, `renderMode`, `fov`, `poster`.

---

## 7. Accessibility Annotation Summary

| Element | Implementation |
|---------|---------------|
| Embed wrapper | `<figure>`, `tabindex="0"`, `role="figure"`, `aria-label="{name} — interactive 3D model. Press Space or Enter to activate controls."` |
| Canvas | `role="application"` (keyboard passthrough to arrow keys, per RESY), `aria-label` from `alt` attr or model name |
| figcaption | Rendered when `model.credit` exists. Visible to all users. |
| State announcements | `<div aria-live="polite" class="sr-only">` updated on activate/deactivate transitions |
| Overlay (dormant) | `aria-hidden="true"` — it's a pointer catcher, not content |
| Dismiss pill | `<button>`, `aria-label="Deactivate 3D viewer, return to page scroll"` |
| Expand button | `<button>`, `aria-label="Open {model.name} in fullscreen 3D viewer"` |
| Error state | `role="alert"` on error message |
| Focus ring | `outline: 2px solid var(--color-primary); outline-offset: 2px` on wrapper `:focus-visible` |
| Noscript fallback | `<noscript><img src={model.thumbnail} alt={alt ?? model.name} /></noscript>` |

Canvas `role` note: `role="application"` is correct here (not `role="img"`) because the user can interact with it via keyboard. `role="application"` tells screen readers to pass all keystrokes to the element rather than intercepting them for virtual navigation.

---

## 8. Reduced Motion Checklist

- Auto-rotation: disabled entirely when `prefers-reduced-motion: reduce`
- Skeleton fade-in: instant (no opacity transition)
- "Activated" badge: instant appearance (no fade)
- Camera reset tween: instant snap (no 300ms easing)
- Dismiss pill appearance: instant
- All canvas transitions: disabled

---

## 9. What NOT to Build

- Do NOT implement OffscreenCanvas (Evil Martians approach). The complexity of event relay outweighs the Lighthouse gain. Content-addressed caching (DATY) already gives repeat visitors near-zero load cost.
- Do NOT use model-viewer. Multi-instance bug #2502 and `visibility: hidden` rendering bug make it unsuitable.
- Do NOT attempt live Canvas transfer to ViewerDialog. Re-mount with cache hit is the correct tradeoff.
- Do NOT auto-load on mobile (except `controls="none"`). Firefox mobile 2-context limit is a hard constraint.
