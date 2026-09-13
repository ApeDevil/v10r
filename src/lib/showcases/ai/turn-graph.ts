/**
 * Turn graph — the pure projection of ONE turn into three columns: the sources it drew on
 * (corpus → document → parent section → chunk), the context and model calls that produced
 * the answer (the prompt blocks, the history, each provider request, the answer), and the
 * tools (the inventory offered, one execution per tool call).
 *
 * Every edge is a RECORDED relation, never an inference: a chunk reaches a block through its
 * `blockId`; a block reaches a call through the call's `blockIds`; a call reaches an
 * execution through `modelCallId`; an execution reaches a later call only when that call's
 * `toolResultIds` names it, and an item only when the item's `toolCallId` does; the answer
 * reaches an item through a citation that resolved. What the record does not carry is said
 * so (`flags.unknown`) — the graph never draws a relationship to look complete.
 *
 * Containment (what sits under what) and data flow (what fed what) are different kinds of
 * edge, so the two never read alike. Node ids are the inspector's (`NODE_IDS`): a card, the
 * tree row and the timeline bar of one record share one selection. Where the visible graph's
 * nodes sit and how its edges travel is `turn-graph-layout.ts`.
 *
 * Pure functions only — no `$lib/server/*`, no `$env/*`, no Paraglide, no `@xyflow` — so the
 * fixtures, a live turn and the streaming snapshot share one projection.
 */

import type { AssistantProfileManifest, GroundingSourceId } from '$lib/types/assistant-profile';
import type {
	GroundingItem,
	GroundingSource,
	ToolExecutionRecord,
	TurnItemState,
	TurnTrace,
} from '$lib/types/turn-trace';
import { type InspectorNode, NODE_IDS, type ToolInventoryEntry } from './inspector';

export type TurnGraphColumn = 'sources' | 'context' | 'tools';

export type TurnGraphNodeKind =
	| 'source'
	| 'document'
	| 'parent'
	| 'item'
	| 'omitted'
	| 'prompt'
	| 'block'
	| 'boundary'
	| 'history'
	| 'call'
	| 'answer'
	| 'proposal'
	| 'toolset'
	| 'tool';

/**
 * `containment` is where a record sits; the rest are data flow: an item entered a block
 * (`inclusion`), a block or the history entered a provider request and the last request
 * produced the answer (`request`), a call ran a tool (`execution`), a tool's output entered a
 * later request or surfaced an item (`result`), the answer named an item (`citation`).
 */
export type TurnGraphEdgeKind = 'containment' | 'inclusion' | 'request' | 'execution' | 'result' | 'citation';

export interface TurnGraphFlags {
	/** Part of the selected model call's request: its blocks, the history, the executions whose results it carried. */
	inCall?: boolean;
	/** The inventory: offered in the selected model call's request. */
	offered?: boolean;
	/** Still open while the turn streams. */
	active?: boolean;
	failed?: boolean;
	drifted?: boolean;
	/** A prompt block that does not depend on the request — the cache-stable prefix. */
	stable?: boolean;
	/** Read-side metadata as it stands now, not the turn's own account. */
	current?: boolean;
	/** Facts this record does not carry — the card says "not recorded" for each. */
	unknown: string[];
}

export interface TurnGraphNode {
	id: string;
	column: TurnGraphColumn;
	kind: TurnGraphNodeKind;
	/** The record's own name — a title, a tool name, a block id; the card adds the words. */
	label: string;
	/** What the detail pane opens; absent only for the cache boundary. */
	detail?: InspectorNode;
	/** Containment: the node this one sits under (sources column only). */
	parentId?: string;
	depth: number;
	/** Collapsed by default: its children stay hidden until it is expanded. */
	expandable: boolean;
	/** Children (a document's chunks, an omitted group's candidates, the inventory's tools). */
	count?: number;
	state?: TurnItemState;
	flags: TurnGraphFlags;
}

export interface TurnGraphEdge {
	id: string;
	source: string;
	target: string;
	kind: TurnGraphEdgeKind;
	/** Part of the selected model call's request. */
	inCall?: boolean;
	/** Still streaming through. */
	active?: boolean;
	/** Set on a visible edge that stands for this many edges of hidden children. */
	merged?: number;
}

export interface TurnGraph {
	nodes: TurnGraphNode[];
	edges: TurnGraphEdge[];
	/** The model calls, for the selector. */
	calls: { id: string; index: number }[];
}

export interface TurnGraphOptions {
	/** The selected model call; null (or absent) selects none, so nothing reads dimmed. */
	callId?: string | null;
	answer?: string;
	profile?: AssistantProfileManifest | null;
}

