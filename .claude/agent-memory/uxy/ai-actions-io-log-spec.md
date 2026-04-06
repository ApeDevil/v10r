---
name: AI Actions + I/O Log UX
description: REVISED (Round 2) full UX specification for AI-as-actor in the desk — tool-invocation parts in chat, I/O Log unique value proposition, consolidated feedback model, generative UI surfaces, permission composition. Supersedes Round 1.
type: project
---

# AI Actions + I/O Log UX — REVISED FINAL SPECIFICATION (Round 2)

Produced 2026-04-06. Incorporates cross-agent input from ARCHY (entity model), SVEY (I/O Log as dock panel), AIY (tool-invocation parts + state machine), RESY (industry patterns: Cursor/Windsurf/Copilot Workspace), SCOUT (vercel/chatbot reference, shadcn/ai components, generative UI), APY (DeskEffect annotations), DATY (data model).

Supersedes the Round 1 spec. Round 1 structural decisions that survive unchanged are summarized but not re-argued.

**How to apply:** Use as the binding design contract when implementing ChatMessage.svelte message.parts rendering, the I/O Log panel, action feedback, generative UI components, and the permission overlay per panel.

---

## 0. What Changed From Round 1

Round 1 was designed before knowing that:
1. The AI SDK already surfaces tool calls as `message.parts` with state transitions (`call` → `partial-call` → `result`)
2. The chat bubble itself already knows about every tool invocation in real time
3. SCOUT found production apps using "generative UI" — custom components rendered from tool results
4. APY designed DeskEffect annotations that stream effect payloads alongside tool results

These facts create a redundancy problem: without intervention, the user would see the same action in **four places simultaneously** — the chat bubble (tool-invocation parts), the tab dot, the I/O Log, and a toast/notice. That's noise. This revision resolves the redundancy by assigning each surface a distinct responsibility and eliminating overlap.

---

## 1. Mental Model + Responsibilities

**Each feedback surface owns a different concern:**

| Surface | Concern | User question answered |
|---|---|---|
| Chat tool-invocation part | "What is the AI doing right now?" | In-progress awareness |
| Message action strip | "What did this response do?" | Per-message accountability |
| Panel tab dot | "Which panels were affected?" | Spatial orientation |
| I/O Log | "What happened, in full detail, with proof?" | Audit and recovery |
| Toast | Nothing (eliminated for AI actions) | — |

**Rule:** No AI action produces a toast notification. Toasts are for user-initiated actions (save, publish, delete). AI actions are contextual — their feedback lives in the chat stream and I/O Log.

---

## 2. Chat Message Parts — Tool-Invocation Rendering

### 2a. The Current Gap

`ChatMessage.svelte` currently receives `content: string` and renders it as markdown. The AI SDK `Chat` class provides `message.parts` — an array of typed parts including `text`, `tool-invocation`, and `tool-result`. The component must be upgraded to render parts instead of (or alongside) content.

`ChatPanel.svelte` currently passes `content={message.content}` to `ChatMessage`. This must change to `parts={message.parts}` (or the full message object).

### 2b. Part Rendering Contract

Each assistant message is a sequence of parts rendered in order:

```
[text part]        → rendered as markdown prose (existing behavior)
[tool-invocation]  → rendered as ToolCallCard (new component)
[text part]        → more prose after the tool call
[tool-invocation]  → another tool call
```

Multiple tool calls within one message render as a vertical stack of ToolCallCards between prose segments.

### 2c. ToolCallCard Component

A compact inline card that lives inside the assistant's message bubble:

**State: `call` (AI has emitted the call, tool is executing)**
```
┌──────────────────────────────────────────────────────────┐
│  ⟳  Reading Sheet1 A1:C8...                              │
└──────────────────────────────────────────────────────────┘
```

**State: `partial-call` (streaming tool arguments — rare but handled)**
```
┌──────────────────────────────────────────────────────────┐
│  ⟳  Preparing to write report.md...                      │
└──────────────────────────────────────────────────────────┘
```

**State: `result` (tool completed successfully)**
```
┌──────────────────────────────────────────────────────────┐
│  ✓  Read Sheet1 A1:C8  ·  3 rows · ~2.1K tokens         │
└──────────────────────────────────────────────────────────┘
```

**State: `result` with error**
```
┌──────────────────────────────────────────────────────────┐
│  ✕  Could not read Sheet1 — spreadsheet is not open      │
└──────────────────────────────────────────────────────────┘
```

