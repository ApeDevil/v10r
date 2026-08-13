/**
 * AI tool manifest — the client-safe contract for the two AI surfaces' tool harnesses.
 *
 * Pure data + types, ZERO imports. Safe for the client bundle BY CONSTRUCTION: the
 * manifest carries name/surface/risk/scope only — no model-facing `description`
 * strings, no input schemas, no prompt text. The server tool factories
 * (`$lib/server/ai/tools/`) derive their meta maps from this list; the public
 * showcase topology (`$lib/showcase/ai/`) projects from it too. One source, no drift.
 *
 * Follows the `$lib/types/pipeline.ts` precedent: a contract module the server emits
 * against and the client renders from.
 */

/** The two product AI surfaces — mirrors the orchestrator's `TurnSurface` discriminant. */
export type AiSurfaceId = 'chatbot' | 'deskbot';

/**
 * Tool permission scopes the desk client requests. Deskbot-only — the chatbot has no scopes.
 * `desk:ask` is a READ-ONLY grounding scope (deskbot nRAG over the user's own files); it is
 * NOT a mutating scope and never triggers the plan gate.
 */
export type DeskToolScope = 'desk:read' | 'desk:write' | 'desk:create' | 'desk:delete' | 'desk:ask';

/**
 * Risk classification for a tool (surface-neutral). Drives UI gating (plan card vs.
 * confirm card vs. auto), governor audit priority, and the `shouldRequirePlan` predicate.
 *
 * - `read` — no side effects; always auto-approved
 * - `create` — new entity; reversible via soft delete, auto-approved with notification
 * - `write` — mutates an existing entity; confirm card when target is user-originated
 * - `destructive` — delete or unrecoverable mutation; always explicit confirm
 */
export type ToolRisk = 'read' | 'create' | 'write' | 'destructive';

/**
 * Metadata for a tool with no scope gating — the chatbot's read-only retrieval tools.
 * Registered in parallel with the tool definition (AI SDK `tool()` has no metadata slot).
 */
export interface ToolMeta {
	risk: ToolRisk;
}

/** Metadata for a desk tool — risk plus the scope that gates it. Deskbot-only. */
export interface DeskToolMeta extends ToolMeta {
	scope: DeskToolScope;
}

/**
 * One entry in the declarative tool registry (`TOOL_MANIFEST` below) — the single source
 * of truth for a tool's surface + risk (+ gating scope for deskbot). The derived meta maps
 * (`chatbotToolMeta`/`deskbotToolMeta`/`allToolMeta` in `$lib/server/ai/tools/`) are
 * projected from this, so they can't drift from the manifest. Chatbot tools carry no
 * scope; deskbot tools always do — enforced by this discriminated union.
 */
export type ToolDescriptor =
	| { name: string; surface: 'chatbot'; risk: ToolRisk }
	| { name: string; surface: 'deskbot'; risk: ToolRisk; scope: DeskToolScope };

/**
 * The one declarative tool registry — the single source of truth for every tool's
 * surface, risk, and (for deskbot) gating scope. The server-side metadata maps are
 * DERIVED from this list, so a new tool can't drift out of sync with its meta: add one
 * entry here and the chatbot/deskbot/union maps pick it up automatically.
 *
 * The tool *factories* deliberately stay in `buildRetrievalTools` / `createDeskTools`
 * (`$lib/server/ai/tools/index.ts`) rather than living on each descriptor — their
 * signatures are heterogeneous (per-turn sinks for retrieval, scope-gated batch assembly
 * + deskLayout for desk), so a uniform `factory` field would force an awkward, riskier
 * shape for no correctness gain. Instead the builders are locked to this manifest by the
 * drift-guard test in `tools/index.test.ts`, which asserts each builder's emitted tool
 * set matches the manifest names for its surface. `resolve_ref` is intentionally absent —
 * it is compaction infra (AI SDK #9631), never surfaced as a metered/replayable tool.
 */
export const TOOL_MANIFEST: readonly ToolDescriptor[] = [
	// ── chatbot: read-only, grounded retrieval tools (no scope) ──
	{ name: 'get_llmwiki_pages', surface: 'chatbot', risk: 'read' },
	{ name: 'get_rawrag_chunks', surface: 'chatbot', risk: 'read' },
	{ name: 'search_catalog', surface: 'chatbot', risk: 'read' },
	{ name: 'search_project_docs', surface: 'chatbot', risk: 'read' },
	{ name: 'search_pattern_library', surface: 'chatbot', risk: 'read' },
	// ── deskbot: scope-gated UI-parity tools ──
	{ name: 'desk_list_files', surface: 'deskbot', risk: 'read', scope: 'desk:read' },
	{ name: 'desk_read_file', surface: 'deskbot', risk: 'read', scope: 'desk:read' },
	{ name: 'desk_file_tree', surface: 'deskbot', risk: 'read', scope: 'desk:read' },
	{ name: 'desk_search_files', surface: 'deskbot', risk: 'read', scope: 'desk:read' },
	{ name: 'desk_get_open_panels', surface: 'deskbot', risk: 'read', scope: 'desk:read' },
	{ name: 'desk_update_cells', surface: 'deskbot', risk: 'write', scope: 'desk:write' },
	{ name: 'desk_rename_file', surface: 'deskbot', risk: 'write', scope: 'desk:write' },
	{ name: 'desk_update_markdown', surface: 'deskbot', risk: 'write', scope: 'desk:write' },
	{ name: 'desk_create_spreadsheet', surface: 'deskbot', risk: 'create', scope: 'desk:create' },
	{ name: 'desk_create_markdown', surface: 'deskbot', risk: 'create', scope: 'desk:create' },
	{ name: 'desk_delete_file', surface: 'deskbot', risk: 'destructive', scope: 'desk:delete' },
	{ name: 'desk_search_knowledge', surface: 'deskbot', risk: 'read', scope: 'desk:ask' },
	// desk_propose_plan is a read-risk primitive gated with the base read scope; it is
	// mounted whenever a mutating scope is present (see createDeskTools).
	{ name: 'desk_propose_plan', surface: 'deskbot', risk: 'read', scope: 'desk:read' },
];
