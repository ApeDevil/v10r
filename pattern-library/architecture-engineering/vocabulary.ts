/**
 * The closed vocabularies of Architecture Engineering: engineering domains, workload factors,
 * placements, node kinds, protocols, trust-zone kinds and evidence kinds.
 *
 * Framework-free and dependency-free on purpose (the `pattern-library/` rule): the stdio MCP
 * server imports this by relative path under bare Bun with no `node_modules`, and the app
 * reaches the same file as `#patterns/architecture-engineering/vocabulary.ts`.
 *
 * Four dimensions that are easy to conflate are kept apart here:
 *   - language (TypeScript, Rust) is a property of the code,
 *   - runtime (V8, a wasm engine, Bun, Postgres) executes it,
 *   - placement (browser main thread, a worker, a request handler, a database) is where it runs,
 *   - deployment unit (the app, a separate service) is what is shipped and scaled together.
 * A `Placement` names the third; `NODE_KINDS[*].deploysAs` names the fourth.
 */
import type { PatternRequirement } from '../schema.ts';

/** The five initial engineering domains. Order is display order. */
export const ENGINEERING_DOMAINS = ['execution', 'communication', 'data', 'deployment', 'performance'] as const;
export type EngineeringDomain = (typeof ENGINEERING_DOMAINS)[number];

export const ENGINEERING_DOMAIN_TITLES: Record<EngineeringDomain, string> = {
	execution: 'Execution architecture',
	communication: 'Communication architecture',
	data: 'Data architecture',
	deployment: 'Deployment architecture',
	performance: 'Performance architecture',
};

export const ENGINEERING_DOMAIN_QUESTIONS: Record<EngineeringDomain, string> = {
	execution: 'Where should the computation run, and in which runtime and language?',
	communication: 'How should the parts talk — synchronously or not, across which boundaries?',
	data: 'Where should data live, and where should it be filtered and aggregated?',
	deployment: 'What is shipped and scaled together, and when is a separate unit justified?',
	performance: 'What does the choice cost in loading, latency, CPU, memory and money — measured, not assumed?',
};

/**
 * Workload factors: the structured inputs Explore asks for. Every factor also accepts
 * `unknown`, which the engine keeps as missing information instead of guessing.
 */
export const WORKLOAD_FACTORS = {
	workload: [
		'interactive-ui',
		'numeric-compute',
		'data-query',
		'media-processing',
		'business-rules',
		'realtime-collaboration',
		'simulation',
		'light-api',
		'file-ingest',
	],
	/** How long one unit of work runs. */
	duration: ['under-100ms', 'under-1s', 'seconds', 'minutes', 'hours'],
	/** How much data one unit of work touches. */
	dataVolume: ['small', 'medium', 'large'],
	/** Where the input data is when the work starts. */
	dataOrigin: ['user-device', 'server-database', 'object-storage', 'external-source'],
	sensitivity: ['public', 'personal', 'secret'],
	offline: ['required', 'not-required'],
	/** How soon the user needs the result. */
	latency: ['interactive', 'responsive', 'relaxed'],
	/** CPU per unit of work. */
	compute: ['light', 'moderate', 'heavy'],
	/** Must the work continue without the user's request (or browser) staying open? */
	background: ['required', 'not-required'],
	/** What the target can host besides the serverless app. */
	infrastructure: ['serverless-only', 'container-available'],
	/** How much operational complexity the team accepts. */
	complexityTolerance: ['low', 'medium', 'high'],
} as const;

export type WorkloadFactor = keyof typeof WORKLOAD_FACTORS;
export type WorkloadFactorValue<F extends WorkloadFactor> = (typeof WORKLOAD_FACTORS)[F][number];
export const UNKNOWN = 'unknown' as const;
export type WorkloadProfile = { [F in WorkloadFactor]: WorkloadFactorValue<F> | typeof UNKNOWN };
export const WORKLOAD_FACTOR_IDS = Object.keys(WORKLOAD_FACTORS) as WorkloadFactor[];

export const WORKLOAD_FACTOR_LABELS: Record<WorkloadFactor, string> = {
	workload: 'Workload type',
	duration: 'Execution duration',
	dataVolume: 'Data volume',
	dataOrigin: 'Where the data starts',
	sensitivity: 'Data sensitivity',
	offline: 'Offline operation',
	latency: 'Latency requirement',
	compute: 'Computational intensity',
	background: 'Background execution',
	infrastructure: 'Infrastructure',
	complexityTolerance: 'Complexity tolerance',
};

