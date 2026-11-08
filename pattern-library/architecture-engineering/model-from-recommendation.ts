/**
 * Transfer an Explore result into Design: a deterministic starting model built from the
 * alternatives the engine chose, with each node linked to the decisions that put it there.
 *
 * It is a starting point, not a finished design: properties the profile leaves unknown stay
 * unknown in the model (authentication and failure handling of new connections start as
 * `unknown`), so Engineer mode shows exactly what still has to be decided.
 */
import type { ArchitectureLayout, ArchitectureModel } from './architecture-model.ts';
import type { ArchitectureRecommendation } from './explore.ts';
import {
	addConnection,
	addNode,
	createArchitectureModel,
	type ModelOperation,
	type NewConnection,
	type NewNode,
	updateNode,
} from './model-operations.ts';
import { NODE_KINDS, type ZoneKind } from './vocabulary.ts';

function must(result: ModelOperation): ArchitectureModel {
	// Every operation below is built from ids this function just created; a refusal is a bug.
	if (!result.ok) throw new Error(`model-from-recommendation: refused (${result.refusal})`);
	return result.model;
}

class Builder {
	model: ArchitectureModel;
	constructor(id: string, name: string) {
		this.model = createArchitectureModel(id, name);
	}
	has(id: string): boolean {
		return this.model.nodes.some((node) => node.id === id);
	}
	node(input: NewNode & { id: string }): void {
		if (this.has(input.id)) {
			const current = this.model.nodes.find((node) => node.id === input.id);
			this.model = must(
				updateNode(this.model, input.id, {
					responsibilities: [...new Set([...(current?.responsibilities ?? []), ...(input.responsibilities ?? [])])],
					decisions: [...new Set([...(current?.decisions ?? []), ...(input.decisions ?? [])])],
					...(input.placement ? { placement: input.placement } : {}),
					traits: input.traits,
				}),
			);
			return;
		}
		this.model = must(addNode(this.model, input));
	}
	connect(input: NewConnection): void {
		const exists = this.model.connections.some(
			(connection) => connection.from === input.from && connection.to === input.to,
		);
		if (exists) return;
		this.model = must(addConnection(this.model, input));
	}
}

