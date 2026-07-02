# Desk + AI Integration Architecture

Final architectural recommendation for integrating AI tool-calling into the Desk workspace. This document resolves disagreements from the multi-agent review and provides a phased implementation plan.

> **Superseded design record (v4-era plan).** This doc captures the original v4 plan; the feature shipped on **AI SDK v6** with a different surface. Read it for rationale, not as the current contract — the live contract is [surfaces.md](./surfaces.md) (deskbot surface, `desk:ask` nRAG, one-door `executeDeskToolCall`, the wired plan gate). What actually shipped:
> - **Per-surface route.** The deskbot client posts to `POST /api/ai/deskbot` (not the old single `/api/ai/chat`, since deleted). The route sets `surface: 'deskbot'`; one `chat-orchestrator.ts` dispatches.
> - **AI SDK v6** (`ai ^6.0.0`, `@ai-sdk/* ^3.x`). The orchestrator uses `createUIMessageStream` / `createUIMessageStreamResponse` / `toUIMessageStream({ sendStart: false })` / `message-metadata` — not `createDataStreamResponse` / `writeMessageAnnotation` / `toDataStreamResponse`. Step control is `stopWhen`, not `maxSteps`.
> - **Tool names are `desk_*`-prefixed**: `desk_create_spreadsheet`, `desk_update_cells`, `desk_rename_file`, `desk_update_markdown`, `desk_delete_file`, `desk_create_markdown` (in `tools/desk-*.ts`) — not the `listFiles` / `readFile` / `createFile` / … names proposed below.
> - **`toolCallStatusEnum` is `['pending', 'success', 'error']`** and the `toolCall` table lives in `schema/ai/conversation.ts`, not a separate `tool-call.ts`. The proposed `['pending', 'completed', 'failed']` enum never shipped.
> - Policy machinery is the governor / proposal layer (see [harness-lens.md](./harness-lens.md)).
> - **Approval, not inline confirmation.** The Phase-3 inline `ConfirmCard` / `confirm` `DeskEffect` design below did **not** ship. Deskbot **write and destructive** tools (`desk_update_cells`, `desk_rename_file`, `desk_update_markdown`, `desk_delete_file`) never mutate in the agent loop — each returns a `requiresApproval` sentinel that becomes a pending `agent_proposal` (surfaced as a PlanCard); the mutation runs only via `POST /api/ai/proposals/[id]/approve` → `executeDeskToolCall`, recording a real `approvedBy`/`approvedAt`. Reversible creates still mutate in-loop, auto-approved. The old model-minted `confirmed=false → confirmed=true` self-handshake is gone, and even a single-target overwrite or delete is now gated.
> - **Overwrite/delete recoverability.** `db/desk` captures a pre-image `desk.file_revision` snapshot before an overwrite or delete, so a fat-fingered or prompt-injected overwrite is no longer irrecoverable (capture only — no restore UI yet).

---

## Decision Record

### 1. DeskBus vs Direct Dock Calls

**Decision: SVEY is right. Split routing, not unified bus.**

My Phase 1 proposal routed all AI actions through DeskBus with an `ai:` prefix. SVEY correctly identified that structural actions (open panel, focus tab, create panel) originate in ChatPanel and act on the dock — routing them through a bus that ChatPanel itself subscribes to creates a pointless triangle.

The split:

| Action Type | Routing | Example |
|-------------|---------|---------|
| **Structural** (panels, tabs, layout) | `dock.*` direct calls | Open spreadsheet, focus editor, create panel |
| **Content** (data flowing between panels) | DeskBus channels | Insert text into editor, update spreadsheet cells |

Implementation: a `dispatchDeskAction()` function lives in ChatPanel. It receives the tool result, classifies it, and either calls `dock.addPanel()` / `dock.activateTab()` directly, or calls `bus.publish()` for content delivery.

```
Tool result → dispatchDeskAction() ─┬─ structural → dock.addPanel() / dock.activateTab()
                                    │                (queueMicrotask between multi-step)
                                    └─ content    → bus.publish('editor:content', payload)
```

