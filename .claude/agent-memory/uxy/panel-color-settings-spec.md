---
name: Panel Color Settings — Full UX Specification (Wave 2 Refined)
description: Settings dialog design for per-panel color customization in the VS Code-style dock workspace. Covers entry points, color picker UX, live preview, presets, accessibility, and keyboard patterns. Wave 2 incorporates per-instance overrides, ARCHY's three-tab structure, Linear's 3-input model, cross-device preset sync, and novel-territory risk mitigations.
type: project
---

# Panel Color Settings — Full UX Specification (Wave 2)

## Context

The desk workspace is a binary split-tree dock with tabbed leaves, activity bar, and tab bars. Users want to tint panels distinctly — "my production terminal is red, dev terminal is blue." This is novel territory: SCOUT confirms no production app does per-panel theming at this granularity. The UX must be approachable for first-timers while powerful enough for power users.

**Resolution chain (ARCHY):** instance override > type default > workspace default > design token. The dialog exposes all three writable layers.

**How to apply:** This is the design contract. All implementation decisions flow from this document.

---

## Decision Table (Updated)

| Question | Decision |
|---|---|
| Container: modal vs. panel | Floating dialog (not full-panel, not slide-over) |
| Primary entry | Tab context menu "Appearance..." |
| Secondary entry | Activity bar settings button (bottom) |
| Tertiary entry | View menu > Workspace Settings... Ctrl+Shift+, |
| Dialog structure | Three tabs: Panels / Chrome / Presets (ARCHY) |
| Color selection UX | Single swatch + intensity per row (Linear model). 12-swatch grid opens on click. |
| Per-type vs per-instance | Type-level default with per-instance override (ARCHY). Instance rows beneath type rows, indented. |
| Live preview | Draft state, CSS var injection. Committed on Done. |
| Presets | Stored in PostgreSQL (cross-device, cloud icon). Active theme in localStorage for offline-first perf. |
| Novel territory mitigation | "Types" framing, onboarding tooltip on first open, instance override gated behind disclosure. |
| Reset/undo | Per-row Clear + session undo + Reset All with confirmation |
| Contrast warnings | Real-time WCAG 3:1 informational warning, auto-suggestion |
| Mobile | Bottom sheet; Quick Presets top, detailed panel rows collapsed |
| Keyboard shortcut | Ctrl+Shift+, |

---

## 1. Container: Floating Dialog

Same as Wave 1. Floating dialog, not a sidebar panel.

- Width: min(600px, 90vw)
- Max-height: 80vh, scrollable per tab content area
- Centered, backdrop at 30% opacity (deliberately low — panels must be visible through it for live feedback)
- Bits UI `Dialog.Root` wrapping `Dialog.Content`

---

## 2. Entry Points

### Primary: Tab Context Menu

Right-click any tab → "Appearance..." opens the dialog on the **Panels tab**, with that specific panel's instance row visible and expanded.

```
Close
Close Others
Close All
─────────────────────
Appearance...          ← opens Panels tab, panel row highlighted
─────────────────────
Split Right
Split Down
```

### Secondary: Activity Bar Settings Button

SVEY identified the activity bar has a settings button at the bottom. This opens the dialog on the Panels tab with no pre-selection (first type row visible, all collapsed).

### Tertiary: View Menu

View menu > "Workspace Settings... Ctrl+Shift+," opens the Panels tab, no pre-selection.

---

## 3. Dialog Structure: Three-Tab Layout

ARCHY resolved the dialog architecture: three tabs — Panels, Chrome, Presets. These are orthogonal concerns and tab separation prevents one long scrollable form that conflates them.

```
┌──────────────────────────────────────────────────────┐
│  Workspace Appearance                            [×]  │
│  ┌──────────┬──────────┬──────────┐                  │
│  │  Panels  │  Chrome  │ Presets  │                  │
│  └──────────┴──────────┴──────────┘                  │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│  [Tab content — scrollable]                           │
│                                                       │
├──────────────────────────────────────────────────────┤
│  [↩ Undo]                 [Reset All]  [Done]         │
└──────────────────────────────────────────────────────┘
```

