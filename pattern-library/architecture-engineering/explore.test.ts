import { describe, expect, it } from 'vitest';
import registryJson from '../registry.json';
import { parseRegistry } from '../schema.ts';
import { DECISION_CATALOG } from './decision-catalog.ts';
import { type ArchitectureDecision, checkDecisionReferences, parseDecisionCatalog } from './decision-record.ts';
import catalogJson from './decisions.json';
import { evaluateDecision, exploreWorkload, parseWorkloadProfile } from './explore.ts';
import { ENGINEERING_DOMAINS, NODE_KINDS, unknownProfile, type WorkloadProfile } from './vocabulary.ts';
import { WORKLOAD_EXAMPLES } from './workload-examples.ts';

const registry = parseRegistry(registryJson).registry;

function profile(overrides: Partial<WorkloadProfile>): WorkloadProfile {
	return { ...unknownProfile(), ...overrides };
}

function chosen(id: string, input: WorkloadProfile): string {
	const outcome = exploreWorkload(DECISION_CATALOG, input).outcomes.find((entry) => entry.decision === id);
	if (!outcome) throw new Error(`no outcome for ${id}`);
	return outcome.chosen.id;
}

describe('decision catalogue', () => {
	it('parses and covers every engineering domain', () => {
		const { catalog, errors } = parseDecisionCatalog(catalogJson);
		expect(errors).toEqual([]);
		const domains = new Set(catalog?.decisions.map((decision) => decision.domain));
		expect([...domains].sort()).toEqual([...ENGINEERING_DOMAINS].sort());
	});

	it('references only patterns that exist in the registry (invariant 8)', () => {
		expect(registry).not.toBeNull();
		if (registry) expect(checkDecisionReferences(DECISION_CATALOG, registry)).toEqual([]);
	});

	it('node kinds link only to registry patterns', () => {
		const known = new Set(registry?.patterns.map((pattern) => pattern.id));
		const dangling = Object.entries(NODE_KINDS).flatMap(([kind, spec]) =>
			spec.patterns.filter((id) => !known.has(id)).map((id) => `${kind}: ${id}`),
		);
		expect(dangling).toEqual([]);
	});

	it('the check catches a dangling pattern id (non-empty control)', () => {
		const broken = structuredClone(DECISION_CATALOG);
		broken.decisions[0].alternatives[0].patterns.push('no-such-pattern');
		if (registry) expect(checkDecisionReferences(broken, registry)).toHaveLength(1);
	});

	it('refuses a rule that names an unknown alternative, factor or value', () => {
		const broken = structuredClone(catalogJson) as { decisions: ArchitectureDecision[] };
		broken.decisions[0].rules[0] = {
			id: 'bad',
			when: { compute: ['enormous'], colour: ['red'] } as never,
			choose: 'nowhere',
			because: 'x',
		};
		const { catalog, errors } = parseDecisionCatalog(broken);
		expect(catalog).toBeNull();
		expect(errors.join('\n')).toMatch(/not an alternative/);
		expect(errors.join('\n')).toMatch(/'enormous' is not a value/);
		expect(errors.join('\n')).toMatch(/colour: not a workload factor/);
	});

	it('refuses measured evidence without conditions', () => {
		const broken = structuredClone(catalogJson) as { decisions: ArchitectureDecision[] };
		broken.decisions[0].evidence = [{ kind: 'measured', ref: 'x', claim: 'fast', limitations: 'none' }];
		expect(parseDecisionCatalog(broken).errors.join('\n')).toMatch(/must state its conditions/);
	});

	it('refuses a rule that matches on `unknown`', () => {
		const broken = structuredClone(catalogJson) as { decisions: ArchitectureDecision[] };
		broken.decisions[0].rules[0].when = { compute: ['unknown'] };
		expect(parseDecisionCatalog(broken).errors.join('\n')).toMatch(/'unknown' is not a value/);
	});
});

