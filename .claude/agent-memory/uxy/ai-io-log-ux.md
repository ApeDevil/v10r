---
name: AI I/O Log + Action Feedback UX
description: Full UX specification for AI write access to the desk — I/O Log panel, AI action feedback patterns, sub-entity context control, permission tiers, conversation-action linkage, tool execution pause state, malformed tool call recovery, token budget visibility, undo expiry, and user annotation patterns.
type: project
---

# AI I/O Log + Action Feedback UX — FULL SPECIFICATION

Produced 2026-04-06. Builds directly on ai-context-ux.md (Phase 1 context tray). This document covers the "AI writes to the desk" system.

**Phase 2 refinements appended at end of document.** See Section 14 for all cross-pollination updates.


**How to apply:** Use as the binding design contract for the I/O Log panel, AI action overlays, permission model UI, and undo/history integration.

---

## Guiding Principle

The user must feel like a supervisor, not a spectator. AI agency is powerful exactly to the degree the user trusts it — and trust collapses the first time something happens that they didn't expect and can't reverse. Every design decision here is subordinate to: the user is always able to understand what happened, stop what's happening, and undo what happened.

---

## 1. I/O Log: Location and Shell

### Where It Lives

The I/O Log is a **standard panel type** in the dock, not a modal, drawer, or overlay. It uses the identifier `io-log`.

Rationale: A drawer or overlay would make it feel like a debugging tool — something you open to diagnose problems. A dock panel treats it as a first-class workspace view, visible alongside the panels the AI is actually touching. Users who want to monitor AI activity keep it open in a side leaf. Users who don't, close it.

### Opening It

- Activity bar item: `i-lucide-activity` icon, label "Activity"
- When any AI tool call executes: if the log panel isn't open, a **badge count** appears on the activity bar item (increments per tool call). The badge clears when the panel is opened.
- The log panel can be opened via the File menu: "View > Activity Log" (keyboard: `Ctrl+Shift+L`)

### Layout Recommendation

Typical arrangement: IO Log occupies a narrow right leaf (~240–280px), Chat panel occupies the bottom of the main area or a split leaf. Users can resize/rearrange as normal via the dock.

---

## 2. I/O Log: Entry Structure

Each log entry represents **one round-trip** between a user message and the AI's response (including all tool calls in that round). Entries collapse by default, expand on click.

### Collapsed Entry Anatomy

```
┌──────────────────────────────────────────────────────┐
│  ▶  14:32:08  "Summarize the Q1 data"                │
│     3 tool calls · 2 panels affected · 1.2K tokens   │
└──────────────────────────────────────────────────────┘
```

- Timestamp: `HH:MM:SS` in `var(--color-muted)` at 11px
- User message preview: truncated to 60 chars
- Summary line: quick stats in muted text

### Expanded Entry Anatomy

When the user clicks a collapsed entry, it expands inline (no navigation, no modal):

```
┌──────────────────────────────────────────────────────┐
│  ▼  14:32:08  "Summarize the Q1 data"                │
│  ┌─────────────────────────────────────────────────┐ │
│  │  CONTEXT RECEIVED                               │ │
│  │  ├─ Spreadsheet · Sheet1 · A1:C8               │ │
│  │  │    12 cells · 340 tokens                    │ │
│  │  └─ Editor · "Q1 Report" · Introduction        │ │
│  │       ~280 tokens                              │ │
│  ├─────────────────────────────────────────────────┤ │
│  │  ACTIONS TAKEN                                  │ │
│  │  ├─ [✓] read_spreadsheet  A1:C8                │ │
│  │  ├─ [✓] open_panel  type=preview               │ │
│  │  └─ [✓] write_editor  doc="Q1 Report"         │ │
│  │       ↳ 3 paragraphs inserted after line 12   │ │
│  ├─────────────────────────────────────────────────┤ │
│  │  [↩ Undo this turn]          [↩ Undo last action] │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Section Labels

Three fixed sections, always in this order:
1. **CONTEXT RECEIVED** — what was in the context tray when the message was sent
2. **ACTIONS TAKEN** — tool calls that executed during this turn
3. **Undo controls** — only if reversible actions occurred

Sections that are empty are hidden (e.g., if AI only read context and replied, ACTIONS TAKEN is absent).

---

## 3. I/O Log: Entity and Sub-Entity Hierarchy

### Context Section — Sub-Entity Display

Each context item is a tree node:

```
Spreadsheet · Sheet1                     [panel entity]
  └─ A1:C8 · 12 cells · 340 tokens      [sub-entity: selection]

