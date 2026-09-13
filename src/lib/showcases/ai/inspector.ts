/**
 * Turn inspector — the pure projection of ONE recorded turn into what the inspector renders.
 *
 * The input is the persisted contract (`TurnTrace`, `$lib/types/turn-trace.ts`) plus the
 * profile it ran on (`AssistantProfileManifest`) and the words around it (question, answer).
 * The output is a tree of nodes in the five-state order — AVAILABLE (the profile) →
 * CONSIDERED (the grounding candidates) → INCLUDED (the prompt blocks, the history) →
 * EXECUTED (the model calls, the tool executions; on the deskbot the proposal the turn
 * stopped on and the receipts of what its approval ran) → CITED — plus the timeline rows
 * and the spine statuses the other sections light up from.
 *
 * Nodes carry the underlying records, never copy: the components label them through
 * Paraglide, and code identifiers (block tags, tool names, capability ids, model ids) render
 * verbatim. Pure functions only — no `$lib/server/*`, no `$env/*`, no Paraglide — so the
 * recorded fixture, a live turn fetched by its owner and the recording script all share one
 * projection.
 */

import type { WaterfallRow } from '$lib/components/viz/timeline/types';
import type { AiErrorKind } from '$lib/types/ai-error';
import type { ProposalCardStep, ProposalStepReceipt } from '$lib/types/ai-proposal';
import type {
	AssistantProfileManifest,
	CapabilityManifest,
	GroundingInventory,
	GroundingSourceId,
	ToolManifestEntry,
} from '$lib/types/assistant-profile';
import type {
	Activation,
	AttemptRecord,
	CitationRecord,
	GroundingItem,
	GroundingSource,
	ModelCallRecord,
	PromptBlock,
	ToolDefinitionRecord,
	ToolExecutionRecord,
	TurnAwareness,
	TurnHistory,
	TurnOutcome,
	TurnProposal,
	TurnSummary,
	TurnTrace,
	TurnTraceSnapshot,
} from '$lib/types/turn-trace';
import { type AiLayerId, GUARD_STAGES, type GuardStageState, type TraceStatus } from './topology';

/**
 * Where a turn shown on the page came from. `recorded`: a real dev turn exported by
 * `scripts/ai/record-turn-fixture.ts`; `authored`: a stand-in written by hand until one is;
 * `live`: the viewer's own turn, fetched from its persisted trace.
 */
export type TurnProvenanceKind = 'authored' | 'recorded' | 'live';

export interface TurnProvenance {
	kind: TurnProvenanceKind;
	/** ISO date of the recording or the authoring. */
	recordedAt: string;
}

/** One turn as the inspector reads it: the recorded account plus the words around it. */
export interface InspectedTurn {
	provenance: TurnProvenance;
	question: string;
	answer: string;
	trace: TurnTrace;
	/** The AVAILABLE side — the profile as declared; null until the viewer's profile loads. */
	profile: AssistantProfileManifest | null;
}

/** The groups of the tree, in commitment order; `proposal` is the deskbot's approval door. */
export type InspectorGroupId = 'available' | 'awareness' | 'considered' | 'prompt' | 'calls' | 'proposal' | 'cited';

/**
 * One tool as the turn graph's inventory lists it: declared by the profile or the turn's
 * toolset, offered in the selected model call's request, and how often it ran (and failed).
 * Declared, offered and executed are separate facts; none implies the next.
 */
export interface ToolInventoryEntry {
	name: string;
	description: string;
	inputSchema: unknown;
	declared: boolean;
	offered: boolean;
	executions: number;
	failed: number;
}

