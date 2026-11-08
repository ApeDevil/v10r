/**
 * Engineering checks: an architecture model in, sorted findings out. Each check is a pure,
 * static function over the model's declared facts — the architecture-level counterpart of
 * v10r's own `*.gate.test.ts` fitness functions. Nothing here measures, runs or estimates
 * performance, and no finding may claim a number.
 *
 * The model is assumed to have passed `parseArchitectureModel` (integrity holds: every
 * reference resolves). Security checks are separate functions from the rest, so they can be
 * read, tested and reported on their own.
 */
import type { ArchitectureConnection, ArchitectureModel, ArchitectureNode } from './architecture-model.ts';
import { type ArchitectureFinding, finding, sortFindings } from './findings.ts';
import { CLIENT_PLACEMENTS, NETWORK_PROTOCOLS, NODE_KINDS, type NodeKind, type Protocol } from './vocabulary.ts';

const DATA_KINDS: readonly NodeKind[] = ['relational-db', 'graph-db', 'cache', 'object-storage'];
/** Data stores the browser may legitimately reach directly — object storage through a signed URL. */
const CLIENT_REACHABLE_STORES: readonly NodeKind[] = ['object-storage'];

interface Context {
	model: ArchitectureModel;
	byId: Map<string, ArchitectureNode>;
	zoneKind: Map<string, string>;
}

function isClient(node: ArchitectureNode): boolean {
	return CLIENT_PLACEMENTS.includes(node.placement);
}

function crossesNetwork(connection: ArchitectureConnection): boolean {
	return NETWORK_PROTOCOLS.includes(connection.protocol);
}

function crossesZone(context: Context, connection: ArchitectureConnection): boolean {
	const from = context.byId.get(connection.from);
	const to = context.byId.get(connection.to);
	return !!from && !!to && from.zone !== to.zone;
}

/**
 * A boundary between separately running parts the design owns or depends on: the device to
 * the server, the app to a worker or service, anything to a third party. Calls to the app's
 * own managed data stores are left to the driver's defaults and not flagged here.
 */
function isServiceBoundary(from: ArchitectureNode, to: ArchitectureNode): boolean {
	const target = NODE_KINDS[to.kind].deploysAs;
	if (to.kind === 'external-service') return true;
	if (target === 'service' || target === 'worker') return from.id !== to.id;
	return isClient(from) && !isClient(to) && target === 'app';
}

function connectionSubject(connection: ArchitectureConnection): string {
	return `connections/${connection.id}`;
}

// ── Security ────────────────────────────────────────────────────────────────

function secretsOnClient(context: Context): ArchitectureFinding[] {
	return context.model.nodes
		.filter((node) => node.traits.holds_secrets && isClient(node))
		.map((node) =>
			finding('secret.client-exposed', `nodes/${node.id}`, {
				detected: `"${node.label}" holds server-only secrets but runs on the user's device (${node.placement}).`,
				why: 'Everything shipped to a browser can be read by its user: bundles, workers and wasm modules are public.',
				constraint: 'Secrets and authorization decisions never execute on the device.',
				fix: 'Move the secret-holding work to an application-zone node (a server request or service) and call it from the browser.',
				patterns: ['multi-client-core', 'identity-route-guards'],
			}),
		);
}

