/**
 * Assistant profile — the upper description of one AI surface's assistant, and the one
 * door that composes a turn from it.
 *
 * A profile is an **identity** (who the assistant is, the rules it always follows) plus the
 * **capabilities** it is composed from. A capability owns every fact about one thing the
 * assistant can do: its tools (description + schema live on the tool), the when-to-use
 * guidance, the rule that activates it on a turn, its grounding source, the detail it
 * injects on demand, the citations it can verify. The per-turn inputs — **awareness**
 * (the user's situation) and **grounding** (retrieved material) — stay distinct from both.
 *
 * `composeTurn` runs the profile against one turn: activations → grounding lanes in
 * parallel under one shared query embedding → the prompt, block by block in cache order
 * (identity → guidance → stable grounding ‖ awareness → dynamic grounding → guides) →
 * the tool set → the step budget. Everything it decides lands on the caller's
 * `TurnRecorder`, and `verify()` runs the capabilities' verifiers over the answer.
 */
import type { ToolSet } from 'ai';
import type { Locale } from '$lib/i18n';
import type { SearchResult } from '$lib/search/types';
import type { DeskCorpusState } from '$lib/server/db/retrieval/queries';
import { generateEmbedding, type RankedChunk } from '$lib/server/retrieval';
import type { PageContext } from '$lib/server/search';
import type { CapabilityId, GroundingSourceId } from '$lib/types/assistant-profile';
import type { AiSurface } from '$lib/types/db-enums';
import type {
	Activation,
	CitationRecord,
	GroundingSkipReason,
	GroundingSource,
	PromptBlock,
	PromptBlockId,
	PromptBlockSection,
	TurnAwareness,
} from '$lib/types/turn-trace';
import { type CompactionListener, wrapToolsWithCompaction } from '../capabilities/compaction';
import type { EmbeddingConnection } from '../connections';
import type { DeskLayoutEntry, DeskToolScope } from '../tools/_types';
import type { DocsSeed } from '../tools/search-docs';
import type { TurnRecorder } from '../trace/recorder';
import type { PanelContextEntry } from '../types';

/** Who the assistant is, and the rules it follows whatever the turn. */
export interface AssistantIdentity {
	name: string;
	/** The opening of the `<role>` block: who it is, what it is for, what it never does. */
	role: string;
	/** Always-on rules — its own, then the shared ones (`shared-rules.ts`). */
	rules: readonly string[];
}

/** What one turn brings to the profile: who asks, from where, with what granted. */
export interface TurnInput {
	userId: string;
	/** Text of the fresh user turn ('' on a desk turn that is not a fresh user message). */
	userMsgText: string;
	locale: Locale;
	authCeiling: 'admin' | 'user' | null;
	/** A tool-capable provider serves this turn and the profile mounts tools. */
	hasTools: boolean;
	/** The profile wanted tools, but every tool-capable provider is cooled. */
	toolsCooled: boolean;
	/** The request's already-opened embedding connection, so no turn re-reads the provider row. */
	embeddingConnection?: EmbeddingConnection;
	/** Chatbot: the trusted, server-resolved current page, or null. */
	pageContext: PageContext | null;
	/** Deskbot: the consent scopes the user switched on. */
	scopes: DeskToolScope[];
	/** Deskbot: whether the user's desk corpus can answer a search — read once per desk turn. */
	deskCorpus?: DeskCorpusState;
	panelContext?: PanelContextEntry[];
	deskLayout?: DeskLayoutEntry[];
	activeWorkspace?: { id: string; name: string };
	/** How the turn's tool results reach the recorder when a result is replaced by a ref. */
	onCompacted?: CompactionListener;
}

/** One block a capability contributes; `composeTurn` stamps the owner and sizes it. */
export interface BlockDraft {
	id: PromptBlockId;
	section: PromptBlockSection;
	text: string;
	stable: boolean;
}

/**
 * A catalog row a tool (or a lane) put in front of the model, with the source that produced
 * it and — for a tool — the call whose result carried it.
 */
