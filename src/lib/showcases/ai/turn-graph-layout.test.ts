/**
 * The turn graph's geometry over the committed fixtures: groups enclose their members and nest
 * without overlap, every edge's vertical run lies in a gutter (never inside a column), a
 * column's own edges share its rail, an edge two columns apart detours beneath the columns,
 * and the same visible graph always yields the same picture.
 */

import { describe, expect, it } from 'vitest';
import { chatbotGrounded } from './fixtures/chatbot-grounded';
import { deskbotPlan } from './fixtures/deskbot-plan';
import { deskbotSentinel } from './fixtures/deskbot-sentinel';
import { NODE_IDS } from './inspector';
import { type TurnGraph, turnGraph, visibleTurnGraph } from './turn-graph';
import {
	COLUMN_WIDTH,
	cardSize,
	cardVariant,
	GROUP_HEADER,
	GROUP_PADDING,
	GUTTER_WIDTH,
	layoutTurnGraph,
	orthogonalPath,
	routeEdges,
	routePoints,
	type TurnGraphLayout,
} from './turn-graph-layout';

const everythingExpanded = (g: TurnGraph) => new Set(g.nodes.filter((n) => n.expandable).map((n) => n.id));

const columnSpans = (layout: TurnGraphLayout) =>
	(['sources', 'context', 'tools'] as const).map((c) => [layout.columns[c].x, layout.columns[c].x + COLUMN_WIDTH]);

const insideAColumn = (x: number, layout: TurnGraphLayout) => columnSpans(layout).some(([x0, x1]) => x > x0 && x < x1);

