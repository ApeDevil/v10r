/**
 * Replay engine — frame contract + the ONE pure reducer both trace sources share.
 *
 * A recorded fixture is an array of `TurnFrame`s; a live turn adapts the Vely
 * singleton's message metadata into the same frames. `reduceTurn` is total and pure:
 * `state(n) === reduceTurn(replay, n, decision)` for every n — the player holds only
 * a cursor. Seeking is rebuild-from-seed (the `applyAnnotations` REPLACE precedent in
 * the old nrag trace), never incremental mutation, so step-back/Home/End are safe and
 * two properties are testable: idempotence and monotone-prefix.
 *
 * Frame `meta` fields carry the FULL accumulated value each time (REPLACE, never
 * merge) — the same semantics the orchestrator uses for `message-metadata`.
 */

import type { AiSurfaceId } from '$lib/types/ai-tools';
import {
	type NragTraceStep,
	PHASE_OF,
	PIPELINE_REGISTRY,
	type PipelineStepEvent,
	type PipelineStepId,
} from '$lib/types/pipeline';
import type {
	AiLayerId,
	GuardStageState,
	HarnessStepState,
	PromptOutline,
	ProposalCardData,
	TraceStatus,
	TurnOutcome,
	TurnTrace,
} from '$lib/types/turn-trace';
import { GUARD_STAGES, STEP_LAYER } from './topology';

/**
 * A recorded pipeline step event — `PipelineStepEvent` minus the fields a fixture
 * must never carry (`requestId` correlates real requests; nothing else is sensitive).
 */
export type RecordedStepEvent = Omit<PipelineStepEvent, 'requestId'>;

/** One frame of a recorded (or adapted-live) turn. */
export type TurnFrame =
	/** Guard outcome — the HTTP response line. Non-2xx terminates the turn. */
	| { kind: 'http'; status: number; code?: string }
	/** Metadata flush — every field REPLACES the previous value wholesale (never merges). */
	| {
			kind: 'meta';
			pipeline?: readonly RecordedStepEvent[];
			harnessSteps?: readonly HarnessStepState[];
			proposal?: ProposalCardData;
			promptOutline?: PromptOutline;
	  }
	/** Assistant text delta — coalesced on seek (no replayed typing animation). */
	| { kind: 'text'; text: string }
	/** Stream closed cleanly — persist/charge ran. */
	| { kind: 'finish' };

/** A committed recorded turn. Everything in it is authored fiction — see the leak test. */
export interface SurfaceReplay {
	version: 1;
	surface: AiSurfaceId;
	/** Rendered verbatim in the provenance strip — provenance is data, never inferred. */
	provenance: { recordedAt: string; workspace: string };
	/** The synthetic user prompt this turn answers. */
	prompt: string;
	frames: readonly TurnFrame[];
	/**
	 * Optional human-decision halt: playback stops after `frames` and resumes down
	 * `branches[decision]` once the visitor chooses. One fixture, one shared prefix
	 * by construction, one-dimensional seek math.
	 */
	halt?: {
		decision: 'proposal';
		branches: Record<'approved' | 'rejected', readonly TurnFrame[]>;
	};
}

export type HaltDecision = 'approved' | 'rejected';

/** The effective frame sequence for a chosen branch (prefix + branch, one array). */
export function replayTimeline(replay: SurfaceReplay, decision?: HaltDecision): readonly TurnFrame[] {
	if (!replay.halt || !decision) return replay.frames;
	return [...replay.frames, ...replay.halt.branches[decision]];
}

/** Seed the chatbot retrieval steps exactly as the live trace does (llmwiki profile). */
function seedSteps(surface: AiSurfaceId): NragTraceStep[] {
	if (surface !== 'chatbot') return [];
	return PIPELINE_REGISTRY.filter((d) => !d.dynamic && (d.path === 'llmwiki' || d.path === 'both')).map((d) => ({
		id: d.id,
		instanceKey: d.id,
		label: d.label,
		phase: d.phase,
		lane: d.lane,
		path: d.path,
		status: 'pending',
	}));
}

/** Fold one step event into the step list (REPLACE by instanceKey; append dynamics). */
function applyStepEvent(steps: NragTraceStep[], event: RecordedStepEvent): void {
	const key = event.instanceKey ?? event.step;
	const existing = steps.find((s) => s.instanceKey === key);
	if (existing) {
		existing.status = event.status;
		if (event.startOffsetMs !== undefined) existing.startOffsetMs = event.startOffsetMs;
		if (event.durationMs !== undefined) existing.durationMs = event.durationMs;
		if (event.error !== undefined) existing.error = event.error;
		if (event.detail !== undefined) existing.detail = event.detail;
		return;
	}
	const registry = PIPELINE_REGISTRY.find((d) => d.id === event.step);
	steps.push({
		id: event.step,
		instanceKey: key,
		label: registry?.label ?? event.step,
		phase: event.phase ?? PHASE_OF[event.step],
		lane: event.lane ?? registry?.lane,
		path: registry?.path ?? 'llmwiki',
		status: event.status,
		startOffsetMs: event.startOffsetMs,
		durationMs: event.durationMs,
		error: event.error,
		detail: event.detail,
	});
}