function boundaryAuthentication(context: Context): ArchitectureFinding[] {
	const findings: ArchitectureFinding[] = [];
	for (const connection of context.model.connections) {
		const from = context.byId.get(connection.from);
		const to = context.byId.get(connection.to);
		if (!from || !to || !crossesZone(context, connection) || !crossesNetwork(connection)) continue;
		// Only crossings *into* a more trusted zone need the caller authenticated; data leaving to a client is the server's choice.
		const intoTrusted = isClient(from) || context.zoneKind.get(from.zone) === 'third-party';
		if (!intoTrusted) continue;
		if (connection.authenticated === 'no') {
			findings.push(
				finding('boundary.unauthenticated', connectionSubject(connection), {
					detected: `"${from.label}" → "${to.label}" crosses a trust boundary (${connection.protocol}) without authentication.`,
					why: 'Anyone who can reach the endpoint can call it; the client is not a trust boundary.',
					constraint:
						'Every crossing into a more trusted zone authenticates the caller and authorizes the operation on the server.',
					fix: 'Authenticate the connection (session cookie, bearer token, signed webhook) and authorize in the server-side domain.',
					patterns: ['identity-route-guards', 'identity-capability-grants', 'anti-abuse-rate-limiting'],
				}),
			);
		} else if (connection.authenticated === 'unknown') {
			findings.push(
				finding('boundary.auth-unknown', connectionSubject(connection), {
					detected: `"${from.label}" → "${to.label}" crosses a trust boundary and its authentication is not stated.`,
					why: 'Whether this is a problem depends on a fact the model does not record.',
					constraint: 'Every crossing into a more trusted zone authenticates the caller.',
					fix: 'State whether the connection is authenticated; if it is public on purpose, mark it "no" and expect a finding to accept.',
					patterns: ['identity-route-guards'],
				}),
			);
		}
	}
	return findings;
}

function clientDirectData(context: Context): ArchitectureFinding[] {
	return context.model.connections.flatMap((connection) => {
		const from = context.byId.get(connection.from);
		const to = context.byId.get(connection.to);
		if (!from || !to || !isClient(from) || !DATA_KINDS.includes(to.kind) || CLIENT_REACHABLE_STORES.includes(to.kind)) {
			return [];
		}
		return [
			finding('client.direct-data-access', connectionSubject(connection), {
				detected: `"${from.label}" on the device talks to "${to.label}" directly.`,
				why: 'A database credential in the browser is a public credential; row access can no longer be authorized per user.',
				constraint: 'Data stores are reached through the application zone, which authorizes every operation.',
				fix: 'Route the access through an API endpoint or server load function that owns the query.',
				patterns: ['multi-client-core', 'databases-queries-mutations-split'],
			}),
		];
	});
}

export function checkSecurity(model: ArchitectureModel): ArchitectureFinding[] {
	const context = contextOf(model);
	return sortFindings([...secretsOnClient(context), ...boundaryAuthentication(context), ...clientDirectData(context)]);
}

// ── Runtime, communication, data, structure ─────────────────────────────────

function mainThreadCpu(context: Context): ArchitectureFinding[] {
	return context.model.nodes
		.filter((node) => node.placement === 'browser-main-thread' && node.traits.cpu_intensive)
		.map((node) =>
			finding('main-thread.cpu', `nodes/${node.id}`, {
				detected: `"${node.label}" does CPU-intensive work on the browser main thread.`,
				why: 'While it runs, input and rendering wait; on slow phones a heavy task is visible jank. A heuristic: short bursts may be fine.',
				constraint: 'Interactive work keeps each main-thread task inside the interaction budget.',
				fix: 'Move the computation into a browser worker (and transfer buffers), or measure and show it stays under budget.',
				patterns: ['main-thread-budget', 'velocity-idle-work'],
			}),
		);
}

function longRunningInRequest(context: Context): ArchitectureFinding[] {
	return context.model.nodes
		.filter((node) => node.traits.long_running && (node.placement === 'server-request' || node.placement === 'edge'))
		.map((node) =>
			finding('request.long-running', `nodes/${node.id}`, {
				detected: `"${node.label}" is long-running but placed in a short-lived request handler (${node.placement}).`,
				why: 'Serverless request handlers are cut off at the host’s duration limit, and the user waits on an open request.',
				constraint: 'Work that outlives a request runs as a job with a status, not inside the request.',
				fix: 'Enqueue it for a background worker (database outbox) and report progress by status or SSE.',
				patterns: ['jobs-scheduler', 'notifications-router-outbox', 'durable-step-execution'],
			}),
		);
}

