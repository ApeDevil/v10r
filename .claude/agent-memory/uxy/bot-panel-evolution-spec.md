---
name: Bot Panel Evolution UX
description: FINAL Round 2 UX spec for desk context improvements — resolves APY/AIY/DATY/ARCHY conflicts. No close tool, 4-level content model collapsed to 2 UI states, AIY status naming adopted, segmented token bar, panel control feedback patterns.
type: project
---

# Bot Panel Context — FINAL UX Spec (Round 2)

Produced 2026-04-11. Supersedes Round 1 evolution spec. Resolves three inter-agent conflicts and tightens implementation contract.

**How to apply:** This is the binding design contract for BotContextSection, BotToolsSection, token bar, and nav feedback patterns. Cross-references ai-actions-io-log-spec.md (write/undo model) and bot-manager-ux.md (dialog shell).

---

## Conflict Resolutions

### 1. Close Tool — APY wins. No desk_close_panel tool.

The bot cannot close panels. Period. Not now, not with confirmation, not with a permission row in Bot Manager. Closing the user's workspace without their initiation is adversarial regardless of consent UI.

**Impact on spec:**
- Remove close confirmation card (was in Round 1)
- Remove [Undo] on NAV ToolCallCards for close — no close event exists
- Bot Manager Navigation tool rows: only "Open panels" and "Focus panels"

### 2. Content Levels — DATY 4-level engine, 2-state UI

DATY's `full/summary/title-only/excluded` model runs internally. User sees binary: full vs compressed.

**Mapping:**
- `full` → chip with no prefix
- `summary` or `title-only` → chip label prefixed with `[~]`
- `excluded` → chip grays to Available visual but stays in INCLUDED tier row with [expand] button

Tooltip on `[~]` chip: "Context compressed to save token budget."

Manual override: per-panel [Compress] / [Expand] toggle (renamed from "Collapse"/"Expand"). Forces `summary` or restores `full`. No other content level knobs exposed.

Pinning a panel raises DATY weight to pinned=80, resisting compression longer. This is the only user lever on priority — no explicit weight controls.

### 3. Status Naming — Adopt AIY's model

AIY uses: `focused` / `active` / `background`.

**Mapping to UI tiers:**

| AIY status | UI tier label | Who qualifies |
|---|---|---|
| `focused` | ACTIVE | Currently focused panel + user-pinned panels |
| `active` | INCLUDED | Other open panels (auto-included) |
| `background` | AVAILABLE | Closed panels the bot knows about |

Pinned panels receive `focused` status even when not the focused leaf — user intent overrides auto-focus. This is intentional.

---

## Context Tray Layout

```
ACTIVE ────────────────────────────────────────
[●] Sheet1              ~1.2K tok    [pin]
    focused · full context

[●] report.md           ~0.8K tok    [unpin]
    pinned · full context

INCLUDED ──────────────────────────────────────
[◉] ~ Preview           ~12 tok      [↗ expand]
    compressed
[◉] Explorer            ~0.1K tok    [↙ compress]

AVAILABLE ─────────────────────────────────────
[+] Spreadsheet         not open     [Open]
    Analyze and edit tabular data
```

**Tier dividers:** All-caps label, muted color, thin separator line. Not interactive.

**Status icons:**
- `●` filled circle, primary color — ACTIVE (focused or pinned)
- `◉` ring circle, muted — INCLUDED (open, auto)
- `+` plus, very muted — AVAILABLE (closed)

---

## Chip Visual States

| State | Background | Border | Label opacity | Right action |
|---|---|---|---|---|
| Active/focused | `color-mix(in srgb, var(--color-primary) 10%, transparent)` | `color-mix(in srgb, var(--color-primary) 25%, transparent)` | 100% | [pin] or [unpin] |
| Compressed (~) | Same as active | Same | 80% | [↗ expand] |
| Included (auto) | `color-mix(in srgb, var(--color-muted) 8%, transparent)` | `color-mix(in srgb, var(--color-border) 60%, transparent)` | 70% | [↙ compress] |
| Excluded (auto) | Same as included | Same | 50% | [↗ expand] |
| Available (closed) | Same as included | Same | 60% | [Open] |

**Stale dot:** Amber `●` top-right of chip. Appears on ACTIVE and INCLUDED chips when underlying content changed since last response. Not on AVAILABLE.

