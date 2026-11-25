/**
 * The architecture model the A2A interop run, the A2A tests and the Interop Lab send: small, valid, and built to
 * trip rules on both sides — a secret on the browser node and unstated boundary properties for
 * v10r's security checks; a three-hop synchronous chain, no cache and one database for the
 * Python performance peer. Built through `model-operations.ts`, so it is valid by construction.
 */
import {
	type ArchitectureModel,
	addConnection,
	addNode,
	createArchitectureModel,
	type NewConnection,
	type NewNode,
} from '#patterns/architecture-engineering/index.ts';

const NODES: NewNode[] = [
	{ kind: 'browser-app', traits: { holds_secrets: true } },
	{ kind: 'api-endpoint' },
	{ kind: 'background-worker' },
	{ kind: 'relational-db' },
];

const CONNECTIONS: NewConnection[] = [
	{ from: 'browser-app', to: 'api-endpoint', authenticated: 'yes', failure_handling: 'timeout' },
	{ from: 'api-endpoint', to: 'background-worker', protocol: 'http-rest' },
	{ from: 'background-worker', to: 'relational-db', authenticated: 'yes', failure_handling: 'none' },
];

export function sampleReviewModel(): ArchitectureModel {
	let model = createArchitectureModel('a2a-interop-sample', 'A2A interop sample');
	for (const node of NODES) {
		const step = addNode(model, node);
		if (!step.ok) throw new Error(`sample model: ${step.refusal}`);
		model = step.model;
	}
	for (const connection of CONNECTIONS) {
		const step = addConnection(model, connection);
		if (!step.ok) throw new Error(`sample model: ${step.refusal}`);
		model = step.model;
	}
	return model;
}