**Why not all-bus:** The dock is a context-injected state object, not an event target. Its methods mutate reactive `$state` directly. Publishing a bus event that dock would need to subscribe to would require the dock to import the bus — coupling two context objects that are currently independent. Keep them independent; let ChatPanel be the bridge.

**`queueMicrotask` for sequencing:** When a tool result requires both structural and content actions (e.g., "create spreadsheet, then populate it"), use `queueMicrotask` between the structural action (panel creation) and the content action (data delivery). This lets Svelte's microtask-based rendering complete the panel mount before the content event fires.

**`PanelDefinition.meta` field:** Add an optional `meta?: Record<string, unknown>` to `PanelDefinition`. When AI creates a panel, it attaches `{ documentId, sourceToolCallId }` so the panel knows its backing document immediately on mount, without a bus round-trip.

### 2. I/O Log Storage

**Decision: DATY is right. Derived view, not separate table.**

APY proposed a dedicated `ai.io_log_entry` table. DATY proposed deriving the I/O Log from `ai.tool_call` + `ai.message` tables. The derived approach wins because:

1. **Single source of truth.** A separate log table must be kept in sync with tool_call records — that is denormalization with no query performance justification at our scale.
2. **The I/O Log is a view concern.** It is a timeline reconstruction from tool calls and messages. The query is a simple join with ordering by `created_at`.
3. **No backward compatibility burden.** We have no production users. Adding a derived view later costs nothing.

Schema additions to `ai` schema:

```
ai.tool_call
  id            text PK
  message_id    text FK → ai.message
  name          text NOT NULL          -- tool name (e.g., 'createSpreadsheet')
  arguments     jsonb NOT NULL         -- input parameters
  result        jsonb                  -- summarized output (<500 tokens)
  entity_type   text                   -- polymorphic: 'desk.file', 'desk.spreadsheet', etc.
  entity_id     text                   -- FK to the affected entity
  status        text NOT NULL          -- 'pending' | 'completed' | 'failed'
  duration_ms   integer                -- execution time
  created_at    timestamptz NOT NULL
```