export type InspectorNode =
	| { id: string; kind: 'group'; group: InspectorGroupId; count: number; children: InspectorNode[] }
	| { id: string; kind: 'identity'; name: string; text: string }
	| {
			id: string;
			kind: 'capability';
			capability: CapabilityManifest;
			activation: Activation | null;
			children: InspectorNode[];
	  }
	| { id: string; kind: 'tool-definition'; tool: ToolManifestEntry; capability: CapabilityManifest }
	| { id: string; kind: 'inventory'; inventory: GroundingInventory }
	| { id: string; kind: 'awareness'; awareness: TurnAwareness }
	| { id: string; kind: 'source'; source: GroundingSource; included: number; children: InspectorNode[] }
	| { id: string; kind: 'item'; source: GroundingSourceId; item: GroundingItem; citation: CitationRecord | null }
	| { id: string; kind: 'block'; block: PromptBlock }
	| { id: string; kind: 'history'; history: TurnHistory }
	| { id: string; kind: 'call'; call: ModelCallRecord; index: number; children: InspectorNode[] }
	| { id: string; kind: 'tool'; execution: ToolExecutionRecord; definition: ToolDefinitionRecord | null }
	| { id: string; kind: 'attempt'; attempt: AttemptRecord }
	| { id: string; kind: 'proposal'; proposal: TurnProposal; children: InspectorNode[] }
	| {
			id: string;
			kind: 'proposal-step';
			index: number;
			step: ProposalCardStep;
			/** The receipt of the step's execution; null when the step never ran. */
			receipt: ProposalStepReceipt | null;
	  }
	| { id: string; kind: 'citation'; citation: CitationRecord; item: GroundingItem | null }
	// The turn graph's own nodes — never in the tree, rendered by the same detail pane.
	| {
			id: string;
			kind: 'document';
			source: GroundingSourceId;
			documentId: string;
			title: string;
			path?: string;
			items: GroundingItem[];
	  }
	| {
			id: string;
			kind: 'parent-chunk';
			source: GroundingSourceId;
			parentId: string;
			/** The parent as it stands now (read-side metadata); null when not readable any more. */
			parent: NonNullable<GroundingItem['parent']> | null;
			items: GroundingItem[];
	  }
	| { id: string; kind: 'omitted'; source: GroundingSourceId; items: GroundingItem[] }
	| {
			id: string;
			kind: 'answer';
			answer: string;
			outcome: TurnOutcome;
			errorKind: AiErrorKind | null;
			citations: CitationRecord[];
			/** Paths the answer named that nothing this turn produced — the answer's claim, not the turn's. */
			unsurfaced: number;
	  }
	| { id: string; kind: 'toolset'; tools: ToolInventoryEntry[] };

// Every id is namespaced by kind: a keyed each over the flat tree needs them unique, and
// a group shares its name with its one child ('awareness') otherwise.
export const NODE_IDS = {
	group: (group: InspectorGroupId) => `group:${group}`,
	identity: 'identity',
	capability: (id: string) => `capability:${id}`,
	toolDefinition: (name: string) => `tool-definition:${name}`,
	inventory: (id: string) => `inventory:${id}`,
	awareness: 'awareness',
	source: (id: string) => `source:${id}`,
	item: (source: string, id: string) => `item:${source}:${id}`,
	block: (id: string) => `block:${id}`,
	history: 'history',
	call: (id: string) => `call:${id}`,
	tool: (id: string) => `tool:${id}`,
	attempt: (index: number) => `attempt:${index}`,
	proposal: 'proposal',
	proposalStep: (index: number) => `proposal-step:${index}`,
	citation: (index: number) => `citation:${index}`,
	finalize: (stage: string) => `finalize:${stage}`,
	// The turn graph's own nodes.
	document: (source: string, id: string) => `document:${source}:${id}`,
	parentChunk: (id: string) => `parent:${id}`,
	omitted: (source: string) => `omitted:${source}`,
	answer: 'answer',
	toolset: 'toolset',
	boundary: 'boundary',
} as const;

/**
 * Has the profile changed since this turn? Compared fact by fact — the recorded identity
 * block, each recorded guidance block and each recorded tool definition against what the
 * profile declares today. Only what the turn carries is compared: withheld or redacted
 * bodies make no claim. (The two version hashes are built from different inputs — the
 * recorder's includes the stable grounding blocks — so they are never the same string.)
 */