function unsupportedRuntime(context: Context): ArchitectureFinding[] {
	const findings: ArchitectureFinding[] = [];
	for (const connection of context.model.connections) {
		const to = context.byId.get(connection.to);
		if (!to) continue;
		if (connection.protocol === 'websocket' && (to.placement === 'server-request' || to.placement === 'edge')) {
			findings.push(
				finding('runtime.unsupported', connectionSubject(connection), {
					detected: `A WebSocket terminates at "${to.label}", which runs as ${to.placement}.`,
					why: 'Short-lived request handlers cannot hold a connection open between requests.',
					constraint: 'Persistent connections need a persistent process.',
					fix: 'Place the target on a persistent server process, or switch to SSE plus ordinary requests.',
					patterns: ['notifications-sse-stream', 'architecture-deployment'],
				}),
			);
		}
	}
	for (const node of context.model.nodes) {
		if (node.kind === 'background-worker' && node.traits.stateful && node.placement === 'background-worker') {
			// A scheduled job on serverless keeps no state between runs; flag only when the model says it must.
			findings.push(
				finding('runtime.unsupported', `nodes/${node.id}`, {
					detected: `"${node.label}" is a scheduled background worker but is marked as keeping state between runs.`,
					why: 'Scheduled jobs start fresh each run; in-memory state is lost.',
					constraint:
						'State that must survive between runs lives in a store, or the worker runs as a persistent process.',
					fix: 'Keep the state in Postgres, or set the placement to a persistent server process.',
					patterns: ['jobs-scheduler'],
				}),
			);
		}
	}
	return findings;
}

function protocolCompatibility(context: Context): ArchitectureFinding[] {
	return context.model.connections.flatMap((connection) => {
		const to = context.byId.get(connection.to);
		if (!to) return [];
		const accepts = NODE_KINDS[to.kind].accepts as readonly Protocol[];
		if (accepts.includes(connection.protocol)) return [];
		return [
			finding('protocol.incompatible', connectionSubject(connection), {
				detected: `"${to.label}" (${NODE_KINDS[to.kind].label}) cannot be reached over ${connection.protocol}.`,
				why: 'The connection describes a call the target does not speak, so the design cannot be built as drawn.',
				constraint: `A ${NODE_KINDS[to.kind].label} accepts: ${accepts.join(', ')}.`,
				fix: `Change the protocol to one the target accepts, or put an adapter node between them.`,
				patterns: NODE_KINDS[to.kind].patterns.slice(0, 2),
			}),
		];
	});
}

function failureHandling(context: Context): ArchitectureFinding[] {
	const findings: ArchitectureFinding[] = [];
	for (const connection of context.model.connections) {
		const from = context.byId.get(connection.from);
		const to = context.byId.get(connection.to);
		if (!from || !to || !crossesNetwork(connection)) continue;
		if (!isServiceBoundary(from, to)) continue;
		if (connection.failure_handling === 'unknown') {
			findings.push(
				finding('boundary.failure-unknown', connectionSubject(connection), {
					detected: `"${from.label}" → "${to.label}" crosses a network boundary and its failure handling is not stated.`,
					why: 'Across a network the callee can be slow, down or cold; what the caller does then is part of the design.',
					constraint: 'Every network boundary states a deadline and a retry policy (or why none is needed).',
					fix: 'State the failure handling: a timeout, retries for idempotent calls, or queue redelivery.',
					patterns: ['resilience-policy', 'deadline-propagation'],
				}),
			);
		} else if (connection.failure_handling === 'none' && connection.mode === 'sync') {
			findings.push(
				finding('boundary.no-failure-handling', connectionSubject(connection), {
					detected: `"${from.label}" → "${to.label}" is a synchronous network call with no failure handling.`,
					why: 'Without a deadline a slow callee holds the caller’s request open until the host kills it.',
					constraint: 'Every synchronous network call has a deadline.',
					fix: 'Add a timeout; retry only idempotent operations, with backoff.',
					patterns: ['resilience-policy', 'deadline-propagation'],
				}),
			);
		}
	}
	return findings;
}

