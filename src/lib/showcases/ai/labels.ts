/**
 * Human copy for the AI-surface showcase — the i18n half of the topology.
 *
 * `topology.ts` ships ids and refs only (consumable from bare scripts); this module
 * maps those ids to Paraglide message functions, the `showcases/registry.ts` LabelFn
 * pattern. Code identifiers (`guardAiRequest`, tool names, block tags, HTTP codes)
 * are deliberately NOT translated — they render verbatim in all locales.
 */

import type { LabelFn } from '$lib/nav/types';
import * as m from '$lib/paraglide/messages';
import type { AiSurface } from '$lib/types/db-enums';
import type { ChunkLevel, PromptBlockId, TurnItemState, TurnOutcome } from '$lib/types/turn-trace';
import type { InspectorGroupId } from './inspector';
import {
	type AiBuildStatus,
	type AiLayerId,
	type GuardStageId,
	STEP_BUDGETS,
	type TraceStatus,
	toolCounts,
} from './topology';
import type { TurnGraphColumn, TurnGraphEdgeKind, TurnGraphNodeKind } from './turn-graph';

/** Display name per spine layer. */
export const LAYER_NAMES: Record<AiLayerId, LabelFn> = {
	client: m.showcase_ai_layer_client,
	route: m.showcase_ai_layer_route,
	guard: m.showcase_ai_layer_guard,
	orchestrator: m.showcase_ai_layer_orchestrator,
	compaction: m.showcase_ai_layer_compaction,
	prompt: m.showcase_ai_layer_prompt,
	retrieval: m.showcase_ai_layer_retrieval,
	harness: m.showcase_ai_layer_harness,
	gate: m.showcase_ai_layer_gate,
	stream: m.showcase_ai_layer_stream,
	persist: m.showcase_ai_layer_persist,
};

/** Surface-neutral role line per layer (what this layer does, one sentence). */
const ROLE_LINES: Partial<Record<AiLayerId, LabelFn>> = {
	route: m.showcase_ai_role_route,
	guard: m.showcase_ai_role_guard,
	orchestrator: m.showcase_ai_role_orchestrator,
	compaction: m.showcase_ai_role_compaction,
	prompt: m.showcase_ai_role_prompt,
	stream: m.showcase_ai_role_stream,
	persist: m.showcase_ai_role_persist,
};

/** Surface-specific role lines where the surfaces genuinely diverge. */
const ROLE_LINES_BY_SURFACE: Partial<Record<AiLayerId, Record<AiSurface, LabelFn>>> = {
	client: { chatbot: m.showcase_ai_role_client_chatbot, deskbot: m.showcase_ai_role_client_deskbot },
	retrieval: { chatbot: m.showcase_ai_role_retrieval_chatbot, deskbot: m.showcase_ai_role_retrieval_deskbot },
	// Counts come from the manifest and the config, never from prose.
	harness: {
		chatbot: () =>
			m.showcase_ai_role_harness_chatbot({ n: String(toolCounts().chatbot), steps: String(STEP_BUDGETS.chatbot) }),
		deskbot: m.showcase_ai_role_harness_deskbot,
	},
	gate: { chatbot: m.showcase_ai_role_gate_chatbot, deskbot: m.showcase_ai_role_gate_deskbot },
};

/** Resolve the role line for a layer on a surface. */
export function layerRole(layer: AiLayerId, surface: AiSurface): string {
	const bySurface = ROLE_LINES_BY_SURFACE[layer];
	if (bySurface) return bySurface[surface]();
	return ROLE_LINES[layer]?.() ?? '';
}

/** Guard stage display names + one-line glosses. */
export const GUARD_LABELS: Record<GuardStageId, { name: LabelFn; gloss: LabelFn }> = {
	auth: { name: m.showcase_ai_guard_auth, gloss: m.showcase_ai_guard_auth_gloss },
	configured: { name: m.showcase_ai_guard_configured, gloss: m.showcase_ai_guard_configured_gloss },
	'rate-limit': { name: m.showcase_ai_guard_ratelimit, gloss: m.showcase_ai_guard_ratelimit_gloss },
	budget: { name: m.showcase_ai_guard_budget, gloss: m.showcase_ai_guard_budget_gloss },
};

/** Turn-status legend text — pairs with the glyph, never replaces it. */
export const STATUS_LABELS: Record<TraceStatus, LabelFn> = {
	pending: m.showcase_ai_status_pending,
	active: m.showcase_ai_status_active,
	done: m.showcase_ai_status_done,
	skipped: m.showcase_ai_status_skipped,
	'not-taken': m.showcase_ai_status_nottaken,
	error: m.showcase_ai_status_error,
};

/** Build-lifecycle legend text (the wired-vs-scaffold honesty axis). */
export const BUILD_LABELS: Record<AiBuildStatus, LabelFn> = {
	live: m.showcase_ai_build_live,
	dormant: m.showcase_ai_build_dormant,
	planned: m.showcase_ai_build_planned,
};

/** Retrieval corpus labels (tier names stay technical; the tier number is the identity). */
export const LANE_LABELS: Record<string, LabelFn> = {
	'tier-1': m.showcase_ai_retrieval_retriever_t1,
	'tier-2': m.showcase_ai_retrieval_retriever_t2,
	'tier-3': m.showcase_ai_retrieval_retriever_t3,
};

/**
 * The turn inspector's groups — the five states in commitment order, plus the awareness the
 * turn ran under and, on the deskbot, the proposal it stopped on.
 */
