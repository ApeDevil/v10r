import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';
import { thirdPartyLicenses } from './scripts/build/third-party-licenses.ts';

const licenses = thirdPartyLicenses();

/**
 * Component modules under `src/lib/components/` (`.svelte`, `.ts`, `.js` — never a
 * `?svelte&type=style` virtual module or a `.css` file).
 *
 * A compiled Svelte component runs code at module scope (`$.delegate(...)`, template
 * factories), so the bundler must assume it has side effects and keeps every component a
 * barrel re-exports, used or not. One `import { Button } from '$lib/components'` then
 * shipped the whole primitives layer — culori, bits-ui select and menu, floating-ui —
 * to ~197 of 199 routes. Nothing in this tree registers anything at module scope
 * (registration happens inside functions and effects), so its modules are declared
 * side-effect free: a component is bundled when an export of it is used, and dropped
 * when it is not. Its stylesheet is a separate virtual module and keeps its own flag.
 */
const COMPONENT_MODULE = /\/src\/lib\/components\/[^?]*\.(svelte|ts|js)$/;

/**
 * Paraglide's compiled messages (`src/lib/paraglide/messages.js`, its `_index.js` barrel and one
 * module per message). Each is a pure function definition, but nothing tells the bundler so.
 * Rollup still split them per route. Rolldown assigns a module to a chunk by who imports it, and
 * every page imports the barrel that `export *`s all ~3,260 of them. Left unclassified, they all
 * land in one 215 KB (gz) chunk that every route loads: the median route measured 420 KB instead
 * of 235 KB. Declared side-effect free, each message again ships only with the routes that call it.
 */
const PARAGLIDE_MESSAGE_MODULE = /\/src\/lib\/paraglide\/messages(\.js$|\/)/;

export default defineConfig({
	plugins: [
		UnoCSS(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['url', 'cookie', 'baseLocale'],
		}),
		sveltekit(),
		licenses.plugin,
	],
	ssr: {
		noExternal: ['three'], // Required for Three.js/Threlte SSR compatibility
	},
	build: {
		rolldownOptions: {
			treeshake: {
				// A rule, not a function: Rolldown pins a module as side-effectful when a function
				// returns `true`, skipping both its package.json `sideEffects` and its own analysis.
				// A module this rule does not match stays unclassified and falls through to both, and
				// plugin-supplied flags still win over it.
				moduleSideEffects: [
					{ test: COMPONENT_MODULE, external: false, sideEffects: false },
					{ test: PARAGLIDE_MESSAGE_MODULE, external: false, sideEffects: false },
				],
			},
		},
	},
	worker: {
		// Vite (8 included) defaults worker bundles to 'iife', which cannot carry `import`
		// statements. Web Workers spawned as ES modules — `new Worker(url, { type:
		// 'module' })` — therefore work in dev (native ESM, no bundling) and break
		// only in the production build. See src/lib/workers/.
		format: 'es',
		plugins: () => [licenses.workerPlugin()],
	},
	server: {
		host: '0.0.0.0',
		port: 5173,
		allowedHosts: ['.trycloudflare.com'],
		watch: {
			usePolling: true, // Required for container file watching (volume-mounted FS)
			interval: 1000,
			// Paraglide writes to its outdir during buildStart and re-emits when SSR
			// resolves messages.js — chokidar would otherwise treat those as user
			// edits and fire spurious (ssr) page reload events ~5s after ready.
			// Build output is a polling cost, never an edit: `.vercel/` alone holds ~16k
			// files after a `validate:build`, and under Node every poll is a threadpool
			// stat — with them watched, the dev server saturated libuv and never listened.
			ignored: ['**/src/lib/paraglide/**', '**/.vercel/**', '**/.svelte-kit/output/**'],
		},
		// HMR multiplexed over the main HTTP port (5173). Previously was on a separate
		// port 24678, which in Chrome + Podman port-forwarding caused WebSocket
		// connections to accumulate across hard reloads (Firefox tore them down
		// aggressively, Chrome didn't — freeze after ~3 reloads).
		warmup: {
			clientFiles: ['./src/routes/+layout.svelte', './src/lib/styles/tokens.ts'],
			ssrFiles: ['./src/hooks.server.ts', './src/lib/server/db/index.ts', './src/lib/server/auth/index.ts'],
		},
	},
});