/** A profile with every factor unknown — the honest starting point. */
export function unknownProfile(): WorkloadProfile {
	return Object.fromEntries(WORKLOAD_FACTOR_IDS.map((factor) => [factor, UNKNOWN])) as WorkloadProfile;
}

export function isFactorValue(factor: WorkloadFactor, value: unknown): boolean {
	return value === UNKNOWN || (WORKLOAD_FACTORS[factor] as readonly unknown[]).includes(value);
}

/** Where a node's code executes. Not a language, not a deployment unit. */
export const PLACEMENTS = [
	'browser-main-thread',
	'browser-worker',
	'server-request',
	'server-persistent',
	'background-worker',
	'separate-service',
	'database',
	'edge',
	'managed-service',
] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const PLACEMENT_LABELS: Record<Placement, string> = {
	'browser-main-thread': 'Browser main thread',
	'browser-worker': 'Browser Web Worker',
	'server-request': 'Server request handler (short-lived)',
	'server-persistent': 'Persistent server process',
	'background-worker': 'Background worker / job',
	'separate-service': 'Separately deployed service',
	database: 'Inside the database',
	edge: 'Edge function',
	'managed-service': 'Managed third-party service',
};

/** Placements whose code ships to, and runs on, the user's device. */
export const CLIENT_PLACEMENTS: readonly Placement[] = ['browser-main-thread', 'browser-worker'];

/** Trust zones: each crossing between two of them is a trust boundary. */
export const ZONE_KINDS = ['client', 'application', 'data', 'third-party'] as const;
export type ZoneKind = (typeof ZONE_KINDS)[number];

export const PROTOCOLS = [
	'function-call',
	'http-rest',
	'typed-rpc',
	'sse',
	'websocket',
	'message-queue',
	'database-outbox',
	'sql',
	'cypher',
	'cache-protocol',
	'object-storage-api',
	'post-message',
	'wasm-call',
] as const;
export type Protocol = (typeof PROTOCOLS)[number];

export const PROTOCOL_LABELS: Record<Protocol, string> = {
	'function-call': 'In-process function call',
	'http-rest': 'HTTP / REST',
	'typed-rpc': 'Typed RPC over HTTP',
	sse: 'Server-Sent Events',
	websocket: 'WebSocket',
	'message-queue': 'Message queue',
	'database-outbox': 'Database-mediated (outbox / claimed rows)',
	sql: 'SQL',
	cypher: 'Cypher (graph query)',
	'cache-protocol': 'Cache protocol (Redis / REST)',
	'object-storage-api': 'Object storage API (S3)',
	'post-message': 'postMessage (worker)',
	'wasm-call': 'Wasm export call',
};

/** Protocols that cross a process boundary and can therefore fail independently of the caller. */
export const NETWORK_PROTOCOLS: readonly Protocol[] = [
	'http-rest',
	'typed-rpc',
	'sse',
	'websocket',
	'message-queue',
	'database-outbox',
	'sql',
	'cypher',
	'cache-protocol',
	'object-storage-api',
];

