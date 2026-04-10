---
name: Bot Manager Dialog UX
description: Full UX spec for the Bot Manager dialog — icon tab navigation, tool scope rows grouped by risk, desk:delete confirmation strip, trigger button, sizing, density strategy, and accessibility checklist
type: project
---

# Bot Manager Dialog — UX Specification

Produced 2026-04-10. Unified AI configuration surface expanding the Context Manager dialog.

**How to apply:** Use as the binding design contract when implementing the Bot Manager dialog, the Tools section toggle rows, and the desk:delete confirmation strip.

---

## Navigation: Icon Tabs

At 300–400px panel width, segmented controls fail at 3+ labels. Vertical sidebars burn too much width. Use a row of **icon tabs** along the top of the dialog content area.

- Each tab: 24px icon + hidden label (shown as tooltip on hover), 40px minimum touch target
- Active state: primary-colored underline + icon color tint
- Inactive state: muted icon only — no label reduces width pressure
- Scales to 6 sections without layout breakage

```
┌─────────────────────────────────────┐
│  Bot Manager                     ×  │
├─────────────────────────────────────┤
│  [Context] [Tools] [Model] [Prompt] │
│            ^^^
│         active underline
├─────────────────────────────────────┤
│  (section content scrolls)          │
└─────────────────────────────────────┘
```

Tab accessibility: `role="tablist"`, each tab `role="tab"`, `aria-selected`, `aria-controls` → panel id.

**Active scope count badge** on tabs that have toggleable state: small numeric badge showing enabled count (e.g., "3"). Visible from other tabs, no tab switch needed.

---

## Tools Section Layout

Four scopes grouped by risk tier. Grouping communicates the risk gradient without user effort.

```
Tools
Control what the AI can do

─── Read access ────────────────────
[●] desk:read
    Browse files, read content

─── Write access ───────────────────
[●] desk:write
    Update cells, rename files
[●] desk:create
    Create spreadsheets, documents

─── Destructive ────────────────────
[○] desk:delete          ⚠
    Delete files permanently
```

Row anatomy: Switch (left) + scope name (`var(--color-fg)` weight-medium) + description (12px `var(--color-muted)`, 1.4 line-height).

Section header dividers: 10px `var(--color-muted)` uppercase label, `1px solid var(--color-border)` line extending right.

---

## Risk Communication: desk:delete

Three layers, no modals.

### Layer 1: Inline warning icon
`i-lucide-triangle-alert` in `var(--color-warning)` to the right of the toggle label. Always visible (not hover-only). Present even when disabled — user needs to understand risk before enabling.

`aria-label="Destructive — deletes files permanently"`, `role="img"`.

### Layer 2: Description wording
"Delete files permanently" — not "remove." Word choice communicates irreversibility.

### Layer 3: Enable confirmation strip
On flip to ON, toggle switches immediately + inline strip appears below the row:

```
[●] desk:delete          ⚠
    Delete files permanently
┌──────────────────────────────────┐
│ AI can now delete files.         │
│ [Keep enabled]  [Turn off]       │
└──────────────────────────────────┘
```

- Strip role: `role="alert"` — screen readers announce immediately
- "Turn off" is the safe default — rightmost, primary-styled
- "Keep enabled" is secondary-styled — intentionally subdued
- Auto-dismiss after 12s → defaults to turning OFF (non-action = safe state)
- No confirmation on disable — disabling is always safe, instant

---

## Trigger Button

Reuse the existing `i-lucide-sliders-horizontal` icon button from the Context Manager. Changing the icon creates a separate mental model. One icon, one surface.

Label change: "Context" → "Bot" (or icon-only with `aria-label="Bot settings"`). Dialog title "Bot Manager" orients users to the expanded scope.

---

## Dialog Sizing

- Width: 480px (unchanged from Context Manager spec)
- At 300–400px panel width, dialog will overlap adjacent panels — acceptable for a settings dialog
- `min-height: 400px`, `max-height: 70vh`
- Inner content scrolls per section tab
- Tools section at MVP: ~220px (4 rows + 3 group headers)

---

## Information Density Strategy

**State at a glance:** Switch position = enabled/disabled. No reading required. Full tools audit in ~2 seconds.

**Group headers carry hierarchy.** "Read access / Write access / Destructive" communicates risk at the group level. Users make good decisions without reading individual descriptions.

**Description text is secondary.** 12px muted, present for first-time understanding, never needs re-reading.

---

## Switch Row Accessibility

- `role="switch"`, `aria-checked`, `aria-describedby` → description text element id
- Warning icon: `role="img"`, `aria-label` (never `aria-hidden`)
- Confirmation strip: `role="alert"` for immediate screen reader announcement
- Focus stays within dialog (Bits UI Dialog handles trap)
- `Escape` closes dialog, returns focus to trigger button
