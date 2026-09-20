/**
 * Turn graph geometry — where the visible graph's nodes sit and how its edges travel, as pure
 * functions of the visible graph. Nothing is measured: every size is fixed per kind, so the
 * fixtures, a live turn and the streaming snapshot lay out alike and a test can assert it.
 *
 * Three columns at fixed x with a gutter between each pair. A node with visible members is a
 * GROUP: a header row and its members stacked inside, each depth stepping in by the group's
 * padding — the nesting itself says where a record sits, so a containment edge is never drawn.
 * Edges never cross a card: one between adjacent columns takes a TRACK in the gutter (its
 * vertical run; overlapping runs get different tracks), one inside a column runs down that
 * column's RAIL (a shared line just left of it, read as a bus with taps), one two columns
 * apart takes a DETOUR beneath the columns.
 *
 * Pure — no `$lib/server/*`, no `$env/*`, no Paraglide, no `@xyflow`.
 */

import type { TurnGraph, TurnGraphColumn, TurnGraphNode, TurnGraphNodeKind } from './turn-graph';

export const COLUMN_WIDTH = 272;
export const GUTTER_WIDTH = 104;
const COLUMN_X: Record<TurnGraphColumn, number> = {
	sources: 0,
	context: COLUMN_WIDTH + GUTTER_WIDTH,
	tools: 2 * (COLUMN_WIDTH + GUTTER_WIDTH),
};
const COLUMN_ORDER: TurnGraphColumn[] = ['sources', 'context', 'tools'];

export const GROUP_HEADER = 48;
export const GROUP_PADDING = 10;
const MEMBER_GAP = 6;
const GAP_WITHIN = 10;
const GAP_BETWEEN = 24;
/** Tracks sit in the gutter's middle band; the rail hugs the column to the right of the gutter. */
const TRACK_FIRST = 16;
const TRACK_GAP = 8;
const TRACK_COUNT = 8;
const RAIL_OFFSET = 14;
const DETOUR_GAP = 24;
const TOOLSET_ROW = 28;
const TOOLSET_BASE = 48;

/** How a node renders: a standalone card, the header of a group, or a compact member row. */
export type TurnGraphCardVariant = 'card' | 'header' | 'row';

const CARD_HEIGHTS: Record<Exclude<TurnGraphNodeKind, 'toolset'>, number> = {
	source: 74,
	document: 74,
	parent: 62,
	item: 78,
	omitted: 54,
	prompt: 74,
	block: 58,
	boundary: 28,
	history: 62,
	call: 80,
	answer: 80,
	proposal: 80,
	tool: 74,
};

/** Members inside a group are rows: a block is one line, a chunk two, the cache boundary a divider. */
const ROW_HEIGHTS: Partial<Record<TurnGraphNodeKind, number>> = {
	block: 40,
	boundary: 22,
	item: 56,
	document: 60,
	omitted: 44,
};

/** The variant a node takes on the canvas: a group when it has visible members, a row inside one. */
export function cardVariant(node: TurnGraphNode, groups: ReadonlySet<string>): TurnGraphCardVariant {
	if (groups.has(node.id)) return 'header';
	return node.parentId ? 'row' : 'card';
}

/** Fixed per kind and variant so the layout needs no measurement; the card truncates to fit. */
export function cardSize(
	node: TurnGraphNode,
	variant: TurnGraphCardVariant = 'card',
): { width: number; height: number } {
	const width = COLUMN_WIDTH - node.depth * 2 * GROUP_PADDING;
	if (node.kind === 'toolset') return { width, height: TOOLSET_BASE + TOOLSET_ROW * Math.max(1, node.count ?? 0) };
	if (variant === 'header') return { width, height: GROUP_HEADER };
	if (variant === 'row') return { width, height: ROW_HEIGHTS[node.kind] ?? CARD_HEIGHTS[node.kind] };
	return { width, height: CARD_HEIGHTS[node.kind] };
}

export interface TurnGraphLayout {
	/** Absolute, graph space — the canvas makes a member's position relative to its group. */
	positions: Map<string, { x: number; y: number }>;
	sizes: Map<string, { width: number; height: number }>;
	/** The y of a node's side handles: mid-card, or mid-header for a group. */
	anchors: Map<string, number>;
	/** Nodes drawn as a group — a header with members inside. */
	groups: Set<string>;
	/** Placement order: every group before its members (a sub-flow renders parents first). */
	order: string[];
	width: number;
	/** The bottom of the tallest column. */
	height: number;
	/** The horizontal run of a detour, beneath every column. */
	detourY: number;
	columns: Record<TurnGraphColumn, { x: number; width: number }>;
}