export function modelFromRecommendation(
	recommendation: ArchitectureRecommendation,
	id = 'explored-architecture',
	name = 'Explored architecture',
): ArchitectureModel {
	const chosen = new Map(recommendation.outcomes.map((outcome) => [outcome.decision, outcome.chosen.id]));
	const { profile } = recommendation;
	const heavy = profile.compute === 'moderate' || profile.compute === 'heavy';
	const workload = profile.workload === 'unknown' ? 'the workload' : `the ${profile.workload} workload`;
	const b = new Builder(id, name);

	b.node({ id: 'browser-app', kind: 'browser-app', responsibilities: ['User interface'] });
	b.node({
		id: 'app-server',
		kind: 'app-server',
		responsibilities: ['Pages and API', 'Authentication and authorization'],
		traits: { holds_secrets: true },
	});
	b.connect({ from: 'browser-app', to: 'app-server', protocol: 'http-rest', data_flow: 'page and API requests' });

	switch (chosen.get('compute-placement')) {
		case 'browser-main-thread':
			b.node({
				id: 'browser-app',
				kind: 'browser-app',
				responsibilities: [`Runs ${workload}`],
				decisions: ['compute-placement'],
				traits: { cpu_intensive: heavy },
			});
			break;
		case 'browser-worker':
			b.node({
				id: 'browser-worker',
				kind: 'browser-worker',
				responsibilities: [`Runs ${workload} off the main thread`],
				decisions: ['compute-placement'],
				traits: { cpu_intensive: heavy },
			});
			b.connect({
				from: 'browser-app',
				to: 'browser-worker',
				protocol: 'post-message',
				data_flow: 'input buffers (transferred) and results',
			});
			break;
		case 'background-job':
			b.node({
				id: 'background-worker',
				kind: 'background-worker',
				responsibilities: [`Runs ${workload} as a job`],
				decisions: ['compute-placement'],
				traits: { long_running: true, cpu_intensive: heavy },
			});
			break;
		case 'separate-service':
			b.node({
				id: 'compute-service',
				kind: 'compute-service',
				responsibilities: [`Runs ${workload}`],
				decisions: ['compute-placement'],
				traits: { cpu_intensive: true, distinct_runtime: chosen.get('compute-runtime') === 'rust-native-service' },
			});
			b.connect({
				from: 'app-server',
				to: 'compute-service',
				protocol: chosen.get('interaction-style') === 'typed-rpc' ? 'typed-rpc' : 'http-rest',
				data_flow: 'compute requests and results',
			});
			break;
		default:
			b.node({
				id: 'app-server',
				kind: 'app-server',
				responsibilities: [`Runs ${workload}`],
				decisions: ['compute-placement'],
			});
	}

	if (chosen.get('compute-runtime') === 'rust-wasm-browser') {
		b.node({
			id: 'browser-worker',
			kind: 'browser-worker',
			responsibilities: ['Hosts the wasm kernel'],
			decisions: ['compute-runtime'],
		});
		b.connect({
			from: 'browser-app',
			to: 'browser-worker',
			protocol: 'post-message',
			data_flow: 'input buffers (transferred) and results',
		});
		b.node({
			id: 'wasm-module',
			kind: 'wasm-module',
			placement: 'browser-worker',
			responsibilities: ['The measured hot loop, in Rust'],
			decisions: ['compute-runtime'],
			traits: { cpu_intensive: true, distinct_runtime: true },
		});
		b.connect({
			from: 'browser-worker',
			to: 'wasm-module',
			protocol: 'wasm-call',
			data_flow: 'pointers into resident linear memory',
		});
	}

	const dataStore = chosen.get('data-store');
	const needsDatabase =
		dataStore === 'postgres' ||
		chosen.get('processing-locality') === 'sql-in-database' ||
		b.has('background-worker') ||
		dataStore === 'redis-cache' ||
		dataStore === 'object-storage';
	if (needsDatabase) {
		b.node({
			id: 'relational-db',
			kind: 'relational-db',
			responsibilities: [
				'Authoritative data',
				...(chosen.get('processing-locality') === 'sql-in-database' ? ['Filtering and aggregation in SQL'] : []),
			],
			decisions: [
				'data-store',
				...(chosen.get('processing-locality') === 'sql-in-database' ? ['processing-locality'] : []),
			],
		});
		b.connect({ from: 'app-server', to: 'relational-db', protocol: 'sql', data_flow: 'queries and writes' });
	}
	if (b.has('background-worker')) {
		b.connect({
			from: 'app-server',
			to: 'relational-db',
			protocol: 'sql',
			data_flow: 'enqueue job rows in the same transaction',
		});
		b.connect({
			from: 'background-worker',
			to: 'relational-db',
			protocol: 'database-outbox',
			data_flow: 'claims job rows, writes results',
			mode: 'async',
		});
	}
	if (dataStore === 'object-storage') {
		b.node({
			id: 'object-storage',
			kind: 'object-storage',
			responsibilities: ['Files and media'],
			decisions: ['data-store'],
		});
		b.connect({
			from: 'app-server',
			to: 'object-storage',
			protocol: 'object-storage-api',
			data_flow: 'signed URLs and metadata',
		});
		if (profile.dataOrigin === 'user-device') {
			b.connect({
				from: 'browser-app',
				to: 'object-storage',
				protocol: 'object-storage-api',
				data_flow: 'direct upload through a signed URL',
			});
		}
		if (b.has('background-worker')) {
			b.connect({
				from: 'background-worker',
				to: 'object-storage',
				protocol: 'object-storage-api',
				data_flow: 'reads inputs, writes outputs',
			});
		}
	}
	if (dataStore === 'redis-cache') {
		b.node({ id: 'cache', kind: 'cache', responsibilities: ['Repeat-read cache'], decisions: ['data-store'] });
		b.connect({ from: 'app-server', to: 'cache', protocol: 'cache-protocol', data_flow: 'cached reads' });
	}
	if (dataStore === 'graph-db') {
		b.node({
			id: 'graph-db',
			kind: 'graph-db',
			responsibilities: ['Relationship traversals'],
			decisions: ['data-store'],
		});
		b.connect({ from: 'app-server', to: 'graph-db', protocol: 'cypher', data_flow: 'traversals' });
	}
	if (dataStore === 'indexeddb' || dataStore === 'browser-memory') {
		b.node({
			id: 'browser-app',
			kind: 'browser-app',
			responsibilities: [
				dataStore === 'indexeddb'
					? 'Offline copy in IndexedDB, synced to the server'
					: 'Working set kept in browser memory',
			],
			decisions: ['data-store'],
		});
	}

	const style = chosen.get('interaction-style');
	if (style === 'sse' || style === 'websocket') {
		b.connect({ from: 'browser-app', to: 'app-server', protocol: style, data_flow: 'live updates' });
	}
	if (style === 'websocket' || chosen.get('deployment-shape') === 'persistent-monolith') {
		b.node({
			id: 'app-server',
			kind: 'app-server',
			placement: 'server-persistent',
			decisions: ['deployment-shape'],
			traits: { stateful: style === 'websocket' },
		});
	}

	if (profile.sensitivity !== 'unknown') {
		b.model = { ...b.model, constraints: [`Data sensitivity: ${profile.sensitivity}`] };
	}
	b.model = {
		...b.model,
		description: `Built from an Explore recommendation (engine revision ${recommendation.engine_revision}). Properties the profile left unknown stay unknown.`,
	};
	return b.model;
}

const COLUMN: Record<ZoneKind, number> = { client: 0, application: 320, data: 640, 'third-party': 960 };

/** A deterministic first layout: one column per zone kind, nodes stacked in model order. */
export function layoutByZone(model: ArchitectureModel): ArchitectureLayout {
	const zoneKind = new Map(model.zones.map((zone) => [zone.id, zone.kind]));
	const rows = new Map<number, number>();
	const positions: ArchitectureLayout['positions'] = {};
	for (const node of model.nodes) {
		const x = COLUMN[zoneKind.get(node.zone) ?? NODE_KINDS[node.kind].zone];
		const row = rows.get(x) ?? 0;
		rows.set(x, row + 1);
		positions[node.id] = { x, y: row * 140 };
	}
	return { format: 1, positions };
}