**Panels tab:** Per-type and per-instance panel background tints.
**Chrome tab:** Tab bar, sidebar/activity bar, and dock background.
**Presets tab:** Named preset cards, apply/save/delete.

The footer is shared across all tabs. "Undo" reverts one change from the session stack. "Reset All" is destructive, requires popover confirmation. "Done" commits the draft state to persistent storage.

**Draft/committed pattern (SVEY):** All changes write to a `draftColorSettings` object in a `.svelte.ts` store. CSS var injection (`style:--var={value}`) applies draft values live to each `DockLeaf`. On "Done," the draft is committed (written to localStorage for active theme + synced to PostgreSQL via debounced API call). On dialog close without Done (×, Escape), if the draft differs from committed state, a brief inline warning bar appears:

```
  Changes not saved  [Keep editing]  [Discard]
```

This prevents accidental loss without making the dialog feel hostile to explore.

---

## 4. Panels Tab: Per-Type with Per-Instance Disclosure

### The Core Mental Model Problem

This is novel territory. No mental model exists for "per-panel theming" in the wild. Two risks:

1. **Type vs. instance confusion:** Users don't understand why changing "Terminal" affects all their terminal tabs.
2. **Feature discovery inversion:** Power users who need per-instance overrides won't find them; casual users who don't need them see too many rows.

### Resolution: Type as Primary, Instance as Expandable Detail

The Panels tab shows **one row per panel type** that has at least one open instance. Instance overrides are hidden behind a "Customize individual panels" disclosure per type row. First-timers interact only with type rows. Power users expand the disclosure.

```
  Panels tab layout:

  Type rows (all open panel types in current workspace):
  ┌───────────────────────────────────────────────────┐
  │  [⬡ Terminal]  [●]  Red · 12%           [Clear]  │
  │  └── 2 instances · customize individually  ▸      │
  ├───────────────────────────────────────────────────┤
  │  [⬡ Explorer]  [○]  No tint             [Clear]  │
  │  └── 1 instance                                   │
  ├───────────────────────────────────────────────────┤
  │  [⬡ Editor]    [●]  Blue · 8%           [Clear]  │
  │  └── 3 instances · customize individually  ▸      │
  └───────────────────────────────────────────────────┘
```

**"customize individually ▸" link** expands the instance sub-rows beneath the type row:

```
  ┌───────────────────────────────────────────────────┐
  │  [⬡ Terminal]  [●]  Red · 12%           [Clear]  │
  │  └── 2 instances · customize individually  ▾      │
  │      ├── Terminal #1 (Leaf A)  [●] Red·12%  [Clear] │
  │      └── Terminal #2 (Leaf B)  [○] Inherits type  [Override] │
  └───────────────────────────────────────────────────┘
```

Instance rows show:
- The instance name/leaf ID (or "Leaf A/B/C" as a fallback if no user label)
- Current effective tint: "Inherits type" (muted text) if no override, or the override swatch + intensity
- [Clear] if instance has an override; [Override] if currently inheriting (invites setting an instance color)

Clicking anywhere on a type row (except the disclosure link) opens an inline color picker. Clicking [Override] on an instance row opens the picker scoped to that instance.

### Color Picker: Linear-Inspired Simplicity

SCOUT found Linear uses 3 inputs to generate 98 CSS variables. The lesson: abstract the complexity. Users see one swatch circle + one intensity value. That is the complete input surface.

**Collapsed state:** A single colored circle (24px) shows the current tint. "No tint" shows a hollow circle with a dashed border.

**Expanded state (click the circle):** A popover opens anchored to the circle:

```
┌────────────────────────────────────┐
│  ○ ○ ○ ○ ○ ○                      │
│  ○ ○ ○ ○ ○ ○    (12 swatches)     │
│                                    │
│  Intensity  [━━━●──────] 12%       │
│                                    │
│  ⚠ Low contrast at this level      │
│  [Use 7% instead?]                 │
└────────────────────────────────────┘
```