const groupKeyOf = (node: TurnGraphNode): string => {
	if (node.column === 'sources') return node.id;
	if (node.column === 'context') {
		if (node.kind === 'prompt' || node.kind === 'block' || node.kind === 'boundary') return 'prompt';
		if (node.kind === 'call') return 'calls';
		return node.kind;
	}
	return node.kind === 'toolset' ? 'toolset' : 'executions';
};

/**
 * Deterministic column stacking — the same input yields the same geometry. Each column stacks
 * its root nodes in emission order (a new run of records — another source, the calls after the
 * prompt, the executions after the inventory — opens a wider gap); a node with visible members
 * becomes a group whose height follows its members, recursively.
 */
export function layoutTurnGraph(visible: TurnGraph): TurnGraphLayout {
	const positions = new Map<string, { x: number; y: number }>();
	const sizes = new Map<string, { width: number; height: number }>();
	const anchors = new Map<string, number>();
	const byId = new Map(visible.nodes.map((n) => [n.id, n]));
	const members = new Map<string, TurnGraphNode[]>();
	for (const node of visible.nodes) {
		if (!node.parentId || !byId.has(node.parentId)) continue;
		const list = members.get(node.parentId) ?? [];
		list.push(node);
		members.set(node.parentId, list);
	}
	const groups = new Set(members.keys());
	const order: string[] = [];

	const place = (node: TurnGraphNode, x: number, y: number, width: number): number => {
		order.push(node.id);
		const variant = cardVariant(node, groups);
		const own = cardSize(node, variant);
		let height = own.height;
		if (variant === 'header') {
			let cursor = y + GROUP_HEADER + GROUP_PADDING;
			for (const member of members.get(node.id) ?? []) {
				cursor += place(member, x + GROUP_PADDING, cursor, width - 2 * GROUP_PADDING) + MEMBER_GAP;
			}
			height = cursor - MEMBER_GAP + GROUP_PADDING - y;
		}
		positions.set(node.id, { x, y });
		sizes.set(node.id, { width, height });
		anchors.set(node.id, y + (variant === 'header' ? GROUP_HEADER / 2 : own.height / 2));
		return height;
	};

	const cursor: Record<TurnGraphColumn, number> = { sources: 0, context: 0, tools: 0 };
	const lastGroup: Partial<Record<TurnGraphColumn, string>> = {};
	for (const node of visible.nodes) {
		if (node.parentId && byId.has(node.parentId)) continue;
		const key = groupKeyOf(node);
		const previous = lastGroup[node.column];
		if (previous !== undefined) cursor[node.column] += previous === key ? GAP_WITHIN : GAP_BETWEEN;
		lastGroup[node.column] = key;
		cursor[node.column] += place(node, COLUMN_X[node.column], cursor[node.column], COLUMN_WIDTH);
	}
	const height = Math.max(cursor.sources, cursor.context, cursor.tools);
	return {
		positions,
		sizes,
		anchors,
		groups,
		order,
		width: COLUMN_X.tools + COLUMN_WIDTH,
		height,
		detourY: height + DETOUR_GAP,
		columns: {
			sources: { x: COLUMN_X.sources, width: COLUMN_WIDTH },
			context: { x: COLUMN_X.context, width: COLUMN_WIDTH },
			tools: { x: COLUMN_X.tools, width: COLUMN_WIDTH },
		},
	};
}

export type TurnGraphSourceHandle = 'r-out' | 'l-out';
export type TurnGraphTargetHandle = 'l-in' | 'r-in';

/** One bend of a route: a vertical run at `x`, or a horizontal run at `y`. */
export type RouteVia = { x: number } | { y: number };

export interface EdgeRoute {
	sourceHandle: TurnGraphSourceHandle;
	targetHandle: TurnGraphTargetHandle;
	via: RouteVia[];
	/** Where a merged count may sit: on the leg entering the target, or nowhere (a rail is shared). */
	labelAt: 'entry' | null;
}

interface Run {
	edgeId: string;
	index: number;
	y0: number;
	y1: number;
}

/**
 * The way every data-flow edge travels, so no edge crosses a card. Adjacent columns: out of the
 * side facing the target, one vertical run on a gutter track, into the side facing the source —
 * runs that overlap in y take different tracks. One column: out of the left side, down the
 * column's rail, into the target's left side. Two columns apart: a detour — a track down to
 * beneath the columns, across, a track back up. Containment is not an edge on the canvas.
 */
