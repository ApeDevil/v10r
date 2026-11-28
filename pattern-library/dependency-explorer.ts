/**
 * The pattern dependency explorer: one deterministic projection of the registry's typed
 * relationship graph (`pattern-graph.ts`), answered for one pattern (what adopting it builds —
 * foundations and required constituents, transitively — its open constituents, its
 * generalization and references, and what builds on or contains it) or for the graph as a whole
 * (every pattern in an adoption relationship, grouped by category, with the hubs).
 *
 * It backs the `explore_patterns` tool, which the hosted MCP serves with an MCP Apps View
 * (`src/lib/server/mcp/apps/`). The projection is returned twice from one computation: as
 * markdown for any client, and as a JSON value the View renders — so a host without MCP Apps
 * support loses the interactivity, never the answer.
 *
 * Framework-free and filesystem-free, like `query.ts`, whose argument bounds, failure contract and
 * next-action convention it reuses.
 */

import { needsSummary } from './infrastructure-needs.ts';
import { type OpenConstituent, type PatternGraph, patternGraph, type ResolvedNeed } from './pattern-graph.ts';
import { MAX_ARG_CHARS, type NextAction, type QueryDiag, type ToolDef, withNextActions } from './query-contract.ts';
import { registryDigest } from './registry-digest.ts';
import type { PatternMaturity, PatternRecord, PatternTier, Registry } from './schema.ts';

export const EXPLORE_PATTERNS_TOOL_NAME = 'explore_patterns';

/** Invariants carried in the summary; the rest are counted, and `get_pattern` has them all. */
const MAX_SUMMARY_INVARIANTS = 3;
/** Hubs named in the overview: the patterns the most others build on. */
const MAX_HUBS = 5;

export const EXPLORE_PATTERNS_TOOL: ToolDef = {
	name: EXPLORE_PATTERNS_TOOL_NAME,
	description:
		"Explore the pattern library's relationship graph. With `id`: that pattern's maturity, infrastructure needs by level, an invariants summary, everything adopting it builds (foundations and required constituents, transitively, in adoption order), its conditional and optional constituents, its generalization and references, and every pattern that builds on or contains it, with a docs link. Without `id`: the patterns in adoption relationships, by category, and the hubs. Read-only. Hosts that support MCP Apps render it as an interactive explorer; every other client gets the same answer as text.",
	inputSchema: {
		type: 'object',
		properties: {
			id: {
				type: 'string',
				maxLength: MAX_ARG_CHARS,
				description: 'A pattern id, e.g. "multi-client-core". Omit for the overview.',
			},
		},
		additionalProperties: false,
	},
};

/** One pattern as the explorer names it everywhere: enough to label a node and badge it. */
export interface ExploredPattern {
	id: string;
	title: string;
	category: string;
	tier: PatternTier;
	maturity: PatternMaturity;
}

/** A step adopting the focus builds, in adoption order, with how many adoption hops away it is. */
export interface ExploredPrerequisite {
	id: string;
	depth: number;
	/** How the nearest path reaches it: a foundation (`builds_on`) or a required constituent (`composes`). */
	relation: 'builds_on' | 'composes';
}

/** A resolved need without its per-path sources (those stay in `get_pattern` and the graph). */
export type ExploredNeed = Omit<ResolvedNeed, 'sources'>;

export interface ExploredFocus extends ExploredPattern {
	summary: string;
	risk: string;
	/** Own needs and those reaching it through foundations, constituents and generalizations. */
	needs: ExploredNeed[];
	/** The same needs as one line by level, as every surface prints them. */
	needsSummary: string;
	invariantCount: number;
	invariants: string[];
	/** The first contraindication, when the record names one. */
	avoidWhen: string | null;
	buildsOn: string[];
	composes: Array<{ id: string; level: string; when?: string }>;
	specializes: string | null;
	references: string[];
	/** Every step adopting it builds, transitively, in adoption order (foundations first). */
	prerequisites: ExploredPrerequisite[];
	/** Conditional and optional constituents, never adopted silently. */
	open: OpenConstituent[];
	/** Patterns that build on it, contain it or specialize it, directly (derived inverses). */
	dependents: string[];
	/** Every pattern whose adoption includes this one, directly or through another. */
	allDependents: string[];
	/** Patterns that reference it (planning-neutral, derived inverse). */
	referencedBy: string[];
	/** Site path of the generated docs page (`/docs/pattern-library/<id>`); absolute when an origin was given. */
	docsUrl: string;
	cyclic: boolean;
}