12 swatches in a 6×2 grid. Single click selects hue. Slider adjusts intensity 5–30%. Live preview updates instantly via CSS var injection. Arrow keys navigate swatches.

This keeps the Panels tab scannable — rows are compact, one circle per row, full picker is on-demand.

---

## 5. Chrome Tab

Shorter. Three named settings:

- **Tab indicator** — the active tab underline/highlight color. One swatch + intensity.
- **Sidebar background** — the activity bar background. One swatch + intensity.
- **Dock background** — the overall workspace background behind all panels. One swatch + intensity.

Same compact row anatomy: label + swatch circle + current value + [Clear]. Same popover picker on click.

Chrome settings are type-level only (no instance concept applies). No instance disclosure needed.

---

## 6. Presets Tab

### Cross-Device Sync (DATY)

Presets are stored in PostgreSQL. The tab shows a sync indicator next to each user preset:

- Cloud icon with checkmark: synced
- Spinning cloud: syncing
- Cloud with warning: sync failed (hover shows error)

Built-in presets have no cloud icon (they are static, not synced).

Active theme is cached in localStorage (`desk-active-preset`) so the workspace loads with the correct theme instantly on page load, before any API call resolves.

### Preset Cards

Horizontal scrollable strip. Each card: 120×72px, name label at bottom, 5-swatch strip preview, cloud sync indicator top-right (user presets only).

**Built-in presets (3):**
- Minimal — all clear, token defaults
- Focus Mode — terminal amber, explorer blue, editor clear
- Colorful — each type gets a distinct 12% tint

**User presets:** Appear in same strip after built-ins, with delete [×] on hover.

**Applying:** Single click applies immediately (draft state). "Done" commits.

**Saving:** "+ Save current" below the strip opens an inline form:
```
  Preset name: [________________]    [Save]  [Cancel]
```
Saved presets sync to PostgreSQL. User sees the spinning cloud icon until confirmed.

---

## 7. Onboarding Tooltip (Novel Territory Mitigation)

On the user's **first time opening the dialog** (localStorage flag `desk-appearance-first-open`), a brief explanatory tooltip appears anchored to the Panels tab:

```
  Colors here apply to all panels of that type — open a new Terminal
  and it inherits the same tint. To customize one panel specifically,
  use the "customize individually" link beneath the type row.
```

This surfaces the type-vs-instance mental model immediately, before the user makes their first change and wonders why "all terminals changed." The tooltip is dismissible (×) and self-dismisses after 12 seconds. It never appears again after dismissed.

---

## 8. Footer Undo and Reset

**Undo (session stack):** "↩ Undo" appears in the footer only when there are changes to undo. Reverts one change at a time. Stack clears on Done or Discard.

**Reset All:** Destructive secondary button. Inline confirmation popover anchored to button. Focus starts on [Cancel]. [Reset] clears all settings to system defaults (not the last preset — raw token defaults).

---

## 9. Data Model (Refined)

```typescript
// dock.types.ts additions

export interface PanelColorConfig {
  swatchHex: string;     // oklch() string
  intensity: number;     // 5–30
}

export interface WorkspaceColorSettings {
  // Type-level: Record<PanelType, config | null>
  typeColors: Record<string, PanelColorConfig | null>;

  // Instance-level overrides: Record<leafId, config | null>
  // null = inherit from type. Omitted key = also inherit.
  instanceOverrides: Record<string, PanelColorConfig | null>;

  // Chrome settings
  tabIndicator: PanelColorConfig | null;
  sidebarBg: PanelColorConfig | null;
  dockBg: PanelColorConfig | null;

  activePresetName: string | null;   // name of applied preset, or null if custom
}
```

**Resolution in DockLeaf (ARCHY chain):**