export interface SurfacedCatalogRow {
	row: SearchResult;
	source: GroundingSourceId;
	toolCallId?: string;
}

/** A chunk of the user's own desk corpus `desk_search_knowledge` put in front of the model this turn. */
export interface SurfacedDeskChunk {
	chunk: RankedChunk;
	fileId: string | null;
	/** The live file changed after its retrieval copy was indexed. */
	stale: boolean;
	/** The tool call whose result carried it. */
	toolCallId?: string;
}

/** What a grounding lane established for the turn. */
export interface GroundingLane {
	/** Absent for a lane that contributes static blocks only (the catalog map). */
	source?: GroundingSource;
	blocks: BlockDraft[];
	/** A lane that knows better after running revises its capability's activation. */
	activation?: { active: boolean; reason?: string };
}

/** What a verifier found in the answer. */
export interface Verification {
	citations: CitationRecord[];
	/** Grounding sources to update — tool-surfaced rows folded in as included/cited items. */
	grounding?: GroundingSource[];
}

/**
 * The state one composition's capabilities share: the memoized query embedding, what the
 * lanes established, what the tools surfaced. A capability is a stateless declaration;
 * everything per turn lives here.
 */
export interface TurnState {
	/** The user message's embedding — one provider call per turn however many lanes ask. */
	queryEmbedding(): Promise<number[]>;
	activations: Map<CapabilityId, Activation>;
	grounding: Map<GroundingSourceId, GroundingSource>;
	/** The docs lane's retrieval, handed to `search_project_docs` so it never re-embeds the question. */
	docsSeed?: DocsSeed;
	/** Catalog rows put in front of the model this turn, by row id — chips and the path verifier read it. */
	surfacedCatalog: Map<string, SurfacedCatalogRow>;
	/** Desk chunks put in front of the model this turn, by chunk id, in the order they surfaced. */
	surfacedDesk: Map<string, SurfacedDeskChunk>;
	/** Tools mounted so far, in profile order. */
	tools: ToolSet;
	/** True once a grounding block with this id entered the prompt. */
	hasBlock(id: PromptBlockId): boolean;
}

export interface AssistantCapability {
	id: CapabilityId;
	/** The rule that activates it, in words. */
	when: string;
	/** Desk capabilities: the consent scope that grants it and how `<permissions>` names it. */
	scope?: { id: DeskToolScope; description: string };
	/** When-to-use guidance — one cache-stable block, present whenever the capability is active. */
	guidance?: string;
	/** The grounding sources it draws on. */
	sources?: GroundingSourceId[];
	activates(turn: TurnInput): { active: boolean; reason?: string };
	/** Retrieved material for the turn: candidates, what the prompt takes, the block text. */
	grounding?(turn: TurnInput, state: TurnState): Promise<GroundingLane>;
	/** What the assistant is told about the user's situation — asked of every capability, active or not. */
	awareness?(turn: TurnInput, state: TurnState): BlockDraft[];
	/** The tools it mounts; called only on a turn with tools. */
	tools?(turn: TurnInput, state: TurnState): ToolSet;
	/** On-demand detail, injected only when its rule fires — asked of every capability, active or not. */
	guide?(turn: TurnInput, state: TurnState): BlockDraft | null;
	/** Deterministic citation matching over the answer. */
	verify?(answer: string, turn: TurnInput, state: TurnState): Promise<Verification>;
}

export interface AssistantProfile {
	surface: AiSurface;
	identity: AssistantIdentity;
	/** In prompt order: `completion` first (its guidance follows the identity), `compaction` last. */
	capabilities: readonly AssistantCapability[];
	/** Whether a turn wants tools at all — decides whether a tool-capable provider is sought. */
	wantsTools(turn: Pick<TurnInput, 'scopes'>): boolean;
	stepBudget(turn: TurnInput): number;
	awareness(turn: TurnInput): TurnAwareness;
}