export function profileDrifted(turn: InspectedTurn, profile: AssistantProfileManifest): boolean {
	const { trace } = turn;
	const role = trace.blocks.find((b) => b.id === 'role');
	if (role?.text !== undefined && role.text !== profile.identity.text) return true;
	for (const block of trace.blocks) {
		if (block.section !== 'guidance' || block.text === undefined || !block.capability) continue;
		const declared = profile.capabilities.find((c) => c.id === block.capability)?.guidance;
		if (declared !== undefined && declared !== null && declared !== block.text) return true;
	}
	// A recorded tool the manifest does not list is not drift: the compaction helper mounts
	// only beside another tool, and the manifest reads the profile with none mounted.
	const declaredTools = new Map(profile.capabilities.flatMap((c) => c.tools.map((t) => [t.name, t] as const)));
	for (const tool of trace.toolset) {
		const declared = declaredTools.get(tool.name);
		if (!declared) continue;
		if (declared.description !== tool.description) return true;
		if (tool.inputSchema !== null && canonicalJson(declared.inputSchema) !== canonicalJson(tool.inputSchema))
			return true;
	}
	return false;
}

/** JSON with sorted keys, so two readings of one schema compare equal whatever their key order. */
function canonicalJson(value: unknown): string {
	return JSON.stringify(value, (_key, v) =>
		v && typeof v === 'object' && !Array.isArray(v)
			? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
			: v,
	);
}

/**
 * The turn as the inspector reads it while it is still streaming: the snapshot on the
 * message (every key present, bodies withheld) widened to the persisted shape — no tool
 * definitions yet, `bodies: 'persisted'` (the detail pane says they arrive with the turn),
 * the words as far as they have come. The graph, the tree and the timeline render it as
 * they render a persisted turn; the persisted read replaces it once the turn is written.
 */
export function inspectedFromSnapshot(
	snapshot: TurnTraceSnapshot,
	words: { question: string; answer: string; at: string },
	profile: AssistantProfileManifest | null,
): InspectedTurn {
	return {
		provenance: { kind: 'live', recordedAt: words.at.slice(0, 10) },
		question: words.question,
		answer: words.answer,
		trace: { ...snapshot, toolset: [], createdAt: words.at, bodies: 'persisted' },
		profile,
	};
}

const children = (node: InspectorNode): InspectorNode[] => ('children' in node ? node.children : []);

/** Find one node anywhere in the tree. */
export function findInspectorNode(nodes: readonly InspectorNode[], id: string): InspectorNode | null {
	for (const node of nodes) {
		if (node.id === id) return node;
		const hit = findInspectorNode(children(node), id);
		if (hit) return hit;
	}
	return null;
}

/** One row of the tree as rendered: the node, its depth and its parent — the treeview's flat view. */
export interface VisibleNode {
	node: InspectorNode;
	depth: number;
	parentId: string | null;
	expandable: boolean;
}

/** The rows a treeview shows for a set of expanded ids, in document order. */
export function visibleNodes(nodes: readonly InspectorNode[], expanded: ReadonlySet<string>): VisibleNode[] {
	const out: VisibleNode[] = [];
	const walk = (list: readonly InspectorNode[], depth: number, parentId: string | null) => {
		for (const node of list) {
			const kids = children(node);
			out.push({ node, depth, parentId, expandable: kids.length > 0 });
			if (kids.length > 0 && expanded.has(node.id)) walk(kids, depth + 1, node.id);
		}
	};
	walk(nodes, 0, null);
	return out;
}

/** The ids above a node, root first — what a treeview must expand to reveal it. */
export function ancestorIds(nodes: readonly InspectorNode[], id: string): string[] {
	const walk = (list: readonly InspectorNode[], path: string[]): string[] | null => {
		for (const node of list) {
			if (node.id === id) return path;
			const hit = walk(children(node), [...path, node.id]);
			if (hit) return hit;
		}
		return null;
	};
	return walk(nodes, []) ?? [];
}

/** The ids of every node that has children — the "expand all" set. */
export function expandableIds(nodes: readonly InspectorNode[]): string[] {
	const out: string[] = [];
	const walk = (list: readonly InspectorNode[]) => {
		for (const node of list) {
			const kids = children(node);
			if (kids.length > 0) {
				out.push(node.id);
				walk(kids);
			}
		}
	};
	walk(nodes);
	return out;
}

