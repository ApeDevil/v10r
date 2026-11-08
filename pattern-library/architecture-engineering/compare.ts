/**
 * Compare two architecture models — typically a baseline and a variant derived from it.
 *
 * Everything counted here is read off the models: nodes, placements, connections, zones,
 * deployment units, network boundaries, operational requirements and findings. Latency and
 * complexity are described *qualitatively*, from those counts, and every such statement is
 * marked `basis: 'qualitative'` — no number in a comparison is a measurement, and none is
 * presented as one. Adding a component is never scored as an improvement by itself.
 */
import type { PatternRequirement } from '../schema.ts';
import type { ArchitectureConnection, ArchitectureModel, ArchitectureNode } from './architecture-model.ts';
import { checkArchitecture } from './checks.ts';
import type { ArchitectureFinding } from './findings.ts';
import { NETWORK_PROTOCOLS, NODE_KINDS } from './vocabulary.ts';

export interface NodeChange {
	id: string;
	label: string;
	changes: string[];
}

export interface ModelSummary {
	id: string;
	name: string;
	/** What gets deployed and operated: `app`, plus one entry per worker or service node. */
	deployment_units: string[];
	/** Managed or third-party systems the design depends on. */
	managed_dependencies: string[];
	network_connections: number;
	synchronous_network_connections: number;
	trust_boundary_crossings: number;
	requirements: PatternRequirement[];
	findings: ArchitectureFinding[];
}

export interface QualitativeAssessment {
	dimension: 'deployment-complexity' | 'latency' | 'operations' | 'security' | 'risk';
	statement: string;
	basis: 'qualitative';
}

export interface ArchitectureComparison {
	baseline: ModelSummary;
	variant: ModelSummary;
	change_reason?: string;
	derived: boolean;
	nodes: { added: ArchitectureNode[]; removed: ArchitectureNode[]; changed: NodeChange[] };
	placements: { id: string; label: string; from: string; to: string }[];
	connections: { added: ArchitectureConnection[]; removed: ArchitectureConnection[]; changed: NodeChange[] };
	zones: { added: string[]; removed: string[] };
	requirements: { added: PatternRequirement[]; removed: PatternRequirement[] };
	findings: { introduced: ArchitectureFinding[]; resolved: ArchitectureFinding[] };
	assessment: QualitativeAssessment[];
}

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function summarize(model: ArchitectureModel): ModelSummary {
	const byId = new Map(model.nodes.map((node) => [node.id, node]));
	const units = new Set<string>();
	const managed: string[] = [];
	for (const node of model.nodes) {
		const deploysAs = NODE_KINDS[node.kind].deploysAs;
		if (deploysAs === 'app') units.add('app');
		else if (deploysAs === 'managed') managed.push(node.id);
		else units.add(`${deploysAs}:${node.id}`);
	}
	const network = model.connections.filter((connection) => NETWORK_PROTOCOLS.includes(connection.protocol));
	const crossings = model.connections.filter((connection) => {
		const from = byId.get(connection.from);
		const to = byId.get(connection.to);
		return !!from && !!to && from.zone !== to.zone;
	});
	const requirements = new Set<PatternRequirement>();
	for (const node of model.nodes)
		for (const requirement of NODE_KINDS[node.kind].requires) requirements.add(requirement);
	return {
		id: model.id,
		name: model.name,
		deployment_units: [...units].sort(compareText),
		managed_dependencies: managed.sort(compareText),
		network_connections: network.length,
		synchronous_network_connections: network.filter((connection) => connection.mode === 'sync').length,
		trust_boundary_crossings: crossings.length,
		requirements: [...requirements].sort(compareText),
		findings: checkArchitecture(model),
	};
}

function nodeChanges(a: ArchitectureNode, b: ArchitectureNode): string[] {
	const changes: string[] = [];
	if (a.label !== b.label) changes.push(`label "${a.label}" → "${b.label}"`);
	if (a.zone !== b.zone) changes.push(`zone ${a.zone} → ${b.zone}`);
	if (a.placement !== b.placement) changes.push(`placement ${a.placement} → ${b.placement}`);
	if (a.responsibilities.join('\n') !== b.responsibilities.join('\n')) changes.push('responsibilities changed');
	for (const trait of Object.keys(a.traits) as (keyof ArchitectureNode['traits'])[]) {
		if (a.traits[trait] !== b.traits[trait]) changes.push(`${trait} ${a.traits[trait]} → ${b.traits[trait]}`);
	}
	if (a.patterns.join() !== b.patterns.join()) changes.push('linked patterns changed');
	if (a.decisions.join() !== b.decisions.join()) changes.push('linked decisions changed');
	return changes;
}

function connectionChanges(a: ArchitectureConnection, b: ArchitectureConnection): string[] {
	const changes: string[] = [];
	for (const field of ['protocol', 'mode', 'data_flow', 'authenticated', 'failure_handling'] as const) {
		if (a[field] !== b[field]) changes.push(`${field} ${a[field] || '—'} → ${b[field] || '—'}`);
	}
	return changes;
}

const findingKey = (entry: ArchitectureFinding): string => `${entry.code} ${entry.subject}`;