/** What `composeTurn` established: the prompt, the tools, the budget, and the trace facts behind them. */
export interface TurnComposition {
	systemPrompt: string;
	blocks: PromptBlock[];
	/** Compaction-wrapped, `resolve_ref` included; `{}` on a tool-less turn. */
	tools: ToolSet;
	stepBudget: number;
	activations: Activation[];
	grounding: GroundingSource[];
	/** Per-source failure messages — a lane can fail while the turn proceeds without it. */
	errors: Partial<Record<GroundingSourceId, string>>;
	/** The shared embed's own wait; each lane's settle time is on its grounding source. */
	embedMs?: number;
	state: TurnState;
	/** Run the capabilities' verifiers over the answer; each stage's ms by capability. */
	verify(answer: string): Promise<Verification & { stages: Partial<Record<CapabilityId, number>> }>;
}

/** Block order in the prompt — the cache order: static first, most volatile last. */
const SECTION_ORDER: Record<`${PromptBlockSection}:${'stable' | 'dynamic'}`, number> = {
	'identity:stable': 0,
	'identity:dynamic': 0,
	'guidance:stable': 1,
	'guidance:dynamic': 1,
	'grounding:stable': 2,
	'awareness:stable': 3,
	'awareness:dynamic': 3,
	'grounding:dynamic': 4,
	'guide:stable': 5,
	'guide:dynamic': 5,
};

/** The identity block: `<role>` then `<instructions>` — the one block every turn of a profile shares verbatim. */
export function identityBlock(identity: AssistantIdentity): string {
	return `<role>\n${identity.role}\n</role>\n\n<instructions>\n${identity.rules.map((r) => `- ${r}`).join('\n')}\n</instructions>`;
}

/** A lane's own outcome, written the moment it settles and read after the barrier. */
interface LaneSettled {
	ms: number;
	failed: boolean;
	error?: unknown;
}

/**
 * Stamp a lane's own settle time. The lanes join at one `Promise.allSettled` barrier;
 * measuring after the barrier charges the slowest lane's wait to every lane, which is how
 * a 10 s cold turn read as "everything was slow". The returned promise settles exactly
 * like the input (a rejection is re-thrown), so consumers chain on it.
 */
export function settle<T>(p: Promise<T>): { promise: Promise<T>; at: LaneSettled } {
	const at: LaneSettled = { ms: 0, failed: false };
	const started = performance.now();
	const promise = p.then(
		(value) => {
			at.ms = Math.round(performance.now() - started);
			return value;
		},
		(error: unknown) => {
			at.ms = Math.round(performance.now() - started);
			at.failed = true;
			at.error = error;
			throw error;
		},
	);
	return { promise, at };
}

export const describeError = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

/** An activation rule's reason as the skipped source records it; anything else is a gate. */
const skipReasonOf = (reason: string | undefined): GroundingSkipReason =>
	reason === 'scope_off' || reason === 'empty_corpus' || reason === 'indexing' ? reason : 'gated_off';

/** A fresh per-turn state; the manifest builds one with no embedding to mount the tools for their schemas. */
export function createTurnState(
	queryEmbedding: TurnState['queryEmbedding'] = () => Promise.reject(new Error('No query embedding on this turn')),
	hasBlock: TurnState['hasBlock'] = () => false,
): TurnState {
	return {
		queryEmbedding,
		activations: new Map(),
		grounding: new Map(),
		surfacedCatalog: new Map(),
		surfacedDesk: new Map(),
		tools: {},
		hasBlock,
	};
}

/**
 * A tool's side channel into the turn's surfaced catalog rows, attributed to the source that
 * produced them and, when a tool recorded them, to its call — the fact that later ties the
 * execution to the items it returned. A lane records without a call id.
 */
export function catalogSink(
	state: TurnState,
	source: GroundingSourceId,
): { record(rows: SearchResult[], toolCallId?: string): void } {
	return {
		record(rows, toolCallId) {
			for (const row of rows) {
				state.surfacedCatalog.set(row.id, { row, source, ...(toolCallId ? { toolCallId } : {}) });
			}
		},
	};
}

