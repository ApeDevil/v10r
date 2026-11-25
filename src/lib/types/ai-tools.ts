/**
 * AI tool manifest — the client-safe contract for the two AI surfaces' tool harnesses.
 *
 * Pure data + types, type-only imports. Safe for the client bundle BY CONSTRUCTION: the
 * manifest carries name/surface/risk/scope/capability only — no model-facing `description`
 * strings, no input schemas, no prompt text. The server tool factories
 * (`#lib/server/ai/tools//index.ts`) derive their meta maps from this list; the public
 * showcase topology (`#lib/showcases/ai/`) projects from it too; the capability that
 * mounts each tool (`#lib/server/ai/capabilities/`) is pinned to it by a drift test.
 * One source, no drift.
 *
 * Follows the `#lib/types/retrieval-trace.ts` precedent: a contract module the server emits
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
 * NOT a mutating scope and never triggers the plan gate. `desk:arrange` grants the client
 * actions that rearrange the workspace (open, focus, close a panel): it changes what is shown,
 * never a file, so it is not a mutating scope either.
 */
export const DESK_TOOL_SCOPES = [
	'desk:read',
	'desk:write',
	'desk:create',
	'desk:delete',
	'desk:ask',
	'desk:arrange',
] as const;

export type DeskToolScope = (typeof DESK_TOOL_SCOPES)[number];

/**
 * Risk classification for a tool (surface-neutral). Drives UI gating (plan card vs.
 * confirm card vs. auto), governor audit priority, and the `shouldRequirePlan` predicate.
 *
 * - `read` — no side effects; always auto-approved
 * - `view` — changes what the interface shows (which panels are open, which is in front),
 *   never stored data; the user undoes it with one gesture, so it is auto-approved
 * - `create` — new entity; reversible via soft delete, auto-approved with notification
 * - `write` — mutates an existing entity; confirm card when target is user-originated
 * - `destructive` — delete or unrecoverable mutation; always explicit confirm
 */
export type ToolRisk = 'read' | 'view' | 'create' | 'write' | 'destructive';

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
 * Where the content of a tool's result comes from. `system` — a corpus v10r owns (the catalog,
 * the project docs, the pattern registry). `user` — anything a user wrote or ingested, file
 * names included: it may carry text shaped like instructions, so it reaches the model wrapped
 * in `<untrusted-content>` (`#lib/server/ai/untrusted-content.ts`).
 */
export type ToolResultOrigin = 'system' | 'user';

/**
 * Whether a tool can move data out of the deployment — a fetch, an email, a message, a
 * webhook. `external` is the exfiltration leg of the lethal trifecta: such a tool must be
 * approval-gated (`untrusted-content.gate.test.ts`). The one `external` tool is
 * `delegate_architecture_review` (A2A delegation, behind the external-operations approval).
 */
export type ToolReach = 'internal' | 'external';

/**
 * Where a tool's execution happens — independent of what it changes (`risk`) and of who may
 * use it (`scope`). `server` — the tool's `execute` runs in the agent loop, inside the
 * request. `client` — the tool has no server `execute`: the call streams to the browser that
 * sent the turn, a registered handler runs it against live interface state, and the result
 * comes back with the next request (a client action, `#lib/client-actions/contract.ts`).
 *
 * Location is not risk: a server read is harmless and a client action could be
 * consequential, which is why the manifest states both and `client-actions.gate.test.ts`
 * holds the combination that is forbidden — a client-executed tool that changes stored data.
 */
export type ToolExecutor = 'server' | 'client';

/**
 * One entry in the declarative tool registry (`TOOL_MANIFEST` below) — the single source
 * of truth for a tool's surface + risk + executor + owning capability (+ gating scope for
 * deskbot). Together the fields are the agent action contract: what a tool changes (`risk`),
 * where it runs (`executor`), who may use it (`scope`), whose content its result carries
 * (`resultOrigin`) and whether it can move data out (`reach`).
 * The derived meta maps (`chatbotToolMeta`/`deskbotToolMeta`/`allToolMeta` in
 * `#lib/server/ai/tools//index.ts`) are projected from this, so they can't drift from the manifest.
 * Chatbot tools carry no scope; deskbot tools always do — enforced by this discriminated
 * union.
 */