```svelte
const panelTint = $derived(() => {
  const leafOverride = colorSettings.instanceOverrides[leaf.id];
  if (leafOverride !== undefined) {
    // instance override exists (even if null = "force clear for this instance")
    return leafOverride ? computeTint(leafOverride) : null;
  }
  const type = dock.panels[leaf.activeTab]?.type;
  const typeConfig = colorSettings.typeColors[type];
  return typeConfig ? computeTint(typeConfig) : null;
});
```

CSS var injection per leaf:

```svelte
<div
  class="dock-leaf-content"
  style:--leaf-tint-bg={panelTint}
>
```

Scoped CSS in DockLeaf applies `background: var(--leaf-tint-bg, var(--color-bg))`.

**Storage:**
- `WorkspaceColorSettings` active state → localStorage `desk-color-settings` (fast, offline)
- Presets → PostgreSQL `desk_presets` table (cross-device, per-user)
- Active preset name → localStorage `desk-active-preset`

---

## 10. Accessibility

All Wave 1 accessibility patterns carry forward unchanged:

- Each swatch: `aria-label="[Color name] tint"`, `aria-pressed` for selected state
- Swatch grid: arrow-key navigation with wrap
- Contrast warning: `role="alert"` for screen reader announcement
- Dialog: Bits UI focus trap, `Dialog.Title` as accessible name
- Preset cards: `<button>` with `aria-label`, `aria-pressed`
- Reset confirmation: `role="dialog"`, focus on [Cancel]

**Additions for Wave 2:**
- Tab panel: `role="tablist"` / `role="tab"` / `role="tabpanel"` with correct ARIA
- Instance disclosure: `aria-expanded` on the toggle link, `aria-controls` pointing to instance rows
- Cloud sync indicator: `aria-label="Syncing"` / "Synced" / "Sync failed" on the icon — not color-only
- Onboarding tooltip: `role="tooltip"`, dismissible with Escape, announced via `aria-live="polite"`

---

## 11. Responsive Behavior

Desktop (>768px): Full tabbed dialog as specified.

Tablet (480–768px): Dialog at 92vw. Swatches scale to 24px. Preset cards scroll horizontally.

Mobile (<480px): Bottom sheet. Tab bar becomes a horizontal segmented control at top of sheet. Panels tab: all type rows collapsed. A "Quick Presets" section (full-width tappable rows for built-in presets) appears above the detailed rows. Instance overrides hidden entirely on mobile — too granular for small screens.

---

## 12. Phase 2 Scope (Deferred)

- Free-form color picker (vanilla-colorful or similar) — beyond the 12 curated swatches
- Custom swatch palettes
- Per-instance color on mobile
- Gradient tints
- OKLCH advanced mode toggle (for designers who want perceptual uniformity controls)
- Tab bar border color per panel type

---

## Summary: Key Changes from Wave 1

| Topic | Wave 1 | Wave 2 |
|---|---|---|
| Dialog structure | Four collapsible sections | Three tabs: Panels / Chrome / Presets |
| Per-instance | Phase 2 | Exposed via "customize individually" disclosure in Panels tab |
| Color picker UX | Swatch grid inline in row | Compact circle → popover picker (Linear model) |
| Presets storage | localStorage only | PostgreSQL with cloud sync indicator; localStorage for active-theme perf |
| Novel-territory risk | Not addressed | Onboarding tooltip on first open explaining type-vs-instance |
| Live preview | Instant apply, undo on close | Draft state, warning bar if closing unsaved |
| Activity bar entry | Not mentioned | Settings button at bottom of activity bar (SVEY) |

## How to apply:

Implement in this order: (1) data model + localStorage persistence, (2) DockLeaf draft/committed color application via CSS var injection, (3) dialog shell with three-tab structure, (4) Panels tab type rows + swatch popover, (5) instance disclosure within Panels tab, (6) Chrome tab, (7) Presets tab with PostgreSQL sync, (8) tab context menu "Appearance..." entry, (9) onboarding tooltip, (10) activity bar settings button. Do not implement Phase 2 features during Phase 1 implementation.
