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
			// Dev: one bundled module per locale (avoids paraglide issue #486 where
			// message-modules emits one .js per key and Vite fires one HTTP request
			// per key on cold load). Prod: per-message modules so the bundler can
			// tree-shake unused keys out of the client bundle.
			outputStructure: process.env.NODE_ENV === 'production' ? 'message-modules' : 'locale-modules',
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
			interval: 1000, // 1s poll: trades ~1s HMR latency for materially less cold-load CPU contention
		},
		// HMR multiplexed over the main HTTP port (5173). Previously was on a separate
		// port 24678, which in Chrome + Podman port-forwarding caused WebSocket
		// connections to accumulate across hard reloads (Firefox tore them down
		// aggressively, Chrome didn't — freeze after ~3 reloads).
		warmup: {
			clientFiles: ['./src/routes/+layout.svelte', './src/lib/components/index.ts', './src/lib/styles/tokens.ts'],
			ssrFiles: [
				'./src/hooks.server.ts',
				'./src/lib/server/db/index.ts',
				'./src/lib/server/auth/index.ts',
				'./src/lib/paraglide/messages.js',
				'./src/lib/paraglide/runtime.js',
			],
		},
	},
});