/** The turn graph of one trace. */
export function turnGraph(trace: TurnTrace, options: TurnGraphOptions = {}): TurnGraph {
	const nodes: TurnGraphNode[] = [];
	const edges: TurnGraphEdge[] = [];
	const edge = (kind: TurnGraphEdgeKind, source: string, target: string) => {
		edges.push({ id: `${kind}:${source}>${target}`, source, target, kind });
	};

	// ── Sources: source → document → (parent) → item; the omitted candidates folded away. ──
	for (const source of trace.grounding) {
		const sourceId = NODE_IDS.source(source.id);
		const inPrompt = source.items.filter((item) => item.state !== 'considered');
		const omitted = source.items.filter((item) => item.state === 'considered');
		nodes.push({
			id: sourceId,
			column: 'sources',
			kind: 'source',
			label: source.id,
			detail: { id: sourceId, kind: 'source', source, included: inPrompt.length, children: [] },
			depth: 0,
			expandable: source.items.length > 0,
			count: source.items.length,
			flags: { failed: source.error !== undefined, unknown: [] },
		});
		const itemIds = new Set(source.items.map((item) => item.id));
		const documents = new Map<string, GroundingItem[]>();
		for (const item of inPrompt) {
			if (!item.documentId) continue;
			const group = documents.get(item.documentId) ?? [];
			group.push(item);
			documents.set(item.documentId, group);
		}
		for (const [documentId, items] of documents) {
			const documentNodeId = NODE_IDS.document(source.id, documentId);
			const first = items[0];
			nodes.push({
				id: documentNodeId,
				column: 'sources',
				kind: 'document',
				label: first?.title ?? documentId,
				detail: {
					id: documentNodeId,
					kind: 'document',
					source: source.id,
					documentId,
					title: first?.title ?? documentId,
					...(first?.path ? { path: first.path } : {}),
					items,
				},
				parentId: sourceId,
				depth: 1,
				expandable: true,
				count: items.length,
				flags: { unknown: [] },
			});
			const parents = new Set<string>();
			for (const item of items) {
				// A parent that is itself a candidate carries its own card; the rest get one per parent.
				const parentIsItem = item.parentId !== undefined && itemIds.has(item.parentId);
				let under = documentNodeId;
				let depth = 2;
				if (item.parentId && !parentIsItem) {
					const parentNodeId = NODE_IDS.parentChunk(item.parentId);
					if (!parents.has(item.parentId)) {
						parents.add(item.parentId);
						nodes.push({
							id: parentNodeId,
							column: 'sources',
							kind: 'parent',
							label: item.parentId,
							detail: {
								id: parentNodeId,
								kind: 'parent-chunk',
								source: source.id,
								parentId: item.parentId,
								parent: item.parent ?? null,
								items: items.filter((sibling) => sibling.parentId === item.parentId),
							},
							parentId: documentNodeId,
							depth: 2,
							expandable: false,
							flags: { current: item.parent !== undefined, unknown: item.parent ? [] : ['parent'] },
						});
						edge('containment', documentNodeId, parentNodeId);
					}
					under = parentNodeId;
					depth = 3;
				} else if (parentIsItem && item.parentId) {
					under = NODE_IDS.item(source.id, item.parentId);
					depth = 3;
				}
				pushItem(nodes, source, item, trace, under, depth);
				edge('containment', under, NODE_IDS.item(source.id, item.id));
			}
			edge('containment', sourceId, documentNodeId);
		}
		for (const item of inPrompt) {
			if (item.documentId) continue;
			pushItem(nodes, source, item, trace, sourceId, 1);
			edge('containment', sourceId, NODE_IDS.item(source.id, item.id));
		}
		if (omitted.length > 0) {
			const omittedId = NODE_IDS.omitted(source.id);
			nodes.push({
				id: omittedId,
				column: 'sources',
				kind: 'omitted',
				label: source.id,
				detail: { id: omittedId, kind: 'omitted', source: source.id, items: omitted },
				parentId: sourceId,
				depth: 1,
				expandable: true,
				count: omitted.length,
				flags: { unknown: [] },
			});
			edge('containment', sourceId, omittedId);
			for (const item of omitted) {
				pushItem(nodes, source, item, trace, omittedId, 2);
				edge('containment', omittedId, NODE_IDS.item(source.id, item.id));
			}
		}
	}

	// ── Context: the prompt (its blocks in cache order, folded), the history, the calls, the answer. ──
	const blockIds = new Set(trace.blocks.map((block) => block.id));
	const promptId = NODE_IDS.group('prompt');
	const blockNodes: InspectorNode[] = trace.blocks.map((block) => ({
		id: NODE_IDS.block(block.id),
		kind: 'block',
		block,
	}));
	nodes.push({
		id: promptId,
		column: 'context',
		kind: 'prompt',
		label: 'prompt',
		detail: { id: promptId, kind: 'group', group: 'prompt', count: trace.blocks.length, children: blockNodes },
		depth: 0,
		expandable: trace.blocks.length > 0,
		count: trace.blocks.length,
		flags: { unknown: [] },
	});
	let boundaryDrawn = false;
	for (const block of trace.blocks) {
		if (!block.stable && !boundaryDrawn && nodes.some((n) => n.kind === 'block')) {
			boundaryDrawn = true;
			nodes.push({
				id: NODE_IDS.boundary,
				column: 'context',
				kind: 'boundary',
				label: 'boundary',
				parentId: promptId,
				depth: 1,
				expandable: false,
				flags: { unknown: [] },
			});
		}
		const id = NODE_IDS.block(block.id);
		nodes.push({
			id,
			column: 'context',
			kind: 'block',
			label: block.id,
			detail: { id, kind: 'block', block },
			parentId: promptId,
			depth: 1,
			expandable: false,
			flags: { stable: block.stable, unknown: [] },
		});
	}
	nodes.push({
		id: NODE_IDS.history,
		column: 'context',
		kind: 'history',
		label: 'history',
		detail: { id: NODE_IDS.history, kind: 'history', history: trace.history },
		depth: 0,
		expandable: false,
		count: trace.history.messages.length,
		flags: { unknown: [] },
	});

	const lastAttempt = trace.attempts.at(-1);
	const streaming = lastAttempt?.outcome === 'started';
	const callIds = new Set(trace.modelCalls.map((call) => call.id));
	trace.modelCalls.forEach((call, index) => {
		const id = NODE_IDS.call(call.id);
		nodes.push({
			id,
			column: 'context',
			kind: 'call',
			label: `${index + 1}`,
			detail: { id, kind: 'call', call, index, children: [] },
			depth: 0,
			expandable: false,
			count: call.response?.toolCalls.length,
			flags: {
				active: call.response === null && streaming,
				failed: call.outcome === 'error',
				unknown: call.request.toolResultIds === undefined ? ['toolResultIds'] : [],
			},
		});
		for (const blockId of call.request.blockIds) {
			if (blockIds.has(blockId)) edge('request', NODE_IDS.block(blockId), id);
		}
		// The window rides on every request (the SDK resends the thread each step); the recorded
		// count says whether this one carried messages at all.
		if (call.request.historyCount > 0) edge('request', NODE_IDS.history, id);
	});

	for (const item of allItems(trace)) {
		if (item.item.blockId && blockIds.has(item.item.blockId)) {
			edge('inclusion', NODE_IDS.item(item.source, item.item.id), NODE_IDS.block(item.item.blockId));
		}
	}

	const unsurfaced = trace.citations.filter((c) => c.match === 'unsurfaced').length;
	const outcomeId = trace.surface === 'deskbot' && trace.proposalId ? NODE_IDS.proposal : NODE_IDS.answer;
	if (outcomeId === NODE_IDS.proposal) {
		const proposal = trace.proposal;
		nodes.push({
			id: NODE_IDS.proposal,
			column: 'context',
			kind: 'proposal',
			label: proposal?.status ?? 'proposal',
			detail: proposal
				? { id: NODE_IDS.proposal, kind: 'proposal', proposal, children: [] }
				: { id: NODE_IDS.group('proposal'), kind: 'group', group: 'proposal', count: 0, children: [] },
			depth: 0,
			expandable: false,
			count: proposal?.steps.length,
			flags: { unknown: proposal ? [] : ['proposal'] },
		});
	} else {
		nodes.push({
			id: NODE_IDS.answer,
			column: 'context',
			kind: 'answer',
			label: trace.outcome,
			detail: {
				id: NODE_IDS.answer,
				kind: 'answer',
				answer: options.answer ?? '',
				outcome: trace.outcome,
				errorKind: trace.errorKind,
				citations: trace.citations,
				unsurfaced,
			},
			depth: 0,
			expandable: false,
			count: trace.citations.length,
			flags: { active: streaming, failed: trace.outcome === 'error', unknown: [] },
		});
	}
	const lastOk = [...trace.modelCalls].reverse().find((call) => call.outcome === 'ok');
	if (lastOk) edge('request', NODE_IDS.call(lastOk.id), outcomeId);
	if (outcomeId === NODE_IDS.answer) {
		for (const citation of trace.citations) {
			if (citation.match === 'unsurfaced') continue;
			const itemId = NODE_IDS.item(citation.source, citation.itemId);
			if (nodes.some((n) => n.id === itemId)) edge('citation', NODE_IDS.answer, itemId);
		}
	}

	// ── Tools: the inventory, then one execution per tool call. ──
	const executionsByTool = new Map<string, ToolExecutionRecord[]>();
	for (const execution of trace.toolExecutions) {
		const list = executionsByTool.get(execution.toolName) ?? [];
		list.push(execution);
		executionsByTool.set(execution.toolName, list);
	}
	const selected = options.callId ? trace.modelCalls.find((call) => call.id === options.callId) : undefined;
	const offered = new Set(
		selected ? selected.request.toolsOffered : trace.modelCalls.flatMap((call) => call.request.toolsOffered),
	);
	const declared = new Map(trace.toolset.map((definition) => [definition.name, definition]));
	if (declared.size === 0 && options.profile) {
		for (const capability of options.profile.capabilities) {
			for (const tool of capability.tools) declared.set(tool.name, tool);
		}
	}
	const names = [...new Set([...declared.keys(), ...offered, ...executionsByTool.keys()])];
	const tools: ToolInventoryEntry[] = names.map((name) => {
		const definition = declared.get(name);
		const executions = executionsByTool.get(name) ?? [];
		return {
			name,
			description: definition?.description ?? '',
			inputSchema: definition?.inputSchema ?? null,
			declared: definition !== undefined,
			offered: offered.has(name),
			executions: executions.length,
			failed: executions.filter((e) => e.status === 'error').length,
		};
	});
	nodes.push({
		id: NODE_IDS.toolset,
		column: 'tools',
		kind: 'toolset',
		label: 'toolset',
		detail: { id: NODE_IDS.toolset, kind: 'toolset', tools },
		depth: 0,
		expandable: false,
		count: tools.length,
		flags: { unknown: [] },
	});

	const definitions = new Map(trace.toolset.map((d) => [d.name, d]));
	const laterCallsRecord = (execution: ToolExecutionRecord): boolean | null => {
		// null: no later call exists; false: later calls exist but none recorded the field.
		const from = trace.modelCalls.findIndex((call) => call.id === execution.modelCallId);
		const later = trace.modelCalls.slice(from + 1);
		if (later.length === 0) return null;
		return later.some((call) => call.request.toolResultIds !== undefined);
	};
	for (const execution of [...trace.toolExecutions].sort((a, b) => a.ordinal - b.ordinal)) {
		const id = NODE_IDS.tool(execution.id);
		const unknown: string[] = [];
		if (!execution.modelCallId || !callIds.has(execution.modelCallId)) unknown.push('modelCallId');
		if (laterCallsRecord(execution) === false) unknown.push('toolResultIds');
		nodes.push({
			id,
			column: 'tools',
			kind: 'tool',
			label: execution.toolName,
			detail: { id, kind: 'tool', execution, definition: definitions.get(execution.toolName) ?? null },
			depth: 0,
			expandable: false,
			flags: { failed: execution.status === 'error', unknown },
		});
		if (execution.modelCallId && callIds.has(execution.modelCallId)) {
			edge('execution', NODE_IDS.call(execution.modelCallId), id);
		}
		for (const call of trace.modelCalls) {
			if (call.request.toolResultIds?.includes(execution.toolCallId)) edge('result', id, NODE_IDS.call(call.id));
		}
		for (const { source, item } of allItems(trace)) {
			if (item.toolCallId === execution.toolCallId) edge('result', id, NODE_IDS.item(source, item.id));
		}
	}

	// ── The selected call: what its request was made of. ──
	if (selected) {
		const selectedId = NODE_IDS.call(selected.id);
		const fed = new Set<string>();
		for (const e of edges) {
			if (e.target === selectedId && (e.kind === 'request' || e.kind === 'result')) {
				e.inCall = true;
				fed.add(e.source);
			}
		}
		for (const node of nodes) {
			if (node.id === selectedId || fed.has(node.id)) node.flags.inCall = true;
		}
		// The folded prompt stands for its blocks.
		if (nodes.some((n) => n.kind === 'block' && n.flags.inCall)) {
			const prompt = nodes.find((n) => n.id === promptId);
			if (prompt) prompt.flags.inCall = true;
		}
	}
	const streamingCall = nodes.find((n) => n.kind === 'call' && n.flags.active);
	if (streamingCall) {
		for (const e of edges) if (e.target === streamingCall.id || e.source === streamingCall.id) e.active = true;
	}

	return { nodes, edges, calls: trace.modelCalls.map((call, index) => ({ id: call.id, index })) };
}

