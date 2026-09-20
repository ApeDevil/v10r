/**
 * The inspector projection over the committed fixture — the same functions the page runs on
 * a live turn — plus the fixture's own integrity: it must be a `TurnTrace` the server could
 * have written (sizes equal to bodies, citations naming items that exist, executions inside
 * calls that exist) and it must carry no real id, or the scrubber is not doing its job.
 */

import { describe, expect, it } from 'vitest';
import { TOOL_MANIFEST } from '$lib/types/ai-tools';
import type { TurnTrace } from '$lib/types/turn-trace';
import { chatbotGrounded } from './fixtures/chatbot-grounded';
import { deskbotPlan } from './fixtures/deskbot-plan';
import { deskbotSentinel } from './fixtures/deskbot-sentinel';
import {
	ancestorIds,
	expandableIds,
	findInspectorNode,
	guardPassed,
	inspectorTree,
	NODE_IDS,
	profileDrifted,
	scrubTurn,
	servedBy,
	spineOf,
	timelineRows,
	turnOptions,
	visibleNodes,
} from './inspector';
import { AI_LAYERS } from './topology';

const turn = chatbotGrounded;
const trace = turn.trace;

describe('inspectorTree', () => {
	const tree = inspectorTree(turn);
	const groups = tree.map((n) => (n.kind === 'group' ? n.group : n.kind));

	it('walks the five states in commitment order, awareness beside them', () => {
		expect(groups).toEqual(['available', 'awareness', 'considered', 'prompt', 'calls', 'cited']);
	});

	it('gives only a deskbot turn the proposal group, after the calls', () => {
		const desk = inspectorTree(deskbotPlan).map((n) => (n.kind === 'group' ? n.group : n.kind));
		expect(desk).toEqual(['available', 'awareness', 'considered', 'prompt', 'calls', 'proposal', 'cited']);
	});

	it('AVAILABLE is the profile: identity, every capability with its tools, every inventory', () => {
		const available = findInspectorNode(tree, NODE_IDS.group('available'));
		expect(available?.kind).toBe('group');
		const kids = available && 'children' in available ? available.children : [];
		expect(kids[0]?.kind).toBe('identity');
		const capabilities = kids.filter((k) => k.kind === 'capability');
		expect(capabilities.map((c) => c.id)).toEqual(
			turn.profile?.capabilities.map((c) => NODE_IDS.capability(c.id)) ?? [],
		);
		const definitions = capabilities.flatMap((c) => ('children' in c ? c.children : []));
		expect(definitions.map((d) => d.id).sort()).toEqual(
			(turn.profile?.capabilities.flatMap((c) => c.tools.map((t) => NODE_IDS.toolDefinition(t.name))) ?? []).sort(),
		);
		expect(kids.filter((k) => k.kind === 'inventory')).toHaveLength(turn.profile?.grounding.length ?? 0);
	});

	it('pairs each capability with the trace activation of the same id', () => {
		for (const activation of trace.activations) {
			const node = findInspectorNode(tree, NODE_IDS.capability(activation.id));
			expect(node?.kind === 'capability' && node.activation).toEqual(activation);
		}
	});

	it('CONSIDERED lists every grounding item under its source with its citation, if any', () => {
		for (const source of trace.grounding) {
			const node = findInspectorNode(tree, NODE_IDS.source(source.id));
			expect(node?.kind).toBe('source');
			if (node?.kind !== 'source') return;
			expect(node.children.map((c) => c.id)).toEqual(source.items.map((i) => NODE_IDS.item(source.id, i.id)));
			expect(node.included).toBe(source.items.filter((i) => i.state !== 'considered').length);
		}
		for (const citation of trace.citations) {
			const item = findInspectorNode(tree, NODE_IDS.item(citation.source, citation.itemId));
			expect(item?.kind === 'item' && item.citation).toEqual(citation);
		}
	});

	it('PROMPT lists the blocks in recorded order, then the history', () => {
		const prompt = findInspectorNode(tree, NODE_IDS.group('prompt'));
		const kids = prompt && 'children' in prompt ? prompt.children : [];
		expect(kids.map((k) => k.id)).toEqual([...trace.blocks.map((b) => NODE_IDS.block(b.id)), NODE_IDS.history]);
	});

	it('nests each tool execution under the model call that issued it', () => {
		for (const execution of trace.toolExecutions) {
			const call = execution.modelCallId ? findInspectorNode(tree, NODE_IDS.call(execution.modelCallId)) : null;
			expect(call?.kind).toBe('call');
			if (call?.kind !== 'call') return;
			expect(call.children.map((c) => c.id)).toContain(NODE_IDS.tool(execution.id));
			const tool = findInspectorNode(call.children, NODE_IDS.tool(execution.id));
			expect(tool?.kind === 'tool' && tool.definition?.name).toBe(execution.toolName);
		}
	});

	it('CITED resolves each citation to the item it names', () => {
		const cited = findInspectorNode(tree, NODE_IDS.group('cited'));
		const kids = cited && 'children' in cited ? cited.children : [];
		expect(kids).toHaveLength(trace.citations.length);
		for (const node of kids) {
			expect(node.kind === 'citation' && node.item?.path).toBe(
				node.kind === 'citation' ? node.citation.path : undefined,
			);
		}
	});

	it('omits AVAILABLE when the profile has not loaded', () => {
		const without = inspectorTree({ ...turn, profile: null });
		expect(without.map((n) => n.id)).not.toContain(NODE_IDS.group('available'));
	});
});

