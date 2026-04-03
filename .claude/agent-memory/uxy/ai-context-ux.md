---
name: AI Chat Panel + Spreadsheet Context UX
description: FINAL UX specification (Round 2) for AI-aware context in the desk workspace — two-tier context model (implicit/pinned/available), token budget indicator, revised chip states, spreadsheet+chat interaction, and accessibility spec.
type: project
---

# AI Chat Panel + Spreadsheet Context UX — FINAL SPECIFICATION

Produced 2026-04-03. Round 2 revision incorporating SCOUT research (context rot), ARCHY (token budget), SVEY (pin/unpin lifecycle), and RESY (DOM rendering at 50×26).

**How to apply:** Use as the binding design contract when implementing the Chat panel, Spreadsheet panel, and the `ai:context-*` DeskBus events. Supersedes Round 1 specification.

---

## Core Design Principle

The AI's context must never be ambiguous. The user should be able to glance at the chat panel and know, in under one second, exactly what the AI currently sees. Any doubt about what's being sent destroys trust faster than any missing feature.

**Revised mental model (Round 2):** The "context tray" has two lanes:
- **Implicit lane** (left): the one focused panel, auto-managed, no user action needed
- **Explicit lane** (right): user-pinned items that survive focus changes

Research is unambiguous — auto-including all open panels degrades AI quality. But the user's right to see what's being sent is equally non-negotiable. The resolution: everything is visible, but only the focused panel is active by default. Other panels appear as grayed, activatable chips.

---

## 1. Revised Context Model — Two-Tier

### Tier 1: Implicit (Automatic)

Exactly **one** context item is always implicit: the **focused panel**.

| Panel type | What gets sent |
|---|---|
| `spreadsheet` | Current cell selection — range values, column headers, formula if active |
| `editor` | Current document — title, visible content block, cursor section |
| `files` | Currently selected file row — name, type, path |
| `chat` (self) | Nothing — chat does not contribute its own history as context |

When the user switches panel focus, the implicit context updates immediately. No debounce on focus switch. The debounce (800ms) applies only to **selection changes within** the focused panel (to prevent chip flicker while arrow-keying through cells).

### Tier 2: Explicit (User-pinned)

Any context item a user deliberately pins persists across focus changes. Pinned items show a pin icon instead of a dismiss ×. They must be manually unpinned.

Pin action is intentional friction — it requires the user to decide "I want this to stay." This is the right level of effort for something that affects AI quality on every message.

**Phase 1 scope:** Pin/unpin via chip interaction only (click the chip to toggle pin state). No @-mention syntax at launch.

### Available (Not Active)

Other open panels that are NOT focused and NOT pinned appear in the tray as **grayed chips** — visible but explicitly dormant. This preserves the transparency principle without adding their data to the context.

Available chips communicate: "This panel is open. Its data is available. Click to include."

---

## 2. Context Tray — Revised Design

### Layout (active state, one implicit + one pinned + two available)

```
┌──────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐  ┌───────┐  ┌─────┐ │  ← context tray
│  │ [⊞] A1:C8  × │  │ 📌 Intro ×   │  │ [≡] … │  │[📁]…│ │
│  │  (active)    │  │  (pinned)    │  │(avail) │  │(av.)│ │
│  └──────────────┘  └──────────────┘  └───────┘  └─────┘ │
│  ████████░░░░░░░░░░░░  2.1K / 8K tokens         [clear] │  ← token bar
├──────────────────────────────────────────────────────────┤
│  Ask about your selection...                  [Send ↵]   │
└──────────────────────────────────────────────────────────┘
```

### Layout (empty state)

Tray area collapses entirely to zero height. No empty box, no label.

```
┌──────────────────────────────────────────────────────────┐
│  Ask anything...                              [Send ↵]   │
└──────────────────────────────────────────────────────────┘
```

### Chip States — Three Visual Variants

**Active chip** (implicit — focused panel, or explicit — pinned):
- Background: `color-mix(in srgb, var(--color-primary) 10%, transparent)`
- Border: `1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)`
- Text: `var(--color-fg)` at full opacity
- Right action: × dismiss (implicit) or 📌 unpin (pinned)

**Available chip** (open but not contributing):
- Background: `color-mix(in srgb, var(--color-muted) 8%, transparent)`
- Border: `1px solid color-mix(in srgb, var(--color-border) 60%, transparent)`
- Text: `var(--color-muted)` at 70% opacity
- Right action: none — clicking the chip activates/pins it
- Tooltip on hover: "Click to include in next message"

**Stale badge** on active/pinned chips only:
- Small dot `●` in `var(--color-warning)` positioned top-right of chip
- Meaning: "Context has changed since the AI's last response"
- Cleared when: user sends a new message OR dismisses/unpins the chip
- Does NOT appear on available chips (they're not in context, so they can't be stale)

### Chip Anatomy

- Source icon: 12px, `var(--color-muted)` on active, dimmer on available
- Label: panel-specific shorthand. Max 160px, truncate with ellipsis.
- Action icon: 16px tap target minimum, 20px actual hit area
- Chip height: 26px. Padding: 4px 8px.

### Chip Click Behaviors