export type ToolDescriptor =
	| {
			name: string;
			surface: 'chatbot';
			risk: ToolRisk;
			executor: ToolExecutor;
			capability: CapabilityId;
			resultOrigin: ToolResultOrigin;
			reach: ToolReach;
	  }
	| {
			name: string;
			surface: 'deskbot';
			risk: ToolRisk;
			executor: ToolExecutor;
			scope: DeskToolScope;
			capability: CapabilityId;
			resultOrigin: ToolResultOrigin;
			reach: ToolReach;
	  };

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
 * The tool *factories* stay in `#lib/server/ai/tools/*` and are mounted by the capability
 * each entry names (`#lib/server/ai/capabilities/*`) — their signatures are heterogeneous
 * (per-turn sinks for retrieval, scope + deskLayout for desk), so a uniform `factory` field
 * would force an awkward shape for no correctness gain. The capabilities are locked to this
 * manifest by the drift-guard test in `profile/profile.test.ts`, which asserts each
 * profile's emitted tool set matches the manifest names for its surface, capability by
 * capability. `resolve_ref` is intentionally absent — it is compaction infra (AI SDK
 * #9631), never surfaced as a metered/replayable tool.
 */
export const TOOL_MANIFEST: readonly ToolDescriptor[] = [
	// ── chatbot: read-only, grounded retrieval tools (no scope) ──
	{
		name: 'search_catalog',
		surface: 'chatbot',
		risk: 'read',
		executor: 'server',
		capability: 'catalog',
		resultOrigin: 'system',
		reach: 'internal',
	},
	{
		name: 'search_project_docs',
		surface: 'chatbot',
		risk: 'read',
		executor: 'server',
		capability: 'project-docs',
		resultOrigin: 'system',
		reach: 'internal',
	},
	{
		name: 'search_pattern_library',
		surface: 'chatbot',
		risk: 'read',
		executor: 'server',
		capability: 'pattern-library',
		resultOrigin: 'system',
		reach: 'internal',
	},
	// The one output tool: compiles a generative surface; changes nothing stored.
	{
		name: 'render_surface',
		surface: 'chatbot',
		risk: 'view',
		executor: 'server',
		capability: 'generative-ui',
		resultOrigin: 'system',
		reach: 'internal',
	},
	// ── deskbot: scope-gated UI-parity tools ──
	// The one catalogued external tool: delegates a review to an operator-listed A2A peer.
	// External reach makes it approval-gated (`write` risk: it creates a task on another
	// organisation's agent and discloses the model); the peer's answer is a claim, so its result
	// is `user` origin. Deskbot, because the deskbot owns the persisted approval door; mounted
	// under `desk:read`, the least scope a turn that may read what it sends needs.
	{
		name: 'delegate_architecture_review',
		surface: 'deskbot',
		risk: 'write',
		scope: 'desk:read',
		executor: 'server',
		capability: 'agent-delegation',
		resultOrigin: 'user',
		reach: 'external',
	},
	{
		name: 'desk_list_files',
		surface: 'deskbot',
		risk: 'read',
		executor: 'server',
		scope: 'desk:read',
		capability: 'desk-files',
		resultOrigin: 'user',
		reach: 'internal',
	},
	{
		name: 'desk_read_file',
		surface: 'deskbot',
		risk: 'read',
		executor: 'server',
		scope: 'desk:read',
		capability: 'desk-files',
		resultOrigin: 'user',
		reach: 'internal',
	},
	{
		name: 'desk_file_tree',
		surface: 'deskbot',
		risk: 'read',
		executor: 'server',
		scope: 'desk:read',
		capability: 'desk-files',
		resultOrigin: 'user',
		reach: 'internal',
	},
	{
		name: 'desk_search_files',
		surface: 'deskbot',
		risk: 'read',
		executor: 'server',
		scope: 'desk:read',
		capability: 'desk-files',
		resultOrigin: 'user',
		reach: 'internal',
	},
	{
		name: 'desk_get_open_panels',
		surface: 'deskbot',
		risk: 'read',
		executor: 'server',
		scope: 'desk:read',
		capability: 'desk-files',
		resultOrigin: 'user',
		reach: 'internal',
	},
	{
		name: 'desk_update_cells',
		surface: 'deskbot',
		risk: 'write',
		executor: 'server',
		scope: 'desk:write',
		capability: 'desk-edit',
		resultOrigin: 'user',
		reach: 'internal',
	},
	{
		name: 'desk_rename_file',
		surface: 'deskbot',
		risk: 'write',
		executor: 'server',
		scope: 'desk:write',
		capability: 'desk-edit',
		resultOrigin: 'user',
		reach: 'internal',
	},
	{
		name: 'desk_update_markdown',
		surface: 'deskbot',
		risk: 'write',
		executor: 'server',
		scope: 'desk:write',
		capability: 'desk-edit',
		resultOrigin: 'user',
		reach: 'internal',
	},
	{
		name: 'desk_edit_markdown',
		surface: 'deskbot',
		risk: 'write',
		executor: 'server',
		scope: 'desk:write',
		capability: 'desk-edit',
		resultOrigin: 'user',
		reach: 'internal',
	},
	{
		name: 'desk_create_spreadsheet',
		surface: 'deskbot',
		risk: 'create',
		executor: 'server',
		scope: 'desk:create',
		capability: 'desk-create',
		resultOrigin: 'user',
		reach: 'internal',
	},
	{
		name: 'desk_create_markdown',
		surface: 'deskbot',
		risk: 'create',
		executor: 'server',
		scope: 'desk:create',
		capability: 'desk-create',
		resultOrigin: 'user',
		reach: 'internal',
	},
	{
		name: 'desk_delete_file',
		surface: 'deskbot',
		risk: 'destructive',
		executor: 'server',
		scope: 'desk:delete',
		capability: 'desk-delete',
		resultOrigin: 'user',
		reach: 'internal',
	},
	{
		name: 'desk_search_knowledge',
		surface: 'deskbot',
		risk: 'read',
		executor: 'server',
		scope: 'desk:ask',
		capability: 'desk-ask',
		resultOrigin: 'user',
		reach: 'internal',
	},
	// desk_propose_plan is a read-risk primitive gated with the base read scope; its
	// capability mounts it whenever a mutating scope is granted.
	{
		name: 'desk_propose_plan',
		surface: 'deskbot',
		risk: 'read',
		executor: 'server',
		scope: 'desk:read',
		capability: 'desk-plan',
		resultOrigin: 'user',
		reach: 'internal',
	},
	// ── deskbot: client actions — executed in the user's browser, on the live workspace ──
	// `view` risk: they change what is shown, never what is stored. A client-executed tool may
	// not carry a `write`/`destructive` risk (`client-actions.gate.test.ts`): the approval gate
	// replays on the server, and a browser's word is not an approval.
	{
		name: 'desk_open_file',
		surface: 'deskbot',
		risk: 'view',
		executor: 'client',
		scope: 'desk:arrange',
		capability: 'desk-arrange',
		resultOrigin: 'user',
		reach: 'internal',
	},
	{
		name: 'desk_focus_panel',
		surface: 'deskbot',
		risk: 'view',
		executor: 'client',
		scope: 'desk:arrange',
		capability: 'desk-arrange',
		resultOrigin: 'user',
		reach: 'internal',
	},
	{
		name: 'desk_close_panel',
		surface: 'deskbot',
		risk: 'view',
		executor: 'client',
		scope: 'desk:arrange',
		capability: 'desk-arrange',
		resultOrigin: 'user',
		reach: 'internal',
	},
];
