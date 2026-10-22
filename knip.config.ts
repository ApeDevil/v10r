import type { KnipConfig } from 'knip';

const config: KnipConfig = {
	// Use the real Svelte compiler for accurate import extraction. Its output drops type-only
	// imports (`import type …`, `import { type … }`), so a types.ts consumed only by .svelte
	// files would read as unused; re-append those specifiers as side-effect imports.
	compilers: {
		svelte: async (source: string) => {
			const { compile } = await import('svelte/compiler');
			const typeImports = [...source.matchAll(/^\s*import\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]/gm)]
				.filter(([, clause]) => /^type\s|\btype\s/.test(clause))
				.map(([, , specifier]) => `import '${specifier}';`);
			return [compile(source, {}).js.code, ...typeImports].join('\n');
		},
	},

	// Entry points Knip can't trace.
	// mcp/ = standalone Pattern MCP server, spawned by MCP clients outside the app graph.
	// pattern-library/ = the registry + its schema, read by that server under bare Bun.
	// The three scripts/ entries are documented manual diagnostics with no package.json script
	// (docs/stack/data/postgres.md, scripts/perf/README.md; the tap is pasted into a browser
	// console). Scripts wired to a package.json script are already treated as entries, so do
	// NOT broaden this to scripts/**/* — that would hide genuinely orphaned one-off scripts.
	entry: [
		'mcp/*.ts',
		'pattern-library/*.ts',
		'scripts/db/verify-tx-rollback.ts',
		'scripts/perf/db-explain.ts',
		'scripts/perf/vely-turn-tap.js',
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

	// Exclude export/type analysis from default runs — too noisy with Svelte templates.
	// Svelte component `default` exports + multi-client server functions + CVA variant types
	// all produce false positives. Run with `--include exports,types` for deep audits.
	exclude: ['exports', 'types', 'nsExports', 'nsTypes', 'enumMembers', 'duplicates'],
};

export default config;