describe.each([
	['chatbot-grounded', chatbotGrounded],
	['deskbot-plan', deskbotPlan],
	['deskbot-sentinel', deskbotSentinel],
])('turn graph geometry — %s', (_name, fixture) => {
	const g = turnGraph(fixture.trace, { answer: fixture.answer, profile: fixture.profile });
	const visible = visibleTurnGraph(g, everythingExpanded(g));
	const layout = layoutTurnGraph(visible);

	it('places every visible node, a group before its members, and never overlaps two roots of a column', () => {
		for (const n of visible.nodes) expect(layout.positions.has(n.id), n.id).toBe(true);
		expect(layout.order).toHaveLength(visible.nodes.length);
		for (const n of visible.nodes) {
			if (n.parentId) expect(layout.order.indexOf(n.parentId)).toBeLessThan(layout.order.indexOf(n.id));
		}
		for (const column of ['sources', 'context', 'tools'] as const) {
			const boxes = visible.nodes
				.filter((n) => n.column === column && !n.parentId)
				.map((n) => ({ y: layout.positions.get(n.id)?.y ?? 0, h: layout.sizes.get(n.id)?.height ?? 0 }))
				.sort((a, b) => a.y - b.y);
			for (let i = 1; i < boxes.length; i++) expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].h);
		}
		expect(layout.height).toBeGreaterThan(0);
		expect(layout.detourY).toBeGreaterThan(layout.height);
	});

	it('encloses a group’s members inside it, stepped in by the padding, without overlap', () => {
		for (const id of layout.groups) {
			const box = { ...layout.positions.get(id), ...layout.sizes.get(id) } as {
				x: number;
				y: number;
				width: number;
				height: number;
			};
			const members = visible.nodes
				.filter((n) => n.parentId === id)
				.map((n) => ({ ...layout.positions.get(n.id), ...layout.sizes.get(n.id) }) as typeof box)
				.sort((a, b) => a.y - b.y);
			expect(members.length).toBeGreaterThan(0);
			for (const m of members) {
				expect(m.x).toBe(box.x + GROUP_PADDING);
				expect(m.width).toBe(box.width - 2 * GROUP_PADDING);
				expect(m.y).toBeGreaterThanOrEqual(box.y + GROUP_HEADER);
				expect(m.y + m.height).toBeLessThanOrEqual(box.y + box.height);
			}
			for (let i = 1; i < members.length; i++)
				expect(members[i].y).toBeGreaterThanOrEqual(members[i - 1].y + members[i - 1].height);
			expect(layout.anchors.get(id)).toBe(box.y + GROUP_HEADER / 2);
		}
	});

	it('keeps every vertical run in a gutter, a column’s own edges on its rail, and a two-column edge on a detour', () => {
		const routes = routeEdges(visible, layout);
		const columnOf = new Map(visible.nodes.map((n) => [n.id, n.column]));
		for (const e of visible.edges) {
			const route = routes.get(e.id);
			if (e.kind === 'containment') {
				expect(route).toBeUndefined();
				continue;
			}
			expect(route, e.id).toBeDefined();
			if (!route) continue;
			for (const bend of route.via) {
				if ('x' in bend) expect(insideAColumn(bend.x, layout), `${e.id} at x=${bend.x}`).toBe(false);
				else expect(bend.y).toBe(layout.detourY);
			}
			const from = columnOf.get(e.source);
			const to = columnOf.get(e.target);
			if (from === to) {
				expect(route.sourceHandle).toBe('l-out');
				expect(route.targetHandle).toBe('l-in');
				expect(route.via).toEqual([{ x: layout.columns[from as 'context'].x - 14 }]);
				expect(route.labelAt).toBeNull();
			} else if (from === 'tools' && to === 'sources') {
				expect(route.via).toHaveLength(3);
				expect(route.via[1]).toEqual({ y: layout.detourY });
			} else {
				expect(route.via).toHaveLength(1);
			}
		}
		expect(routeEdges(visible, layout)).toEqual(routes);
		expect(layoutTurnGraph(visible)).toEqual(layout);
	});

	it('gives runs that overlap in a gutter different tracks', () => {
		const routes = routeEdges(visible, layout);
		const runs: { gutter: number; x: number; y0: number; y1: number; id: string }[] = [];
		for (const e of visible.edges) {
			const route = routes.get(e.id);
			// The rail is shared on purpose; only gutter tracks are measured here.
			if (!route || route.labelAt === null || route.via.length !== 1 || !('x' in route.via[0])) continue;
			const [ay, by] = [layout.anchors.get(e.source) ?? 0, layout.anchors.get(e.target) ?? 0];
			const x = route.via[0].x;
			runs.push({
				gutter: x < layout.columns.context.x ? 0 : 1,
				x,
				y0: Math.min(ay, by),
				y1: Math.max(ay, by),
				id: e.id,
			});
		}
		expect(runs.length).toBeGreaterThan(0);
		for (const a of runs) {
			for (const b of runs) {
				if (a.id >= b.id || a.x !== b.x) continue;
				const overlap = a.y0 < b.y1 && b.y0 < a.y1;
				// Only a gutter with more concurrent runs than tracks may double one up.
				if (overlap) expect(runs.filter((r) => r.gutter === a.gutter).length, `${a.id} / ${b.id}`).toBeGreaterThan(8);
			}
		}
	});
});