/** The desk search tool's side channel into the turn's surfaced desk chunks. */
export function deskSink(state: TurnState): { record(chunks: SurfacedDeskChunk[], toolCallId?: string): void } {
	return {
		record(chunks, toolCallId) {
			for (const surfaced of chunks) {
				state.surfacedDesk.set(surfaced.chunk.chunkId, toolCallId ? { ...surfaced, toolCallId } : surfaced);
			}
		},
	};
}

/**
 * Compose one turn from a profile. Never throws for a lane: a failed grounding lane
 * degrades to a prompt without that lane's context, reported per source.
 */
export async function composeTurn(
	profile: AssistantProfile,
	turn: TurnInput,
	recorder?: TurnRecorder,
): Promise<TurnComposition> {
	const t0 = performance.now();
	const offset = (at: number) => Math.round(at - t0);
	const errors: TurnComposition['errors'] = {};
	let embedMs: number | undefined;

	// Embed the user message at most ONCE per turn. Every lane that needs the vector shares
	// one promise, so the provider call fires once; if it rejects, every consumer rejects —
	// each lane reports the failure on its own source.
	let embedLane: ReturnType<typeof settle<number[]>> | undefined;
	const queryEmbedding = () => {
		if (!embedLane) {
			embedLane = settle(generateEmbedding(turn.userMsgText, { connection: turn.embeddingConnection }));
			embedLane.promise.then(
				() => {
					embedMs = embedLane?.at.ms;
					if (embedMs !== undefined) recorder?.timing({ embedMs });
				},
				() => {
					embedMs = embedLane?.at.ms;
				},
			);
		}
		return embedLane.promise;
	};

	const groundingBlocks = new Map<PromptBlockId, BlockDraft>();
	const state = createTurnState(queryEmbedding, (id) => groundingBlocks.has(id));
	const owner = new Map<PromptBlockId, CapabilityId>();

	recorder?.awareness(profile.awareness(turn));

	// 1. Activations — every capability's own rule.
	const record = (id: CapabilityId, verdict: { active: boolean; reason?: string }) => {
		const activation: Activation = verdict.reason === undefined ? { id, active: verdict.active } : { id, ...verdict };
		state.activations.set(id, activation);
		recorder?.activation(id, activation.active, activation.reason);
	};
	for (const capability of profile.capabilities) record(capability.id, capability.activates(turn));
	const isActive = (id: CapabilityId) => state.activations.get(id)?.active === true;

	// 2. Grounding lanes, in parallel. Each source is recorded the moment its lane settles,
	// with the lane's own clock; the barrier only orders the assembly. A source whose
	// capability did not activate is recorded as skipped, with the rule's reason.
	const recordSource = (source: GroundingSource) => {
		if (source.error) errors[source.id] = source.error;
		state.grounding.set(source.id, source);
		recorder?.grounding(source);
	};
	for (const capability of profile.capabilities) {
		if (!capability.sources || isActive(capability.id)) continue;
		const reason = state.activations.get(capability.id)?.reason;
		for (const id of capability.sources ?? []) {
			recordSource({ id, ran: false, skippedReason: skipReasonOf(reason), items: [] });
		}
	}
	const lanes = profile.capabilities
		.filter((c) => c.grounding && isActive(c.id))
		.map((capability) => {
			const started = performance.now();
			const lane = settle((capability.grounding as NonNullable<typeof capability.grounding>)(turn, state));
			const settled = lane.promise.then(
				(result) => {
					if (result.source) {
						recordSource({ ...result.source, startOffsetMs: offset(started), ms: lane.at.ms });
					}
					for (const block of result.blocks) {
						groundingBlocks.set(block.id, block);
						owner.set(block.id, capability.id);
					}
					if (result.activation) record(capability.id, result.activation);
				},
				(reason: unknown) => {
					// A lane that threw rather than reporting: the source is recorded as failed
					// under the capability's first declared source.
					const id = capability.sources?.[0];
					if (!id) return;
					recordSource({
						id,
						ran: false,
						error: describeError(reason),
						items: [],
						startOffsetMs: offset(started),
						ms: lane.at.ms,
					});
				},
			);
			return settled;
		});
	await Promise.all(lanes);

	// 3. The prompt, block by block. Identity first; then each active capability's guidance;
	// the stable grounding; the awareness blocks; the dynamic grounding; the guides — each
	// group in profile order, so the cache-stable prefix is the same across turns.
	const drafts: { draft: BlockDraft; capability?: CapabilityId; index: number }[] = [];
	const push = (draft: BlockDraft, capability: CapabilityId | undefined, index: number) =>
		drafts.push({ draft, capability, index });
	push({ id: 'role', section: 'identity', text: identityBlock(profile.identity), stable: true }, undefined, -1);
	profile.capabilities.forEach((capability, index) => {
		if (capability.guidance && isActive(capability.id)) {
			push(
				{
					id: `${capability.id}-guidance` as PromptBlockId,
					section: 'guidance',
					text: capability.guidance,
					stable: true,
				},
				capability.id,
				index,
			);
		}
		for (const draft of capability.awareness?.(turn, state) ?? []) push(draft, capability.id, index);
	});
	for (const [id, draft] of groundingBlocks) {
		const capability = owner.get(id) as CapabilityId;
		push(
			draft,
			capability,
			profile.capabilities.findIndex((c) => c.id === capability),
		);
	}
	profile.capabilities.forEach((capability, index) => {
		const guide = capability.guide?.(turn, state);
		if (guide) push(guide, capability.id, index);
	});
	drafts.sort((a, b) => {
		const order = (d: BlockDraft) => SECTION_ORDER[`${d.section}:${d.stable ? 'stable' : 'dynamic'}`];
		return order(a.draft) - order(b.draft) || a.index - b.index;
	});
	const blocks: PromptBlock[] = drafts.map(({ draft, capability }) => ({
		id: draft.id,
		...(capability ? { capability } : {}),
		section: draft.section,
		text: draft.text,
		chars: draft.text.length,
		stable: draft.stable,
	}));
	for (const { draft, capability } of drafts) {
		recorder?.block({
			id: draft.id,
			...(capability ? { capability } : {}),
			section: draft.section,
			text: draft.text,
			stable: draft.stable,
		});
	}
	const systemPrompt = blocks.map((b) => b.text).join('\n\n');

	// 4. The tools — mounted by the capabilities that are active on a turn that has tools,
	// compaction-wrapped once. `compaction` sits last, so it sees what mounted before it.
	if (turn.hasTools) {
		for (const capability of profile.capabilities) {
			if (!capability.tools || !isActive(capability.id)) continue;
			Object.assign(state.tools, capability.tools(turn, state));
		}
	}
	const tools = wrapToolsWithCompaction(state.tools, turn.onCompacted);

	// The completion guidance names the loop's end, so the profile version hashes the same
	// text on every tool-mounted turn; the recorder folds the tool definitions in itself.
	if (Object.keys(tools).length > 0) recorder?.toolsOffered(tools);

	const verify: TurnComposition['verify'] = async (answer) => {
		const citations: CitationRecord[] = [];
		const grounding: GroundingSource[] = [];
		const stages: Partial<Record<CapabilityId, number>> = {};
		for (const capability of profile.capabilities) {
			if (!capability.verify || !isActive(capability.id)) continue;
			const from = performance.now();
			try {
				const found = await capability.verify(answer, turn, state);
				citations.push(...found.citations);
				for (const source of found.grounding ?? []) {
					grounding.push(source);
					state.grounding.set(source.id, source);
					recorder?.grounding(source);
				}
			} catch (err) {
				console.error(`[ai:profile] ${capability.id} verification failed:`, err);
			} finally {
				stages[capability.id] = Math.round(performance.now() - from);
			}
		}
		recorder?.citations(citations);
		return { citations, grounding, stages };
	};

	return {
		systemPrompt,
		blocks,
		tools,
		stepBudget: profile.stepBudget(turn),
		activations: [...state.activations.values()],
		grounding: [...state.grounding.values()],
		errors,
		...(embedMs !== undefined ? { embedMs } : {}),
		state,
		verify,
	};
}