function allItems(trace: TurnTrace): { source: GroundingSourceId; item: GroundingItem }[] {
	return trace.grounding.flatMap((source) => source.items.map((item) => ({ source: source.id, item })));
}

function pushItem(
	nodes: TurnGraphNode[],
	source: GroundingSource,
	item: GroundingItem,
	trace: TurnTrace,
	parentId: string,
	depth: number,
): void {
	const id = NODE_IDS.item(source.id, item.id);
	const citation = trace.citations.find((c) => c.source === source.id && c.itemId === item.id) ?? null;
	nodes.push({
		id,
		column: 'sources',
		kind: 'item',
		label: item.title,
		detail: { id, kind: 'item', source: source.id, item, citation },
		parentId,
		depth,
		expandable: false,
		state: item.state,
		flags: { drifted: item.drifted === true, unknown: [] },
	});
}

/**
 * What the graph opens with: nothing expanded — each source is one card carrying its counts,
 * the prompt is one card, their lifted edges say what fed what; documents, chunks and blocks
 * open on demand.
 */
export function defaultGraphExpanded(_graph: TurnGraph): string[] {
	return [];
}

/** The containment chain above a node, root first. */
export function graphAncestorIds(graph: TurnGraph, id: string): string[] {
	const byId = new Map(graph.nodes.map((n) => [n.id, n]));
	const out: string[] = [];
	let current = byId.get(id)?.parentId;
	while (current) {
		out.unshift(current);
		current = byId.get(current)?.parentId;
	}
	return out;
}