export function routeEdges(visible: TurnGraph, layout: TurnGraphLayout): Map<string, EdgeRoute> {
	const columnOf = new Map(visible.nodes.map((n) => [n.id, n.column]));
	const routes = new Map<string, EdgeRoute>();
	const runs: Run[][] = [[], []];
	const gutterX = (index: number) => COLUMN_X[COLUMN_ORDER[index]] + COLUMN_WIDTH;
	const railX = (column: TurnGraphColumn) => COLUMN_X[column] - RAIL_OFFSET;

	for (const edge of visible.edges) {
		if (edge.kind === 'containment') continue;
		const from = columnOf.get(edge.source);
		const to = columnOf.get(edge.target);
		if (!from || !to) continue;
		const fromIndex = COLUMN_ORDER.indexOf(from);
		const toIndex = COLUMN_ORDER.indexOf(to);
		const ay = layout.anchors.get(edge.source) ?? 0;
		const by = layout.anchors.get(edge.target) ?? 0;
		const forward = toIndex > fromIndex;
		if (fromIndex === toIndex) {
			routes.set(edge.id, { sourceHandle: 'l-out', targetHandle: 'l-in', via: [{ x: railX(from) }], labelAt: null });
			continue;
		}
		const handles = forward
			? { sourceHandle: 'r-out' as const, targetHandle: 'l-in' as const }
			: { sourceHandle: 'l-out' as const, targetHandle: 'r-in' as const };
		if (Math.abs(fromIndex - toIndex) === 1) {
			const gutter = Math.min(fromIndex, toIndex);
			runs[gutter].push({ edgeId: edge.id, index: 0, y0: Math.min(ay, by), y1: Math.max(ay, by) });
			routes.set(edge.id, { ...handles, via: [{ x: 0 }], labelAt: 'entry' });
			continue;
		}
		// Two columns apart: the near gutter down to the detour, the far gutter back up.
		const [first, second] = forward ? [fromIndex, toIndex - 1] : [fromIndex - 1, toIndex];
		runs[first].push({ edgeId: edge.id, index: 0, y0: Math.min(ay, layout.detourY), y1: layout.detourY });
		runs[second].push({ edgeId: edge.id, index: 2, y0: Math.min(by, layout.detourY), y1: layout.detourY });
		routes.set(edge.id, { ...handles, via: [{ x: 0 }, { y: layout.detourY }, { x: 0 }], labelAt: 'entry' });
	}

	// Greedy interval colouring per gutter: a run takes the first track free below its start.
	runs.forEach((list, gutter) => {
		list.sort((a, b) => a.y0 - b.y0 || a.y1 - b.y1 || a.edgeId.localeCompare(b.edgeId));
		const busyUntil: number[] = [];
		for (const run of list) {
			let track = busyUntil.findIndex((until) => until < run.y0);
			if (track === -1) track = busyUntil.length;
			busyUntil[track] = run.y1;
			const x = gutterX(gutter) + TRACK_FIRST + (track % TRACK_COUNT) * TRACK_GAP;
			const route = routes.get(run.edgeId);
			if (route) route.via[run.index] = { x };
		}
	});
	return routes;
}

export interface Point {
	x: number;
	y: number;
}

/** The corner points of a route between two handle points, axis-aligned, no zero-length legs. */
export function routePoints(source: Point, via: RouteVia[], target: Point): Point[] {
	const points: Point[] = [source];
	let pen = source;
	for (const bend of via) {
		pen = 'x' in bend ? { x: bend.x, y: pen.y } : { x: pen.x, y: bend.y };
		points.push(pen);
	}
	if (pen.x !== target.x && pen.y !== target.y) points.push({ x: pen.x, y: target.y });
	points.push(target);
	return points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
}

/** An SVG path through axis-aligned points with rounded corners — `M`, `L` and `Q` only. */
export function orthogonalPath(points: Point[], radius = 8): string {
	if (points.length === 0) return '';
	const [first, ...rest] = points;
	let d = `M ${first.x} ${first.y}`;
	for (let i = 0; i < rest.length; i++) {
		const corner = rest[i];
		const previous = i === 0 ? first : rest[i - 1];
		const next = rest[i + 1];
		if (!next) {
			d += ` L ${corner.x} ${corner.y}`;
			break;
		}
		const inLength = Math.hypot(corner.x - previous.x, corner.y - previous.y);
		const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
		const r = Math.min(radius, inLength / 2, outLength / 2);
		const before = {
			x: corner.x - Math.sign(corner.x - previous.x) * r,
			y: corner.y - Math.sign(corner.y - previous.y) * r,
		};
		const after = {
			x: corner.x + Math.sign(next.x - corner.x) * r,
			y: corner.y + Math.sign(next.y - corner.y) * r,
		};
		d += ` L ${before.x} ${before.y} Q ${corner.x} ${corner.y} ${after.x} ${after.y}`;
	}
	return d;
}
