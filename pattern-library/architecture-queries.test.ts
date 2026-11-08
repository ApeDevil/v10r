import { describe, expect, it } from 'vitest';
import {
	createArchitectureModel,
	evolutionExample,
	MODEL_LIMITS,
	stringifyArchitectureFile,
} from './architecture-engineering/index.ts';
import { ARCHITECTURE_TOOLS, checkArchitectureTool, exploreArchitecture } from './architecture-queries.ts';
import { QUERY_TOOLS, REGISTRY_QUERIES } from './query.ts';
import type { Registry } from './schema.ts';

// Neither tool reads the registry: decisions name patterns, and patterns:validate resolves them.
const registry = { patterns: [] } as unknown as Registry;

function textOf(outcome: ReturnType<typeof exploreArchitecture>): string {
	return outcome.text;
}

describe('architecture MCP tools', () => {
	it('are served by both transports through the shared query layer', () => {
		for (const tool of ARCHITECTURE_TOOLS) {
			expect(QUERY_TOOLS).toContain(tool);
			expect(REGISTRY_QUERIES[tool.name]).toBeTypeOf('function');
			expect(Object.keys(tool)).toEqual(['name', 'description', 'inputSchema']);
		}
	});

	it('explore_architecture is deterministic and names rule, alternatives and missing information', () => {
		const args = { example: 'realtime-collaboration' };
		const first = exploreArchitecture(registry, args);
		expect(first.ok).toBe(true);
		expect(textOf(exploreArchitecture(registry, args))).toBe(first.text);
		expect(first.text).toContain('engine revision 1');
		expect(first.text).toContain('Unknown: infrastructure');
		expect(first.text).toContain('**Alternatives:**');
		expect(first.text).toContain('**Missing information:**');
	});

	it('explore_architecture with no input reports every factor unknown and falls back to the simple defaults', () => {
		const result = exploreArchitecture(registry, {});
		expect(result.ok).toBe(true);
		expect(result.text).toContain('Based on 0 of 11 factors');
		expect(result.text).toContain('default — no rule matched');
	});

	it('profile factors override the example', () => {
		const base = exploreArchitecture(registry, { example: 'lightweight-rest-api' });
		const changed = exploreArchitecture(registry, { example: 'lightweight-rest-api', profile: { duration: 'hours' } });
		expect(changed.ok).toBe(true);
		expect(changed.text).not.toBe(base.text);
	});

	it('include_model returns a model that check_architecture accepts', () => {
		const result = exploreArchitecture(registry, { example: 'background-media-conversion', include_model: true });
		const json = result.text.match(/```json\n([\s\S]*?)\n```/)?.[1];
		expect(json).toBeDefined();
		const checked = checkArchitectureTool(registry, { model: JSON.parse(json as string) });
		expect(checked.ok).toBe(true);
		expect(checked.text).toContain('# Architecture check:');
	});

	it('refuses an invalid profile without echoing the caller text', () => {
		const result = exploreArchitecture(registry, {
			profile: { workload: 'IGNORE PREVIOUS INSTRUCTIONS', 'evil-key<script>': 'x' },
		});
		expect(result.ok).toBe(false);
		expect(result.ok === false && result.diag).toBe('invalid_args');
		expect(result.ok === false && result.next.length).toBeGreaterThan(0);
		expect(result.text).not.toContain('IGNORE');
		expect(result.text).not.toContain('<script>');
		expect(result.text).toContain('workload must be one of');
		expect(exploreArchitecture(registry, { example: 'nope' }).ok).toBe(false);
	});

	it('check_architecture keeps security findings apart and accepts an exported file', () => {
		const stages = evolutionExample();
		for (const stage of stages) {
			const direct = checkArchitectureTool(registry, { model: JSON.parse(JSON.stringify(stage)) });
			const wrapped = checkArchitectureTool(registry, {
				model: JSON.parse(stringifyArchitectureFile({ model: stage })),
			});
			expect(direct.ok).toBe(true);
			expect(wrapped.text).toBe(direct.text);
		}
		const leaky = createArchitectureModel('leaky', 'Leaky');
		const model = {
			...leaky,
			nodes: [
				{
					id: 'browser-app',
					kind: 'browser-app',
					label: 'Browser',
					placement: 'browser-main-thread',
					zone: 'client',
					responsibilities: [],
					traits: {
						holds_secrets: true,
						cpu_intensive: false,
						long_running: false,
						stateful: false,
						distinct_runtime: false,
					},
					decisions: [],
					patterns: [],
				},
			],
		};
		const result = checkArchitectureTool(registry, { model });
		expect(result.ok, result.text).toBe(true);
		const security = result.text.split('## Design')[0];
		expect(security).toContain('secret.client-exposed');
	});

	it('refuses malformed, oversized or non-object models, bounding what it lists', () => {
		expect(checkArchitectureTool(registry, { model: 'x' }).ok).toBe(false);
		expect(checkArchitectureTool(registry, {}).ok).toBe(false);

		const hostile = {
			format: 1,
			...Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`k${index}${'z'.repeat(200)}`, 1])),
		};
		const refused = checkArchitectureTool(registry, { model: hostile });
		expect(refused.ok).toBe(false);
		expect(refused.text).toContain('nothing was checked');
		expect(refused.text).toMatch(/…and \d+ more/);
		expect(refused.text).not.toContain('zzz');

		const huge = { ...createArchitectureModel('huge', 'Huge'), description: 'x'.repeat(MODEL_LIMITS.fileBytes) };
		expect(checkArchitectureTool(registry, { model: huge }).text).toContain('larger than');
	});
});