describe('inspectorTree — the deskbot proposal', () => {
	it('opens the resolved proposal with one node per planned step and its receipt', () => {
		const tree = inspectorTree(deskbotPlan);
		const group = findInspectorNode(tree, NODE_IDS.group('proposal'));
		expect(group?.kind === 'group' && group.count).toBe(deskbotPlan.trace.proposal?.steps.length);
		const proposal = findInspectorNode(tree, NODE_IDS.proposal);
		expect(proposal?.kind).toBe('proposal');
		if (proposal?.kind !== 'proposal') return;
		expect(proposal.proposal.status).toBe('executed');
		expect(proposal.children.map((c) => c.id)).toEqual(proposal.proposal.steps.map((_, i) => NODE_IDS.proposalStep(i)));
		for (const [i, step] of proposal.children.entries()) {
			expect(step.kind === 'proposal-step' && step.receipt?.stepIndex).toBe(i);
			expect(step.kind === 'proposal-step' && step.receipt?.kind).toBe('ok');
		}
	});

	it('shows a pending proposal with its steps not run', () => {
		const proposal = findInspectorNode(inspectorTree(deskbotSentinel), NODE_IDS.proposal);
		expect(proposal?.kind === 'proposal' && proposal.proposal.status).toBe('pending');
		const step = proposal?.kind === 'proposal' ? proposal.children[0] : undefined;
		expect(step?.kind === 'proposal-step' && step.receipt).toBeNull();
	});

	it('keeps the group, empty, for a deskbot turn that proposed nothing', () => {
		const bare = { ...deskbotPlan, trace: { ...deskbotPlan.trace, proposalId: null, proposal: undefined } };
		const group = findInspectorNode(inspectorTree(bare), NODE_IDS.group('proposal'));
		expect(group?.kind === 'group' && group.count).toBe(0);
		expect(group && 'children' in group ? group.children : null).toEqual([]);
	});
});