| Chip state | Click target | Result |
|---|---|---|
| Active (implicit) | Chip body | No action (already active) |
| Active (implicit) | × | Dismiss — panel stops contributing until re-focused |
| Pinned | Chip body | No action |
| Pinned | 📌 | Unpin — reverts to available if not focused |
| Available | Chip body | Pin it (add to explicit context) |
| Available | (no action icon) | — |

### Chip Ordering

Left to right: active implicit chip → pinned chips (oldest first) → available chips (alphabetical by panel type).

Active implicit chip is always leftmost. It is the anchor — the user always knows where to look for "what the AI is seeing right now."

---

## 3. Token Budget Indicator

### Design

A thin fill bar below the chip row. Always visible when context tray is populated.

```
████████░░░░░░░░░░  2.1K / 8K tokens  [clear]
```

- Bar width: full tray width
- Fill color: `var(--color-primary)` at 40% opacity, progressing to `var(--color-warning)` at 70% fill, `var(--color-error)` at 90%+ fill
- Label: `{used}K / {budget}K tokens` in 11px `var(--color-muted)`
- Color transitions are discrete (three zones), not gradient — gradients are harder to interpret at a glance

### Budget Thresholds

| Fill | Color | Label behavior |
|---|---|---|
| 0–69% | Primary | Normal |
| 70–89% | Warning | Label turns `var(--color-warning)` |
| 90–100% | Error | Label turns `var(--color-error)`, bar pulses once |

The bar never blocks sending. It informs; it does not gate. The user decides.

### Token Estimation

