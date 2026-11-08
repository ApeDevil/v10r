import { describe, expect, it } from 'vitest';
import registryJson from '../registry.json';
import type { ArchitectureModel } from './architecture-model.ts';
import { checkArchitecture, checkDesign, checkSecurity } from './checks.ts';
import { FINDING_SPECS, type FindingCode } from './findings.ts';
import {
	addConnection,
	addNode,
	createArchitectureModel,
	type NewConnection,
	type NewNode,
	updateNode,
} from './model-operations.ts';

function build(nodes: NewNode[], connections: NewConnection[] = []): ArchitectureModel {
	let model = createArchitectureModel('test', 'Test');
	for (const node of nodes) {
		const result = addNode(model, node);
		if (!result.ok) throw new Error(result.refusal);
		model = result.model;
	}
	for (const connection of connections) {
		const result = addConnection(model, connection);
		if (!result.ok) throw new Error(result.refusal);
		model = result.model;
	}
	return model;
}

const codes = (model: ArchitectureModel) => checkArchitecture(model).map((entry) => entry.code);

/** A clean three-tier baseline: every boundary authenticated with a stated failure policy. */
function clean(): ArchitectureModel {
	return build(
		[{ kind: 'browser-app' }, { kind: 'app-server', traits: { holds_secrets: true } }, { kind: 'relational-db' }],
		[
			{ from: 'browser-app', to: 'app-server', authenticated: 'yes', failure_handling: 'timeout' },
			{ from: 'app-server', to: 'relational-db', authenticated: 'yes', failure_handling: 'timeout' },
		],
	);
}

