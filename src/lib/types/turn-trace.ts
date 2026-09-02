/**
 * Turn trace — the ONE viewer-input contract for the AI-surface showcase pages.
 *
 * Both trace sources reduce into this shape: a recorded fixture
 * (`$lib/showcases/ai/fixtures/`) and a live turn observed from the Vely singleton
 * (`chatbotSession.chat` message metadata). One state type, one pure reducer
 * (`$lib/showcases/ai/replay.ts`), two thin adapters — so the fixture player and the
 * live x-ray can never render through divergent code paths.
 *
 * Deliberately text-free where it matters: there is NO field anywhere in this
 * contract that can carry a system-prompt body — prompt structure travels as block
 * ids + token estimates only (`PromptOutline`). Structural impossibility beats
 * review discipline (same principle as `$lib/types/ai-tools.ts`).
 */

import type { AiSurface } from '$lib/types/db-enums';
import type { RetrievalStepStatus, RetrievalTraceStep } from './retrieval-trace';

/**
 * Per-turn runtime status vocabulary — `RetrievalStepStatus` plus `not-taken`.
 *
 * `skipped` means the ENGINE declined (e.g. relevance gate); `not-taken` means a
 * HUMAN declined — the un-chosen arm of the approval branch. Rendering a rejected
 * approval arm as `skipped` would claim the system decided, which inverts the
 * deskbot page's central claim. Orthogonal to the BUILD axis
 * (`live | dormant | planned` on the static topology): a dormant layer simply never
 * leaves `pending`.
 */
export type TraceStatus = RetrievalStepStatus | 'not-taken';

/**
 * Spine layer identifiers — the bands of the `SurfaceFlow` stack, in request order.
 * The static topology (`$lib/showcases/ai/topology.ts`) keys off these; registration
 * maps (`STEP_LAYER`, `TOOL_LAYER`) let a firing trace light the layer it belongs to.
 */
export type AiLayerId =
	| 'client'
	| 'route'
	| 'guard'
	| 'orchestrator'
	| 'compaction'
	| 'prompt'
	| 'retrieval'
	| 'harness'
	| 'gate'
	| 'stream'
	| 'persist';

/** The four `guardAiRequest()` stages, in execution order. */
export type GuardStageId = 'auth' | 'configured' | 'rate-limit' | 'budget';

/**
 * Per-turn state of one guard stage. The guard is pre-stream and emits nothing on
 * success — the absence of an error IS the pass signal, so a live trace derives
 * these purely from the HTTP outcome (status + `error.code`).
 */
export interface GuardStageState {
	id: GuardStageId;
	status: TraceStatus;
	/** Set only on the stage that rejected the request. */
	httpStatus?: number;
	code?: string;
}

/** Outcome of one tool call inside a harness step — names and statuses only, never args. */
export interface HarnessToolOutcome {
	tool: string;
	status: 'ok' | 'error' | 'requires_approval';
}

/** One step of the agent loop (`stopWhen: stepCountIs(...)`). */
export interface HarnessStepState {
	stepIndex: number;
	outcomes: HarnessToolOutcome[];
	startOffsetMs?: number;
	durationMs?: number;
}

/**
 * Closed union of system-prompt block identifiers, in emission order. Pinned to the
 * real assemblers (`ai/config.ts`, `context/system-prompt.ts`, the orchestrator's
 * inline `<project-overview>`/`<catalog-map>` injection) by a text-scan drift test.
 */
export type PromptBlockId =
	| 'role'
	| 'completion'
	| 'planning'
	| 'permissions'
	| 'workspace'
	| 'desk-context'
	| 'desk-layout'
	| 'project-overview'
	| 'current-page'
	| 'catalog-map';

/** One block of the prompt tape — identity, size estimate, and its gating predicate. */
export interface PromptBlockOutline {
	id: PromptBlockId;
	/** chars/4 estimate, never a provider count (mirrors `RetrievalPromptEvent.estimated`). */
	tokensEst?: number;
	/** Name of the predicate that gates a conditional block (e.g. `requirePlan`). */
	conditional?: string;
}

/** Prompt structure without prompt text — block list + counts. No body field exists. */
export interface PromptOutline {
	blocks: PromptBlockOutline[];
	totalTokensEst?: number;
	estimated: true;
}

/**
 * One proposed step as the PlanCard renders it — the canonical client-side shape, read by
 * `composites/chatbot/harness-types.ts` too. The server's `ProposedStep` carries an extra
 * `args` object for the approve-route replay; it never crosses to the client.
 */
export interface ProposalCardStep {
	action: string;
	tool: string;
	risk: 'read' | 'create' | 'write' | 'destructive';
	rationale: string;
}

/**
 * PlanCard payload — structurally assignable to `ProposalMetadata`
 * (`composites/chatbot/harness-types.ts`), so the showcase renders the REAL
 * `PlanCard.svelte` from fixture data. In fixtures every value is authored fiction
 * (`demo_` ids, synthetic file names); the live wire never carries desk args at all.
 */
export interface ProposalCardData {
	id: string;
	goal: string;
	steps: ProposalCardStep[];
	estimatedWrites: number;
	rollback: string;
	riskTier: 'low' | 'medium' | 'high';
	status: 'pending' | 'approved' | 'executed' | 'rejected' | 'failed' | 'expired';
}

/** The approval slice of a deskbot turn — the one-door rule as playback state. */
export interface ProposalRunState {
	card: ProposalCardData;
	/** Which branch the visitor took at the halt; unset while awaiting the decision. */
	decision?: 'approved' | 'rejected';
}

/** Terminal result of the turn as observed from the wire. */
export interface TurnOutcome {
	kind: 'ok' | 'guard_rejected' | 'stream_error' | 'awaiting_decision';
	httpStatus?: number;
	code?: string;
}

/** The reduced state of one turn — everything the viewer renders. */
export interface TurnTrace {
	surface: AiSurface;
	/** Provenance is data, never inferred — drives the mandatory provenance strip. */
	source: 'recorded' | 'live';
	/** Fixed length 4, `guardAiRequest()` order. */
	guard: readonly GuardStageState[];
	/** Spine band statuses, derived via the registration maps. */
	layers: Readonly<Partial<Record<AiLayerId, TraceStatus>>>;
	/** Retrieval pipeline steps (chatbot profile) — same shape the rag observability used. */
	steps: readonly RetrievalTraceStep[];
	/** Agent-loop steps (deskbot profile). */
	harness: readonly HarnessStepState[];
	prompt: PromptOutline | null;
	proposal: ProposalRunState | null;
	/** Coalesced assistant text (seek-safe: concatenation of all deltas ≤ cursor). */
	answerText: string;
	outcome: TurnOutcome | null;
}
