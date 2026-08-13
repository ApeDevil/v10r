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
import type { AiSurfaceId } from '$lib/types/ai-tools';
import type { ProbeGate, ProbeLane, ProbeLaneResult } from '$lib/types/context-probe';
import type { AiLayerId, GuardStageId, TraceStatus } from '$lib/types/turn-trace';
import type { AiBuildStatus } from './topology';

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
const ROLE_LINES_BY_SURFACE: Partial<Record<AiLayerId, Record<AiSurfaceId, LabelFn>>> = {
	client: { chatbot: m.showcase_ai_role_client_chatbot, deskbot: m.showcase_ai_role_client_deskbot },
	retrieval: { chatbot: m.showcase_ai_role_retrieval_chatbot, deskbot: m.showcase_ai_role_retrieval_deskbot },
	harness: { chatbot: m.showcase_ai_role_harness_chatbot, deskbot: m.showcase_ai_role_harness_deskbot },
	gate: { chatbot: m.showcase_ai_role_gate_chatbot, deskbot: m.showcase_ai_role_gate_deskbot },
};

/** Resolve the role line for a layer on a surface. */
export function layerRole(layer: AiLayerId, surface: AiSurfaceId): string {
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

/** Retrieval lane labels (tier names stay technical; the tier number is the identity). */
export const LANE_LABELS: Record<string, LabelFn> = {
	'tier-1': m.showcase_ai_nrag_lane_t1,
	'tier-2': m.showcase_ai_nrag_lane_t2,
	'tier-3': m.showcase_ai_nrag_lane_t3,
};

/** Context-probe gate names + one-line glosses. */
export const PROBE_GATE_LABELS: Record<ProbeGate['id'], { name: LabelFn; gloss: LabelFn }> = {
	ground_docs: { name: m.showcase_ai_probe_gate_ground, gloss: m.showcase_ai_probe_gate_ground_gloss },
	page_deixis: { name: m.showcase_ai_probe_gate_deixis, gloss: m.showcase_ai_probe_gate_deixis_gloss },
	require_plan: { name: m.showcase_ai_probe_gate_plan, gloss: m.showcase_ai_probe_gate_plan_gloss },
};

/** Context-probe lane display names (corpus, not tier). */
export const PROBE_LANE_LABELS: Record<ProbeLane, LabelFn> = {
	llmwiki: m.showcase_ai_probe_lane_llmwiki,
	docs: m.showcase_ai_probe_lane_docs,
	desk: m.showcase_ai_probe_lane_desk,
};

/** Why a lane didn't run — each reason is a different honesty claim. */
export const PROBE_SKIP_LABELS: Record<NonNullable<ProbeLaneResult['skippedReason']>, LabelFn> = {
	gated_off: m.showcase_ai_probe_skip_gated,
	scope_off: m.showcase_ai_probe_skip_scope,
	empty_corpus: m.showcase_ai_probe_skip_empty,
};