function diffKeyed<T extends { id: string }>(a: T[], b: T[]) {
	const before = new Map(a.map((item) => [item.id, item]));
	const after = new Map(b.map((item) => [item.id, item]));
	return {
		added: b.filter((item) => !before.has(item.id)),
		removed: a.filter((item) => !after.has(item.id)),
		both: b.filter((item) => before.has(item.id)).map((item) => [before.get(item.id) as T, item] as const),
	};
}

function plural(n: number, word: string): string {
	return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function assess(
	baseline: ModelSummary,
	variant: ModelSummary,
	introduced: ArchitectureFinding[],
	resolved: ArchitectureFinding[],
): QualitativeAssessment[] {
	const out: QualitativeAssessment[] = [];
	const unitDelta = variant.deployment_units.length - baseline.deployment_units.length;
	out.push({
		dimension: 'deployment-complexity',
		basis: 'qualitative',
		statement:
			unitDelta > 0
				? `The variant adds ${plural(unitDelta, 'deployment unit')}: each is one more thing to build, deploy, monitor, secure and pay for.`
				: unitDelta < 0
					? `The variant removes ${plural(-unitDelta, 'deployment unit')}: fewer things to operate, at the cost of whatever isolation they gave.`
					: 'Both have the same deployment units.',
	});
	const syncDelta = variant.synchronous_network_connections - baseline.synchronous_network_connections;
	out.push({
		dimension: 'latency',
		basis: 'qualitative',
		statement:
			syncDelta > 0
				? `The variant has ${plural(syncDelta, 'more synchronous network call')}. Each one on a request path adds a round trip and a way to fail; how much depends on placement and region — not measured here.`
				: syncDelta < 0
					? `The variant has ${plural(-syncDelta, 'fewer synchronous network call')}, so request paths that used them have fewer round trips — not measured here.`
					: 'The number of synchronous network calls is unchanged; latency differences, if any, come from placement — not measured here.',
	});
	const addedRequirements = variant.requirements.filter((requirement) => !baseline.requirements.includes(requirement));
	out.push({
		dimension: 'operations',
		basis: 'qualitative',
		statement:
			addedRequirements.length > 0
				? `The variant needs infrastructure the baseline does not: ${addedRequirements.join(', ')}.`
				: 'No new infrastructure requirements.',
	});
	const crossingDelta = variant.trust_boundary_crossings - baseline.trust_boundary_crossings;
	const securityIntroduced = introduced.filter((entry) => entry.category === 'security').length;
	out.push({
		dimension: 'security',
		basis: 'qualitative',
		statement: `${crossingDelta === 0 ? 'Trust-boundary crossings are unchanged' : `${plural(Math.abs(crossingDelta), 'trust-boundary crossing')} ${crossingDelta > 0 ? 'added' : 'removed'}`}; ${plural(securityIntroduced, 'new security finding')}.`,
	});
	out.push({
		dimension: 'risk',
		basis: 'qualitative',
		statement:
			introduced.length === 0 && resolved.length === 0
				? 'The checks report the same findings for both.'
				: `${plural(introduced.length, 'finding')} introduced and ${plural(resolved.length, 'finding')} resolved by the variant.`,
	});
	return out;
}

export function compareArchitectures(baseline: ArchitectureModel, variant: ArchitectureModel): ArchitectureComparison {
	const a = summarize(baseline);
	const b = summarize(variant);
	const nodes = diffKeyed(baseline.nodes, variant.nodes);
	const connections = diffKeyed(baseline.connections, variant.connections);
	const zones = diffKeyed(baseline.zones, variant.zones);
	const before = new Set(a.findings.map(findingKey));
	const after = new Set(b.findings.map(findingKey));
	const introduced = b.findings.filter((entry) => !before.has(findingKey(entry)));
	const resolved = a.findings.filter((entry) => !after.has(findingKey(entry)));
	return {
		baseline: a,
		variant: b,
		...(variant.change_reason ? { change_reason: variant.change_reason } : {}),
		derived: variant.derived_from === baseline.id,
		nodes: {
			added: nodes.added,
			removed: nodes.removed,
			changed: nodes.both
				.map(([x, y]) => ({ id: y.id, label: y.label, changes: nodeChanges(x, y) }))
				.filter((change) => change.changes.length > 0),
		},
		placements: nodes.both
			.filter(([x, y]) => x.placement !== y.placement)
			.map(([x, y]) => ({ id: y.id, label: y.label, from: x.placement, to: y.placement })),
		connections: {
			added: connections.added,
			removed: connections.removed,
			changed: connections.both
				.map(([x, y]) => ({ id: y.id, label: `${y.from} → ${y.to}`, changes: connectionChanges(x, y) }))
				.filter((change) => change.changes.length > 0),
		},
		zones: { added: zones.added.map((zone) => zone.id), removed: zones.removed.map((zone) => zone.id) },
		requirements: {
			added: b.requirements.filter((requirement) => !a.requirements.includes(requirement)),
			removed: a.requirements.filter((requirement) => !b.requirements.includes(requirement)),
		},
		findings: { introduced, resolved },
		assessment: assess(a, b, introduced, resolved),
	};
}