**Visual design:**
- Card sits inline inside the assistant bubble (same width, no external gutter)
- Height: 32px collapsed
- Background: `color-mix(in srgb, var(--color-muted) 8%, transparent)`
- Border: `1px solid color-mix(in srgb, var(--color-muted) 15%, transparent)`
- Border-radius: `var(--radius-sm)`
- Margin: `4px 0` between text segments and other cards
- Icon: 12px — spinner (animated) for in-progress, `i-lucide-check` for success, `i-lucide-x` for error
- Icon color: muted for in-progress, `var(--color-success, #22c55e)` for success, `var(--color-error-fg)` for error
- Label: 12px, `var(--color-muted)`, single line. Truncated at full width.
- Success label switches from past-progressive ("Reading...") to past-perfect ("Read...") on completion

**Expand behavior:**
- Clicking the card expands it to show content preview (see Section 2d)
- `aria-expanded` toggles; `chevron-down` / `chevron-up` icon on right edge when expandable
- Cards with no preview (nav actions) are not expandable

### 2d. ToolCallCard Expanded — Generative UI

When expanded, the card reveals a content region below the summary line. Content is tool-type-specific:

**read_spreadsheet result:**
```
┌──────────────────────────────────────────────────────────┐
│  ✓  Read Sheet1 A1:C8  ·  3 rows · ~2.1K tokens    [▴]  │
│  ──────────────────────────────────────────────────────  │
│  │ Month    │ Revenue │ Units │                           │
│  │ January  │ 42000   │ 120   │                           │
│  │ February │ 38000   │ 98    │                           │
│  (showing 3 of 3 rows)                                    │
└──────────────────────────────────────────────────────────┘
```
Rendered as a mini table — NOT an image or text dump. Actual HTML table with design-token borders. Max 8 rows shown; "and N more rows" if truncated. This is the "generative UI" from SCOUT's finding: render a custom component appropriate to the data type.

**write_editor result (WRITE action, completed):**
```
┌──────────────────────────────────────────────────────────┐
│  ✓  Wrote report.md · Introduction  ·  3 paragraphs [▴]  │
│  ──────────────────────────────────────────────────────  │
│  - The Q1 results were mixed, with revenue...            │  ← removed (red bg)
│  + Based on the spreadsheet data, Q1 revenue...          │  ← added (green bg)
│  ──────────────────────────────────────────────────────  │
│  [Undo this change]  ·  [Open in Editor]                 │
└──────────────────────────────────────────────────────────┘
```
Color: removed lines use `color-mix(in srgb, var(--color-error-fg) 10%, transparent)`, added lines use `color-mix(in srgb, #22c55e 10%, transparent)`. No +/- symbols — just color (consistent with I/O Log diff).

[Undo this change] visible for 60 seconds from completion. Uses a fading underline progress indicator. After 60s: button disappears, action is committed.

**open_panel result (NAV action):**
```
┌──────────────────────────────────────────────────────────┐
│  ✓  Opened Spreadsheet panel                             │
└──────────────────────────────────────────────────────────┘
```
No expand. No content. NAV cards are always compact.

**search_web / external tool result:**
```
┌──────────────────────────────────────────────────────────┐
│  ✓  Searched web · "Q1 revenue trends"  ·  5 results [▴] │
│  ──────────────────────────────────────────────────────  │
│  • Q1 2025 Global Revenue Report — statista.com          │
│  • Tech sector Q1 performance — bloomberg.com            │
│  • ...3 more results                                     │
└──────────────────────────────────────────────────────────┘
```
Rendered as a link list. URLs are real links (open in new tab). Max 5 shown.

### 2e. Cursor's Pre-Tool Narration — Adopted With Scope Limit

Cursor's pattern: the AI narrates what it intends to do before executing the tool call ("I'm going to read your spreadsheet to understand the data..."). This reduces surprise and builds trust.

**Decision: Adopt for destructive actions only. Not for reads.**

Rationale: Pre-narrating every read becomes noise fast. A read that takes 200ms doesn't need narration — the ToolCallCard's in-progress state ("Reading...") is sufficient. But a destructive write benefits from the pause that narration creates. The user sees "I'm going to overwrite the Introduction section..." and can read that before the confirmation card appears.

Implementation: Pre-narration is a `text` part that the AI emits immediately before the `tool-invocation` part for destructive actions. It is part of the message stream, not a separate UI element. No extra UI needed — the existing prose rendering handles it.

Example sequence in the message stream:
```
[text part]: "The Introduction section needs to be updated to reflect the Q1 data. I'll replace it now."
[tool-invocation part]: write_editor (call state → confirmation card appears)
```

