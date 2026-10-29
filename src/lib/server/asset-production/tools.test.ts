import { describe, expect, test } from 'vitest';
import { DEFAULT_ASSET_BUDGET } from '#lib/asset-production/index.ts';
import { STRUCTURAL_RING_DEFAULTS } from '#lib/schemas/asset-production.ts';
import type { ToolRegistry } from '#lib/server/mcp/types.ts';
import { createAssetToolRegistry, createMemoryAssetStore } from './index.ts';

let id = 0;
const store = createMemoryAssetStore();
// Typed as the MCP transport's registry: the structural fit is the contract.
const registry: ToolRegistry = createAssetToolRegistry({
	owner: 'user-1',
	agent: { kind: 'ai', label: 'test agent', onBehalfOf: 'user-1' },
	budget: DEFAULT_ASSET_BUDGET,
	runMs: 5_000,
	store,
	nextJobId: () => `tool-${++id}`,
});
const call = async (name: string, args: unknown) => {
	const result = await registry.dispatch(name, args);
	return { ...result, body: result.content[0].text };
};

describe('the asset tools', () => {
	test('list two tools whose input schema is the request schema, closed to unknown keys', () => {
		expect(registry.tools.map((t) => t.name)).toEqual(['describe_asset_generators', 'produce_asset']);
		const schema = JSON.stringify(registry.tools[1].inputSchema);
		expect(schema).toContain('"additionalProperties":false');
		expect(schema).toContain('structural-ring');
	});

	test('describe names every parameter with its bounds', async () => {
		const { body } = await call('describe_asset_generators', {});
		for (const name of Object.keys(STRUCTURAL_RING_DEFAULTS)) expect(body).toContain(`| ${name} |`);
	});

	test('produce runs a job and keeps a draft — never published', async () => {
		const { body, isError } = await call('produce_asset', {
			format: 1,
			generator: 'structural-ring',
			parameters: STRUCTURAL_RING_DEFAULTS,
		});
		expect(isError).toBeUndefined();
		expect(body).toMatch(/succeeded/);
		expect(body).toMatch(/Kept as a draft: user-1\/[0-9a-f]{64} \(created\); nothing was published/);
	});

	test.each([
		[
			'code instead of parameters',
			{
				format: 1,
				generator: 'structural-ring',
				parameters: STRUCTURAL_RING_DEFAULTS,
				script: 'import bpy; bpy.ops.wm.quit_blender()',
			},
		],
		['an unsupported generator', { format: 1, generator: 'python', parameters: {} }],
		[
			'an over-budget request',
			{
				format: 1,
				generator: 'structural-ring',
				parameters: { ...STRUCTURAL_RING_DEFAULTS, ringRadius: 30, bays: 64, detail: 16, bracing: 'x-brace' },
			},
		],
	])('refuses %s with findings, as invalid_args', async (_, args) => {
		const small = createAssetToolRegistry({
			owner: 'user-1',
			agent: { kind: 'ai', label: 'test agent' },
			budget: { ...DEFAULT_ASSET_BUDGET, maxTriangles: 20_000 },
			runMs: 5_000,
			nextJobId: () => 'tool-refused',
		});
		const result = await small.dispatch('produce_asset', args);
		expect(result.isError).toBe(true);
		expect(result.diag).toBe('invalid_args');
		expect(result.content[0].text).toMatch(/refused/);
	});

	test('an unknown tool name is refused', async () => {
		const result = await registry.dispatch('run_blender_python', { code: 'print(1)' });
		expect(result).toMatchObject({ isError: true, diag: 'unknown_tool' });
	});
});