describe('turn graph geometry — the chatbot fixture in detail', () => {
	const graph = turnGraph(chatbotGrounded.trace, { answer: chatbotGrounded.answer, profile: chatbotGrounded.profile });

	it('renders an expanded source as a group of document groups of chunk rows, narrower per depth', () => {
		const expanded = new Set([NODE_IDS.source('project-docs'), NODE_IDS.document('project-docs', 'demo_document_1')]);
		const visible = visibleTurnGraph(graph, expanded);
		const layout = layoutTurnGraph(visible);
		const source = NODE_IDS.source('project-docs');
		const document = NODE_IDS.document('project-docs', 'demo_document_1');
		const section = NODE_IDS.parentChunk('demo_parent_1');
		const chunk = NODE_IDS.item('project-docs', 'demo_chunk_1');
		expect([...layout.groups]).toEqual(expect.arrayContaining([source, document, section]));
		expect(layout.groups.has(chunk)).toBe(false);
		expect(layout.sizes.get(source)?.width).toBe(COLUMN_WIDTH);
		expect(layout.sizes.get(document)?.width).toBe(COLUMN_WIDTH - 2 * GROUP_PADDING);
		expect(layout.sizes.get(section)?.width).toBe(COLUMN_WIDTH - 4 * GROUP_PADDING);
		expect(layout.sizes.get(chunk)).toEqual({ width: COLUMN_WIDTH - 6 * GROUP_PADDING, height: 56 });
		// A collapsed sibling document is a row inside the source group.
		const folded = NODE_IDS.document('project-docs', 'demo_document_2');
		expect(cardVariant(visible.nodes.find((n) => n.id === folded) as never, layout.groups)).toBe('row');
		expect(layout.sizes.get(folded)?.height).toBe(60);
	});

	it('opens the prompt into one-line block rows with the boundary as a divider', () => {
		const visible = visibleTurnGraph(graph, new Set([NODE_IDS.group('prompt')]));
		const layout = layoutTurnGraph(visible);
		expect(layout.groups.has(NODE_IDS.group('prompt'))).toBe(true);
		expect(layout.sizes.get(NODE_IDS.block('role'))?.height).toBe(40);
		expect(layout.sizes.get(NODE_IDS.boundary)?.height).toBe(22);
		expect(layout.sizes.get(NODE_IDS.group('prompt'))?.height).toBe(
			GROUP_HEADER + 2 * GROUP_PADDING + 10 * 40 + 22 + 10 * 6,
		);
	});

	it('sizes standalone cards by kind and the inventory by its rows', () => {
		const toolset = graph.nodes.find((n) => n.id === NODE_IDS.toolset) as (typeof graph.nodes)[number];
		expect(cardSize(toolset).height).toBe(48 + 28 * (toolset.count ?? 0));
		const call = graph.nodes.find((n) => n.id === NODE_IDS.call('demo_call_1')) as (typeof graph.nodes)[number];
		expect(cardSize(call)).toEqual({ width: COLUMN_WIDTH, height: 80 });
		expect(GUTTER_WIDTH).toBeGreaterThan(8 * 8 + 16 + 14);
	});
});

describe('orthogonal paths', () => {
	it('turns a route into axis-aligned corner points and drops zero-length legs', () => {
		expect(routePoints({ x: 0, y: 10 }, [{ x: 40 }], { x: 80, y: 50 })).toEqual([
			{ x: 0, y: 10 },
			{ x: 40, y: 10 },
			{ x: 40, y: 50 },
			{ x: 80, y: 50 },
		]);
		expect(routePoints({ x: 0, y: 10 }, [{ x: 40 }, { y: 90 }, { x: 20 }], { x: 10, y: 30 })).toEqual([
			{ x: 0, y: 10 },
			{ x: 40, y: 10 },
			{ x: 40, y: 90 },
			{ x: 20, y: 90 },
			{ x: 20, y: 30 },
			{ x: 10, y: 30 },
		]);
		expect(routePoints({ x: 0, y: 10 }, [{ x: 40 }], { x: 80, y: 10 })).toEqual([
			{ x: 0, y: 10 },
			{ x: 40, y: 10 },
			{ x: 80, y: 10 },
		]);
	});

	it('draws M, L and Q only, starting and ending on the endpoints, corners shortened to fit', () => {
		const d = orthogonalPath(
			[
				{ x: 0, y: 10 },
				{ x: 40, y: 10 },
				{ x: 40, y: 50 },
				{ x: 80, y: 50 },
			],
			8,
		);
		expect(d).toBe('M 0 10 L 32 10 Q 40 10 40 18 L 40 42 Q 40 50 48 50 L 80 50');
		expect(
			orthogonalPath(
				[
					{ x: 0, y: 0 },
					{ x: 6, y: 0 },
					{ x: 6, y: 100 },
				],
				8,
			),
		).toBe('M 0 0 L 3 0 Q 6 0 6 3 L 6 100');
		expect(orthogonalPath([])).toBe('');
	});
});
