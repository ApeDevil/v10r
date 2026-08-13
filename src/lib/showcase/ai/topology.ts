/**
 * AI-surface topology — the static, client-safe projection the two showcase pages
 * (`/showcases/ai/chatbot`, `/showcases/ai/deskbot`) render from.
 *
 * Conventions (per `$lib/showcase/mcp/registry-viz.ts`):
 * - Pure data + pure functions. No `$lib/server/*`, no `$env/*`, no Paraglide —
 *   human copy lives in `./labels.ts`; this module ships ids and refs only.
 * - Everything here is either mirrored from published sources (`TOOL_MANIFEST`,
 *   `PIPELINE_REGISTRY`) or hand-mirrored and PINNED by `topology.drift.test.ts`
 *   (proposal states/transitions, step budgets, guard stages, prompt blocks).
 *
 * AI_TOPOLOGY_VERSION is a drift signal for the tests and the page footer — NOT a
 * compat mechanism. Nothing may branch on it (no-backward-compat house rule).
 */

import { type AiSurfaceId, type DeskToolScope, TOOL_MANIFEST, type ToolRisk } from '$lib/types/ai-tools';
import type { PipelineStepId } from '$lib/types/pipeline';
import type { AiLayerId, GuardStageId, PromptBlockId } from '$lib/types/turn-trace';

export const AI_TOPOLOGY_VERSION = 1;

/** BUILD axis — mirrors the repo's wired-vs-scaffold honesty map (knowledge-base.md). */
export type AiBuildStatus = 'live' | 'dormant' | 'planned';

/** Structural discriminant — how a spine band is drawn. Facts about the code, not styling. */
export type AiLayerShape = 'single' | 'lanes' | 'branch' | 'loop';

/** One concurrent lane inside a `lanes`-shaped layer, with per-surface build status. */
export interface AiLane {
	id: string;
	statusBySurface: Partial<Record<AiSurfaceId, AiBuildStatus>>;
}

export interface AiLayer {
	id: AiLayerId;
	/** Total order per surface — concurrency is expressed via `lanes`, never via order ties. */
	order: number;
	surfaces: readonly AiSurfaceId[];
	status: AiBuildStatus;
	shape: AiLayerShape;
	lanes?: readonly AiLane[];
	/** Repo-relative "show me the code" entry point (shared across surfaces). */
	source: string;
	/** Per-surface source override where the surfaces diverge physically. */
	sourceBySurface?: Partial<Record<AiSurfaceId, string>>;
	/** In-app docs anchor. */
	doc?: string;
}

/** The spine, in request order. Shared bands carry both surfaces. */
export const AI_LAYERS: readonly AiLayer[] = [
	{
		id: 'client',
		order: 1,
		surfaces: ['chatbot', 'deskbot'],
		status: 'live',
		shape: 'single',
		source: 'src/lib/components/composites/chatbot/Chatbot.svelte',
		sourceBySurface: {
			chatbot: 'src/lib/components/composites/chatbot/Chatbot.svelte',
			deskbot: 'src/lib/components/chat/ChatPanel.svelte',
		},
		doc: '/docs/blueprint/ai/persistent-chatbot',
	},
	{
		id: 'route',
		order: 2,
		surfaces: ['chatbot', 'deskbot'],
		status: 'live',
		shape: 'single',
		source: 'src/routes/api/ai',
		sourceBySurface: {
			chatbot: 'src/routes/api/ai/chatbot/+server.ts',
			deskbot: 'src/routes/api/ai/deskbot/+server.ts',
		},
		doc: '/docs/blueprint/ai/surfaces',
	},
	{
		id: 'guard',
		order: 3,
		surfaces: ['chatbot', 'deskbot'],
		status: 'live',
		shape: 'single',
		source: 'src/lib/server/ai/guard.ts',
		doc: '/docs/blueprint/ai/surfaces',
	},
	{
		id: 'orchestrator',
		order: 4,
		surfaces: ['chatbot', 'deskbot'],
		status: 'live',
		shape: 'branch',
		source: 'src/lib/server/ai/chat-orchestrator.ts',
		doc: '/docs/blueprint/ai/surfaces',
	},
	{
		id: 'compaction',
		order: 5,
		surfaces: ['chatbot', 'deskbot'],
		status: 'live',
		shape: 'single',
		source: 'src/lib/server/ai/loop/compact.ts',
	},
	{
		id: 'prompt',
		order: 6,
		surfaces: ['chatbot', 'deskbot'],
		status: 'live',
		shape: 'single',
		source: 'src/lib/server/ai/context/system-prompt.ts',
		doc: '/docs/blueprint/ai/site-awareness',
	},
	{
		id: 'retrieval',
		order: 7,
		surfaces: ['chatbot', 'deskbot'],
		status: 'live',
		shape: 'lanes',
		lanes: [
			{ id: 'tier-1', statusBySurface: { chatbot: 'live', deskbot: 'live' } },
			{ id: 'tier-2', statusBySurface: { chatbot: 'dormant', deskbot: 'dormant' } },
			{ id: 'tier-3', statusBySurface: { chatbot: 'dormant' } },
		],
		source: 'src/lib/server/rawrag/index.ts',
		doc: '/docs/blueprint/ai/layered-rag',
	},
	{
		id: 'harness',
		order: 8,
		surfaces: ['chatbot', 'deskbot'],
		status: 'live',
		shape: 'loop',
		source: 'src/lib/server/ai/tools/index.ts',
		doc: '/docs/blueprint/ai/harness-lens',
	},
	{
		id: 'gate',
		order: 9,
		surfaces: ['chatbot', 'deskbot'],
		status: 'live',
		shape: 'branch',
		source: 'src/lib/server/ai/chat-orchestrator.ts',
		sourceBySurface: {
			chatbot: 'src/lib/server/ai/citations/drill.ts',
			deskbot: 'src/routes/api/ai/proposals/[id]/approve/+server.ts',
		},
		doc: '/docs/blueprint/ai/harness-lens',
	},
	{
		id: 'stream',
		order: 10,
		surfaces: ['chatbot', 'deskbot'],
		status: 'live',
		shape: 'loop',
		source: 'src/lib/server/ai/_shared/streaming-turn.ts',
	},
	{
		id: 'persist',
		order: 11,
		surfaces: ['chatbot', 'deskbot'],
		status: 'live',
		shape: 'single',
		source: 'src/lib/server/db/ai/mutations.ts',
	},
];