const citationKey = (source: string, itemId: string) => `${source}\0${itemId}`;

/** The inspector tree of one turn. */
export function inspectorTree(turn: InspectedTurn): InspectorNode[] {
	const { trace, profile } = turn;
	const nodes: InspectorNode[] = [];

	if (profile) {
		const activations = new Map(trace.activations.map((a) => [a.id, a]));
		const capabilities: InspectorNode[] = profile.capabilities.map((capability) => ({
			id: NODE_IDS.capability(capability.id),
			kind: 'capability',
			capability,
			activation: activations.get(capability.id) ?? null,
			children: capability.tools.map((tool) => ({
				id: NODE_IDS.toolDefinition(tool.name),
				kind: 'tool-definition',
				tool,
				capability,
			})),
		}));
		const inventory: InspectorNode[] = profile.grounding.map((inv) => ({
			id: NODE_IDS.inventory(inv.id),
			kind: 'inventory',
			inventory: inv,
		}));
		nodes.push({
			id: NODE_IDS.group('available'),
			kind: 'group',
			group: 'available',
			count: profile.capabilities.length,
			children: [
				{ id: NODE_IDS.identity, kind: 'identity', name: profile.identity.name, text: profile.identity.text },
				...capabilities,
				...inventory,
			],
		});
	}

	nodes.push({
		id: NODE_IDS.group('awareness'),
		kind: 'group',
		group: 'awareness',
		count: 1,
		children: [{ id: NODE_IDS.awareness, kind: 'awareness', awareness: trace.awareness }],
	});

	const cited = new Map(trace.citations.map((c) => [citationKey(c.source, c.itemId), c]));
	const sources: InspectorNode[] = trace.grounding.map((source) => ({
		id: NODE_IDS.source(source.id),
		kind: 'source',
		source,
		included: source.items.filter((item) => item.state !== 'considered').length,
		children: source.items.map((item) => ({
			id: NODE_IDS.item(source.id, item.id),
			kind: 'item',
			source: source.id,
			item,
			citation: cited.get(citationKey(source.id, item.id)) ?? null,
		})),
	}));
	nodes.push({
		id: NODE_IDS.group('considered'),
		kind: 'group',
		group: 'considered',
		count: trace.grounding.reduce((n, source) => n + source.items.length, 0),
		children: sources,
	});

	nodes.push({
		id: NODE_IDS.group('prompt'),
		kind: 'group',
		group: 'prompt',
		count: trace.blocks.length,
		children: [
			...trace.blocks.map((block): InspectorNode => ({ id: NODE_IDS.block(block.id), kind: 'block', block })),
			{ id: NODE_IDS.history, kind: 'history', history: trace.history },
		],
	});

	const definitions = new Map(trace.toolset.map((d) => [d.name, d]));
	const toolNode = (execution: ToolExecutionRecord): InspectorNode => ({
		id: NODE_IDS.tool(execution.id),
		kind: 'tool',
		execution,
		definition: definitions.get(execution.toolName) ?? null,
	});
	const attached = new Set<string>();
	const calls: InspectorNode[] = trace.modelCalls.map((call, index) => {
		const own = trace.toolExecutions.filter((e) => e.modelCallId === call.id);
		for (const e of own) attached.add(e.id);
		return { id: NODE_IDS.call(call.id), kind: 'call', call, index, children: own.map(toolNode) };
	});
	const orphans = trace.toolExecutions.filter((e) => !attached.has(e.id)).map(toolNode);
	const attempts: InspectorNode[] = trace.attempts.map((attempt) => ({
		id: NODE_IDS.attempt(attempt.attemptIndex),
		kind: 'attempt',
		attempt,
	}));
	nodes.push({
		id: NODE_IDS.group('calls'),
		kind: 'group',
		group: 'calls',
		count: trace.modelCalls.length,
		children: [...calls, ...orphans, ...attempts],
	});

	// The deskbot's door: the proposal the turn stopped on (resolved for the owner) with one
	// node per planned step and its receipt. A deskbot turn that proposed nothing shows the
	// group empty — no mutation was attempted; the chatbot has no door.
	if (trace.surface === 'deskbot') {
		const proposal = trace.proposal;
		const receipts = new Map(proposal?.receipts.map((r) => [r.stepIndex, r]));
		nodes.push({
			id: NODE_IDS.group('proposal'),
			kind: 'group',
			group: 'proposal',
			count: proposal?.steps.length ?? 0,
			children: proposal
				? [
						{
							id: NODE_IDS.proposal,
							kind: 'proposal',
							proposal,
							children: proposal.steps.map((step, index) => ({
								id: NODE_IDS.proposalStep(index),
								kind: 'proposal-step',
								index,
								step,
								receipt: receipts.get(index) ?? null,
							})),
						},
					]
				: [],
		});
	}

	const items = new Map<string, GroundingItem>();
	for (const source of trace.grounding)
		for (const item of source.items) items.set(citationKey(source.id, item.id), item);
	nodes.push({
		id: NODE_IDS.group('cited'),
		kind: 'group',
		group: 'cited',
		count: trace.citations.length,
		children: trace.citations.map((citation, index) => ({
			id: NODE_IDS.citation(index),
			kind: 'citation',
			citation,
			item: items.get(citationKey(citation.source, citation.itemId)) ?? null,
		})),
	});

	return nodes;
}