describe('visibleNodes', () => {
	const tree = inspectorTree(turn);

	it('shows only the roots when nothing is expanded, everything when all is', () => {
		expect(visibleNodes(tree, new Set()).map((r) => r.depth)).toEqual(tree.map(() => 0));
		const all = visibleNodes(tree, new Set(expandableIds(tree)));
		const count = (nodes: typeof tree): number =>
			nodes.reduce((n, node) => n + 1 + ('children' in node ? count(node.children) : 0), 0);
		expect(all).toHaveLength(count(tree));
	});

	it('gives every row a unique id — the keyed each block throws on a duplicate', () => {
		const ids = visibleNodes(tree, new Set(expandableIds(tree))).map((r) => r.node.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('records depth and parent for keyboard navigation', () => {
		const rows = visibleNodes(tree, new Set([NODE_IDS.group('calls')]));
		const call = rows.find((r) => r.node.kind === 'call');
		expect(call?.depth).toBe(1);
		expect(call?.parentId).toBe(NODE_IDS.group('calls'));
		expect(call?.expandable).toBe(true);
	});

	it('names the ancestors a selection must expand to become visible', () => {
		const execution = trace.toolExecutions[0];
		if (!execution?.modelCallId) throw new Error('fixture has no tool execution under a call');
		const path = ancestorIds(tree, NODE_IDS.tool(execution.id));
		expect(path).toEqual([NODE_IDS.group('calls'), NODE_IDS.call(execution.modelCallId)]);
		expect(visibleNodes(tree, new Set(path)).some((r) => r.node.id === NODE_IDS.tool(execution.id))).toBe(true);
		expect(ancestorIds(tree, NODE_IDS.group('calls'))).toEqual([]);
		expect(ancestorIds(tree, 'nope')).toEqual([]);
	});
});

describe('timelineRows', () => {
	const rows = timelineRows(trace);

	it('lays out lanes, calls with their executions nested, then the finalize stages', () => {
		expect(rows.map((r) => r.groupId)).toEqual([
			...trace.grounding.map(() => 'assembly'),
			...trace.modelCalls.flatMap((c) => [
				'calls',
				...trace.toolExecutions.filter((e) => e.modelCallId === c.id).map(() => 'calls'),
			]),
			...Object.values(trace.timings.finalize ?? {})
				.filter((ms) => ms !== undefined)
				.map(() => 'finalize'),
		]);
		const execution = rows.find((r) => r.id === NODE_IDS.tool(trace.toolExecutions[0]?.id ?? ''));
		expect(execution?.depth).toBe(1);
		expect(execution?.parentId).toBe(NODE_IDS.call(trace.toolExecutions[0]?.modelCallId ?? ''));
	});

	it('marks a lane that did not run as skipped and colours by design token only', () => {
		// The chatbot fixture's lanes all ran (the tools surfaced catalog rows); the deskbot's desk lane did not.
		const deskTrace = deskbotPlan.trace;
		const skipped = deskTrace.grounding.find((g) => !g.ran);
		expect(skipped).toBeDefined();
		const deskRows = timelineRows(deskTrace);
		expect(deskRows.find((r) => r.id === NODE_IDS.source(skipped?.id ?? ''))?.status).toBe('skipped');
		for (const row of [...rows, ...deskRows]) expect(row.color).toMatch(/^var\(--chart-\d\)$/);
	});

	it('starts the finalize stages after the last model call ends', () => {
		const lastCallEnd = Math.max(...trace.modelCalls.map((c) => (c.startOffsetMs ?? 0) + (c.durationMs ?? 0)));
		const first = rows.find((r) => r.groupId === 'finalize');
		expect(first?.startOffsetMs).toBe(lastCallEnd);
	});
});

describe('spineOf', () => {
	it('lights every chatbot band from the recorded facts alone', () => {
		const layers = spineOf(trace);
		for (const layer of AI_LAYERS.filter((l) => l.surfaces.includes('chatbot'))) {
			expect(layers[layer.id], layer.id).toBeDefined();
		}
		expect(layers.guard).toBe('done');
		expect(layers.retrieval).toBe('done');
		expect(layers.harness).toBe(trace.toolExecutions.length > 0 ? 'done' : 'skipped');
		expect(layers.gate).toBe('done');
		expect(layers.stream).toBe('done');
		expect(layers.persist).toBe('done');
	});

	it('reports a failed last attempt as a stream error and a lane error as a retrieval error', () => {
		const failed: TurnTrace = {
			...trace,
			attempts: [{ attemptIndex: 0, providerId: 'p', modelId: 'm', outcome: 'failed', errorKind: 'rate_limit' }],
			grounding: [{ id: 'project-docs', ran: true, error: 'boom', items: [] }],
		};
		const layers = spineOf(failed);
		expect(layers.stream).toBe('error');
		expect(layers.retrieval).toBe('error');
	});

	it('the guard of a turn that exists has passed', () => {
		expect(guardPassed().every((g) => g.status === 'done')).toBe(true);
	});

	it("lights the deskbot's gate from the proposal: taken, pending, declined by the human, or never reached", () => {
		expect(spineOf(deskbotPlan.trace).gate).toBe('done');
		expect(spineOf(deskbotSentinel.trace).gate).toBe('active');
		const rejected = { ...deskbotSentinel.trace, proposal: { ...deskbotSentinel.trace.proposal, status: 'rejected' } };
		expect(spineOf(rejected as TurnTrace).gate).toBe('not-taken');
		const expired = { ...deskbotSentinel.trace, proposal: { ...deskbotSentinel.trace.proposal, status: 'expired' } };
		expect(spineOf(expired as TurnTrace).gate).toBe('not-taken');
		expect(spineOf({ ...deskbotSentinel.trace, proposal: undefined }).gate).toBe('done');
		expect(spineOf({ ...deskbotSentinel.trace, proposalId: null, proposal: undefined }).gate).toBe('skipped');
		expect(spineOf(deskbotPlan.trace).harness).toBe('done');
	});
});

describe('servedBy / turnOptions', () => {
	it('names the attempt that answered', () => {
		expect(servedBy(trace)).toBe('google / gemini-2.5-flash');
		expect(servedBy({ ...trace, attempts: [] })).toBeNull();
	});

	it('pairs a turn with the user message before it', () => {
		const messages = [
			{ id: 'u1', role: 'user', content: 'first?' },
			{ id: 'a1', role: 'assistant', content: 'one' },
			{ id: 'u2', role: 'user', content: 'second?' },
			{ id: 'a2', role: 'assistant', content: 'two' },
		];
		const summaries = [
			{ messageId: 'a2', createdAt: '2026-09-12T00:00:00.000Z', outcome: 'ok' as const },
			{ messageId: 'a1', createdAt: '2026-09-12T00:00:00.000Z', outcome: 'ok' as const },
		].map((s) => ({
			...s,
			surface: 'chatbot' as const,
			activations: [],
			citations: [],
			cited: [],
		}));
		expect(turnOptions(messages, summaries).map((t) => t.question)).toEqual(['second?', 'first?']);
	});
});

describe('profileDrifted', () => {
	const profile = turn.profile as NonNullable<typeof turn.profile>;

	it('finds no drift between the fixture and the profile it carries', () => {
		expect(profileDrifted(turn, profile)).toBe(false);
	});

	it('reports a changed identity, a changed guidance block or a changed tool definition', () => {
		expect(profileDrifted(turn, { ...profile, identity: { ...profile.identity, text: 'someone else' } })).toBe(true);
		const guidance = profile.capabilities.map((c) =>
			c.id === 'project-docs' ? { ...c, guidance: `${c.guidance} — and more` } : c,
		);
		expect(profileDrifted(turn, { ...profile, capabilities: guidance })).toBe(true);
		const tools = profile.capabilities.map((c) => ({
			...c,
			tools: c.tools.map((t) => (t.name === 'search_catalog' ? { ...t, description: 'changed' } : t)),
		}));
		expect(profileDrifted(turn, { ...profile, capabilities: tools })).toBe(true);
	});

	it('makes no claim from bodies the turn does not carry', () => {
		const withheld = { ...turn, trace: { ...trace, blocks: trace.blocks.map(({ text: _t, ...b }) => b), toolset: [] } };
		expect(profileDrifted(withheld, { ...profile, identity: { ...profile.identity, text: 'someone else' } })).toBe(
			false,
		);
	});
});

describe('scrubTurn', () => {
	const UUID = '550e8400-e29b-41d4-a716-446655440000';
	const real: typeof turn = {
		...turn,
		trace: {
			...trace,
			messageId: 'msg_real',
			conversationId: 'cnv_real',
			requestId: 'req_real',
			modelCalls: trace.modelCalls.map((c, i) => ({ ...c, id: `mc_${i}` })),
			toolExecutions: trace.toolExecutions.map((e) => ({
				...e,
				id: 'tc_real',
				toolCallId: 'call_abc',
				modelCallId: 'mc_0',
				output: { echo: `see chunk ${UUID} and call_abc` },
			})),
			grounding: trace.grounding.map((g) =>
				g.id === 'project-docs'
					? {
							...g,
							items: g.items.map((it, i) => ({
								...it,
								id: `${UUID.slice(0, 35)}${i}`,
								documentId: 'doc_real',
								// The first chunk's parent is the second chunk (a candidate itself); the rest share one parent.
								...(it.parentId ? { parentId: i === 0 ? `${UUID.slice(0, 35)}1` : 'parent_real' } : {}),
							})),
						}
					: g,
			),
		},
	};

	it('renames every id consistently — the record still joins up', () => {
		const scrubbed = scrubTurn(real);
		expect(scrubbed.trace.messageId).toBe('demo_turn');
		expect(scrubbed.trace.conversationId).toBe('demo_conversation');
		expect(scrubbed.trace.requestId).toBe('demo_request');
		expect(scrubbed.trace.modelCalls.map((c) => c.id)).toEqual(['demo_call_1', 'demo_call_2']);
		const execution = scrubbed.trace.toolExecutions[0];
		expect(execution?.id).toBe('demo_tool_1');
		expect(execution?.toolCallId).toBe('demo_tool_call_1');
		expect(execution?.modelCallId).toBe('demo_call_1');
		expect(scrubbed.trace.modelCalls[0]?.response?.toolCalls[0]?.toolCallId).toBe('demo_tool_call_1');
		expect(JSON.stringify(execution?.output)).toContain('demo_tool_call_1');
		const docs = scrubbed.trace.grounding.find((g) => g.id === 'project-docs');
		expect(docs?.items.map((i) => i.id)).toEqual(docs?.items.map((_, i) => `demo_chunk_${i + 1}`));
		expect(new Set(docs?.items.map((i) => i.documentId))).toEqual(new Set(['demo_document_1']));
		// A parent that is a candidate keeps its chunk name; every other parent is a demo parent.
		expect(docs?.items[0]?.parentId).toBe('demo_chunk_2');
		expect(new Set(docs?.items.slice(1).flatMap((i) => (i.parentId ? [i.parentId] : [])))).toEqual(
			new Set(['demo_parent_1']),
		);
	});

	it('leaves no UUID anywhere in the record', () => {
		const scrubbed = scrubTurn(real);
		expect(JSON.stringify(scrubbed)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
		expect(JSON.stringify(scrubbed)).not.toContain('_real');
	});

	it('is idempotent on an already-scrubbed turn', () => {
		expect(scrubTurn(turn)).toEqual(turn);
	});

	it("renames a deskbot turn's proposal, panel and file ids across the awareness, the plan and the receipts", () => {
		const desk = deskbotPlan.trace;
		const real: typeof deskbotPlan = {
			...deskbotPlan,
			trace: {
				...desk,
				proposalId: 'prp_real',
				awareness: {
					...desk.awareness,
					workspace: { id: 'wsp_real', name: 'Planning' },
					layout: [{ panelId: 'pnl_real', fileId: 'fil_real', fileType: 'markdown', label: 'todo.md' }],
					panels: [{ panelType: 'markdown', label: 'todo.md', fileId: 'fil_real', chars: 10 }],
				},
				blocks: desk.blocks.map((b) => (b.id === 'desk-layout' ? { ...b, text: '- todo.md [fil_real]' } : b)),
				proposal: desk.proposal && {
					...desk.proposal,
					id: 'prp_real',
					steps: [
						{
							...(desk.proposal.steps[0] as NonNullable<typeof desk.proposal>['steps'][number]),
							target: { fileId: 'fil_real', fileType: 'markdown', name: 'todo.md', version: 4 },
						},
					],
					receipts: [
						{
							stepIndex: 0,
							toolName: 'desk_create_markdown',
							kind: 'ok',
							output: { fileId: 'fil_created' },
							errorMessage: null,
						},
					],
				},
			},
		};
		const scrubbed = scrubTurn(real);
		expect(scrubbed.trace.proposalId).toBe('demo_proposal');
		expect(scrubbed.trace.proposal?.id).toBe('demo_proposal');
		expect(scrubbed.trace.awareness.workspace?.id).toBe('demo_workspace');
		expect(scrubbed.trace.awareness.layout?.[0]).toMatchObject({ panelId: 'demo_panel_1', fileId: 'demo_file_1' });
		expect(scrubbed.trace.blocks.find((b) => b.id === 'desk-layout')?.text).toBe('- todo.md [demo_file_1]');
		expect(scrubbed.trace.proposal?.steps[0]?.target?.fileId).toBe('demo_file_1');
		expect(scrubbed.trace.proposal?.receipts[0]?.output).toEqual({ fileId: 'demo_file_2' });
	});
});

describe.each([
	['chatbot-grounded', chatbotGrounded],
	['deskbot-plan', deskbotPlan],
	['deskbot-sentinel', deskbotSentinel],
])('fixture integrity — %s', (_name, fixture) => {
	const trace = fixture.trace;

	it('says what it is', () => {
		expect(['authored', 'recorded']).toContain(fixture.provenance.kind);
		expect(fixture.provenance.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(fixture.question.length).toBeGreaterThan(0);
		expect(fixture.answer.length).toBeGreaterThan(0);
		expect(fixture.profile?.surface).toBe(trace.surface);
	});

	it('carries demo ids only', () => {
		expect(trace.messageId).toBe('demo_turn');
		expect(trace.conversationId).toBe('demo_conversation');
		expect(trace.requestId).toBe('demo_request');
		expect(scrubTurn(fixture)).toEqual(fixture);
	});

	it('records sizes that match the bodies it carries', () => {
		for (const block of trace.blocks) expect(block.chars, block.id).toBe(block.text?.length);
		for (const source of trace.grounding) {
			for (const item of source.items) {
				if (item.body !== undefined && item.chars !== undefined) expect(item.chars, item.id).toBe(item.body.length);
			}
		}
	});

	it('orders the prompt blocks stable-first, as the composer does', () => {
		const stable = trace.blocks.map((b) => b.stable);
		const boundary = stable.indexOf(false);
		expect(boundary).toBeGreaterThan(0);
		expect(stable.slice(boundary)).not.toContain(true);
		for (const call of trace.modelCalls) expect(call.request.blockIds).toEqual(trace.blocks.map((b) => b.id));
	});

	it('names only tools the manifest knows, and offers only what the toolset defines', () => {
		const known = new Set([...TOOL_MANIFEST.map((d) => d.name), 'resolve_ref']);
		const defined = new Set(trace.toolset.map((t) => t.name));
		for (const call of trace.modelCalls) {
			for (const name of call.request.toolsOffered) {
				expect(known.has(name), name).toBe(true);
				expect(defined.has(name), name).toBe(true);
			}
		}
		for (const execution of trace.toolExecutions) {
			expect(defined.has(execution.toolName)).toBe(true);
			expect(trace.modelCalls.some((c) => c.id === execution.modelCallId)).toBe(true);
		}
	});

	it('records rows only under a source that ran, and names a real execution on every tool-surfaced item', () => {
		const executions = new Set(trace.toolExecutions.map((e) => e.toolCallId));
		for (const source of trace.grounding) {
			if (source.items.length > 0) expect(source.ran, source.id).toBe(true);
			for (const item of source.items) {
				if (item.toolCallId !== undefined) expect(executions.has(item.toolCallId), item.id).toBe(true);
				if (item.state === 'executed') expect(item.toolCallId, item.id).toBeDefined();
			}
		}
	});

	it('names on every call only the tool results of executions the turn ran', () => {
		const executions = new Set(trace.toolExecutions.map((e) => e.toolCallId));
		for (const call of trace.modelCalls) {
			for (const id of call.request.toolResultIds ?? []) expect(executions.has(id), call.id).toBe(true);
		}
	});

	it('cites only items the grounding produced, and marks them cited', () => {
		for (const citation of trace.citations) {
			const source = trace.grounding.find((g) => g.id === citation.source);
			const item = source?.items.find((i) => i.id === citation.itemId);
			expect(item, citation.itemId).toBeDefined();
			expect(item?.state).toBe('cited');
		}
	});

	it('activates exactly the profile capabilities', () => {
		expect(trace.activations.map((a) => a.id).sort()).toEqual(
			(fixture.profile?.capabilities.map((c) => c.id) ?? []).sort(),
		);
	});

	it('ties a proposal to the turn that stopped on it, and its receipts to its steps', () => {
		if (trace.surface === 'chatbot') {
			expect(trace.proposalId).toBeNull();
			expect(trace.proposal).toBeUndefined();
			return;
		}
		expect(trace.outcome).toBe('awaiting_decision');
		expect(trace.proposal?.id).toBe(trace.proposalId);
		expect(trace.toolExecutions.some((e) => e.status === 'requires_approval')).toBe(true);
		for (const receipt of trace.proposal?.receipts ?? []) {
			expect(trace.proposal?.steps[receipt.stepIndex]?.tool).toBe(receipt.toolName);
		}
		if (trace.proposal?.status === 'pending') expect(trace.proposal.receipts).toEqual([]);
	});
});