- Each `ContextEntry` carries `tokenEstimate` (from ARCHY's budget model)
- Total is derived: `$derived(contextItems.reduce((sum, item) => sum + item.tokenEstimate, 0))`
- Budget ceiling: 8K tokens reserved for context (configurable constant, not exposed in UI at MVP)
- Estimation is approximate — label reads "~2.1K" with tilde to communicate this

### Interaction with Available Chips

Available chips are not in the budget. When a user clicks to pin an available chip, the bar updates immediately (optimistic — estimate is fast). If pinning would push budget over 90%, show a one-time inline warning below the bar: "Adding this may degrade response quality. Consider removing another item." Non-blocking. Auto-dismisses after 5s.

---

## 4. Staleness: Revised Scope

With the two-tier model, staleness is scoped correctly:

**Implicit chip** can go stale if:
- User changes selection within the focused panel after the last AI response
- User switches to a different panel (different content is now implicit)

**Pinned chips** can go stale if:
- The underlying panel content changes (editor document is modified, file is renamed)

**Available chips** cannot go stale — they're not in context.

The stale dot is low-key by design. It's a signal, not an alarm. Most users will learn to re-ask when context changes rather than watching for the dot.

---

## 5. Updated Spreadsheet + Chat Interaction Flow

### Happy Path

1. User has spreadsheet panel focused (implicit chip appears: "⊞ Sheet1")
2. User selects cells A1:C8 → 800ms debounce → chip updates to "⊞ A1:C8"
3. Spreadsheet cells A1:C8 show secondary tint ("in AI context")
4. User types message → sends
5. Context is prepended server-side, invisible to user
6. AI responds referencing the data
7. Chip acquires stale dot when user clicks a different cell afterward

### Switching Focus (New in Round 2)

1. User clicks editor panel → focus shifts
2. Old spreadsheet chip becomes an **available chip** (grayed)
3. Editor chip becomes the new **implicit chip** (active, full color)
4. Stale dot on the spreadsheet chip disappears (it's no longer in context, so staleness is irrelevant)
5. Token bar updates to reflect new context budget

### Pinning for Multi-Panel Work

1. User selects cells in spreadsheet (implicit chip appears)
2. User clicks the spreadsheet chip body → nothing (already active — chip body is passive for implicit)

Wait — that's confusing. Resolution: **implicit chips have an explicit "pin" icon button** (not a dismiss ×) so users can promote to pinned before switching focus.

```
Implicit chip:  [⊞] A1:C8  [📌] [×]
                              ↑    ↑
                           pin  dismiss
```

- Clicking 📌 promotes to pinned (chip remains active, focus switch won't remove it)
- Clicking × dismisses (chip gone, that panel stops contributing)
- Clicking chip body: no action

Pinned chip:    [⊞] A1:C8  [📌✓] [×]
                               ↑    ↑
                            unpin  dismiss

### Explicit Include Without Pin

Right-click on a cell range → "Ask AI about this" in context menu. This immediately fires the context event, bypassing the 800ms debounce, and briefly highlights the chip (100ms scale-up animation). For power users who want intentional one-shot context without permanent pinning.

Keyboard: `Ctrl+Shift+I` when spreadsheet is focused.

---

## 6. DeskBus Extensions (Revised)

```ts
// Spreadsheet publishes when selection stabilizes (800ms debounce)
'spreadsheet:context-changed': {
  type: 'cell' | 'range' | 'cleared';
  panelId: string;
  selection: {
    startCell: { row: number; col: number; label: string };
    endCell: { row: number; col: number; label: string } | null;
    values: (string | number | null)[][];
    columnHeaders: (string | null)[];
    formula: string | null;
    tokenEstimate: number;
  } | null;
};

// Chat publishes when context state changes (for panels to render tints)
'chat:context-snapshot': {
  activeItems: Array<{
    sourceType: 'spreadsheet' | 'editor' | 'files';
    panelId: string;
    sourceRef: string;           // 'A1:C8', document ID, file path
    isPinned: boolean;
  }>;
  totalTokenEstimate: number;
};

// Any panel publishes when its content changes (for staleness tracking)
'panel:content-changed': {
  panelId: string;
  panelType: 'spreadsheet' | 'editor' | 'files';
};
```

Chat subscribes to `spreadsheet:context-changed` with `replayLast: true`.
Spreadsheet subscribes to `chat:context-snapshot` to know which cells to tint.
Chat subscribes to `panel:content-changed` to mark pinned items stale.

---

## 7. Context Assembly (Server-Side)

Client sends structured `contextItems` array alongside `messages`. Server formats:

```
[Context: Spreadsheet selection A1:C8]
| Month    | Revenue | Units |
| January  | 42000   | 120   |
| February | 38000   | 98    |
[End context]

[Context: Document "Q1 Report" — Introduction section]
{truncated content block, max 800 tokens}
[End context]

{user message}
```

Implicit item is first in the assembled block. Pinned items follow. Available items are never included.

The raw context block is invisible in chat history — only the user's text appears as a bubble.

Panels own serialization (ARCHY's pattern): each panel's DeskBus payload includes pre-serialized string with its `tokenEstimate`. Server combines, does not re-serialize.

---

## 8. What Is Deferred to Phase 2

| Feature | Why deferred |
|---|---|
| @-mention syntax (`@spreadsheet`, `@file:data.csv`) | Adds input complexity before the basic flow is validated |
| Context presets ("always include header row") | Power-user feature, needs usage data first |
| Excluded panel ID set (`Set<string>` from ARCHY) | The "opt-out" model; round 1 was opt-in. Validate which mental model users prefer first |
| Structured AI citations pointing back to source ranges | Requires response parsing; clean conversation is MVP priority |
| Spreadsheet virtualization for tinting (1000+ rows) | Not needed until load testing shows the need |
| Context visibility toggle per panel | Complexity without validated need |
| Conversation scoping (does dismissed context affect earlier refs?) | No — context is send-time-only. Captured in DeskBus snapshot per message. Implement when conversation history is persistent |

---

## 9. Keyboard Shortcuts

| Shortcut | Scope | Action |
|---|---|---|
| `Ctrl+Shift+I` | Spreadsheet focused | Force-include current selection immediately (bypasses debounce) |
| `Escape` | Context tray region focused | Clear all non-pinned context |
| `Delete` / `Backspace` | Individual chip focused | Remove that chip |
| `P` (while chip focused) | Context tray region | Toggle pin state of focused chip |

Tab order: conversation history → context chips (left to right) → input textarea → send button.

---

## 10. Accessibility Specification

**Context tray region:**
- `role="region"`, `aria-label="AI context"`
- When tray has items, `aria-live="polite"` sibling region announces changes

**Chip accessibility:**
- Active chip: `role="group"`, `aria-label="[Panel]: [label], active"`
- Available chip: `role="button"`, `aria-label="[Panel]: [label], click to include in context"`, `aria-pressed="false"`
- Pinned chip: `role="group"`, `aria-label="[Panel]: [label], pinned"`
- Dismiss ×: `aria-label="Remove [label] from context"`
- Pin 📌: `aria-label="Pin [label] to context"` / `"Unpin [label] from context"`

**Stale indicator:**
- `aria-label` on the dot: `"Context changed since last response"`
- Never rely on color alone — the `●` character is the indicator, color is reinforcement

**Live announcements:**
- Chip added: `"[Panel] selection included in context"`
- Chip dismissed: `"[Panel] selection removed from context"`
- Chip pinned: `"[Panel] selection pinned — will persist across panel switches"`
- Chip unpinned: `"[Panel] selection unpinned"`
- Token warning: `"Context is nearly full. Consider removing items."`

**Token bar:**
- `role="progressbar"`, `aria-valuenow={Math.round(usedPct)}`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label="Context token usage"`

**Spreadsheet cell tint:**
- Never color-only — cell tooltip reads "Included in AI context"
- When selection is in context, formula bar shows a `[AI]` badge to the left of `fx`

**Focus management:**
- When a chip is dismissed, focus moves to the next chip (or previous if it was the last)
- When tray empties, focus returns to the textarea

---

## 11. One-Time Onboarding Tooltip

Single tooltip fires on the FIRST time a chip appears (localStorage flag `desk:context-tooltip-seen`):

```
┌──────────────────────────────────────────────────────┐
│  Your selection is included in the next message.     │
│  Dismiss chips you don't want to share.    [Got it]  │
└──────────────────────────────────────────────────────┘
```

- Positioned above the chip row, pointing down
- Auto-dismisses after 8s or on "Got it" click
- Never appears again
- Screen reader: `role="status"` with same text

That is the entire onboarding. No modals, no guided tours, no feature explanations.