This is enforced via system prompt guidance to the model, not hardcoded in the UI.

### 2f. Message Action Strip

After the entire message has finished streaming (all parts resolved), a compact strip appears below the bubble if any read or write actions occurred. NAV-only messages do not get a strip.

```
│  Here's a summary of your Q1 data. I've updated        │
│  the Introduction to match.                             │
│  ─────────────────────────────────────────────────────  │
│  Read: Sheet1 A1:C8 · ~2.1K tokens                     │
│  Wrote: report.md Introduction · 3 paragraphs   [Undo] │
```

- 10px text, `var(--color-muted)`
- Written items: label in `color-mix(in srgb, var(--color-warning) 80%, transparent)` 
- [Undo] for 60s on written items (same timer as ToolCallCard expanded undo)
- The strip is a summary — it does not replace the ToolCallCards above it
- If the user already used [Undo] from a ToolCallCard, the strip [Undo] disappears for that item

---

## 3. Revised I/O Log — Unique Value Proposition

### 3a. Why It Still Exists (Post-Chat-Parts)

The chat stream and ToolCallCards cover "what just happened." The I/O Log adds what chat cannot provide:

1. **Persistence across messages.** The chat does not aggregate. If the AI read your spreadsheet in message 3 and wrote to the editor in message 7, the I/O Log is the only place both appear together as a unified timeline.

2. **Cross-session context.** Within a session, the I/O Log is the working history. "What has the AI touched in this session?" is a question chat cannot answer without scrolling.

3. **Full content proof.** ToolCallCards show 8 rows of a table. The I/O Log shows everything the AI received, with no truncation limit (up to 2000 chars per entry). It is the authoritative record.

4. **Undo surface for old actions.** The 60s inline undo window expires. The I/O Log carries undo buttons for every action that has an available snapshot, regardless of age (up to 50 entries per panel).

5. **Structured filtering.** "Show me only what the AI wrote to the editor, this session." Chat cannot do this.

**Positioning:** The I/O Log is not a debugging tool. It is the **audit record** for the session — an accountability surface for users who want to understand or undo what the AI did beyond the current exchange.

### 3b. I/O Log Layout — Unchanged From Round 1

The Round 1 layout spec (panel in dock, filter/live controls, entry anatomy with TYPE badges, collapsed/expanded entries, content preview, undo buttons per entry, DeskBus events) is correct and carries forward without change. See Section 4 of the Round 1 spec for full details.

**One addition from DATY's data model:** Each I/O Log entry should carry `operationId` derived from the tool_call row. This enables deep-link from I/O Log entry → specific message in chat ("See this in chat" link at the bottom of the expanded entry that scrolls chat to the message with that tool call).

### 3c. I/O Log Entry — "See in Chat" Link

Expanded entry footer gains one new element:

```
│  [undo ↩]  ·  [See in chat ↗]                           │
```

"See in chat" scrolls the ChatPanel to the message that contains the corresponding tool-invocation part and expands the relevant ToolCallCard. Requires the chat panel to be open; if not open, clicking this opens it. This closes the loop between the audit surface and the source conversation.

---

## 4. Action Feedback Consolidation — Noise Elimination

### 4a. The Four-Surface Problem

Before consolidation, an AI write action could trigger:
1. ToolCallCard in chat (in-progress, then result)
2. Panel tab dot (amber, pulsing)
3. I/O Log entry
4. Toast notification

That is four simultaneous signals for one event. This spec eliminates the redundancy:

### 4b. Consolidation Rules

| Signal | Write (non-destructive) | Write (destructive) | Read | NAV |
|---|---|---|---|---|
| ToolCallCard | Yes (in-progress + result + diff) | Yes (in-progress, pauses for confirmation, then result) | Yes (compact, expandable preview) | Yes (compact, no expand) |
| Message action strip | Yes (after streaming) | Yes (after streaming) | Yes (if read-heavy) | No |
| Panel tab dot | Yes (amber → clears on visit) | Yes (amber → clears on visit) | No | No |
| I/O Log entry | Yes | Yes | Yes | Yes (NAV type) |
| Toast | No | No | No | No |
| In-panel action banner | Yes (while streaming) | No (AI is paused for confirmation) | No | No |

**Why tab dots survive despite ToolCallCards:** The chat panel may not be visible. The user might be focused on the spreadsheet when the AI writes to the editor in the background. The tab dot on the editor tab is the only signal visible without looking at chat. It answers "which panels changed" even when chat is off-screen.