export interface ExploredCategory {
	id: string;
	title: string;
	patterns: string[];
}

/** The JSON half of an answer — the View's whole input. Every id it names is in `patterns`. */
export type PatternExploration =
	| {
			kind: 'focus';
			/** Content identity of the registry answered from (see `registry-digest.ts`). */
			registryDigest: string;
			focus: ExploredFocus;
			patterns: ExploredPattern[];
	  }
	| {
			kind: 'overview';
			/** Content identity of the registry answered from (see `registry-digest.ts`). */
			registryDigest: string;
			categories: ExploredCategory[];
			hubs: Array<{ id: string; dependents: number }>;
			/** Registry patterns in no adoption relationship. */
			unconnected: number;
			patterns: ExploredPattern[];
	  };

export type ExplorationOutcome =
	| { ok: true; text: string; exploration: PatternExploration }
	| { ok: false; text: string; diag: QueryDiag; next: readonly NextAction[] };

export interface ExploreOptions {
	/** The public origin the docs pages live on; without it `docsUrl` is a site path. */
	siteOrigin?: string;
}

function node(pattern: PatternRecord): ExploredPattern {
	return {
		id: pattern.id,
		title: pattern.title,
		category: pattern.category,
		tier: pattern.tier,
		maturity: pattern.maturity,
	};
}

/** Records whose adoption directly includes `id`: built on by, part of (any level), specialized by. */
function adoptersOf(graph: PatternGraph, id: string): string[] {
	return [
		...new Set(
			graph
				.edgesTo(id)
				.filter((edge) => edge.type !== 'references')
				.map((edge) => edge.from),
		),
	];
}

/** Breadth-first walk from `start` (excluded) along `next`, recording the hop count. */
function walk(start: string, next: (id: string) => readonly string[]): Map<string, number> {
	const depth = new Map<string, number>();
	const queue: Array<[string, number]> = next(start).map((id) => [id, 1]);
	while (queue.length > 0) {
		const entry = queue.shift();
		if (!entry) break;
		const [id, hops] = entry;
		if (id === start || depth.has(id)) continue;
		depth.set(id, hops);
		for (const following of next(id)) queue.push([following, hops + 1]);
	}
	return depth;
}

export function patternDocsUrl(id: string, options: ExploreOptions = {}): string {
	return `${options.siteOrigin ?? ''}/docs/pattern-library/${id}`;
}

