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
			ignored: ['**/src/lib/paraglide/**'],
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
