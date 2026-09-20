/**
 * AI tool manifest — the client-safe contract for the two AI surfaces' tool harnesses.
 *
 * Pure data + types, type-only imports. Safe for the client bundle BY CONSTRUCTION: the
 * manifest carries name/surface/risk/scope/capability only — no model-facing `description`
 * strings, no input schemas, no prompt text. The server tool factories
 * (`$lib/server/ai/tools/`) derive their meta maps from this list; the public
 * showcase topology (`$lib/showcases/ai/`) projects from it too; the capability that
 * mounts each tool (`$lib/server/ai/capabilities/`) is pinned to it by a drift test.
 * One source, no drift.
 *
 * Follows the `$lib/types/retrieval-trace.ts` precedent: a contract module the server emits
 * against and the client renders from.
 */

import type { CapabilityId } from './assistant-profile';

/**
 * What a completed desk mutation asks the desk UI to do — carried inside an in-loop
 * tool's output and beside a replayed step's receipt. The desk dispatches it
 * (`components/desk/dispatch-desk-effect.ts`); the server derives it
 * (`server/ai/tools/desk-execute.ts` → `effectsForStep`).
 */
export type DeskEffect =
	| { type: 'desk:open_panel'; panelType: string; fileId: string; label: string }
	| { type: 'desk:refresh_file'; fileId: string }
	| { type: 'desk:refresh_explorer' }
	| { type: 'desk:tab_indicator'; fileId: string; panelType: string; variant: 'modified' | 'created' | 'deleted' };

/**
 * Tool permission scopes the desk client requests. Deskbot-only — the chatbot has no scopes.
 * `desk:ask` is a READ-ONLY grounding scope (deskbot retrieval over the user's own files); it is
 * NOT a mutating scope and never triggers the plan gate.
 */
export const DESK_TOOL_SCOPES = ['desk:read', 'desk:write', 'desk:create', 'desk:delete', 'desk:ask'] as const;

export type DeskToolScope = (typeof DESK_TOOL_SCOPES)[number];

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
 * of truth for a tool's surface + risk + owning capability (+ gating scope for deskbot).
 * The derived meta maps (`chatbotToolMeta`/`deskbotToolMeta`/`allToolMeta` in
 * `$lib/server/ai/tools/`) are projected from this, so they can't drift from the manifest.
 * Chatbot tools carry no scope; deskbot tools always do — enforced by this discriminated
 * union.
 */
export type ToolDescriptor =
	| { name: string; surface: 'chatbot'; risk: ToolRisk; capability: CapabilityId }
	| { name: string; surface: 'deskbot'; risk: ToolRisk; scope: DeskToolScope; capability: CapabilityId };

/**
 * The one human label of a tool — the status row's verb ("Searching the catalog") — is the
 * i18n message under this key, in every locale. Derived from the name so no second map can
 * drift; `tool-label.gate.test.ts` proves every key exists.
 */
export const toolLabelKey = (toolName: string) => `ai_tool_${toolName}`;

/**
 * The one declarative tool registry — the single source of truth for every tool's
 * surface, risk, and (for deskbot) gating scope. The server-side metadata maps are
 * DERIVED from this list, so a new tool can't drift out of sync with its meta: add one
 * entry here and the chatbot/deskbot/union maps pick it up automatically.
 *
 * The tool *factories* stay in `$lib/server/ai/tools/*` and are mounted by the capability
 * each entry names (`$lib/server/ai/capabilities/*`) — their signatures are heterogeneous
 * (per-turn sinks for retrieval, scope + deskLayout for desk), so a uniform `factory` field
 * would force an awkward shape for no correctness gain. The capabilities are locked to this
 * manifest by the drift-guard test in `profile/profile.test.ts`, which asserts each
 * profile's emitted tool set matches the manifest names for its surface, capability by
 * capability. `resolve_ref` is intentionally absent — it is compaction infra (AI SDK
 * #9631), never surfaced as a metered/replayable tool.
 */
export const TOOL_MANIFEST: readonly ToolDescriptor[] = [
	// ── chatbot: read-only, grounded retrieval tools (no scope) ──
	{ name: 'search_catalog', surface: 'chatbot', risk: 'read', capability: 'catalog' },
	{ name: 'search_project_docs', surface: 'chatbot', risk: 'read', capability: 'project-docs' },
	{ name: 'search_pattern_library', surface: 'chatbot', risk: 'read', capability: 'pattern-library' },
	// ── deskbot: scope-gated UI-parity tools ──
	{ name: 'desk_list_files', surface: 'deskbot', risk: 'read', scope: 'desk:read', capability: 'desk-files' },
	{ name: 'desk_read_file', surface: 'deskbot', risk: 'read', scope: 'desk:read', capability: 'desk-files' },
	{ name: 'desk_file_tree', surface: 'deskbot', risk: 'read', scope: 'desk:read', capability: 'desk-files' },
	{ name: 'desk_search_files', surface: 'deskbot', risk: 'read', scope: 'desk:read', capability: 'desk-files' },
	{ name: 'desk_get_open_panels', surface: 'deskbot', risk: 'read', scope: 'desk:read', capability: 'desk-files' },
	{ name: 'desk_update_cells', surface: 'deskbot', risk: 'write', scope: 'desk:write', capability: 'desk-edit' },
	{ name: 'desk_rename_file', surface: 'deskbot', risk: 'write', scope: 'desk:write', capability: 'desk-edit' },
	{ name: 'desk_update_markdown', surface: 'deskbot', risk: 'write', scope: 'desk:write', capability: 'desk-edit' },
	{ name: 'desk_edit_markdown', surface: 'deskbot', risk: 'write', scope: 'desk:write', capability: 'desk-edit' },
	{
		name: 'desk_create_spreadsheet',
		surface: 'deskbot',
		risk: 'create',
		scope: 'desk:create',
		capability: 'desk-create',
	},
	{ name: 'desk_create_markdown', surface: 'deskbot', risk: 'create', scope: 'desk:create', capability: 'desk-create' },
	{
		name: 'desk_delete_file',
		surface: 'deskbot',
		risk: 'destructive',
		scope: 'desk:delete',
		capability: 'desk-delete',
	},
	{ name: 'desk_search_knowledge', surface: 'deskbot', risk: 'read', scope: 'desk:ask', capability: 'desk-ask' },
	// desk_propose_plan is a read-risk primitive gated with the base read scope; its
	// capability mounts it whenever a mutating scope is granted.
	{ name: 'desk_propose_plan', surface: 'deskbot', risk: 'read', scope: 'desk:read', capability: 'desk-plan' },
];
