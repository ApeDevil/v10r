import type { KnipConfig } from 'knip';

const config: KnipConfig = {
	// Use the real Svelte compiler for accurate import extraction
	compilers: {
		svelte: async (source: string) => {
			const { compile } = await import('svelte/compiler');
			return compile(source, {}).js.code;
		},
	},

	// SvelteKit convention files and entry points Knip can't trace
	entry: ['src/hooks.ts', 'src/lib/index.ts', 'scripts/*.ts'],

	// Files Knip can't trace through Svelte template imports or re-export chains
	ignore: [
		// Viz barrel/type files — consumed via parent index.ts re-exports into Svelte templates
		'src/lib/components/viz/chart/index.ts',
		'src/lib/components/viz/chart/treemap/types.ts',
		'src/lib/components/viz/graph/dag/types.ts',
		'src/lib/components/viz/graph/index.ts',
		'src/lib/components/viz/graph/knowledge/knowledge-types.ts',
		'src/lib/components/viz/graph/network/types.ts',
		'src/lib/components/viz/graph/tree/types.ts',
		'src/lib/components/viz/plot/heatmap/types.ts',
		'src/lib/components/viz/plot/index.ts',
		// Server modules imported via chains Knip's Svelte compiler misses
		'src/lib/schemas/style.ts',
		'src/lib/server/analytics/hook.ts',
		'src/lib/server/analytics/index.ts',
		'src/lib/server/api/pagination.ts',
		'src/lib/server/api/sse.ts',
		'src/lib/server/branding/types.ts',
		'src/lib/server/db/analytics/graph-seed.ts',
		'src/lib/server/db/analytics/mutations.ts',
		'src/lib/server/db/rag/setup.ts',
		'src/lib/server/db/schema/core.ts',
	],

	// SvelteKit virtual modules ($types) produce false "unresolved" reports
	ignoreIssues: {
		'**/+server.ts': ['unresolved'],
		'**/+page.ts': ['unresolved'],
		'**/+page.server.ts': ['unresolved'],
		'**/+layout.ts': ['unresolved'],
		'**/+layout.server.ts': ['unresolved'],
	},

	// Dependencies that Knip can't trace through barrel re-exports or Vite plugins
	ignoreDependencies: [
		'@internationalized/date',
		'@unocss/preset-icons',
		'@unocss/preset-uno',
		'uno.css', // virtual import from UnoCSS Vite plugin
		// Sub-packages of installed unified/remark/rehype ecosystem
		'vfile',
		'mdast',
		'hast',
		'unist',
		'hast-util-sanitize',
	],

	// Exports consumed within the same file (barrel re-exports, CVA variants)
	ignoreExportsUsedInFile: true,

	// Treat entry file exports as intentional public API
	includeEntryExports: true,

	// Ignore Drizzle relation exports (consumed by ORM at runtime, not by imports)
	ignoreMembers: ['.*Relations$'],

	// Exclude export/type analysis from default runs — too noisy with Svelte templates.
	// Svelte component `default` exports + multi-client server functions + CVA variant types
	// all produce false positives. Run with `--include exports,types` for deep audits.
	exclude: ['exports', 'types', 'nsExports', 'nsTypes', 'enumMembers', 'duplicates'],
};

export default config;