function focusOn(registry: Registry, pattern: PatternRecord, options: ExploreOptions): ExplorationOutcome {
	const graph = patternGraph(registry);
	const registryOrder = registry.patterns.map((entry) => entry.id);
	const adoption = graph.adopt([pattern.id]);
	const required = (id: string) =>
		graph
			.effectiveEdges(id)
			.filter((edge) => edge.type === 'builds_on' || edge.level === 'required')
			.map((edge) => edge.to);
	const upstream = walk(pattern.id, required);
	const relation = new Map<string, 'builds_on' | 'composes'>();
	for (const [id, reasons] of adoption.reasons) {
		const nearest = reasons.find((reason) => reason.kind !== 'requested');
		if (nearest) relation.set(id, nearest.kind === 'builds_on' ? 'builds_on' : 'composes');
	}
	const downstream = walk(pattern.id, (id) => adoptersOf(graph, id));
	const allDependents = registryOrder.filter((id) => downstream.has(id));
	const needs = graph.needs(pattern.id);
	const steps = adoption.steps.filter((id) => id !== pattern.id);
	const focus: ExploredFocus = {
		...node(pattern),
		summary: pattern.summary,
		risk: pattern.risk,
		needs: needs.map(({ sources: _sources, ...need }) => need),
		needsSummary: needsSummary(needs, { condition: true }),
		invariantCount: pattern.invariants.length,
		invariants: pattern.invariants.slice(0, MAX_SUMMARY_INVARIANTS),
		avoidWhen: pattern.avoid_when[0] ?? null,
		buildsOn: pattern.builds_on.map((entry) => entry.id),
		composes: pattern.composes.map((entry) => ({
			id: entry.id,
			level: entry.level,
			...(entry.when ? { when: entry.when } : {}),
		})),
		specializes: pattern.specializes?.id ?? null,
		references: pattern.references.map((entry) => entry.id),
		prerequisites: steps.map((id) => ({ id, depth: upstream.get(id) ?? 0, relation: relation.get(id) ?? 'builds_on' })),
		open: adoption.open,
		dependents: adoptersOf(graph, pattern.id),
		allDependents,
		referencedBy: graph.edgesTo(pattern.id, 'references').map((edge) => edge.from),
		docsUrl: patternDocsUrl(pattern.id, options),
		cyclic: adoption.cyclic || upstream.has(pattern.id) || downstream.has(pattern.id),
	};
	const named = new Set([
		pattern.id,
		...steps,
		...allDependents,
		...adoption.open.map((entry) => entry.id),
		...focus.references,
		...focus.referencedBy,
		...(focus.specializes ? [focus.specializes] : []),
	]);
	const exploration: PatternExploration = {
		kind: 'focus',
		registryDigest: registryDigest(registry),
		focus,
		patterns: registry.patterns.filter((entry) => named.has(entry.id)).map(node),
	};
	return { ok: true, text: focusText(focus, graph.byId), exploration };
}

function label(id: string, byId: ReadonlyMap<string, PatternRecord>): string {
	const pattern = byId.get(id);
	return pattern ? `\`${id}\` — ${pattern.title} (${pattern.maturity})` : `\`${id}\``;
}

function focusText(focus: ExploredFocus, byId: ReadonlyMap<string, PatternRecord>): string {
	const list = (ids: string[]) => (ids.length === 0 ? '- (none)' : ids.map((id) => `- ${label(id, byId)}`).join('\n'));
	const more = focus.invariantCount - focus.invariants.length;
	const body = [
		`# ${focus.title} (\`${focus.id}\`)`,
		`${focus.tier} · ${focus.maturity} · ${focus.category}`,
		focus.summary,
		`Needs: ${focus.needsSummary || 'nothing beyond the app runtime'}`,
		focus.avoidWhen ? `Avoid when: ${focus.avoidWhen}` : '',
		focus.invariantCount > 0
			? `## Invariants (${focus.invariantCount})\n${focus.invariants.map((line) => `- ${line}`).join('\n')}${more > 0 ? `\n- … ${more} more in get_pattern` : ''}`
			: '',
		focus.specializes
			? `Specializes \`${focus.specializes}\`: its invariants hold here; its foundations and constituents are adopted with this pattern, and it is not built twice.`
			: '',
		`## Adopting it builds (${focus.prerequisites.length}, adoption order)\n${list(focus.prerequisites.map((entry) => entry.id))}`,
		focus.open.length > 0
			? `## Conditional and optional constituents (decide against the target; never added silently)\n${focus.open
					.map(
						(entry) =>
							`- ${label(entry.id, byId)} — ${entry.level}: ${entry.proposedBy.map((proposal) => `part of \`${proposal.from}\` when ${proposal.condition.when}`).join('; ')}`,
					)
					.join('\n')}`
			: '',
		focus.references.length > 0 ? `## References (context, never a step)\n${list(focus.references)}` : '',
		`## Built on or contained by (${focus.dependents.length} direct, ${focus.allDependents.length} in total)\n${list(focus.allDependents)}`,
		focus.referencedBy.length > 0 ? `## Referenced by\n${list(focus.referencedBy)}` : '',
		focus.cyclic ? 'Warning: an adoption cycle touches this pattern; the order is best-effort.' : '',
		`Docs: ${focus.docsUrl}`,
	].filter((part) => part.length > 0);
	const next: NextAction[] = [
		{ tool: 'get_pattern', args: { id: focus.id }, why: 'the full card: docs, code, tests and every invariant.' },
		{
			tool: 'recommend_emulation_plan',
			args: { capabilities: [focus.title] },
			why: 'an ordered plan that includes these foundations and constituents.',
		},
	];
	return withNextActions(body.join('\n\n'), next);
}