describe('decision engine', () => {
	it('is deterministic: the same profile gives byte-identical output', () => {
		for (const example of WORKLOAD_EXAMPLES) {
			const a = JSON.stringify(exploreWorkload(DECISION_CATALOG, example.profile));
			const b = JSON.stringify(exploreWorkload(DECISION_CATALOG, structuredClone(example.profile)));
			expect(a).toBe(b);
		}
	});

	it('falls back to the simplest alternative when everything is unknown, and lists what is missing', () => {
		const result = exploreWorkload(DECISION_CATALOG, unknownProfile());
		const placement = result.outcomes.find((outcome) => outcome.decision === 'compute-placement');
		expect(placement?.basis).toBe('fallback');
		expect(placement?.chosen.id).toBe('server-request');
		expect(placement?.missing.length).toBeGreaterThan(0);
		expect(result.unknown_factors).toHaveLength(11);
		expect(chosen('deployment-shape', unknownProfile())).toBe('modular-monolith');
		expect(chosen('compute-runtime', unknownProfile())).toBe('typescript');
	});

	it('keeps an unknown factor unknown — it never satisfies a rule', () => {
		const outcome = evaluateDecision(
			DECISION_CATALOG.decisions[0],
			profile({ duration: 'minutes', background: 'unknown' }),
		);
		expect(outcome.chosen.id).toBe('background-job');
		expect(outcome.rule).toBe('longer-than-request');
		// The earlier rule that needs `background` is reported as missing — but it would choose the same thing, so it is dropped.
		expect(outcome.missing.find((entry) => entry.rule === 'must-outlive-request')).toBeUndefined();
	});

	it('reports a missing factor that would change the outcome', () => {
		const outcome = evaluateDecision(
			DECISION_CATALOG.decisions[0],
			profile({ dataOrigin: 'user-device', compute: 'light' }),
		);
		expect(outcome.chosen.id).toBe('browser-main-thread');
		const secret = outcome.missing.find((entry) => entry.rule === 'secret-stays-on-server');
		expect(secret).toMatchObject({ factors: ['sensitivity'], would_choose: 'server-request' });
	});

	it('constraints override convenience: a secret keeps work on the server even with device data', () => {
		expect(
			chosen('compute-placement', profile({ sensitivity: 'secret', dataOrigin: 'user-device', compute: 'heavy' })),
		).toBe('server-request');
	});

	it('explains rejected alternatives with the contradicting input', () => {
		const outcome = evaluateDecision(
			DECISION_CATALOG.decisions[0],
			profile({ sensitivity: 'public', workload: 'light-api', background: 'not-required', duration: 'under-100ms' }),
		);
		const job = outcome.alternatives.find((entry) => entry.alternative.id === 'background-job');
		expect(job?.contradicted_by[0]).toMatchObject({
			rule: 'must-outlive-request',
			factor: 'background',
			actual: 'not-required',
		});
		expect(outcome.alternatives.map((entry) => entry.alternative.id)).not.toContain(outcome.chosen.id);
		expect(outcome.alternatives).toHaveLength(DECISION_CATALOG.decisions[0].alternatives.length - 1);
	});

	it('records the inputs the fired rule used', () => {
		const outcome = evaluateDecision(DECISION_CATALOG.decisions[0], profile({ offline: 'required', compute: 'heavy' }));
		expect(outcome.inputs_used).toEqual({ offline: 'required', compute: 'heavy' });
	});

	it('Wasm is never the default: it needs heavy numeric device-side work', () => {
		expect(
			chosen(
				'compute-runtime',
				profile({ workload: 'numeric-compute', compute: 'moderate', dataOrigin: 'user-device' }),
			),
		).toBe('typescript');
		expect(
			chosen('compute-runtime', profile({ workload: 'media-processing', compute: 'heavy', dataOrigin: 'user-device' })),
		).toBe('rust-wasm-browser');
	});
});

describe('workload examples lead to different architectures', () => {
	const expectations: Record<string, Record<string, string>> = {
		'local-image-processing': {
			'compute-placement': 'browser-worker',
			'compute-runtime': 'rust-wasm-browser',
			'data-store': 'browser-memory',
		},
		'numerical-calculation': { 'compute-placement': 'browser-worker', 'compute-runtime': 'typescript' },
		'aggregate-large-dataset': {
			'processing-locality': 'sql-in-database',
			'compute-runtime': 'sql',
			'deployment-shape': 'modular-monolith',
		},
		'background-media-conversion': {
			'compute-placement': 'background-job',
			'interaction-style': 'database-queue',
			'data-store': 'object-storage',
			'deployment-shape': 'monolith-plus-worker',
		},
		'auth-and-business-rules': {
			'compute-placement': 'server-request',
			'deployment-shape': 'modular-monolith',
			'data-store': 'postgres',
		},
		'realtime-collaboration': { 'compute-placement': 'server-request' },
		'long-running-simulation': { 'compute-placement': 'background-job', 'deployment-shape': 'monolith-plus-service' },
		'lightweight-rest-api': {
			'interaction-style': 'http-rest',
			'deployment-shape': 'modular-monolith',
			'compute-acceleration': 'cache-results',
		},
		'large-file-uploads': { 'data-store': 'object-storage', 'interaction-style': 'http-rest' },
		'scale-heavy-backend': {
			'compute-placement': 'separate-service',
			'compute-runtime': 'rust-native-service',
			'interaction-style': 'typed-rpc',
		},
	};

	for (const example of WORKLOAD_EXAMPLES) {
		it(example.id, () => {
			for (const [decision, alternative] of Object.entries(expectations[example.id] ?? {})) {
				expect(chosen(decision, example.profile), decision).toBe(alternative);
			}
		});
	}

	it('the realtime example leaves infrastructure unknown and says that would change the result', () => {
		const example = WORKLOAD_EXAMPLES.find((entry) => entry.id === 'realtime-collaboration');
		const outcome = exploreWorkload(DECISION_CATALOG, example?.profile ?? unknownProfile()).outcomes.find(
			(entry) => entry.decision === 'interaction-style',
		);
		expect(outcome?.missing.map((entry) => entry.would_choose)).toEqual(expect.arrayContaining(['websocket', 'sse']));
	});

	it('every example is covered by an expectation', () => {
		expect(WORKLOAD_EXAMPLES.map((example) => example.id).sort()).toEqual(Object.keys(expectations).sort());
	});
});

describe('parseWorkloadProfile', () => {
	it('fills absent factors with unknown', () => {
		const result = parseWorkloadProfile({ compute: 'heavy' });
		expect(result.ok && result.profile.compute).toBe('heavy');
		expect(result.ok && result.profile.latency).toBe('unknown');
	});

	it('refuses unknown keys and values', () => {
		const result = parseWorkloadProfile({ compute: 'huge', colour: 'red' });
		expect(result.ok).toBe(false);
		expect(!result.ok && result.issues).toHaveLength(2);
	});
});