**Chip height:** 26px. Padding: 4px 8px. Label max 160px, truncate with ellipsis.

---

## Token Budget Bar

Segmented, two zones:

```
[primary 2K][muted 6.8K       ][empty      ]
ACTIVE       INCLUDED           remaining
~8.8K / 32K tokens
```

- ACTIVE segment: `var(--color-primary)` at 50% opacity
- INCLUDED segment: `var(--color-muted)` at 40% opacity
- Use actual model budget ceiling (not hardcoded 8K)
- Threshold coloring: whole bar shifts to warning amber at 70%, error red at 90%
- Text: `~{used}K / {ceiling}K tokens`, 11px muted

**Overflow states:**

At 80%: inline banner in Context section (not modal, not toast):
```
⚠  Context approaching limit (25.6K / 32K)
The AI may compress older context automatically.
Or: compress included panels to reduce token use.
[Compress all included]
```

At 95%: banner becomes error state + amber dot on Chat panel tab (right of tab label, 4px, `var(--color-warning)` at 60% opacity).

**Accessibility:**
- Bar: `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label="Context token usage"`

---

## Panel Control Feedback Patterns

### Open panel

1. Bot narrates (text part before tool): "I'll open the Explorer to check the file listing."
2. ToolCallCard:
   ```
   ⟳  Opening Explorer...
   ✓  Opened Explorer
   ```
3. Panel opens. New chip appears in INCLUDED tier automatically.
4. Hard limit: 3 panel ops per turn (AIY enforcement). No user-facing error if exceeded — tool layer rejects, bot proceeds.

### Focus panel

No narration. Low-stakes.
```
✓  Focused Sheet1
```
Focused panel chip moves from INCLUDED to ACTIVE. Previously focused panel's chip drops to INCLUDED.

### No close

No close events. No close UI. No [Undo] on NAV cards for close. The bot cannot close panels.

---

## Bot Manager Tools — Navigation Section

```
─── Navigation ─────────────────────────────────
[●] Open panels               ⓘ
    Bot can open panels in your desk
    (max 3 per turn)

[●] Focus panels              ⓘ
    Bot can shift focus to any open panel
```

No "Close panels" row. This is permanent, not a Phase 2 addition.

---

## Auto-Compression/Exclusion Announcements

When DATY's algorithm demotes a panel from `full` to `summary`:
- `aria-live="polite"`: "Preview panel context compressed to save token budget"
- Chip gains `[~]` prefix
- No toast or banner — routine optimization

When a panel drops to `excluded` (weight too low):
- `aria-live="polite"`: "[Panel name] excluded from context — use the expand button to restore"
- Chip stays in INCLUDED tier row but adopts excluded visual state

---

## Components Changed

| Component | Change |
|---|---|
| BotContextSection | Adopt AIY status naming. Three tier labels: ACTIVE / INCLUDED / AVAILABLE. Add `[~]` compressed prefix. Add excluded chip variant. |
| BotToolsSection | Remove "Close panels" row. Open + Focus rows only. Change limit copy to "max 3 per turn". |
| Token bar | Segmented 2-zone. Use actual model ceiling. Thresholds apply to whole bar. |
| Overflow banner | 80% warning, 95% error, inline not modal (unchanged from Round 1). |
| Per-panel compress toggle | Rename "Collapse" → "Compress". Tooltip: "Compress this panel's context to save budget". |
| NAV ToolCallCard | Remove [Undo] affordance (no close = nothing to undo on nav). |
| aria-live region | Add compression + exclusion announcements. |

---

## Unchanged from Round 1

- Pin/unpin interaction
- Stale dot appearance and position
- Left-side dock tab dot when bot panel focused (4px, primary, ACTIVE panels only)
- Suggestion chip (suggest_panel tool result) — max 1 per message, never auto-opens
- "(open in the desk)" narration hint for auto-included panel writes
- 60s undo window for write actions (write undo is separate from nav)
- I/O Log entry structure
- BotManager dialog size (480px) and tab navigation

---

## What Is Not Exposed

- DATY's weight values (100/80/60/30/15) — internal only
- Content level labels (full/summary/title-only/excluded) — internal only
- Per-panel-type summarizer logic — implementation detail
- The `registerPanelCapability()` API — SVEY concern

The UX surface is: chip with possible `[~]` prefix, one [Compress]/[Expand] toggle per chip, segmented budget bar, overflow banner. That is the complete set.