const GROUP_COLOR = {
	assembly: 'var(--chart-2)',
	calls: 'var(--chart-3)',
	tools: 'var(--chart-5)',
	finalize: 'var(--chart-7)',
} as const;

/** Timeline rows: grounding lanes, model calls with their tool executions nested, the finalize stages. */
export function timelineRows(trace: TurnTrace): WaterfallRow[] {
	const rows: WaterfallRow[] = [];
	for (const source of trace.grounding) {
		rows.push({
			id: NODE_IDS.source(source.id),
			label: source.id,
			startOffsetMs: source.startOffsetMs ?? 0,
			durationMs: source.ms ?? 0,
			status: source.error ? 'error' : source.ran ? (source.ms === undefined ? 'active' : 'done') : 'skipped',
			color: GROUP_COLOR.assembly,
			groupId: 'assembly',
			groupLabel: 'composeTurn',
		});
	}
	let lastEnd = 0;
	for (const [index, call] of trace.modelCalls.entries()) {
		const start = call.startOffsetMs ?? 0;
		const duration = call.durationMs ?? 0;
		lastEnd = Math.max(lastEnd, start + duration);
		rows.push({
			id: NODE_IDS.call(call.id),
			label: `call #${index + 1}${call.modelId ? ` · ${call.modelId}` : ''}`,
			startOffsetMs: start,
			durationMs: duration,
			status: call.outcome === 'ok' ? 'done' : call.outcome === 'cancelled' ? 'skipped' : 'error',
			color: GROUP_COLOR.calls,
			groupId: 'calls',
			groupLabel: 'streamText',
		});
		for (const execution of trace.toolExecutions.filter((e) => e.modelCallId === call.id)) {
			rows.push({
				id: NODE_IDS.tool(execution.id),
				label: execution.toolName,
				startOffsetMs: execution.startOffsetMs ?? start,
				durationMs: execution.durationMs ?? 0,
				status: execution.status === 'error' ? 'error' : 'done',
				color: GROUP_COLOR.tools,
				groupId: 'calls',
				groupLabel: 'streamText',
				depth: 1,
				parentId: NODE_IDS.call(call.id),
			});
		}
	}
	const finalize = trace.timings.finalize ?? {};
	let cursor = lastEnd;
	for (const [stage, ms] of Object.entries(finalize) as [string, number | undefined][]) {
		if (ms === undefined) continue;
		rows.push({
			id: NODE_IDS.finalize(stage),
			label: stage.replace(/Ms$/, ''),
			startOffsetMs: cursor,
			durationMs: ms,
			status: 'done',
			color: GROUP_COLOR.finalize,
			groupId: 'finalize',
			groupLabel: 'afterText',
		});
		cursor += ms;
	}
	return rows;
}

