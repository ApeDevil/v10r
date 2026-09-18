import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		UnoCSS(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['url', 'cookie', 'baseLocale'],
		}),
		sveltekit(),
	],
	ssr: {
		noExternal: ['three'], // Required for Three.js/Threlte SSR compatibility
	},
	worker: {
		// Vite defaults worker bundles to 'iife', which cannot carry `import`
		// statements. Web Workers spawned as ES modules — `new Worker(url, { type:
		// 'module' })` — therefore work in dev (native ESM, no bundling) and break
		// only in the production build. See src/lib/workers/.
		format: 'es',
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