Editor · "Q1 Report"                     [panel entity]
  └─ Introduction · ~280 tokens         [sub-entity: section]

Files · Explorer                         [panel entity]
  └─ /data/q1-revenue.csv               [sub-entity: file row]
```

Sub-entity indentation is 12px. No chevron — these are static display, not further expandable.

### Actions Section — Sub-Entity Display

Each tool call is a row. If the tool call targeted a sub-entity, it appears below as indented:

```
[✓] write_spreadsheet                    [tool call]
    └─ Sheet1 · D2:D9 · set values       [target sub-entity]
         [before] [after]                [diff controls]

[✓] open_panel                           [tool call]
    └─ type=preview · title="Q1 Preview" [created sub-entity]

[⚠] write_editor  BLOCKED               [blocked by permission]
    └─ "Strategy" document               [target sub-entity]
```

### Tool Call Status Icons

| Icon | Color | Meaning |
|------|-------|---------|
| `✓` | `var(--color-success)` | Completed |
| `↻` | `var(--color-primary)` (spinning) | In progress |
| `⚠` | `var(--color-warning)` | Completed with warning |
| `✕` | `var(--color-error)` | Failed or blocked |
| `⏸` | `var(--color-muted)` | Awaiting confirmation |

---

## 4. I/O Log: Real-Time Streaming

When the AI is currently executing tool calls, the current turn appears at the **top of the log** (most recent first) in an **in-progress state**.

### In-Progress Entry Anatomy

```
┌──────────────────────────────────────────────────────┐
│  ↻  14:35:12  "Build me a summary table"        LIVE │
│  ┌─────────────────────────────────────────────────┐ │
│  │  ACTIONS IN PROGRESS                           │ │
│  │  ├─ [✓] read_spreadsheet  A1:H50              │ │
│  │  ├─ [↻] write_spreadsheet  J1:J50  ←───────── │ │  ← pulsing line
│  │  └─ [⏸] open_panel  type=preview  (queued)    │ │
│  └─────────────────────────────────────────────────┘ │
│  [Stop AI]                                           │
└──────────────────────────────────────────────────────┘
```

- "LIVE" badge: `var(--color-primary)` with a gentle 1.5s opacity pulse
- Currently executing row: a thin left border animates (flows downward at 1.5s). No other animation.
- Queued rows: muted text, `(queued)` label
- Stop AI button: `var(--color-error)` ghost button. Halts the current tool call stream. Does NOT undo already-completed calls.

### On Completion

The in-progress entry settles into its final state. The "LIVE" badge fades out. The entry joins the scrollable history below any new in-progress entries.

---

## 5. I/O Log: Interactive Context Editing

Within an expanded entry, context items have editing controls:

### Redacting Context

Each sub-entity context row has a `[Redact]` button (shown on hover, not always visible — reduces clutter):

```
  └─ A1:C8 · 12 cells · 340 tokens    [Redact ×]
