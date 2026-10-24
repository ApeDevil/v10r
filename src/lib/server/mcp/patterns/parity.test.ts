import { describe, expect, it } from 'vitest';
import { REGISTRY } from '#lib/server/patterns/index.ts';
import { handleToolCall, TOOLS } from '../../../../../mcp/tools.ts';
import devQueries from '../../../../../pattern-library/bench/dev-queries.json';
import { EXCERPT_ALLOWLIST } from './excerpts';
import { publicPatternRegistry } from './tools';

/**
 * Executable parity between the two runtimes. Both are thin readers over the one query layer
 * (`pattern-library/query.ts`), so they SHOULD answer identically — this test makes them prove
 * it, by running the same calls through the stdio handler and the hosted registry and comparing
 * the bytes an agent would see. It replaced a source-text comparison that could only catch the
 * drift somebody had already thought of.
 *
 * Only what is transport-specific may differ: the hosted `get_file_excerpt` reads an allowlisted
 * snapshot, so files are compared on that allowlist (the snapshot is byte-identical to the tree,
 * which `mcp:excerpts:check` enforces), and `validate_snippet` runs two engines.
 */
const stdioContext = { registry: REGISTRY, loadError: null, root: process.cwd() };

function both(tool: string, args: Record<string, unknown>) {
	const stdio = handleToolCall(tool, args, stdioContext);
	const hosted = publicPatternRegistry.dispatch(tool, args);
	if (hosted instanceof Promise) throw new Error('pattern tools are synchronous');
	return {
		stdio: { text: stdio.content[0]?.text, isError: stdio.isError === true },
		hosted: { text: hosted.content[0]?.text, isError: hosted.isError === true },
	};
}

describe('hosted ↔ stdio pattern-tool parity', () => {
	it('advertises byte-identical tool definitions', () => {
		expect(JSON.stringify(TOOLS)).toBe(JSON.stringify(publicPatternRegistry.tools));
	});

	it('answers every benchmark query identically (search and trace)', () => {
		for (const { query } of devQueries.queries) {
			for (const [tool, args] of [
				['search_patterns', { query }],
				['search_patterns', { query, limit: 20 }],
				['trace_capability', { capability: query }],
			] as const) {
				const { stdio, hosted } = both(tool, args);
				expect(stdio, `${tool} ${query}`).toEqual(hosted);
			}
		}
	});

	it('renders every pattern card identically', () => {
		for (const pattern of REGISTRY.patterns) {
			const { stdio, hosted } = both('get_pattern', { id: pattern.id });
			expect(stdio, pattern.id).toEqual(hosted);
		}
	});

	it('answers the progressive-disclosure parameters identically', () => {
		for (const [tool, args] of [
			['search_patterns', { query: '*' }],
			['search_patterns', { query: '*', category: 'ai', detail: 'compact' }],
			['search_patterns', { query: '*', tier: 'deep', maturity: 'proven', detail: 'ids' }],
			['search_patterns', { query: 'cache', detail: 'ids', tier: 'light', limit: 50 }],
			['get_pattern', { ids: ['singleflight', 'layered-rag', 'app-shell-toasts'], sections: ['fitness', 'code'] }],
			['get_pattern', { id: 'deskbot-approval-gate', sections: ['invariants'] }],
			['get_file_excerpt', { path: 'docs/blueprint/velocity/data.md#singleflight--stampede-protection' }],
			['get_file_excerpt', { path: 'src/lib/server/cache/singleflight.ts', section: 'coalesce' }],
			['get_file_excerpt', { path: 'src/lib/server/cache/singleflight.ts', section: 'no-such-symbol' }],
			['recommend_emulation_plan', { capabilities: ['background jobs', 'layered RAG'], target_infra: ['postgres'] }],
			['recommend_emulation_plan', { capabilities: ['approval gate for AI mutations'], detail: 'outline' }],
			['recommend_emulation_plan', { capabilities: ['jobs'], target_infra: ['mysql'] }],
		] as const) {
			const { stdio, hosted } = both(tool, args);
			expect(stdio, `${tool} ${JSON.stringify(args)}`).toEqual(hosted);
		}
	});

	it('assembles every benchmark plan identically', () => {
		for (const plan of devQueries.plans) {
			for (const include_dependencies of [true, false]) {
				const { stdio, hosted } = both('recommend_emulation_plan', {
					capabilities: plan.capabilities,
					include_dependencies,
				});
				expect(stdio, plan.id).toEqual(hosted);
			}
		}
	});

	it('excerpts every allowlisted file identically', () => {
		for (const path of EXCERPT_ALLOWLIST) {
			const { stdio, hosted } = both('get_file_excerpt', { path, start_line: 1, line_count: 40 });
			expect(stdio, path).toEqual(hosted);
		}
	});

	it('fails the same way on malformed and unknown input', () => {
		for (const [tool, args] of [
			['search_patterns', {}],
			['search_patterns', { query: 'x'.repeat(600) }],
			['search_patterns', { query: 'jobs', category: 'no-such-category' }],
			['search_patterns', { query: 'quantum teleportation zebra' }],
			['get_pattern', { id: 'no-such-pattern' }],
			['trace_capability', { capability: '' }],
			['recommend_emulation_plan', { capabilities: [] }],
			['recommend_emulation_plan', { capabilities: Array.from({ length: 25 }, () => 'jobs') }],
		] as const) {
			const { stdio, hosted } = both(tool, args);
			expect(stdio.isError, `${tool} ${JSON.stringify(args)}`).toBe(true);
			expect(stdio, `${tool} ${JSON.stringify(args)}`).toEqual(hosted);
		}
	});
});
