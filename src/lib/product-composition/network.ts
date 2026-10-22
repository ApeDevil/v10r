/**
 * Port networks: which ports are joined, through couplings at every level of the tree and
 * through the `passages` of a product's body. A network is topology — "these ports are one
 * connected set" — never a flow, pressure or circuit calculation.
 */
import type { ProductComposition } from '../schemas/product-composition';
import { compareText } from './diagnostics';
import { arrangementScopes, indexDefinitions, portKey, resolveComposition, resolvePortIn } from './resolve';

/** A connected set of leaf ports, of two or more. Derived, never stored. */
export interface PortNetwork {
	/** The smallest port key in it — stable while the set is. */
	id: string;
	/** Leaf port keys, sorted. */
	ports: string[];
	/** The port standards it carries, sorted. */
	standards: string[];
	/** Its ports that no coupling uses, sorted. */
	openPorts: string[];
}

export interface PortUse {
	/** Couplings that use the port, at any level. */
	count: number;
	/** Whether one of them is a mate — a mate uses a port exclusively. */
	mated: boolean;
}

/** Every coupling at every level, as leaf-key pairs. Unresolved couplings are left out. */
function leafCouplings(composition: ProductComposition) {
	const definitions = indexDefinitions(composition);
	const edges: { a: string; b: string; mode: 'mated' | 'conduit' }[] = [];
	for (const scope of arrangementScopes(composition, definitions)) {
		for (const coupling of scope.arrangement.couplings) {
			const a = resolvePortIn(definitions, scope.arrangement, coupling.a, scope.path, scope.stack);
			const b = resolvePortIn(definitions, scope.arrangement, coupling.b, scope.path, scope.stack);
			if (a && b) edges.push({ a: a.key, b: b.key, mode: coupling.mode });
		}
	}
	return edges;
}

/** How each leaf port is used. A port no coupling uses is absent. */
export function portUse(composition: ProductComposition): Map<string, PortUse> {
	const use = new Map<string, PortUse>();
	for (const edge of leafCouplings(composition)) {
		for (const key of [edge.a, edge.b]) {
			const current = use.get(key) ?? { count: 0, mated: false };
			use.set(key, { count: current.count + 1, mated: current.mated || edge.mode === 'mated' });
		}
	}
	return use;
}

/** The networks of a composition, sorted by id. */
export function portNetworks(composition: ProductComposition): PortNetwork[] {
	const { ports, occurrences } = resolveComposition(composition);
	const parent = new Map(ports.map((port) => [port.key, port.key]));
	const find = (key: string): string => {
		let root = key;
		while (parent.get(root) !== root) root = parent.get(root) ?? root;
		parent.set(key, root);
		return root;
	};
	const join = (a: string, b: string) => {
		if (!parent.has(a) || !parent.has(b)) return;
		const [rootA, rootB] = [find(a), find(b)];
		const [low, high] = compareText(rootA, rootB) < 0 ? [rootA, rootB] : [rootB, rootA];
		if (low !== high) parent.set(high, low);
	};

	for (const edge of leafCouplings(composition)) join(edge.a, edge.b);
	for (const occurrence of occurrences) {
		if (occurrence.definition.body.kind !== 'geometry') continue;
		for (const [a, b] of occurrence.definition.body.passages ?? []) {
			join(portKey(occurrence.path, a), portKey(occurrence.path, b));
		}
	}

	const used = portUse(composition);
	const groups = new Map<string, typeof ports>();
	for (const port of ports) {
		const root = find(port.key);
		groups.set(root, [...(groups.get(root) ?? []), port]);
	}
	return [...groups.values()]
		.filter((members) => members.length > 1)
		.map((members) => {
			const keys = members.map((member) => member.key).sort(compareText);
			return {
				id: keys[0],
				ports: keys,
				standards: [...new Set(members.map((member) => member.port.standard))].sort(compareText),
				openPorts: keys.filter((key) => !used.has(key)),
			};
		})
		.sort((a, b) => compareText(a.id, b.id));
}