```

Clicking Redact marks the item with a strikethrough and `REDACTED` label. This does NOT affect the message that was already sent (it happened). It applies forward: the next message will not include this sub-entity.

This is actually a **context exclusion shortcut** — clicking redact creates a "blocked" entry in the context configuration for that panel+sub-entity. The tray chip for that panel will show a masked indicator.

### Re-Sending With Modified Context

At the bottom of any completed turn:

```
[Re-send with current context]   [Re-send with this context snapshot]
```

- "Re-send with current context" — resends the same user message, but the context tray's current state is used (whatever's active now)
- "Re-send with this context snapshot" — replays this exact turn using the context as it was when this message was sent

Both options are ghost buttons, small (11px text). Advanced feature, so they're deemphasized.

---

## 6. AI Action Feedback: Visual Indicators on Panels

When AI is actively writing to a panel, the **affected DockLeaf gets a visual state** without disrupting the user's work in other panels.

### The AI-Active Leaf State

The DockLeaf tab bar gains a thin animated border on its top edge:

```
╔════════════════════════════════════════════════════╗  ← 2px animated line
│  Sheet1  ×  │  Q1 Report  ×                       │  ← tab bar
├─────────────────────────────────────────────────────┤
│  [panel content]                                   │
```

The line is `var(--color-primary)` at 60% opacity, with a shimmer animation (light sweeps left-to-right, 1.5s loop). This is identical to a loading skeleton's shimmer but applied as a border, not a fill.

Why a line rather than a glow: glows create visual urgency that competes with the content. A top-line is unmissable but calm. It reads "something is happening" without "something is wrong."

The tab itself gets a small `↻` spinner replacing (not adding to) the panel's icon while AI is writing. No badge count — count lives in the I/O Log.

### On Completion

The spinner reverts to the panel icon. The animated border fades out over 600ms. A single subtle checkmark flash (`✓`) replaces the tab icon for 1200ms, then the icon returns. This confirms the write happened without demanding attention.

If the write failed: the tab icon shows a `!` badge in `var(--color-error)` for 5 seconds (or until the user clicks the tab, whichever comes first).

### Cell-Level Feedback (Spreadsheet)

Cells written by AI get a transient highlight:
- During write: `color-mix(in srgb, var(--color-primary) 12%, transparent)` background
- After write completes: fades out over 1s
- A thin `var(--color-primary)` corner tick (top-left, 4px) persists for the session (indicating "AI wrote here") — it appears on hover of any AI-written cell

The corner tick is informational only. It does not interfere with normal cell interaction.

### Paragraph-Level Feedback (Editor)

Editor documents written by AI show a left-margin gutter icon:
- A small `i-lucide-sparkles` icon at 12px, `var(--color-primary)` at 40% opacity, positioned in the gutter to the left of AI-inserted paragraphs
- On hover: tooltip reads "AI wrote this — [timestamp]. [Undo]"
- The undo inline link is a one-click undo scoped to that specific paragraph insertion

---

## 7. Confirmation Model + Permission Tiers

### The Three-Tier Permission Model

| Tier | Name | AI Can Do | Confirmation Required |
|------|------|-----------|----------------------|
| 1 | Read-only | Read context from panels | Never |
| 2 | Suggest | Generate diffs/previews | Always before applying |
| 3 | Auto | Read + write directly | Never (configurable exceptions) |

Default tier at first launch: **Suggest** (Tier 2). This is the safe default that introduces users to AI action before they grant it autonomy.

The tier is per-workspace-session, stored in localStorage. It can be changed in real-time from the chat panel header without opening settings.

### Permission Selector — Chat Panel Header

The chat panel header contains a small permission indicator, right-aligned:

```
┌────────────────────────────────────────────────────────┐
│  Chat               [● Suggest ▾]   [⋮]               │
│  ─────────────────────────────────────────────────────  │
│  [conversation]                                        │
```

Clicking `[● Suggest ▾]` opens an inline dropdown with three rows:
- `○ Read-only — AI can only discuss, not change`
- `● Suggest — AI proposes changes, you approve`  ← current
- `○ Auto — AI writes directly to your workspace`

The colored dot in the selector changes color by tier:
- Read-only: `var(--color-muted)`
- Suggest: `var(--color-warning)` (amber — deliberate caution signal)
- Auto: `var(--color-success)` (green — active, trusted)

**No modal, no settings page, no toggle buried three screens deep.** Permission is a live control in context.

### Suggest Tier: The Preview Strip

When AI generates a write action in Suggest mode, a **preview strip** appears below the last chat message and above the input area:

```
┌──────────────────────────────────────────────────────────────┐
│  AI wants to write to "Q1 Report"                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  + ## Summary                                          │  │
│  │  + Revenue grew 12% YoY. Units declined in February    │  │
│  │  + due to supply constraint.                           │  │
│  └────────────────────────────────────────────────────────┘  │
│  [Apply]   [Apply All]   [Dismiss]                           │
└──────────────────────────────────────────────────────────────┘
```

- Diff view: green `+` for insertions, red `-` for deletions. No syntax highlighting — keep it readable.
- If there are multiple proposed writes (to different panels), each gets its own strip, stacked vertically with a small header ("1 of 3 proposals").
- Apply: applies this one write to the target panel. Panel shows the completion animation.
- Apply All: applies all pending proposals. Confirmation for this button: a brief inline label change to "Confirm — Apply All?" with a 1.5s window before reverting. Not a modal.
- Dismiss: discards this proposal. The AI is not re-prompted — the user's next message continues the conversation.

The preview strip is scrollable if the diff is long. Max height: 200px before it scrolls.

### Auto Tier: Confirmation Exceptions

Even in Auto mode, certain actions require per-action confirmation:
- Deleting files or spreadsheet rows (destructive, irreversible at OS level)
- Opening more than 3 new panels in one turn (spam guard)
- Writing to a panel the user has not interacted with in the current session (cold write)

These exceptions appear as **inline confirmation chips** in the chat message stream:

```
│  AI  I'll delete the 8 empty rows in Sheet1.                  │
│       [Confirm: delete rows 14–21]  [Cancel]                  │
```

These are not modals. They live in the conversation. The user reads the AI's intent, sees the specific action, and approves or cancels inline. Focus is trapped to these chips while they're active (keyboard: Enter = confirm, Escape = cancel).

---

## 8. Context Control: Sub-Entity Granularity

The existing ContextTray (Phase 1) handles panel-level pinning. This section covers the evolved granularity controls.

### Masking Spreadsheet Columns or Rows

The spreadsheet panel's context chip, when active, shows an expand control:

```
┌──────────────────────────────────────────────────────────┐
│  [⊞] Sheet1 · A1:C8  [📌] [⋯] [×]                       │
│                            ↑
│                       "Mask columns"
└──────────────────────────────────────────────────────────┘
```

Clicking `[⋯]` opens an inline popover directly below the chip (not a drawer, not a modal):

```
┌───────────────────────────────┐
│  Columns included in context  │
│  ─────────────────────────────│
│  [✓] Month                   │
│  [✓] Revenue                 │
│  [ ] Employee ID  ← MASKED   │
│  [✓] Units                   │
│  ─────────────────────────────│
│  Rows: All  ▾                │  ← dropdown: All / First N / Custom range
└───────────────────────────────┘
```

Checkboxes are native `<input type="checkbox">` inside table rows (per component exception rule). Masked columns are visually dimmed in the spreadsheet panel itself (same tint as "available" chips — not removed from view, just marked).

The column mask persists for the session. It clears when the chip is dismissed.

### Editor Section Masking

For the editor panel's active chip, the `[⋯]` popover shows:

```
┌───────────────────────────────┐
│  Sections included            │
│  ─────────────────────────────│
│  [✓] Full document            │
│   or                          │
│  [ ] Introduction             │
│  [✓] Q1 Analysis              │
│  [ ] Appendix A  ← sensitive  │
└───────────────────────────────┘
```

Default: "Full document" checked. Unchecking it enables individual section control.

### AI's View vs. User's View

In the chat panel, there is a **secondary toggle in the header**:

```
│  Chat               [● Suggest ▾]   [👁 AI View]   [⋮]    │
```

Clicking `[👁 AI View]` switches the context tray into a read-only preview of exactly what the AI will see — the assembled context block, formatted as the server will send it. This is **not the raw JSON** — it's the human-readable formatted block:

```
┌──────────────────────────────────────────────────────────┐
│  AI VIEW — what the model receives with your next message │
│  ─────────────────────────────────────────────────────── │
│  [Context: Spreadsheet selection A1:C8]                  │
│  | Month    | Revenue | Units |                          │
│  | January  | 42000   | 120   |                          │
│  | February | 38000   | 98    |                          │
│  [End context]                                           │
│                                                          │
│  [Context: Document "Q1 Report" — Q1 Analysis section]  │
│  Revenue grew 12% year-over-year...                      │
│  [End context]                                           │
│  ─────────────────────────────────────────────────────── │
│  [Close AI View]                    ~620 tokens          │
└──────────────────────────────────────────────────────────┘
```

This replaces the conversation view temporarily. The input is still active — the user can type and send from this view. Sending closes AI View automatically.

AI View is for power users. Most users will never open it. It should be discoverable but not prominent.

---

## 9. Conversation + Action History Linkage

### Chat Message Annotations

Every AI message that triggered tool calls gets an annotation below it:

```
│  AI  Here's the summary I added to your document.         │
│       ─────────────────────────────────────────────────   │
│       3 changes made · [View in Activity Log] · [↩ Undo] │
```

- "3 changes made" is a summary count
- "View in Activity Log" opens/focuses the I/O Log panel and scrolls to this turn's entry
- "↩ Undo" undoes ALL actions taken in this AI turn (batch undo)

The annotation is `var(--color-muted)` at 12px. It's visible but not competing with the message content.

### Undo Model

**Per-turn batch undo** is the primary model. Each AI turn is treated as an atomic operation from the undo perspective.

```
[↩ Undo turn: 3 changes]
```

This is the most intuitive model. Users think "the AI did something" — they don't think "the AI made 3 discrete operations." Batch undo matches the mental model.

**Per-action undo** is available in two places:
1. In the I/O Log expanded entry — individual action rows have `[↩]` buttons
2. In panel gutter icons (editor) and cell hover tooltips (spreadsheet)

Per-action undo is for when you want the summary paragraph the AI added, but not the spreadsheet formula it also wrote.

### "AI Changed This" vs. "User Changed This" Attribution

**Spreadsheet:** AI-written cells show the corner tick (described above). Hovering shows "AI · [timestamp]". Cells the user subsequently edits lose the AI attribution — once a human edits a cell, it's theirs.

**Editor:** The left-gutter sparkle icon (described above). Same rule — user edit clears AI attribution on that paragraph.

**Undo stack integration:** AI actions push to the same undo stack as user actions. `Ctrl+Z` works. The undo stack entry label reads "AI: write to Sheet1 D2:D9" instead of the typical "Edit Cell". This means AI actions are part of the normal undo history and don't require the user to think about "AI undo" vs "regular undo."

This is the most important integration detail. Treating AI undo as separate from user undo creates a two-track mental model that users will find confusing. One undo stack, one `Ctrl+Z`.

### History Persistence

The I/O Log is session-only by default. Entries clear on page reload. This is the right default — historical AI activity is not the same as document history, and persisting it would raise data hygiene questions.

If the user wants to reference past AI activity, the chat message annotations are the lightweight persistent record (the chat history itself persists).

---

## 10. DeskBus Extensions for AI Actions

New events needed beyond Phase 1:

```ts
// AI agent publishes before executing a write action (Suggest mode)
'ai:propose-action': {
  turnId: string;
  proposalId: string;
  actionType: 'write_editor' | 'write_spreadsheet' | 'open_panel' | 'close_panel';
  targetPanelId: string;
  targetPanelType: string;
  preview: string;          // human-readable diff/description
  diffLines?: Array<{ type: '+' | '-' | ' '; content: string }>;
};