function unjustifiedService(context: Context): ArchitectureFinding[] {
	return context.model.nodes
		.filter(
			(node) =>
				node.kind === 'compute-service' &&
				!node.traits.cpu_intensive &&
				!node.traits.long_running &&
				!node.traits.distinct_runtime &&
				!node.traits.stateful,
		)
		.map((node) =>
			finding('boundary.unjustified-service', `nodes/${node.id}`, {
				detected: `"${node.label}" is a separately deployed service with no stated reason (no CPU-intensive, long-running, stateful or distinct-runtime trait).`,
				why: 'A separate deployment adds a network hop, a credential, a contract and a failure mode to every call.',
				constraint: 'Prefer the simpler architecture unless a requirement justifies the extra unit.',
				fix: 'Fold it into the application as a domain module, or record the trait that justifies it.',
				patterns: ['multi-client-core', 'architecture-external-service'],
			}),
		);
}

function sharedDataOwnership(context: Context): ArchitectureFinding[] {
	const findings: ArchitectureFinding[] = [];
	for (const store of context.model.nodes) {
		if (!DATA_KINDS.includes(store.kind) || store.kind === 'cache') continue;
		const units = new Set(
			context.model.connections
				.filter((connection) => connection.to === store.id)
				.map((connection) => context.byId.get(connection.from))
				.filter((node): node is ArchitectureNode => !!node)
				.map((node) =>
					NODE_KINDS[node.kind].deploysAs === 'service' ? `service:${node.id}` : NODE_KINDS[node.kind].deploysAs,
				),
		);
		const services = [...units].filter((unit) => unit.startsWith('service:'));
		if (services.length > 0 && units.size > 1) {
			findings.push(
				finding('data.shared-ownership', `nodes/${store.id}`, {
					detected: `"${store.label}" is accessed by several deployment units (${[...units].sort().join(', ')}).`,
					why: 'When two deployments read and write the same tables, neither owns the schema, and a change in one breaks the other.',
					constraint: 'Each data store has one owning deployment unit; others go through its interface.',
					fix: 'Give the store one owner and let the other unit call that owner, or split the data.',
					patterns: ['architecture-external-service', 'databases-queries-mutations-split'],
				}),
			);
		}
	}
	return findings;
}

function isolatedNodes(context: Context): ArchitectureFinding[] {
	if (context.model.nodes.length < 2) return [];
	const touched = new Set(context.model.connections.flatMap((connection) => [connection.from, connection.to]));
	return context.model.nodes
		.filter((node) => !touched.has(node.id))
		.map((node) =>
			finding('node.isolated', `nodes/${node.id}`, {
				detected: `"${node.label}" has no connections.`,
				why: 'A component nothing talks to is either missing its connections or not needed.',
				constraint: 'Every component has a stated relationship to the rest of the system.',
				fix: 'Connect it, or remove it.',
				patterns: [],
			}),
		);
}

function contextOf(model: ArchitectureModel): Context {
	return {
		model,
		byId: new Map(model.nodes.map((node) => [node.id, node])),
		zoneKind: new Map(model.zones.map((zone) => [zone.id, zone.kind])),
	};
}

/** Every check that is not a security check. */
export function checkDesign(model: ArchitectureModel): ArchitectureFinding[] {
	const context = contextOf(model);
	return sortFindings([
		...mainThreadCpu(context),
		...longRunningInRequest(context),
		...unsupportedRuntime(context),
		...protocolCompatibility(context),
		...failureHandling(context),
		...unjustifiedService(context),
		...sharedDataOwnership(context),
		...isolatedNodes(context),
	]);
}

/** All findings, sorted: security and design checks together. */
export function checkArchitecture(model: ArchitectureModel): ArchitectureFinding[] {
	return sortFindings([...checkSecurity(model), ...checkDesign(model)]);
}