/** The spine band each timeline row lights when selected — for the tree ⇄ timeline link. */
export function nodeIdOfRow(rowId: string): string | null {
	return rowId.startsWith('finalize:') ? null : rowId;
}

/**
 * The gate band of a deskbot turn is the approval door: never reached (`skipped`), a
 * proposal awaiting the human (`active`), declined or expired by the human (`not-taken` —
 * a person decided, not the system), else taken. A proposal the reader could not resolve
 * still counts as reached: the turn recorded its id.
 */
function proposalGate(trace: TurnTrace): TraceStatus {
	if (!trace.proposalId) return 'skipped';
	const status = trace.proposal?.status;
	if (status === 'pending') return 'active';
	if (status === 'rejected' || status === 'expired') return 'not-taken';
	return 'done';
}

/**
 * Spine band statuses derived from a persisted trace. A trace exists only past the guard,
 * so the request bands are done by construction; the rest read the recorded facts:
 * a lane that ran, a block that was assembled, a tool that executed, an attempt's outcome.
 */
export function spineOf(trace: TurnTrace): Partial<Record<AiLayerId, TraceStatus>> {
	const layers: Partial<Record<AiLayerId, TraceStatus>> = {
		client: 'done',
		route: 'done',
		guard: 'done',
		orchestrator: 'done',
	};
	const compacted =
		trace.toolExecutions.some((e) => e.compaction) ||
		trace.history.messages.some((m) => m.parts.some((p) => p.type === 'compaction'));
	layers.compaction = compacted ? 'done' : 'skipped';
	layers.prompt = trace.blocks.length > 0 ? 'done' : 'pending';
	const ran = trace.grounding.filter((g) => g.ran);
	layers.retrieval = ran.some((g) => g.error) ? 'error' : ran.length > 0 ? 'done' : 'skipped';
	layers.harness = trace.toolExecutions.length > 0 ? 'done' : 'skipped';
	const finalize = trace.timings.finalize ?? {};
	layers.gate =
		trace.surface === 'deskbot'
			? proposalGate(trace)
			: trace.citations.length > 0 || finalize.catalogMs !== undefined
				? 'done'
				: 'skipped';
	const last = trace.attempts[trace.attempts.length - 1];
	layers.stream = !last
		? 'pending'
		: last.outcome === 'started'
			? 'active'
			: last.outcome === 'ok' || last.outcome === 'rotated'
				? 'done'
				: 'error';
	layers.persist = 'done';
	return layers;
}

/** The guard chain of a turn that exists: every stage passed, or there would be no turn. */
export function guardPassed(): GuardStageState[] {
	return GUARD_STAGES.map((stage) => ({ id: stage.id, status: 'done' }));
}

/** The provider · model line of a turn: the attempt that answered, else the first. */
export function servedBy(trace: TurnTrace): string | null {
	const attempt = trace.attempts.find((a) => a.outcome === 'ok') ?? trace.attempts[0];
	if (!attempt) return null;
	return [attempt.providerId, attempt.modelId].filter(Boolean).join(' / ') || null;
}

/* ── The thread around a turn ───────────────────────────────────────────────────────────── */

/** A message row of a conversation, as `GET /api/ai/conversations/[id]` lists it. */
export interface ThreadMessage {
	id: string;
	role: string;
	content: string;
}

/** A turn as the picker lists it — the question it answered, and when. */
export interface TurnOption {
	messageId: string;
	question: string;
	createdAt: string;
	outcome: TurnSummary['outcome'];
}

/** Pair each recorded turn with the user message it answered — the row before it in the thread. */
export function turnOptions(messages: readonly ThreadMessage[], turns: readonly TurnSummary[]): TurnOption[] {
	const index = new Map(messages.map((m, i) => [m.id, i]));
	return turns.map((turn) => {
		const at = index.get(turn.messageId);
		let question = '';
		for (let i = (at ?? messages.length) - 1; i >= 0; i -= 1) {
			if (messages[i]?.role === 'user') {
				question = messages[i]?.content ?? '';
				break;
			}
		}
		return { messageId: turn.messageId, question, createdAt: turn.createdAt, outcome: turn.outcome };
	});
}