/**
 * The graph as the viewer sees it: a node is visible when every expandable ancestor is
 * expanded. An edge whose endpoint is hidden lifts to that endpoint's nearest visible
 * ancestor, and edges that then coincide merge into one carrying their count — a collapsed
 * document keeps showing that its chunks entered the prompt.
 */
export function visibleTurnGraph(graph: TurnGraph, expanded: ReadonlySet<string>): TurnGraph {
	const byId = new Map(graph.nodes.map((n) => [n.id, n]));
	const visible = (id: string): boolean => {
		let current = byId.get(id)?.parentId;
		while (current) {
			const ancestor = byId.get(current);
			if (!ancestor) return false;
			if (ancestor.expandable && !expanded.has(ancestor.id)) return false;
			current = ancestor.parentId;
		}
		return true;
	};
	const lift = (id: string): string | null => {
		let current: string | undefined = id;
		while (current) {
			if (visible(current)) return current;
			current = byId.get(current)?.parentId;
		}
		return null;
	};
	const nodes = graph.nodes.filter((n) => visible(n.id));
	const merged = new Map<string, TurnGraphEdge>();
	for (const e of graph.edges) {
		const source = lift(e.source);
		const target = lift(e.target);
		if (!source || !target || source === target) continue;
		if (e.kind === 'containment' && (source !== e.source || target !== e.target)) continue;
		const key = `${e.kind}:${source}>${target}`;
		const existing = merged.get(key);
		if (existing) {
			existing.merged = (existing.merged ?? 1) + 1;
			if (e.inCall) existing.inCall = true;
			if (e.active) existing.active = true;
		} else {
			merged.set(key, { ...e, id: key, source, target });
		}
	}
	return { nodes, edges: [...merged.values()], calls: graph.calls };
}

/**
 * What lights up with a selection: everything the selected record fed into, along the data
 * flow (a chunk → its block → the calls → the answer → what it cited), what fed it directly,
 * and where it sits. The answer's upstream is the whole turn, so backward stays one hop.
 */
export function connectedIds(graph: TurnGraph, selectedId: string | null): { nodes: Set<string>; edges: Set<string> } {
	const nodes = new Set<string>();
	const edges = new Set<string>();
	if (!selectedId) return { nodes, edges };
	nodes.add(selectedId);
	const forward = graph.edges.filter((e) => e.kind !== 'containment');
	const queue = [selectedId];
	while (queue.length > 0) {
		const current = queue.shift() as string;
		for (const e of forward) {
			if (e.source !== current || edges.has(e.id)) continue;
			edges.add(e.id);
			if (!nodes.has(e.target)) {
				nodes.add(e.target);
				queue.push(e.target);
			}
		}
	}
	for (const e of graph.edges) {
		if (e.target === selectedId) {
			edges.add(e.id);
			nodes.add(e.source);
		}
	}
	for (const ancestor of graphAncestorIds(graph, selectedId)) nodes.add(ancestor);
	return { nodes, edges };
}