export const GROUP_LABELS: Record<InspectorGroupId, LabelFn> = {
	available: m.showcase_ai_orch_group_available,
	awareness: m.showcase_ai_orch_group_awareness,
	considered: m.showcase_ai_orch_group_considered,
	prompt: m.showcase_ai_orch_group_prompt,
	calls: m.showcase_ai_orch_group_calls,
	proposal: m.showcase_ai_orch_group_proposal,
	cited: m.showcase_ai_orch_group_cited,
};

/** One sentence per group: what being in it claims, and what it does not. */
export const GROUP_GLOSSES: Record<InspectorGroupId, LabelFn> = {
	available: m.showcase_ai_orch_group_available_gloss,
	awareness: m.showcase_ai_orch_group_awareness_gloss,
	considered: m.showcase_ai_orch_group_considered_gloss,
	prompt: m.showcase_ai_orch_group_prompt_gloss,
	calls: m.showcase_ai_orch_group_calls_gloss,
	proposal: m.showcase_ai_orch_group_proposal_gloss,
	cited: m.showcase_ai_orch_group_cited_gloss,
};

/** The five item states (`TurnItemState`) as chips — text, never colour alone. */
export const STATE_LABELS: Record<TurnItemState, LabelFn> = {
	available: m.showcase_ai_orch_state_available,
	considered: m.showcase_ai_orch_state_considered,
	included: m.showcase_ai_orch_state_included,
	executed: m.showcase_ai_orch_state_executed,
	cited: m.showcase_ai_orch_state_cited,
};

export const OUTCOME_LABELS: Record<TurnOutcome, LabelFn> = {
	ok: m.showcase_ai_orch_outcome_ok,
	error: m.showcase_ai_orch_outcome_error,
	cancelled: m.showcase_ai_orch_outcome_cancelled,
	awaiting_decision: m.showcase_ai_orch_outcome_awaiting,
};

/**
 * How each prompt block shows on the page: its XML tag where it has one, else what the
 * block is. Identifiers, untranslated — the tape and the inspector share this one map.
 */
export const BLOCK_TAGS: Record<PromptBlockId, string> = {
	role: '<role> + <instructions>',
	'completion-guidance': '<completion>',
	'project-map-guidance': 'project-map guidance',
	'project-docs-guidance': 'project-docs guidance',
	'catalog-guidance': 'catalog guidance',
	'navigation-guidance': 'navigation guidance',
	'pattern-library-guidance': 'pattern-library guidance',
	'desk-awareness-guidance': 'desk-awareness guidance',
	'desk-files-guidance': 'desk-files guidance',
	'desk-edit-guidance': 'desk-edit guidance',
	'desk-create-guidance': 'desk-create guidance',
	'desk-ask-guidance': 'desk-ask guidance',
	'desk-plan-guidance': 'desk-plan guidance',
	'project-overview': '<project-overview>',
	'catalog-map': '<catalog-map>',
	permissions: '<permissions>',
	workspace: 'workspace sentence',
	'desk-context': '<desk-context>',
	'desk-layout': '<desk-layout>',
	'current-page': '<current-page>',
	'retrieval-context': '<retrieval-context>',
	'catalog-results': '<catalog-results>',
	planning: '<planning>',
	'page-abstention': 'page abstention note',
	'tool-degrade': 'tool-degrade NOTE',
};

/** The turn graph's three columns. */
export const COLUMN_LABELS: Record<TurnGraphColumn, LabelFn> = {
	sources: m.showcase_ai_graph_col_sources,
	context: m.showcase_ai_graph_col_context,
	tools: m.showcase_ai_graph_col_tools,
};

/** What kind of record a graph card is — the word before the record's own name. */
export const KIND_LABELS: Record<TurnGraphNodeKind, LabelFn> = {
	source: m.showcase_ai_graph_kind_source,
	document: m.showcase_ai_graph_kind_document,
	parent: m.showcase_ai_graph_kind_parent,
	item: m.showcase_ai_graph_kind_item,
	omitted: m.showcase_ai_graph_kind_omitted,
	prompt: m.showcase_ai_graph_kind_prompt,
	block: m.showcase_ai_graph_kind_block,
	boundary: m.showcase_ai_graph_kind_boundary,
	history: m.showcase_ai_graph_kind_history,
	call: m.showcase_ai_graph_kind_call,
	answer: m.showcase_ai_graph_kind_answer,
	proposal: m.showcase_ai_graph_kind_proposal,
	toolset: m.showcase_ai_graph_kind_toolset,
	tool: m.showcase_ai_graph_kind_tool,
};

/** The recorded relation an edge stands for, as a verb phrase between its two ends. */
export const EDGE_KIND_LABELS: Record<TurnGraphEdgeKind, LabelFn> = {
	containment: m.showcase_ai_graph_edge_containment,
	inclusion: m.showcase_ai_graph_edge_inclusion,
	request: m.showcase_ai_graph_edge_request,
	execution: m.showcase_ai_graph_edge_execution,
	result: m.showcase_ai_graph_edge_result,
	citation: m.showcase_ai_graph_edge_citation,
};

/** A chunk's rung in its document. */
export const LEVEL_LABELS: Record<ChunkLevel, LabelFn> = {
	section: m.showcase_ai_graph_level_section,
	paragraph: m.showcase_ai_graph_level_paragraph,
	sentence: m.showcase_ai_graph_level_sentence,
};