/* ── Fixture scrubbing ──────────────────────────────────────────────────────────────────── */

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Replace every id a recorded turn carries with a `demo_` id, consistently across the whole
 * record — the fixture must teach the shape without naming a row, a user, a request or a
 * chunk. Catalog rows keep their ids (public paths) and a corpus map its stable one; every
 * other id, and any UUID-shaped string left anywhere in a body, is renamed. Pure: the
 * recording script and the fixture test share it.
 */
export function scrubTurn(turn: InspectedTurn): InspectedTurn {
	const { trace } = turn;
	const renames = new Map<string, string>();
	const rename = (from: string | null | undefined, to: string) => {
		if (from && from !== to) renames.set(from, to);
	};
	rename(trace.messageId, 'demo_turn');
	rename(trace.conversationId, 'demo_conversation');
	rename(trace.requestId, 'demo_request');
	rename(trace.proposalId, 'demo_proposal');
	rename(trace.awareness.workspace?.id, 'demo_workspace');
	for (const [i, call] of trace.modelCalls.entries()) rename(call.id, `demo_call_${i + 1}`);
	for (const [i, execution] of trace.toolExecutions.entries()) {
		rename(execution.id, `demo_tool_${i + 1}`);
		rename(execution.toolCallId, `demo_tool_call_${i + 1}`);
		rename(execution.compaction?.ref, `demo_ref_${i + 1}`);
	}
	let chunks = 0;
	const documents = new Map<string, string>();
	const parents = new Map<string, string>();
	for (const source of trace.grounding) {
		for (const item of source.items) {
			if (item.kind !== 'chunk') continue;
			chunks += 1;
			rename(item.id, `demo_chunk_${chunks}`);
			if (item.documentId && !documents.has(item.documentId)) {
				documents.set(item.documentId, `demo_document_${documents.size + 1}`);
				rename(item.documentId, documents.get(item.documentId) ?? item.documentId);
			}
		}
	}
	// A parent that is itself a candidate already carries its chunk name; the rest are parents.
	for (const source of trace.grounding) {
		for (const item of source.items) {
			const parentId = item.parentId;
			if (!parentId || renames.has(parentId) || parents.has(parentId)) continue;
			parents.set(parentId, `demo_parent_${parents.size + 1}`);
			rename(parentId, parents.get(parentId) ?? parentId);
		}
	}
	let panels = 0;
	const files = new Map<string, string>();
	const renameFile = (id: string | undefined) => {
		if (id && !files.has(id)) {
			files.set(id, `demo_file_${files.size + 1}`);
			rename(id, files.get(id) ?? id);
		}
	};
	for (const layout of trace.awareness.layout ?? []) {
		panels += 1;
		rename(layout.panelId, `demo_panel_${panels}`);
		renameFile(layout.fileId);
	}
	for (const panel of trace.awareness.panels ?? []) renameFile(panel.fileId);
	for (const step of trace.proposal?.steps ?? []) renameFile(step.target?.fileId);
	for (const receipt of trace.proposal?.receipts ?? []) {
		const created = receipt.output?.fileId;
		if (typeof created === 'string') renameFile(created);
	}

	// Longest id first, so an id that happens to prefix another is never renamed inside it.
	const ordered = [...renames].sort((a, b) => b[0].length - a[0].length);
	let uuids = 0;
	const scrubString = (value: string): string => {
		let out = value;
		for (const [from, to] of ordered) out = out.split(from).join(to);
		return out.replace(UUID_RE, () => {
			uuids += 1;
			return `demo_id_${uuids}`;
		});
	};
	const scrubValue = (value: unknown): unknown => {
		if (typeof value === 'string') return scrubString(value);
		if (Array.isArray(value)) return value.map(scrubValue);
		if (value && typeof value === 'object') {
			return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubValue(v)]));
		}
		return value;
	};
	return scrubValue(turn) as InspectedTurn;
}
