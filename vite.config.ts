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
			usePolling: true, // Required for container file watching
		},
		hmr: {
			port: 24678,
		},
		warmup: {
			clientFiles: ['./src/routes/+layout.svelte', './src/lib/components/index.ts', './src/lib/styles/tokens.ts'],
			ssrFiles: ['./src/hooks.server.ts', './src/lib/server/db/index.ts', './src/lib/server/auth/index.ts'],
		},
	},
});
