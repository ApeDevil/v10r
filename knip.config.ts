import type { KnipConfig } from 'knip';

const config: KnipConfig = {
	// Use the real Svelte compiler for accurate import extraction
	compilers: {
		svelte: async (source: string) => {
			const { compile } = await import('svelte/compiler');
			return compile(source, {}).js.code;
		},
	},

	// Entry points Knip can't trace.
	// mcp/ = standalone Pattern MCP server, spawned by MCP clients outside the app graph.
	// pattern-library/ = the registry + its schema, read by that server under bare Bun.
	// The two scripts/ entries are documented manual diagnostics with no package.json script
	// (docs/stack/data/postgres.md, scripts/perf/README.md). Scripts wired to a package.json
	// script are already treated as entries, so do NOT broaden this to scripts/**/*.ts —
	// that would hide genuinely orphaned one-off scripts.
	entry: ['mcp/*.ts', 'pattern-library/*.ts', 'scripts/db/verify-tx-rollback.ts', 'scripts/perf/db-explain.ts'],

	// Files Knip can't trace through Svelte template imports or re-export chains
	ignore: [
		// Viz barrel/type files — consumed via parent index.ts re-exports into Svelte templates
		'src/lib/components/viz/chart/treemap/types.ts',
		'src/lib/components/viz/graph/network/types.ts',
		'src/lib/components/viz/graph/tree/types.ts',
		'src/lib/components/viz/plot/heatmap/types.ts',
		'src/lib/components/viz/plot/index.ts',
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