export const NODE_KINDS = {
	'browser-app': {
		label: 'Browser application',
		placements: ['browser-main-thread'],
		zone: 'client',
		deploysAs: 'app',
		requires: [],
		accepts: ['sse', 'websocket', 'http-rest'],
		patterns: ['multi-client-core', 'architecture-state-management'],
	},
	'browser-worker': {
		label: 'Browser worker',
		placements: ['browser-worker'],
		zone: 'client',
		deploysAs: 'app',
		requires: ['web-worker'],
		accepts: ['post-message'],
		patterns: ['main-thread-budget'],
	},
	'wasm-module': {
		label: 'WebAssembly module',
		placements: ['browser-worker', 'browser-main-thread'],
		zone: 'client',
		deploysAs: 'app',
		requires: ['wasm-toolchain'],
		accepts: ['wasm-call'],
		patterns: ['architecture-wasm-kernel'],
	},
	'app-server': {
		label: 'Application server',
		placements: ['server-request', 'server-persistent'],
		zone: 'application',
		deploysAs: 'app',
		requires: [],
		accepts: ['http-rest', 'typed-rpc', 'sse', 'websocket', 'function-call'],
		patterns: ['multi-client-core', 'architecture-runtime-layers'],
	},
	'api-endpoint': {
		label: 'API endpoint',
		placements: ['server-request', 'edge'],
		zone: 'application',
		deploysAs: 'app',
		requires: [],
		accepts: ['http-rest', 'typed-rpc', 'function-call'],
		patterns: ['architecture-rest-api'],
	},
	'background-worker': {
		label: 'Background worker',
		placements: ['background-worker', 'server-persistent'],
		zone: 'application',
		deploysAs: 'worker',
		requires: ['cron'],
		accepts: ['database-outbox', 'message-queue', 'function-call'],
		patterns: ['jobs-scheduler', 'notifications-router-outbox'],
	},
	'compute-service': {
		label: 'Compute service',
		placements: ['separate-service'],
		zone: 'application',
		deploysAs: 'service',
		requires: ['container-host'],
		accepts: ['http-rest', 'typed-rpc', 'message-queue'],
		patterns: ['architecture-external-service'],
	},
	'relational-db': {
		label: 'Relational database',
		placements: ['database'],
		zone: 'data',
		deploysAs: 'managed',
		requires: ['postgres'],
		accepts: ['sql', 'database-outbox'],
		patterns: ['databases-postgres-connection', 'databases-queries-mutations-split'],
	},
	'graph-db': {
		label: 'Graph database',
		placements: ['database'],
		zone: 'data',
		deploysAs: 'managed',
		requires: ['neo4j'],
		accepts: ['cypher'],
		patterns: ['databases-neo4j-connection', 'databases-graph-modeling'],
	},
	cache: {
		label: 'Cache',
		placements: ['managed-service', 'database'],
		zone: 'data',
		deploysAs: 'managed',
		requires: ['redis'],
		accepts: ['cache-protocol'],
		patterns: ['databases-cache', 'hierarchical-cache'],
	},
	'object-storage': {
		label: 'Object storage',
		placements: ['managed-service'],
		zone: 'data',
		deploysAs: 'managed',
		requires: ['object-storage'],
		accepts: ['object-storage-api', 'http-rest'],
		patterns: ['databases-object-storage', 'forms-file-uploads'],
	},
	'external-service': {
		label: 'External service',
		placements: ['managed-service'],
		zone: 'third-party',
		deploysAs: 'managed',
		requires: ['third-party-api'],
		accepts: ['http-rest', 'typed-rpc', 'websocket', 'message-queue'],
		patterns: ['resilience-policy'],
	},
} as const satisfies Record<
	string,
	{
		label: string;
		placements: readonly Placement[];
		zone: ZoneKind;
		/** What gets shipped: `app` = inside the main deployment; `worker`/`service` = an extra unit; `managed` = someone else runs it. */
		deploysAs: 'app' | 'worker' | 'service' | 'managed';
		requires: readonly PatternRequirement[];
		/** Protocols this kind can be the *target* of. */
		accepts: readonly Protocol[];
		/** Registry patterns that implement this kind in v10r. */
		patterns: readonly string[];
	}
>;

export type NodeKind = keyof typeof NODE_KINDS;
export const NODE_KIND_IDS = Object.keys(NODE_KINDS) as NodeKind[];

/**
 * What sort of support a claim has. One field among several (with `conditions` and
 * `limitations`), never merged into a score — the evidence-status-dimensions discipline.
 */
export const EVIDENCE_KINDS = [
	/** Numbers recorded under stated conditions (a committed table or file). */
	'measured',
	/** A harness that measures on the reader's own device when run; nothing is recorded. */
	'live-measurement',
	/** Working code plus tests that show the approach functions — not that it is fast. */
	'reference-implementation',
	/** Reasoning written down in v10r's docs. */
	'documented-reasoning',
	/** A published study or vendor documentation outside v10r. */
	'external-study',
	/** A judgement nobody has measured. */
	'estimate',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
	measured: 'Measured (recorded conditions)',
	'live-measurement': 'Live measurement (runs on your device)',
	'reference-implementation': 'Reference implementation',
	'documented-reasoning': 'Documented reasoning',
	'external-study': 'External study',
	estimate: 'Estimate — not measured',
};