/** Edge semantics beyond plain top-to-bottom flow. Line-style encodes `kind`, never color. */
export type AiEdgeKind = 'main' | 'gated' | 'fallback' | 'replay' | 'abort' | 'async';

export interface AiFlowEdge {
	from: AiLayerId;
	to: AiLayerId;
	kind: AiEdgeKind;
	surfaces: readonly AiSurfaceId[];
	/** Predicate/label name rendered on the edge (verbatim code identifier). */
	label?: string;
}

/** The non-linear edges the spine must draw beyond band adjacency. */
export const AI_EXTRA_EDGES: readonly AiFlowEdge[] = [
	// Provider rotation — retry of the same logical edge with the next provider.
	{
		from: 'stream',
		to: 'stream',
		kind: 'fallback',
		surfaces: ['chatbot', 'deskbot'],
		label: 'markCooldown → next provider',
	},
	// Deskbot corpus freshness is reconciled OFF the hot path by a polling job.
	{ from: 'persist', to: 'retrieval', kind: 'async', surfaces: ['deskbot'], label: 'desk-rawrag-sync' },
	// The approval replay is a SEPARATE HTTP request — rendered as a second stack, not a back-edge.
	{ from: 'gate', to: 'harness', kind: 'replay', surfaces: ['deskbot'], label: 'POST /api/ai/proposals/[id]/approve' },
];

/** The four `guardAiRequest()` stages with their terminating failure contract. */
export interface GuardStageDescriptor {
	id: GuardStageId;
	/** Verbatim code identifier shown untranslated. */
	check: string;
	httpStatus: number;
	code: string;
}

/** Mirrored from `guard.ts` (order included) — pinned by the drift test. */
export const GUARD_STAGES: readonly GuardStageDescriptor[] = [
	{ id: 'auth', check: 'guardApiUser(locals)', httpStatus: 401, code: 'unauthorized' },
	{ id: 'configured', check: 'aiConfigured', httpStatus: 503, code: 'ai_unavailable' },
	{ id: 'rate-limit', check: 'ratelimit.limit(user.id)', httpStatus: 429, code: 'rate_limited' },
	{ id: 'budget', check: 'checkUserBudget(user.id)', httpStatus: 429, code: 'rate_limited' },
];

/** One band of the prompt tape. `conditional` names the gating predicate verbatim. */
export interface PromptBlockDescriptor {
	id: PromptBlockId;
	conditional?: string;
	/** True for blocks above the cache boundary (stable prefix, prompt-cache friendly). */
	cacheStable: boolean;
}

/**
 * Emission order per surface — mirrored from `buildSystemPrompt()` (`context/system-prompt.ts`),
 * the prompt constants (`ai/config.ts`), and the orchestrator's inline
 * `<project-overview>` / `<catalog-map>` / `<current-page>` injection. Pinned by text-scan.
 */