describe('engineering checks', () => {
	it('a clean baseline has no findings (control for every test below)', () => {
		expect(checkArchitecture(clean())).toEqual([]);
	});

	it('detects a server-only secret on a browser-executed component', () => {
		const result = updateNode(clean(), 'browser-app', { traits: { holds_secrets: true } });
		if (!result.ok) throw new Error(result.refusal);
		expect(checkSecurity(result.model).map((entry) => entry.code)).toEqual(['secret.client-exposed']);
	});

	it('detects an unauthenticated trust-boundary crossing, and keeps unknown as unknown', () => {
		const no = build(
			[{ kind: 'browser-app' }, { kind: 'api-endpoint' }],
			[{ from: 'browser-app', to: 'api-endpoint', authenticated: 'no', failure_handling: 'timeout' }],
		);
		const unknown = build(
			[{ kind: 'browser-app' }, { kind: 'api-endpoint' }],
			[{ from: 'browser-app', to: 'api-endpoint', failure_handling: 'timeout' }],
		);
		expect(codes(no)).toContain('boundary.unauthenticated');
		expect(checkArchitecture(unknown).find((entry) => entry.code === 'boundary.auth-unknown')?.severity).toBe(
			'unknown',
		);
	});

	it('detects a browser talking to a database directly — but allows signed-URL object storage', () => {
		const direct = build(
			[{ kind: 'browser-app' }, { kind: 'relational-db' }],
			[{ from: 'browser-app', to: 'relational-db', protocol: 'sql', authenticated: 'yes' }],
		);
		const upload = build(
			[{ kind: 'browser-app' }, { kind: 'object-storage' }],
			[{ from: 'browser-app', to: 'object-storage', authenticated: 'yes' }],
		);
		expect(codes(direct)).toContain('client.direct-data-access');
		expect(codes(upload)).not.toContain('client.direct-data-access');
	});

	it('flags CPU-intensive main-thread work as a warning, not an error', () => {
		const result = updateNode(clean(), 'browser-app', { traits: { cpu_intensive: true } });
		if (!result.ok) throw new Error(result.refusal);
		const entry = checkDesign(result.model).find((item) => item.code === 'main-thread.cpu');
		expect(entry?.severity).toBe('warning');
	});

	it('flags long-running work in a short-lived request handler', () => {
		const result = updateNode(clean(), 'app-server', { traits: { long_running: true } });
		if (!result.ok) throw new Error(result.refusal);
		expect(codes(result.model)).toContain('request.long-running');
		const persistent = updateNode(result.model, 'app-server', { placement: 'server-persistent' });
		if (!persistent.ok) throw new Error(persistent.refusal);
		expect(codes(persistent.model)).not.toContain('request.long-running');
	});

	it('flags an incompatible protocol and a WebSocket on a request-only placement', () => {
		const model = build(
			[{ kind: 'browser-app' }, { kind: 'app-server' }, { kind: 'relational-db' }],
			[
				{
					from: 'browser-app',
					to: 'app-server',
					protocol: 'websocket',
					authenticated: 'yes',
					failure_handling: 'retry',
				},
				{ from: 'app-server', to: 'relational-db', protocol: 'http-rest', authenticated: 'yes' },
			],
		);
		expect(codes(model)).toEqual(expect.arrayContaining(['protocol.incompatible', 'runtime.unsupported']));
	});

	it('asks for failure handling across a service boundary, and warns when there is none', () => {
		const unknown = build(
			[{ kind: 'app-server' }, { kind: 'compute-service', traits: { cpu_intensive: true } }],
			[{ from: 'app-server', to: 'compute-service', authenticated: 'yes' }],
		);
		const none = build(
			[{ kind: 'app-server' }, { kind: 'compute-service', traits: { cpu_intensive: true } }],
			[{ from: 'app-server', to: 'compute-service', authenticated: 'yes', failure_handling: 'none' }],
		);
		expect(codes(unknown)).toContain('boundary.failure-unknown');
		expect(codes(none)).toContain('boundary.no-failure-handling');
	});

	it('recommends folding a service with no stated reason back into the app', () => {
		const model = build(
			[{ kind: 'app-server' }, { kind: 'compute-service' }],
			[{ from: 'app-server', to: 'compute-service', authenticated: 'yes', failure_handling: 'timeout' }],
		);
		const entry = checkArchitecture(model).find((item) => item.code === 'boundary.unjustified-service');
		expect(entry?.severity).toBe('recommendation');
	});

	it('warns when a service and the app share one database', () => {
		const model = build(
			[
				{ kind: 'app-server' },
				{ kind: 'compute-service', traits: { distinct_runtime: true } },
				{ kind: 'relational-db' },
			],
			[
				{ from: 'app-server', to: 'compute-service', authenticated: 'yes', failure_handling: 'timeout' },
				{ from: 'app-server', to: 'relational-db', authenticated: 'yes' },
				{ from: 'compute-service', to: 'relational-db', authenticated: 'yes' },
			],
		);
		expect(codes(model)).toContain('data.shared-ownership');
	});

	it('recommends connecting or removing an isolated node', () => {
		const model = build([{ kind: 'browser-app' }, { kind: 'cache' }]);
		expect(codes(model)).toContain('node.isolated');
	});

	it('severity is fixed per code, and the order is stable', () => {
		const model = build([
			{ kind: 'browser-app', traits: { holds_secrets: true, cpu_intensive: true } },
			{ kind: 'cache' },
		]);
		const findings = checkArchitecture(model);
		for (const entry of findings) expect(entry.severity).toBe(FINDING_SPECS[entry.code].severity);
		expect(JSON.stringify(checkArchitecture(model))).toBe(JSON.stringify(findings));
		expect(findings[0].severity).toBe('error');
	});

	it('no finding text claims a measured number', () => {
		const model = build(
			[
				{ kind: 'browser-app', traits: { holds_secrets: true, cpu_intensive: true, long_running: true } },
				{ kind: 'app-server', traits: { long_running: true } },
				{ kind: 'compute-service' },
			],
			[
				{
					from: 'browser-app',
					to: 'compute-service',
					protocol: 'http-rest',
					authenticated: 'no',
					failure_handling: 'none',
				},
			],
		);
		for (const entry of checkArchitecture(model)) {
			expect(`${entry.detected} ${entry.why} ${entry.fix}`).not.toMatch(/\d+\s*(ms|s|%|x|×)\b/);
		}
	});

	it('every finding links only to registry patterns', () => {
		const known = new Set((registryJson as { patterns: { id: string }[] }).patterns.map((pattern) => pattern.id));
		const model = build(
			[
				{ kind: 'browser-app', traits: { holds_secrets: true, cpu_intensive: true } },
				{ kind: 'app-server', traits: { long_running: true } },
				{ kind: 'compute-service' },
				{ kind: 'relational-db' },
				{ kind: 'cache' },
			],
			[
				{ from: 'browser-app', to: 'relational-db', protocol: 'sql', authenticated: 'no' },
				{ from: 'browser-app', to: 'app-server', protocol: 'websocket', authenticated: 'unknown' },
				{ from: 'app-server', to: 'compute-service', authenticated: 'yes', failure_handling: 'none' },
				{ from: 'compute-service', to: 'relational-db', authenticated: 'yes' },
				{ from: 'app-server', to: 'relational-db', protocol: 'http-rest', authenticated: 'yes' },
			],
		);
		const findings = checkArchitecture(model);
		const seen = new Set(findings.map((entry) => entry.code));
		// This model is built to exercise every code but the scheduled-stateful variant of runtime.unsupported.
		expect([...seen].sort()).toEqual((Object.keys(FINDING_SPECS) as FindingCode[]).sort());
		for (const entry of findings) for (const id of entry.patterns) expect(known.has(id), id).toBe(true);
	});
});
