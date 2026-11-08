/**
 * A four-stage evolution example: one architecture changed three times as requirements grow,
 * each stage a variant derived from the previous one with its reason recorded. The point is
 * the comparison between neighbours — each stage adds capability *and* complexity, and the
 * checks and comparison say both. No stage is presented as better than the one before.
 */
import type { ArchitectureModel } from './architecture-model.ts';
import {
	addConnection,
	addNode,
	createArchitectureModel,
	deriveVariant,
	type ModelOperation,
} from './model-operations.ts';

function apply(model: ArchitectureModel, ...steps: ((m: ArchitectureModel) => ModelOperation)[]): ArchitectureModel {
	return steps.reduce((current, step) => {
		const result = step(current);
		if (!result.ok) throw new Error(`evolution example: refused (${result.refusal})`);
		return result.model;
	}, model);
}

function baseline(): ArchitectureModel {
	const model = createArchitectureModel('stage-1-monolith', 'SvelteKit + PostgreSQL');
	return {
		...apply(
			{ ...model, description: 'The starting point: one serverless SvelteKit deployment and one Postgres database.' },
			(m) => addNode(m, { id: 'browser-app', kind: 'browser-app', responsibilities: ['User interface'] }),
			(m) =>
				addNode(m, {
					id: 'app-server',
					kind: 'app-server',
					responsibilities: ['Pages and API', 'Authentication and business rules', 'Report generation'],
					traits: { holds_secrets: true },
					decisions: ['compute-placement', 'deployment-shape'],
				}),
			(m) =>
				addNode(m, {
					id: 'relational-db',
					kind: 'relational-db',
					responsibilities: ['Authoritative data'],
					decisions: ['data-store'],
				}),
			(m) =>
				addConnection(m, {
					from: 'browser-app',
					to: 'app-server',
					protocol: 'http-rest',
					data_flow: 'page and API requests',
					authenticated: 'yes',
					failure_handling: 'timeout',
				}),
			(m) =>
				addConnection(m, {
					from: 'app-server',
					to: 'relational-db',
					protocol: 'sql',
					data_flow: 'queries and writes',
					authenticated: 'yes',
					failure_handling: 'timeout',
				}),
		),
	};
}

function withWorker(previous: ArchitectureModel): ArchitectureModel {
	const variant = deriveVariant(
		previous,
		'stage-2-background-worker',
		'+ background worker',
		'Report generation grew to minutes and started hitting the request time limit. It moves into a background job claimed from Postgres; the page shows its status.',
	);
	const moved = {
		...variant,
		nodes: variant.nodes.map((node) =>
			node.id === 'app-server'
				? { ...node, responsibilities: ['Pages and API', 'Authentication and business rules', 'Enqueue report jobs'] }
				: node,
		),
	};
	return apply(
		moved,
		(m) =>
			addNode(m, {
				id: 'report-worker',
				kind: 'background-worker',
				label: 'Report worker',
				responsibilities: ['Generate reports'],
				traits: { long_running: true, cpu_intensive: true },
				decisions: ['compute-placement', 'interaction-style'],
			}),
		(m) =>
			addConnection(m, {
				from: 'report-worker',
				to: 'relational-db',
				protocol: 'database-outbox',
				data_flow: 'claims job rows, writes reports',
				authenticated: 'yes',
				failure_handling: 'queue-redelivery',
			}),
	);
}

function withService(previous: ArchitectureModel): ArchitectureModel {
	const variant = deriveVariant(
		previous,
		'stage-3-rust-service',
		'+ dedicated Rust compute service',
		'One report type needs a numeric solver that already exists in Rust and must be isolated from the app’s memory limits. Evaluate a dedicated service called by the worker.',
	);
	return apply(
		variant,
		(m) =>
			addNode(m, {
				id: 'solver-service',
				kind: 'compute-service',
				label: 'Solver service (Rust)',
				responsibilities: ['Numeric solver'],
				traits: { cpu_intensive: true, distinct_runtime: true },
				decisions: ['compute-runtime', 'deployment-shape'],
			}),
		(m) =>
			addConnection(m, {
				from: 'report-worker',
				to: 'solver-service',
				protocol: 'typed-rpc',
				data_flow: 'solver inputs and results',
				authenticated: 'yes',
			}),
	);
}

function withClientCompute(previous: ArchitectureModel): ArchitectureModel {
	const variant = deriveVariant(
		previous,
		'stage-4-client-compute',
		'+ client-side preview compute',
		'Users want an instant preview while they edit parameters. Evaluate JavaScript in a Web Worker first; a Rust/Wasm kernel only if a parity-gated benchmark shows it pays for its download and init.',
	);
	return apply(
		variant,
		(m) =>
			addNode(m, {
				id: 'preview-worker',
				kind: 'browser-worker',
				label: 'Preview worker',
				responsibilities: ['Compute the live preview'],
				traits: { cpu_intensive: true },
				decisions: ['compute-placement', 'compute-acceleration'],
			}),
		(m) =>
			addConnection(m, {
				from: 'browser-app',
				to: 'preview-worker',
				protocol: 'post-message',
				data_flow: 'parameters in, preview buffer out (transferred)',
			}),
	);
}

/** The four stages, each derived from the one before. */
export function evolutionExample(): ArchitectureModel[] {
	const one = baseline();
	const two = withWorker(one);
	const three = withService(two);
	const four = withClientCompute(three);
	return [one, two, three, four];
}