export const PROMPT_BLOCKS: Record<AiSurfaceId, readonly PromptBlockDescriptor[]> = {
	chatbot: [
		{ id: 'role', cacheStable: true },
		{ id: 'completion', cacheStable: true, conditional: 'hasTools' },
		{ id: 'project-overview', cacheStable: true },
		{ id: 'catalog-map', cacheStable: true },
		{ id: 'current-page', cacheStable: false, conditional: 'pageRouteId' },
	],
	deskbot: [
		{ id: 'role', cacheStable: true },
		{ id: 'completion', cacheStable: true, conditional: 'hasTools' },
		{ id: 'planning', cacheStable: true, conditional: 'shouldRequirePlan' },
		{ id: 'permissions', cacheStable: false },
		{ id: 'workspace', cacheStable: false, conditional: 'activeWorkspace' },
		{ id: 'desk-context', cacheStable: false, conditional: 'panelContext' },
		{ id: 'desk-layout', cacheStable: false, conditional: 'deskLayout' },
	],
};

/** Step budgets — mirrored literals, pinned to `ai/config.ts` by the drift test. */
export const STEP_BUDGETS = {
	chatbot: 3,
	deskRead: 3,
	deskMutate: 5,
} as const;

/** Public projection of one manifest entry — the `#tools` matrix row. */
export interface PublicToolCard {
	name: string;
	surface: AiSurfaceId;
	risk: ToolRisk;
	/** `null` encodes the invariant "chatbot tools carry no scope". */
	scope: DeskToolScope | null;
	mutating: boolean;
	/** The one-door rule, made visual: write/destructive never mutate in-loop. */
	requiresApproval: boolean;
	inLoop: boolean;
	layer: AiLayerId;
}

/** Project the manifest into matrix rows. Derived, never hand-copied. */
export function buildToolCards(): PublicToolCard[] {
	return TOOL_MANIFEST.map((d) => {
		const mutating = d.risk !== 'read';
		const requiresApproval = d.risk === 'write' || d.risk === 'destructive';
		return {
			name: d.name,
			surface: d.surface,
			risk: d.risk,
			scope: d.surface === 'deskbot' ? d.scope : null,
			mutating,
			requiresApproval,
			inLoop: !requiresApproval,
			layer: d.surface === 'chatbot' ? 'retrieval' : 'harness',
		};
	});
}

/** Set-glyph numbers for `#tools` — always derived from the manifest at render time. */
export function toolCounts(): { chatbot: number; deskbot: number; union: number; shared: number } {
	const chatbot = TOOL_MANIFEST.filter((d) => d.surface === 'chatbot').length;
	const deskbot = TOOL_MANIFEST.filter((d) => d.surface === 'deskbot').length;
	return { chatbot, deskbot, union: chatbot + deskbot, shared: 0 };
}

/**
 * Registration map: which spine band a firing pipeline step lights up.
 * Exhaustive Record — a new `PipelineStepId` is a compile error (the `PHASE_OF` technique).
 */
export const STEP_LAYER: Record<PipelineStepId, AiLayerId> = {
	embed: 'retrieval',
	'tier-1': 'retrieval',
	'tier-2': 'retrieval',
	'tier-3': 'retrieval',
	rank: 'retrieval',
	context: 'prompt',
	generate: 'stream',
	'llmwiki:overview': 'retrieval',
	'llmwiki:search': 'retrieval',
	'llmwiki:context': 'prompt',
	'rawrag:drill': 'retrieval',
	'llmwiki:verify': 'gate',
	'system-docs': 'retrieval',
};

/** Registration map: which spine band a tool call lights up. Pinned to the manifest by test. */
export const TOOL_LAYER: Record<string, AiLayerId> = Object.fromEntries(
	TOOL_MANIFEST.map((d) => [d.name, d.surface === 'chatbot' ? 'retrieval' : 'harness'] as const),
);

/** Proposal lifecycle states — mirrored from `proposalStatusEnum`, order included; pinned. */
export const PROPOSAL_STATES = [
	'pending',
	'approved',
	'rejected',
	'executing',
	'executed',
	'failed',
	'expired',
] as const;

export type ProposalState = (typeof PROPOSAL_STATES)[number];

/**
 * Proposal state machine edges `[from, to, trigger]` — mirrored from the approve route
 * (`api/ai/proposals/[id]/approve/+server.ts`) and `db/ai/proposals.ts`. Pinned by the
 * drift test (every state reachable; triggers are verbatim identifiers).
 */
export const PROPOSAL_TRANSITIONS: readonly (readonly [ProposalState, ProposalState, string])[] = [
	['pending', 'approved', 'approveProposal(id, userId)'],
	['pending', 'rejected', 'DELETE → rejectProposal(id)'],
	['pending', 'expired', 'markExpiredIfPending(id)'],
	['approved', 'executing', 'markExecuting(id)'],
	['executing', 'executed', 'markExecuted(id, result)'],
	['executing', 'failed', 'markFailed(id, message, partial)'],
];