function overview(registry: Registry): ExplorationOutcome {
	const graph = patternGraph(registry);
	const adopters = new Map(registry.patterns.map((pattern) => [pattern.id, adoptersOf(graph, pattern.id)]));
	const connected = registry.patterns.filter(
		(pattern) =>
			graph.edgesFrom(pattern.id).some((edge) => edge.type !== 'references') ||
			(adopters.get(pattern.id)?.length ?? 0) > 0,
	);
	const categories: ExploredCategory[] = registry.categories
		.map((category) => ({
			id: category.id,
			title: category.title,
			patterns: connected.filter((pattern) => pattern.category === category.id).map((pattern) => pattern.id),
		}))
		.filter((category) => category.patterns.length > 0);
	const registryOrder = registry.patterns.map((pattern) => pattern.id);
	const hubs = [...adopters]
		.filter(([, ids]) => ids.length > 0)
		.map(([id, ids]) => ({ id, dependents: ids.length }))
		.sort((a, b) => b.dependents - a.dependents || registryOrder.indexOf(a.id) - registryOrder.indexOf(b.id))
		.slice(0, MAX_HUBS);
	const exploration: PatternExploration = {
		kind: 'overview',
		registryDigest: registryDigest(registry),
		categories,
		hubs,
		unconnected: registry.patterns.length - connected.length,
		patterns: connected.map(node),
	};
	const body = [
		`# Pattern relationship graph (registry ${exploration.registryDigest})`,
		`${connected.length} of ${registry.patterns.length} patterns build on, compose or specialize another, or are built on, composed or specialized; ${exploration.unconnected} stand alone.`,
		`## Hubs (most built on or composed)\n${hubs.map((hub) => `- \`${hub.id}\` — ${hub.dependents} direct adopter(s)`).join('\n')}`,
		`## By category\n${categories.map((category) => `- ${category.title}: ${category.patterns.map((id) => `\`${id}\``).join(', ')}`).join('\n')}`,
	];
	const first = hubs[0]?.id ?? registry.patterns[0]?.id ?? '';
	return {
		ok: true,
		text: withNextActions(body.join('\n\n'), [
			{
				tool: EXPLORE_PATTERNS_TOOL_NAME,
				args: { id: first },
				why: 'one pattern with what adopting it builds and what builds on it.',
			},
		]),
		exploration,
	};
}

export function explorePatterns(
	registry: Registry,
	args: Record<string, unknown>,
	options: ExploreOptions = {},
): ExplorationOutcome {
	if (args.id === undefined) return overview(registry);
	// Bounded before use: the not-found branch echoes the id back into text and telemetry.
	if (typeof args.id !== 'string' || args.id.length === 0 || args.id.length > MAX_ARG_CHARS) {
		return {
			ok: false,
			text: `"id" must be a pattern id: a non-empty string of at most ${MAX_ARG_CHARS} characters, or omitted for the overview.`,
			diag: 'invalid_args',
			next: [{ tool: EXPLORE_PATTERNS_TOOL_NAME, why: 'the overview lists every id in the graph.' }],
		};
	}
	const pattern = registry.patterns.find((entry) => entry.id === args.id);
	if (!pattern) {
		return {
			ok: false,
			text: `No pattern with id "${args.id}".`,
			diag: 'not_found',
			next: [
				{ tool: EXPLORE_PATTERNS_TOOL_NAME, why: 'the overview lists every id in the graph.' },
				{ tool: 'search_patterns', args: { query: args.id.slice(0, 60) }, why: 'find the right id by capability.' },
			],
		};
	}
	return focusOn(registry, pattern, options);
}