// User approves or dismisses a proposal
'ai:proposal-resolved': {
  proposalId: string;
  decision: 'approved' | 'dismissed';
};

// AI agent publishes when it begins writing (Auto mode or after approval)
'ai:action-started': {
  turnId: string;
  actionId: string;
  actionType: string;
  targetPanelId: string;
};

// AI agent publishes when write completes
'ai:action-completed': {
  turnId: string;
  actionId: string;
  success: boolean;
  errorMessage?: string;
};

// AI agent publishes the full turn summary after all actions complete
'ai:turn-completed': {
  turnId: string;
  actionCount: number;
  affectedPanelIds: string[];
  undoAvailable: boolean;
};

// Undo dispatcher
'ai:undo-turn': {
  turnId: string;
};

'ai:undo-action': {
  actionId: string;
};
```

Panels subscribe to `ai:action-started` and `ai:action-completed` for their own `panelId` to drive the tab shimmer and completion flash animations.

The I/O Log subscribes to all `ai:*` events with `replayLast: false` (log only live session).

---

## 11. Accessibility Specification

### I/O Log Panel

- `role="log"` on the scroll container, `aria-label="AI activity log"`, `aria-live="polite"`
- New entries inserted at the top: announce "New AI turn: [message preview]"
- Expanded entry: `role="region"`, `aria-label="AI turn detail: [message preview]"`
- Tool call rows: `role="listitem"` within `role="list"` for ACTIONS TAKEN section
- Undo buttons: `aria-label="Undo all actions in this turn"` / `"Undo: write to [target]"`

### Preview Strip (Suggest Mode)

- Strip has `role="dialog"`, `aria-label="AI proposed changes"`, `aria-modal="false"` (it's inline, not truly modal)
- Focus moves to the strip when it appears (first focusable element = Apply button)
- Escape: focus returns to input, strip remains (not dismissed — user must explicitly dismiss)
- `aria-live="assertive"` on the strip — proposed changes are important enough to interrupt

### Permission Selector

- `role="combobox"` pattern via Bits UI Select component
- Selected value announced: "Permission level: Suggest"
- On change: `aria-live="polite"` region announces "AI permission changed to: Auto"

### Inline Confirmation Chips

- `role="alertdialog"`, `aria-label="AI action requires confirmation"`
- Focus trapped while active: Tab cycles through confirm/cancel only
- `aria-describedby` points to the action description text

### AI-Active Tab State

- `aria-busy="true"` on the tab while AI is writing
- `aria-label` updated: "[Panel name] — AI is writing" during write, then reverts
- Completion flash: `aria-label` briefly includes " — AI write complete" (500ms), then reverts

### Reduced Motion

All animations (shimmer line, pulsing LIVE badge, cell highlight fade, tab icon transition) wrap in `@media (prefers-reduced-motion: reduce)` — replaced with instant state changes, no animations.

---

## 12. Mobile Scope

The I/O Log, Permission Selector, and Preview Strip are **not in mobile scope for MVP**. On small screens:
- I/O Log is omitted from the activity bar (or shown as a modal sheet triggered from a chat panel overflow menu)
- Permission selector is a full-screen sheet instead of an inline dropdown
- Preview strip collapses to a single "AI proposed changes — tap to review" chip, expands to a full sheet

AI write actions still execute on mobile. The gap is monitoring and control granularity, not functionality.

---

## 13. What Is Deferred to Phase 3

| Feature | Why deferred |
|---------|-------------|
| I/O Log persistence across sessions | Data hygiene; adds complexity; validate need first |
| Export I/O Log as audit trail | Enterprise feature; wait for use-case evidence |
| Per-panel permission overrides (block AI from writing to this panel) | Power user; the column/section masking handles 80% of the need |
| AI action replay (re-run a previous turn) | Risky without version control; defer |
| Multiple AI agent coordination (what if two AI agents run simultaneously?) | Single-agent model only for MVP |
| Confidence scores per tool call | Requires model introspection; no current API |

---

## 14. Phase 2 Refinements (Cross-Pollination Round)

Produced 2026-04-06. Inputs: ARCHY (store architecture), SVEY (serialization boundary), AIY (v4 SDK pauses + malformed calls), DATY (UndoPayload expiry + user annotation schema), APY (stream annotations), SCOUT (no prior art), RESY (Cursor/Copilot/Replit patterns).

### 14.1 Tool Execution Pause State (New)

AIY confirmed: in v4, each client tool call pauses the AI stream entirely. AI is suspended — not thinking, not erroring — waiting for the client to resolve. Phase 1 had no UX state for this.

**`⏸` icon is repurposed.** Phase 1 used it as "awaiting user confirmation." Phase 2 distinguishes:
- `⏸` in `var(--color-warning)` = AI paused, client tool executing
- `⏸` in `var(--color-muted)` + `(queued)` label = awaiting user confirmation (Suggest mode)

In-progress entry header badge changes from "LIVE" to "WAITING" (same `var(--color-warning)`) when in paused state. This prevents users from reading the pause as a hang.

Duration counter: if client tool takes >4s, show inline elapsed time — `AI waiting for result... 6s`. Resets when tool resolves.

Stop AI button parenthetical added: `[Stop AI] (won't undo current action)`. This is critical honesty — stopping during a client pause does not rollback the in-flight action.

**Accessibility:** Paused row aria-label: "Client action in progress, AI waiting." Duration counter uses `aria-live="polite"`.

### 14.2 Malformed Tool Call UX (New)

When AI generates an invalid tool call (wrong schema, missing field, unparseable), user sees:

```
[✕] generate_chart  FAILED
    └─ AI generated an unrecognized action.
       [Details ▾]   [Retry this step]   [Skip and continue]
```

`[Details ▾]` expands to plain-language technical block:
```
Tool: "generate_chart"
Error: Missing required field "dataset_id"
The AI may have misunderstood the context.
```

No raw JSON. No stack traces. Error text derived from validation failure, written in plain language.

`[Retry this step]` appends a silent system note to the message and re-sends. One click from the user — the mechanism is invisible.

`[Skip and continue]` marks failed and signals AI to proceed without this tool result.

Chat annotation for failed turns:
```
1 action failed · [View in Activity Log] · [Retry]
```

Panel DockLeaf shows `!` badge only if the partial write left the panel in a corrupted state. Otherwise no panel-level feedback — failure is contained in the log.

### 14.3 Token Budget Visibility (New)

4K per panel, 3 panel max, 12K total. Budget is invisible until relevant.

**Normal state (<75% used):** No budget display anywhere.

**Approaching limit (>75%):** Soft indicator at bottom of ContextTray, below chips:
```
Context: 9.4K / 12K tokens  ▓▓▓▓▓▓▓▓░░
```
Bar: 120px wide, 4px tall, `var(--color-primary)` fill on `var(--color-border)` track. Token count in 11px muted text.

**At limit (100%):** Bar turns `var(--color-warning)`. `+` chip button disabled with tooltip: "Context full. Remove a panel or reduce selection to add more." The 3-panel max is not surfaced as a mechanism — only the effect and resolution.

**Per-chip hover cost:** Each panel chip hover state includes token cost: `Sheet1 · 3.2K tokens`. Informs removal decisions without a separate screen.

**AI View (Phase 1 Section 8):** Add exact token count at bottom: `Total context: 9,421 tokens`. This is the one place exact numbers live.

No toasts, no modals, no blocking warnings until the user acts on a full tray.

### 14.4 Undo with Expiry (New)

DATY: `UndoPayload` has an expiry timestamp. Phase 1 assumed undo is always available.

**Principle:** User must never click Undo and have it fail silently. Expired state must be visible before acting.

**I/O Log — expired state:** Replace undo buttons with:
```
[↩ Undo expired]
Changes can no longer be reversed automatically.
You can restore manually by editing the affected cells/document.
```
Disabled button styling (`var(--color-muted)`, no hover). Explanatory line at 11px. No red — expiry is expected, not an error.

**Chat annotation — countdown:** When >2 minutes remain: `[↩ Undo — 8 min left]`. This is the only active countdown. The I/O Log does not animate — it reflects state when opened.

**Chat annotation — expired:** `[↩ Undo expired]` remains as a disabled non-clickable label. Confirms undo existed and passed; prevents confusion.

**Single a11y exception:** If I/O Log panel is open and undo window is <60 seconds, `aria-live="polite"` announces: "Undo window closing soon for AI turn at 14:32." Gives keyboard/screen reader users the same awareness as sighted users noticing the countdown.

### 14.5 User Annotation on Actions (New)

DATY schema: good/bad rating + note per action. Risk: annotation fatigue if solicited.

**Pattern: passive availability, never solicited.**

Rating controls appear on action row hover only — never prompted:
```
[✓] write_spreadsheet  J1:J50
    └─ Sheet1 · 50 values written     [👍]  [👎]  [Note]
```
Controls are right-aligned, appear on hover. No row content shift.

After rating: icon persists muted (`var(--color-primary) 50%` for thumbs-up, `var(--color-error) 50%` for thumbs-down). No animation, no toast.

`[Note]` opens a 2-line inline textarea below the row. Auto-saves on blur. 280 char limit. No submit button.

**Turn-level annotation:** At bottom of expanded entry, after undo controls:
```
Was this turn helpful?  [👍]  [👎]
```
Slightly elevated visual weight — visible without scrolling inside expanded entry.

No annotation anywhere in the chat conversation. Chat is the user's primary workspace; inserting rating widgets contaminates the flow.

**Keyboard:** When an action row has focus in the I/O Log, `R` opens rating controls. Discoverable via aria-label: "Press R to rate this action."

### 14.6 Pre-Flight Plan Summary (Changed from per-action confirmation)

Inspired by Replit's plan-then-execute model (RESY). Replaces per-action confirmation in Suggest mode for multi-step turns.

Before any tool calls execute, AI emits a plan summary in the chat stream:
```
AI  I'll do three things:
    1. Read the sales data from Sheet1
    2. Calculate summary statistics
    3. Insert a summary paragraph in Q1 Report
    [Proceed]  [Cancel]          ← Suggest mode only
```

In **Suggest mode:** requires single approval to proceed. One confirmation for the whole plan. Not per-action. Actions are then logged in I/O Log after execution, reviewable there.

In **Auto mode:** plan summary appears but auto-proceeds after 1.5 seconds. A cancel link is visible during the countdown: `Proceeding in 1s... [Cancel]`.

In **Read-only mode:** no tool calls, no pre-flight.

This is a significant friction reduction from Phase 1. Phase 1 implied approving each action individually in the preview strip. Phase 2 approves the plan once, then reviews in the log. The preview strip still exists for individual writes that are too impactful to trust in a plan — specifically: delete operations, cold writes, >3 panel opens. Those still use the per-action confirmation chip.

### 14.7 Change Summary Table

| Phase 1 Assumption | Phase 2 Correction |
|---|---|
| `⏸` = awaiting user confirmation | `⏸` now also = AI paused, client tool executing — distinguished by color and WAITING badge |
| No malformed tool call state | FAILED row with plain-language error, Details disclosure, Retry/Skip |
| No token budget UI | Soft bar at >75%; per-chip hover cost; hard block with explanation at limit |
| Undo always available | Expiry countdown in chat annotation; disabled expired state in log |
| No annotation | Passive hover-only rating on action rows; turn-level rating at entry bottom |
| Per-action confirmation in Suggest mode | Pre-flight plan approval (single confirm); per-action chips reserved for destructive/cold/spam-guard actions only |
