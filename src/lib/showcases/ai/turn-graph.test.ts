/**
 * The turn graph over the committed fixtures — the same projection the page runs on a live
 * turn. Every edge must be a recorded relation (an unsurfaced citation is never one; a call
 * that did not record its tool results gets no result edge) and every id must resolve. The
 * geometry over the visible graph is `turn-graph-layout.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import type { TurnTrace, TurnTraceSnapshot } from '$lib/types/turn-trace';
import { chatbotGrounded } from './fixtures/chatbot-grounded';
import { deskbotPlan } from './fixtures/deskbot-plan';
import { deskbotSentinel } from './fixtures/deskbot-sentinel';
import { inspectedFromSnapshot, NODE_IDS } from './inspector';
import {
	connectedIds,
	defaultGraphExpanded,
	graphAncestorIds,
	type TurnGraph,
	turnGraph,
	visibleTurnGraph,
} from './turn-graph';

const trace = chatbotGrounded.trace;
const graph = turnGraph(trace, { answer: chatbotGrounded.answer, profile: chatbotGrounded.profile });
const byId = (g: TurnGraph) => new Map(g.nodes.map((n) => [n.id, n]));

describe.each([
	['chatbot-grounded', chatbotGrounded],
	['deskbot-plan', deskbotPlan],
	['deskbot-sentinel', deskbotSentinel],
])('turn graph — %s', (_name, fixture) => {
	const t = fixture.trace;
	const g = turnGraph(t, { answer: fixture.answer, profile: fixture.profile });
	const nodes = byId(g);

	it('has unique node ids, and every edge joins two of them', () => {
		expect(new Set(g.nodes.map((n) => n.id)).size).toBe(g.nodes.length);
		expect(new Set(g.edges.map((e) => e.id)).size).toBe(g.edges.length);
		for (const e of g.edges) {
			expect(nodes.has(e.source), e.id).toBe(true);
			expect(nodes.has(e.target), e.id).toBe(true);
		}
	});

	it('gives every execution one card, attached to its recorded call', () => {
		const tools = g.nodes.filter((n) => n.kind === 'tool');
		expect(tools.map((n) => n.id).sort()).toEqual(t.toolExecutions.map((e) => NODE_IDS.tool(e.id)).sort());
		for (const e of t.toolExecutions) {
			const attached = g.edges.filter((x) => x.kind === 'execution' && x.target === NODE_IDS.tool(e.id));
			expect(attached.map((x) => x.source)).toEqual(e.modelCallId ? [NODE_IDS.call(e.modelCallId)] : []);
		}
	});

	it('draws inclusion only from an item that names a block the prompt carried', () => {
		const inclusion = g.edges.filter((e) => e.kind === 'inclusion');
		const expected = t.grounding.flatMap((s) =>
			s.items
				.filter((i) => i.blockId && t.blocks.some((b) => b.id === i.blockId))
				.map((i) => `${NODE_IDS.item(s.id, i.id)}>${NODE_IDS.block(i.blockId ?? '')}`),
		);
		expect(inclusion.map((e) => `${e.source}>${e.target}`).sort()).toEqual(expected.sort());
	});

	it('draws a request from exactly the blocks each call recorded, and the history into every call that counted messages', () => {
		for (const call of t.modelCalls) {
			const into = g.edges.filter((e) => e.kind === 'request' && e.target === NODE_IDS.call(call.id));
			const blocks = call.request.blockIds.filter((b) => t.blocks.some((x) => x.id === b)).map(NODE_IDS.block);
			const history = call.request.historyCount > 0 ? [NODE_IDS.history] : [];
			expect(into.map((e) => e.source).sort()).toEqual([...blocks, ...history].sort());
		}
	});

	it('draws a result into a later call only when that call recorded the tool result, and onto items the tool surfaced', () => {
		for (const e of g.edges.filter((x) => x.kind === 'result')) {
			const execution = t.toolExecutions.find((x) => NODE_IDS.tool(x.id) === e.source);
			expect(execution, e.id).toBeDefined();
			const target = nodes.get(e.target);
			if (target?.kind === 'call') {
				const call = t.modelCalls.find((c) => NODE_IDS.call(c.id) === e.target);
				expect(call?.request.toolResultIds, e.id).toContain(execution?.toolCallId);
			} else {
				expect(target?.kind).toBe('item');
				expect(target?.detail?.kind === 'item' && target.detail.item.toolCallId).toBe(execution?.toolCallId);
			}
		}
	});

	it('never draws a citation edge for an unsurfaced path, and counts it on the answer instead', () => {
		const citations = g.edges.filter((e) => e.kind === 'citation');
		expect(citations.length).toBe(
			t.citations.filter((c) => c.match !== 'unsurfaced' && nodes.has(NODE_IDS.item(c.source, c.itemId))).length,
		);
		const answer = nodes.get(NODE_IDS.answer);
		if (answer?.detail?.kind === 'answer') {
			expect(answer.detail.unsurfaced).toBe(t.citations.filter((c) => c.match === 'unsurfaced').length);
		}
	});

	it('ends the context column on the answer for the chatbot and on the proposal for a deskbot turn that stopped', () => {
		const last = g.nodes.filter((n) => n.column === 'context').at(-1);
		expect(last?.kind).toBe(t.surface === 'deskbot' && t.proposalId ? 'proposal' : 'answer');
		const lastOk = [...t.modelCalls].reverse().find((c) => c.outcome === 'ok');
		if (lastOk && last) {
			expect(
				g.edges.some((e) => e.kind === 'request' && e.source === NODE_IDS.call(lastOk.id) && e.target === last.id),
			).toBe(true);
		}
	});

	it('keeps containment and data flow apart, and containment only in the sources column', () => {
		for (const e of g.edges) {
			const [source, target] = [nodes.get(e.source), nodes.get(e.target)];
			if (e.kind === 'containment') {
				expect(source?.column).toBe('sources');
				expect(target?.column).toBe('sources');
				expect(target?.parentId).toBe(e.source);
			}
		}
	});
});

describe('turn graph — the chatbot fixture in detail', () => {
	const nodes = byId(graph);

	it('opens with nothing expanded — one card per source and one for the prompt, edges lifted onto them', () => {
		expect(defaultGraphExpanded(graph)).toEqual([]);
		const visible = visibleTurnGraph(graph, new Set());
		expect(visible.nodes.filter((n) => n.column === 'sources').map((n) => n.kind)).toEqual([
			'source',
			'source',
			'source',
		]);
		expect(visible.nodes.filter((n) => n.column === 'context').map((n) => n.kind)).toEqual([
			'prompt',
			'history',
			'call',
			'call',
			'answer',
		]);
		const inclusion = visible.edges.find((e) => e.kind === 'inclusion' && e.source === NODE_IDS.source('project-docs'));
		expect(inclusion).toMatchObject({ target: NODE_IDS.group('prompt'), merged: 4 });
		const request = visible.edges.find((e) => e.kind === 'request' && e.source === NODE_IDS.group('prompt'));
		expect(request).toMatchObject({ target: NODE_IDS.call('demo_call_1'), merged: trace.blocks.length });
	});

	it('unfolds the prompt into its blocks in cache order with the boundary between stable and dynamic', () => {
		const visible = visibleTurnGraph(graph, new Set([NODE_IDS.group('prompt')]));
		const context = visible.nodes.filter((n) => n.column === 'context');
		const blocks = context.filter((n) => n.kind === 'block');
		expect(blocks.map((n) => n.label)).toEqual(trace.blocks.map((b) => b.id));
		expect(blocks.every((n) => n.parentId === NODE_IDS.group('prompt') && n.depth === 1)).toBe(true);
		const boundaryAt = context.findIndex((n) => n.kind === 'boundary');
		const firstDynamic = context.findIndex((n) => n.kind === 'block' && n.flags.stable === false);
		expect(boundaryAt).toBe(firstDynamic - 1);
	});

	it('groups the retrieved chunks under their documents and parents, and folds the omitted ones away', () => {
		const doc = nodes.get(NODE_IDS.document('project-docs', 'demo_document_1'));
		expect(doc).toMatchObject({ kind: 'document', parentId: NODE_IDS.source('project-docs'), depth: 1, count: 1 });
		const parent = nodes.get(NODE_IDS.parentChunk('demo_parent_1'));
		expect(parent).toMatchObject({ kind: 'parent', parentId: doc?.id, depth: 2, flags: { current: true } });
		const chunk = nodes.get(NODE_IDS.item('project-docs', 'demo_chunk_1'));
		expect(chunk).toMatchObject({ kind: 'item', parentId: parent?.id, depth: 3, state: 'included' });
		expect(graphAncestorIds(graph, chunk?.id ?? '')).toEqual([NODE_IDS.source('project-docs'), doc?.id, parent?.id]);
		const omitted = nodes.get(NODE_IDS.omitted('project-docs'));
		expect(omitted).toMatchObject({ kind: 'omitted', count: 8, expandable: true });
		expect(nodes.get(NODE_IDS.item('project-docs', 'demo_chunk_5'))?.parentId).toBe(omitted?.id);
	});

	it('lifts a hidden chunk’s inclusion onto its collapsed document, counting what it stands for', () => {
		const visible = visibleTurnGraph(graph, new Set([NODE_IDS.source('project-docs'), NODE_IDS.group('prompt')]));
		expect(visible.nodes.some((n) => n.kind === 'item')).toBe(false);
		expect(visible.nodes.filter((n) => n.kind === 'document')).toHaveLength(4);
		const lifted = visible.edges.find(
			(e) => e.kind === 'inclusion' && e.source === NODE_IDS.document('project-docs', 'demo_document_3'),
		);
		expect(lifted?.target).toBe(NODE_IDS.block('retrieval-context'));
		expect(lifted?.merged).toBeUndefined();
		// Containment edges to hidden children vanish rather than lift onto themselves.
		expect(visible.edges.every((e) => e.source !== e.target)).toBe(true);
		const toCatalog = visible.edges.filter((e) => e.kind === 'result' && e.target === NODE_IDS.source('catalog'));
		expect(toCatalog).toHaveLength(1);
		expect(toCatalog[0]?.merged).toBe(3);
	});

	it('follows a chunk forward to its block, the calls, the answer and what the answer cited', () => {
		const chunk = NODE_IDS.item('project-docs', 'demo_chunk_1');
		const { nodes: connected, edges } = connectedIds(graph, chunk);
		for (const id of [
			chunk,
			NODE_IDS.block('retrieval-context'),
			NODE_IDS.call('demo_call_1'),
			NODE_IDS.call('demo_call_2'),
			NODE_IDS.answer,
			NODE_IDS.item('catalog', 'doc:en:/docs/blueprint/pages'),
			NODE_IDS.document('project-docs', 'demo_document_1'),
			NODE_IDS.source('project-docs'),
		]) {
			expect(connected.has(id), id).toBe(true);
		}
		expect(connected.has(NODE_IDS.block('role'))).toBe(false);
		expect(connected.has(NODE_IDS.group('prompt'))).toBe(false);
		expect(edges.size).toBeGreaterThan(0);
		expect(connectedIds(graph, null).nodes.size).toBe(0);
	});

	it('marks what the selected call was made of: its blocks, the history or the tool result it carried', () => {
		const second = turnGraph(trace, { callId: 'demo_call_2' });
		const marked = byId(second);
		expect(marked.get(NODE_IDS.call('demo_call_2'))?.flags.inCall).toBe(true);
		expect(marked.get(NODE_IDS.tool('demo_tool_1'))?.flags.inCall).toBe(true);
		expect(marked.get(NODE_IDS.block('role'))?.flags.inCall).toBe(true);
		expect(marked.get(NODE_IDS.group('prompt'))?.flags.inCall).toBe(true);
		expect(marked.get(NODE_IDS.history)?.flags.inCall).toBe(true);
		expect(marked.get(NODE_IDS.call('demo_call_1'))?.flags.inCall).toBeUndefined();
		const toolset = marked.get(NODE_IDS.toolset)?.detail;
		expect(toolset?.kind === 'toolset' && toolset.tools.find((t) => t.name === 'search_catalog')).toMatchObject({
			declared: true,
			offered: true,
			executions: 1,
			failed: 0,
		});
		const first = byId(turnGraph(trace, { callId: 'demo_call_1' }));
		expect(first.get(NODE_IDS.history)?.flags.inCall).toBe(true);
		expect(first.get(NODE_IDS.tool('demo_tool_1'))?.flags.inCall).toBeUndefined();
	});

	it('says "not recorded" instead of guessing when a call did not record its tool results', () => {
		const bare: TurnTrace = {
			...trace,
			modelCalls: trace.modelCalls.map((c) => {
				const { toolResultIds: _dropped, ...request } = c.request;
				return { ...c, request };
			}),
		};
		const g = turnGraph(bare);
		expect(g.edges.some((e) => e.kind === 'result' && e.target === NODE_IDS.call('demo_call_2'))).toBe(false);
		expect(byId(g).get(NODE_IDS.tool('demo_tool_1'))?.flags.unknown).toContain('toolResultIds');
		expect(byId(g).get(NODE_IDS.call('demo_call_2'))?.flags.unknown).toContain('toolResultIds');
		// The recorded fixture knows.
		expect(nodes.get(NODE_IDS.tool('demo_tool_1'))?.flags.unknown).toEqual([]);
	});

	it('renders the streaming snapshot with the same nodes as the persisted turn', () => {
		const { blocks, toolExecutions, toolset: _toolset, createdAt: _at, proposal: _p, bodies: _b, ...rest } = trace;
		const snapshot: TurnTraceSnapshot = {
			...rest,
			blocks: blocks.map(({ text: _text, ...outline }) => outline),
			toolExecutions: toolExecutions.map(({ input: _i, output: _o, ...outline }) => outline),
			bodies: 'persisted',
		};
		const live = inspectedFromSnapshot(snapshot, { question: 'q', answer: 'a', at: '2026-09-13T10:00:00.000Z' }, null);
		expect(live.provenance).toEqual({ kind: 'live', recordedAt: '2026-09-13' });
		expect(live.trace.bodies).toBe('persisted');
		const g = turnGraph(live.trace, { answer: live.answer, profile: chatbotGrounded.profile });
		expect(g.nodes.map((n) => n.id)).toEqual(graph.nodes.map((n) => n.id));
		// No tool definitions yet: the inventory still names what the profile declares.
		const toolset = byId(g).get(NODE_IDS.toolset)?.detail;
		expect(toolset?.kind === 'toolset' && toolset.tools.map((t) => t.name)).toContain('search_project_docs');
	});

	it('marks an open call and its edges active while the last attempt is still running', () => {
		const streaming: TurnTrace = {
			...trace,
			modelCalls: [trace.modelCalls[0], { ...trace.modelCalls[1], response: null, durationMs: null }],
			attempts: [{ ...trace.attempts[0], outcome: 'started' }],
		};
		const g = turnGraph(streaming);
		expect(byId(g).get(NODE_IDS.call('demo_call_2'))?.flags.active).toBe(true);
		expect(
			g.edges.filter((e) => e.active).every((e) => e.source === 'call:demo_call_2' || e.target === 'call:demo_call_2'),
		).toBe(true);
		expect(g.edges.some((e) => e.active)).toBe(true);
	});
});