**Why the in-panel action banner survives for writes:** The affected panel may be visible while writing. The banner communicates "something is happening here right now" to a user who is looking at the panel, not the chat. It is non-blocking and dismisses automatically.

**Why no toast:** Toasts are for point-in-time events that don't have a natural contextual surface. AI write actions have three contextual surfaces (chat bubble, panel content, I/O Log). A toast would be the fourth signal with no additional information.

### 4c. Deduplication Between ToolCallCard and Message Strip

The message strip summarizes what ToolCallCards already showed. This is intentional — not redundancy:
- ToolCallCards are in-progress granular feedback (the "during")
- The strip is the post-hoc summary (the "after") that appears once, then is stable

After the 60s undo window expires, the strip's undo buttons disappear. What remains is a permanent, minimal summary of what the AI did in that response. This serves future reference — the user can scroll back through the conversation and see "this response wrote to report.md."

---

## 5. Permission Model — Composition With APY's Scope Model

### 5a. APY's Scope Model

APY defined three operation scopes for tool calls: `read`, `write`, `create`. These map to what the tool actually does at the data layer.

### 5b. Composition

The UX permission model (5 levels, per panel type) maps onto APY's scopes as follows:

| UX Level | Label | Permitted APY scopes |
|---|---|---|
| 0 | No access | none |
| 1 | Read only | `read` |
| 2 | Read + suggest | `read`, `write` (requires confirmation), `create` (requires confirmation) |
| 3 | Full access | `read`, `write`, `create` |
| 4 | Full + destructive | `read`, `write`, `create` + destructive variants (overwrite, delete, rename) without confirmation |

**Key clarification from this composition:** Level 2 "Read + suggest" covers both `write` and `create` operations — but both require explicit confirmation per action. It is not "read + write quietly." The label should arguably be "Read + confirm-to-write" but that is too long for a context menu. Use "Read + suggest" with a tooltip: "AI can propose changes but must ask before making them."

### 5c. Permission UI in Context Menu — Unchanged From Round 1

The radio group in the panel tab context menu is correct. Add tooltip text to each option:

| Option | Tooltip |
|---|---|
| No access | "AI cannot see or touch this panel" |
| Read only | "AI can read this panel's content (default)" |
| Read + suggest | "AI proposes changes; you approve each one" |
| Full access | "AI can read, write, and create without asking" |
| Full + destructive ⚠ | "AI can overwrite or delete content without asking" |

Tooltips display on hover of the radio option, 300ms delay.

### 5d. Confirmation Card — Updated for Scope Language

The existing confirmation card design (Section 2e, Round 1) is correct. One wording update to align with APY's scope language:

Old: "The AI wants to replace the Introduction section"
New: "The AI wants to **write** to report.md — Introduction section"

The `write` verb comes from APY's scope. This makes the confirmation language consistent with what logs and developer tools will show.

---

## 6. Destructive Action Confirmation — Inline Card Preserved

Round 1's inline confirmation card design is correct and carries forward unchanged. Key decisions reaffirmed:

- Card appears inline in the message stream (not a modal — this was the right call; modals interrupt focus, inline cards stay in conversation context)
- AI streaming pauses until user responds
- Four options: Allow once / Always allow for this file / Skip / Cancel action
- Focus trap between four buttons; Escape = Cancel

One addition: The card should show what APY scope applies. Below the description:

```
│  ⚠  Write to "report.md"?                               │
│                                                         │
│  The AI wants to replace the Introduction section       │
│  (~240 words) with new content.                         │
│  Scope: write · report.md                               │
│                                                         │
│  [Allow once]    [Always allow for this file]           │
│  [Skip this]     [Cancel action]                        │
```

The "Scope:" line is 10px muted text. It gives technically-minded users the exact APY scope annotation, making this card's decision feel informed rather than vague.

---

## 7. Generative UI — Where and How

### 7a. Definition

Generative UI means rendering the *output* of a tool call as a purpose-built component rather than as text. SCOUT found production apps doing this for rich results.

### 7b. Where Generative UI Lives

Generative UI renders inside the **expanded ToolCallCard** only. It does not render as a standalone message, does not spawn a new panel automatically, and does not replace the prose response.

Rationale: Spawning new panels from AI tool results is a power feature (it would be jarring for casual users to see panels popping open without them asking). The expanded ToolCallCard is a contained, opt-in surface — the user clicks to expand and sees the rich content. This respects the progressive disclosure principle.

### 7c. Generative UI Component Registry

Map from tool name pattern to component:

| Tool name pattern | Component rendered |
|---|---|
| `read_spreadsheet` | Mini table (HTML table, max 8 rows, scrollable) |
| `write_spreadsheet` | Diff view (before/after rows, color-coded) |
| `write_editor` | Text diff (removed/added lines, color-coded) |
| `search_web` | Link list (title + domain, max 5 items) |
| `open_panel` / nav tools | None (NAV cards are always compact) |
| `read_file` | Code block or text block depending on file type |
| `create_spreadsheet` | Single-line: "Created data/q1.csv" with [Open] link |

**Unknown tool:** Falls back to raw JSON formatted as a code block. Never blank.

### 7d. Size Constraints

Every generative UI component must:
- Fit within the chat bubble width (bounded by `max-w-[80%]` on the bubble)
- Have a max height of 240px before scrolling kicks in (not modal-sized — this is inline)
- Be keyboard navigable (tab into the mini table, tab through links)
- Not require interaction to be comprehensible (the summary line above always explains what it is)

---

## 8. Windsurf To-Do Lists — Deferred (With Note)

RESY found Windsurf's cascading to-do list pattern: as the AI plans multi-step work, it renders a live checklist that updates as steps complete.

**Decision: Defer to Phase 2.**

Rationale: This is a useful pattern but requires the AI to emit structured plan output that the UI can parse into checklist items. This is a prompt engineering + parsing challenge, not a UI challenge. The ToolCallCard stack in a single message already gives a de-facto checklist of what was done (each card is a step). For now, that is sufficient.

Phase 2: If the AI emits a `plan_steps` tool call at the beginning of a multi-step response, the chat could render those as a live checklist with ToolCallCards linked to each step. Track this as a future enhancement.

---

## 9. Components Summary — What Needs Building

This spec adds the following new components beyond Round 1:

| Component | Location | Description |
|---|---|---|
| `ToolCallCard.svelte` | `$lib/components/chat/` | Inline tool-invocation renderer with state machine |
| `ToolCallMiniTable.svelte` | `$lib/components/chat/` | Generative UI: spreadsheet read result |
| `ToolCallDiff.svelte` | `$lib/components/chat/` | Generative UI: write diff (text + spreadsheet) |
| `ToolCallLinkList.svelte` | `$lib/components/chat/` | Generative UI: web search results |
| `MessageActionStrip.svelte` | `$lib/components/chat/` | Post-message summary of reads/writes with undo |

**ChatMessage.svelte must be upgraded** to accept `parts` (array of message parts from AI SDK) instead of `content: string`. The content fallback (for user messages, which have no parts) stays as-is.

**ChatPanel.svelte must be updated** to pass `parts={message.parts}` to ChatMessage for assistant messages.

---

## 10. All Other Round 1 Sections — Carried Forward Unchanged

The following Round 1 sections are correct and bind as-is:
- Section 2b: In-panel action overlay (pill banner while AI writes)
- Section 2c: Inline edit highlighting (editor border flash, spreadsheet cell ring)
- Section 3: Undo philosophy and undo surfaces (60s inline, I/O Log ↩, panel context menu)
- Section 4: Full I/O Log layout, entry anatomy, TYPE badges, content preview, filter controls, live mode toggle (plus operationId addition from Section 3b above)
- Section 4i: DeskBus events (all five, unchanged — plus `operationId` field on `ai:write` and `ai:tool`)
- Section 5: Context transparency — chip write/blocked states, "What AI sees" popover
- Section 6: Trust and control — permission levels, context menu addition, blocked panel behavior, graceful error handling
- Section 7: Progressive disclosure layers 1–5
- Section 9: Keyboard shortcuts
- Section 10: Accessibility annotations

---

## 11. What Is Deferred (Updated)

| Feature | Why deferred |
|---|---|
| Windsurf-style cascading to-do lists | Requires structured plan output from model; ToolCallCard stack is sufficient for now |
| Copilot Workspace spec/plan/diff pipeline | Multi-step planning workflow; validates after simpler tool calls are proven |
| Per-instance panel permissions | Type-level is validated first |
| Context exclusions via I/O Log toggle | Needs usage data |
| AI action history across sessions | Session-only sufficient for MVP |
| Generative UI: new panel auto-spawn from tool result | Power feature; contained ToolCallCard expansion is the right first step |
| M365 Track-Changes integration for editor | Requires editor to support change-tracking; OOD for current editor panel |
| I/O Log export (JSON, download) | Nice-to-have, not core |
| Phase 2: interactive context editing in I/O Log | Defer until Phase 1 usage validates the need |