The `ai.message` table stays as-is. The `context` JSONB column is sufficient — it stores a snapshot of what panels were visible when the message was sent. Promoting it to a separate table (DATY's suggestion) adds joins without benefit; the context is write-once, read-with-message.

**I/O Log query** is simply:

```sql
SELECT m.role, m.content, m.created_at,
       tc.name, tc.arguments, tc.result, tc.entity_type, tc.entity_id, tc.status
FROM ai.message m
LEFT JOIN ai.tool_call tc ON tc.message_id = m.id
WHERE m.conversation_id = $1
ORDER BY m.created_at, tc.created_at
```

### 3. Bridge Mechanism (Server → Client Effects)

**Decision: DataStream annotations, but with SCOUT's constraints applied.**

AIY flagged that v6 uses `message.parts` natively for tool invocations. However, we are on **AI SDK v4.3.19** today. The v4→v6 migration is a separate concern. The bridge must work on v4 now and remain compatible with v6's model.

**v4 bridge (current):**

Tool `execute()` functions return a summarized result object. After the result is returned to the model, a `writeMessageAnnotation` call emits a `_deskEffect` annotation:

```typescript
// Inside createDataStreamResponse's execute callback
const toolResult = await executeTool(toolCall);

// Emit effect annotation for client
dataStream.writeMessageAnnotation({
  type: '_deskEffect',
  toolCallId: toolCall.toolCallId,
  effects: deriveEffects(toolCall.toolName, toolResult),
});
```

**SCOUT's constraint applied:** The v4 annotation delay bug means annotations inside a tool's `execute()` are delayed until step completion. Solution: emit `_deskEffect` annotations from the `createDataStreamResponse` `execute` callback (the outer data stream), not from within individual tool `execute()` functions. Tool functions return their result; the orchestrator derives and emits effects.

**`DeskEffect` type:**

```typescript
type DeskEffect =
  | { action: 'openPanel'; panelType: string; panelId: string; meta?: Record<string, unknown> }
  | { action: 'focusPanel'; panelId: string }
  | { action: 'updateContent'; channel: keyof DeskEvents; payload: DeskEvents[keyof DeskEvents] }
  | { action: 'notify'; level: 'info' | 'success' | 'warning'; message: string }
  | { action: 'confirm'; toolCallId: string; description: string; destructive: boolean };
```

**Client consumption:** ChatPanel reads annotations from the streaming response, extracts `_deskEffect` entries, and feeds them to `dispatchDeskAction()`.

**v6 migration path:** When we upgrade to v6, tool results appear as `tool-invocation` parts in `message.parts`. The `_deskEffect` annotations can migrate to tool result metadata. The `dispatchDeskAction` function does not change — it still receives `DeskEffect[]` regardless of transport.

### 4. Permission Model

**Decision: UXY's action classes drive UX; permissions are enforced at tool definition, not a separate layer.**

UXY proposed a 5-level per-type permission model. APY proposed scope-based permissions (read/write/create). Both are premature — we have no multi-user collaboration and no production users.

What we need now:

**Tool-level capability flags** (simple, explicit):

```typescript
interface DeskToolDefinition {
  name: string;
  description: string;
  parameters: ZodSchema;
  execute: (args, context) => Promise<ToolResult>;
  // Capability classification
  capability: 'read' | 'write' | 'create';
  // UX classification (drives client behavior)
  actionClass: 'navigational' | 'additive' | 'destructive';
}
```

- `capability` gates execution: the server checks the user has the appropriate permission (for now: authenticated = all capabilities; expandable later).
- `actionClass` drives client UX: navigational actions are silent, additive show a notice, destructive require confirmation via inline chat card (not modal — per UXY).

**Tab indicators** (from UXY): panels can signal state via `PanelDefinition.indicator`. Extend the existing `indicator` field from `'unsaved' | 'saving' | 'error'` to include `'ai-active' | 'ai-modified'`. ChatPanel sets these on target panels during tool execution and clears them on completion.

**Future expansion path:** When multi-user or role-based access is needed, the `capability` field maps directly to role permissions. The `actionClass` is orthogonal — it governs UX, not authorization.

### 5. Tool Design

**8 tools, tightly scoped.** Adopting APY's tool list with SCOUT's constraints:

| Tool | Capability | Action Class | Description |
|------|-----------|-------------|-------------|
| `listFiles` | read | navigational | List desk files/folders |
| `readFile` | read | navigational | Read file content (spreadsheet cells, markdown) |
| `createFile` | create | additive | Create new file + open panel |
| `updateFile` | write | additive | Update file content |
| `deleteFile` | write | destructive | Delete file (confirmation required) |
| `readContext` | read | navigational | Read active panel context |
| `searchContent` | read | navigational | Search across desk files |
| `managePanel` | write | navigational | Open/close/focus panels |

**SCOUT's constraints applied:**
- No `toolChoice: "required"` — use `"auto"` only.
- `maxSteps: 5` ceiling (not `maxTokens` — that is a v4 param for token budget, not step count). When migrating to v6, switch to `stopWhen: stepCountIs(5)`.
- Tool `execute()` returns summarized results under 500 tokens. Full content is available via `readFile` if the model needs it.
- Gemini compatibility: no optional arrays in tool parameters; all array params marked required with empty array defaults.

**System prompt strategy (from AIY):** Metadata-eager, content-lazy.

```
System prompt includes:
  - List of open panels with IDs and types (lightweight)
  - File tree summary (names + types, no content)
  - Active context from desk-context registry (already serialized)

NOT included:
  - Full file content (use readFile tool on demand)
  - Full spreadsheet data (use readFile tool on demand)
```

This keeps the system prompt under ~2K tokens for typical desk states while giving the model enough metadata to decide which tools to call.

---

## Module Boundaries

```
src/lib/server/ai/
  tools/                     # NEW: tool definitions
    desk-tools.ts            # Tool schemas + execute functions
    effects.ts               # deriveEffects() — tool result → DeskEffect[]
    types.ts                 # DeskEffect, DeskToolDefinition, ToolResult
  chat-orchestrator.ts       # MODIFY: add tool-calling path
  config.ts                  # MODIFY: desk system prompt builder

src/lib/server/db/
  schema/ai/
    conversation.ts          # EXISTING (unchanged)
    tool-call.ts             # NEW: ai.tool_call table
  ai/
    tool-mutations.ts        # NEW: persist tool calls
    tool-queries.ts          # NEW: I/O Log query

src/lib/components/composites/dock/
  desk-bus.svelte.ts         # MODIFY: add content channels for AI
  dock.types.ts              # MODIFY: add meta? to PanelDefinition

src/lib/components/chat/
  dispatch-action.ts         # NEW: dispatchDeskAction()
  ChatPanel.svelte           # MODIFY: consume _deskEffect annotations
```

**Responsibility assignments:**

| Module | Owns | Does NOT Own |
|--------|------|-------------|
| `tools/desk-tools.ts` | Tool schemas, parameter validation, domain logic delegation | UI effects, panel state |
| `tools/effects.ts` | Mapping tool results to DeskEffect[] | Executing effects |
| `chat-orchestrator.ts` | Stream lifecycle, tool execution loop, annotation emission | Tool business logic |
| `dispatch-action.ts` | Classifying and executing DeskEffects on client | Generating effects |
| `desk-bus.svelte.ts` | Cross-panel content delivery | Panel lifecycle, dock mutations |
| `dock.state.svelte.ts` | Panel/tab/layout state | Content delivery, AI awareness |

---

## Communication Flow

```
User message
    │
    v
ChatPanel (client)
    │ POST /api/ai/deskbot { messages, panelContext }
    v
+server.ts (thin adapter)
    │ validate, rate-limit, auth
    v
chat-orchestrator.ts
    │ createDataStreamResponse
    v
streamText({ tools: deskTools, maxSteps: 5 })
    │
    ├─ tool call ──> desk-tools.ts ──> domain module (server/desk/*)
    │                    │
    │                    v
    │              tool result (summarized)
    │                    │
    │    deriveEffects() │
    │         │          │
    │         v          v
    │  dataStream.writeMessageAnnotation({ _deskEffect: effects })
    │  persist to ai.tool_call table
    │
    v (stream completes)
ChatPanel receives annotations
    │
    v
dispatchDeskAction(effect)
    ├─ structural ──> dock.addPanel() / dock.activateTab()
    │                 (queueMicrotask)
    └─ content     ──> bus.publish(channel, payload)
```

---

## Schema Additions

```typescript
// src/lib/server/db/schema/ai/tool-call.ts
import { index, integer, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { aiSchema } from './conversation';
import { message } from './conversation';

export const toolCallStatusEnum = aiSchema.enum('tool_call_status', [
  'pending', 'completed', 'failed'
]);

export const toolCall = aiSchema.table(
  'tool_call',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id')
      .notNull()
      .references(() => message.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    arguments: jsonb('arguments').notNull(),
    result: jsonb('result'),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    status: toolCallStatusEnum('status').notNull().default('pending'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tool_call_message_idx').on(table.messageId),
    index('tool_call_entity_idx').on(table.entityType, table.entityId),
  ],
);
```

**Type addition to PanelDefinition:**

```typescript
// dock.types.ts — add to PanelDefinition
meta?: Record<string, unknown>;
```

**Indicator extension:**

```typescript
// dock.types.ts — extend indicator
indicator?: 'unsaved' | 'saving' | 'error' | 'ai-active' | 'ai-modified';
```

---

## Phased Implementation Plan

### Phase 1: Foundation (tools + schema)

**Goal:** Tool definitions exist, execute against real domain modules, results persist.

1. Add `ai.tool_call` table schema + generate migration
2. Create `tools/types.ts` with `DeskEffect`, `DeskToolDefinition`, `ToolResult`
3. Implement `tools/desk-tools.ts` — start with `listFiles`, `readFile`, `readContext` (read-only tools)
4. Implement `tools/effects.ts` — `deriveEffects()` function
5. Add `meta?` field to `PanelDefinition`
6. Extend `indicator` type on `PanelDefinition`
7. Wire tools into `chat-orchestrator.ts` via `createDataStreamResponse` path

**Validation:** AI can list files and read content in chat. Tool calls persist in DB. No UI effects yet.

### Phase 2: Client Bridge (effects reach the UI)

**Goal:** Tool results cause visible changes in the desk.

1. Create `dispatch-action.ts` with `dispatchDeskAction()`
2. Modify ChatPanel to extract `_deskEffect` annotations from stream
3. Implement structural routing: `openPanel`, `focusPanel` via dock calls
4. Implement content routing: `updateContent` via DeskBus
5. Add `queueMicrotask` sequencing for structural→content chains
6. Add `ai-active` / `ai-modified` indicator support to DockTab rendering

**Validation:** "Create a spreadsheet with headers A=Name, B=Score" creates a panel and populates it.

### Phase 3: Write Tools + Confirmation

**Goal:** AI can create and modify desk content with appropriate safeguards.

1. Implement `createFile`, `updateFile` tools
2. Implement `managePanel` tool
3. Implement `searchContent` tool
4. Add inline confirmation cards for destructive actions in ChatPanel
5. Implement `deleteFile` with confirmation flow
6. Add tool-call persistence (mutations + queries for I/O Log)

**Validation:** Full CRUD cycle through chat. Destructive actions require confirmation. I/O Log queryable.

### Phase 4: I/O Log View + Polish

**Goal:** Users can see what AI did and when.

1. Create I/O Log panel (or section within existing panel)
2. Query from `ai.tool_call` joined with `ai.message`
3. Link entries to affected entities (click tool call → focus relevant panel)
4. Add `notify` effect type for non-panel feedback (toast/notice)
5. Refine system prompt based on real usage patterns

**Validation:** User can review all AI actions, navigate to affected entities, understand what changed.

### Phase 5: SDK Migration (when ready)

**Goal:** Move from AI SDK v4 to v6.

1. Replace `maxTokens` → token budget config
2. Replace `maxSteps` → `stopWhen: stepCountIs(5)`
3. Replace `toDataStreamResponse` → v6 streaming API
4. Replace `message.content` string access → `message.parts` iteration
5. Move `_deskEffect` from annotations to tool result metadata
6. Update `ChatPanel` to read effects from `message.parts` instead of annotations

**Not in scope for this plan:** Multi-user permissions, action-stream tracking (Windsurf-style), editable spec pipelines (Copilot Workspace-style), markdown file detail table. These are future capabilities that the architecture accommodates but does not implement.

---

## Known Tradeoffs

| Decision | Tradeoff | Mitigation |
|----------|----------|------------|
| No unified bus for all AI actions | ChatPanel becomes the routing hub — it must know about both dock and bus | `dispatchDeskAction` is a pure function that can be tested in isolation |
| Derived I/O Log (no separate table) | Join query instead of simple table scan | Index on `tool_call.message_id` makes this fast; at our scale (<10K tool calls), this is a non-issue |
| Simple capability flags vs full RBAC | No role-based restrictions | Expandable when multi-user arrives; current auth check is authenticated-or-not |
| v4 annotations for bridge | Will need migration when SDK upgrades | `DeskEffect` type is transport-agnostic; only the emission and consumption points change |
| `meta` as `Record<string, unknown>` | No type safety on panel metadata | Specific panel types can narrow this via `as` in their mount logic; keeps PanelDefinition generic |

---

## Guidance for Extension

**Adding a new tool:**
1. Define in `tools/desk-tools.ts` with schema, execute function, capability, and actionClass
2. Add effect mapping in `tools/effects.ts`
3. Add handling in `dispatch-action.ts` if the effect type is new
4. Add DeskBus channel if the tool delivers content to a new panel type

**Adding a new panel type that AI can create:**
1. Add to `DESK_PANEL_TYPES` and `DESK_PANELS` in `desk-panels.ts`
2. Add detail table in `desk` schema if the panel type has persistent data
3. Extend `fileTypeEnum` if the panel type is file-backed
4. Add panel component with `meta` reading on mount
5. No changes needed to the dispatch/bridge layer

**Adding a new effect type:**
1. Add variant to `DeskEffect` union type
2. Handle in `dispatchDeskAction`
3. Derive in `deriveEffects` from the relevant tool results