/** Derive spine band statuses from the reduced parts — one place, both sources. */
function deriveLayers(input: {
	surface: AiSurfaceId;
	sawAnyFrame: boolean;
	guardRejected: boolean;
	sawMeta: boolean;
	sawText: boolean;
	finished: boolean;
	steps: readonly NragTraceStep[];
	harness: readonly HarnessStepState[];
	prompt: PromptOutline | null;
	proposal: ProposalCardData | null;
	decision?: HaltDecision;
}): Partial<Record<AiLayerId, TraceStatus>> {
	const layers: Partial<Record<AiLayerId, TraceStatus>> = {};
	if (!input.sawAnyFrame) return layers;

	layers.client = 'done';
	layers.route = 'done';
	layers.guard = input.guardRejected ? 'error' : 'done';
	if (input.guardRejected) return layers;

	const started = input.sawMeta || input.sawText;
	layers.orchestrator = started ? 'done' : 'active';
	if (!started) return layers;
	layers.compaction = 'done';

	// Steps light their registered band; a band with active steps is active.
	for (const step of input.steps) {
		if (step.status === 'pending') continue;
		const layer = STEP_LAYER[step.id as PipelineStepId];
		const current = layers[layer];
		if (step.status === 'active' || current === 'active') layers[layer] = 'active';
		else if (current !== 'error') layers[layer] = step.status === 'error' ? 'error' : 'done';
	}
	if (input.prompt) layers.prompt = 'done';
	if (input.harness.length > 0) {
		layers.harness = input.finished || input.proposal ? 'done' : 'active';
	}
	if (input.proposal) {
		layers.gate = input.decision ? 'done' : 'active';
	}
	layers.stream = input.finished ? 'done' : input.sawText ? 'active' : (layers.stream ?? 'pending');
	if (input.finished) layers.persist = 'done';
	return layers;
}

/**
 * Adapt a LIVE turn (the Vely singleton's `message.metadata.pipeline` array) into the
 * same reducer the fixtures use — one viewer, two sources, zero divergent renderers.
 * Only `pipeline:step` events light the spine; other event kinds are ignored here.
 */
export function liveTurnTrace(pipeline: readonly { type: string }[]): TurnTrace {
	const stepEvents = pipeline.filter((e): e is RecordedStepEvent => e.type === 'pipeline:step');
	const replay: SurfaceReplay = {
		version: 1,
		surface: 'chatbot',
		provenance: { recordedAt: '', workspace: 'live' },
		prompt: '',
		frames: [
			{ kind: 'http', status: 200 },
			{ kind: 'meta', pipeline: stepEvents },
		],
	};
	return { ...reduceTurn(replay, replay.frames.length), source: 'live' };
}

/**
 * The reducer. Total and pure — clamps `upTo` to the timeline, never throws on a
 * well-typed replay. `upTo` counts frames consumed (0 = nothing yet).
 */
export function reduceTurn(replay: SurfaceReplay, upTo: number, decision?: HaltDecision): TurnTrace {
	const timeline = replayTimeline(replay, decision);
	const cursor = Math.max(0, Math.min(upTo, timeline.length));
	const consumed = timeline.slice(0, cursor);

	const steps = seedSteps(replay.surface);
	let guardRejection: { status: number; code?: string } | null = null;
	let harness: readonly HarnessStepState[] = [];
	let proposal: ProposalCardData | null = null;
	let prompt: PromptOutline | null = null;
	let answerText = '';
	let finished = false;
	let sawMeta = false;
	let sawText = false;

	for (const frame of consumed) {
		switch (frame.kind) {
			case 'http':
				if (frame.status >= 400) guardRejection = { status: frame.status, code: frame.code };
				break;
			case 'meta':
				sawMeta = true;
				if (frame.pipeline) {
					// REPLACE semantics: rebuild step state from the full array every time.
					steps.length = 0;
					steps.push(...seedSteps(replay.surface));
					for (const event of frame.pipeline) applyStepEvent(steps, event);
				}
				if (frame.harnessSteps) harness = frame.harnessSteps;
				if (frame.proposal) proposal = frame.proposal;
				if (frame.promptOutline) prompt = frame.promptOutline;
				break;
			case 'text':
				sawText = true;
				answerText += frame.text;
				break;
			case 'finish':
				finished = true;
				break;
		}
	}

	// Guard chain: derived from the HTTP outcome — absence of an error IS the pass signal.
	const rejectedIndex = guardRejection
		? GUARD_STAGES.findIndex(
				(s) => s.httpStatus === guardRejection.status && (!guardRejection.code || s.code === guardRejection.code),
			)
		: -1;
	const guard: GuardStageState[] = GUARD_STAGES.map((stage, i) => {
		if (!consumed.length) return { id: stage.id, status: 'pending' };
		if (rejectedIndex === -1) return { id: stage.id, status: 'done' };
		if (i < rejectedIndex) return { id: stage.id, status: 'done' };
		if (i === rejectedIndex) {
			return { id: stage.id, status: 'error', httpStatus: guardRejection?.status, code: guardRejection?.code };
		}
		return { id: stage.id, status: 'pending' };
	});

	// Halted: cursor sits at the end of the shared prefix with an unanswered halt.
	const awaitingDecision = !!replay.halt && !decision && cursor >= replay.frames.length && !finished;

	const outcome: TurnOutcome | null = guardRejection
		? { kind: 'guard_rejected', httpStatus: guardRejection.status, code: guardRejection.code }
		: awaitingDecision
			? { kind: 'awaiting_decision' }
			: finished
				? { kind: 'ok' }
				: null;

	// The card reflects the visitor's decision even before the branch frames restate it.
	const cardWithDecision =
		proposal && decision && proposal.status === 'pending' ? { ...proposal, status: decision } : proposal;

	return {
		surface: replay.surface,
		source: 'recorded',
		guard,
		layers: deriveLayers({
			surface: replay.surface,
			sawAnyFrame: consumed.length > 0,
			guardRejected: !!guardRejection,
			sawMeta,
			sawText,
			finished,
			steps,
			harness,
			prompt,
			proposal,
			decision,
		}),
		steps,
		harness,
		prompt,
		proposal: cardWithDecision ? { card: cardWithDecision, decision } : null,
		answerText,
		outcome,
	};
}
