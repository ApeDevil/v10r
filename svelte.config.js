import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({ runtime: 'nodejs22.x' }),

		// Deploy-accurate app version: powers `updated` polling (update prompts) and
		// the service worker's cache names. Vercel injects the commit SHA at build.
		version: {
			name: process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now()),
			pollInterval: 60_000,
		},

		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self', 'wasm-unsafe-eval'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': [
					'self',
					'data:',
					'blob:',
					'https://*.r2.cloudflarestorage.com',
					'https://basemaps.cartocdn.com',
					'https://avatars.githubusercontent.com',
					// Google OAuth account avatars
					'https://lh3.googleusercontent.com',
				],
				// Vite inlines small fonts as data: URIs; without font-src they fall
				// back to default-src 'self' and get blocked in production.
				'font-src': ['self', 'data:'],
				'connect-src': ['self', 'blob:', 'https://basemaps.cartocdn.com', 'https://*.r2.cloudflarestorage.com'],
				'worker-src': ['self', 'blob:'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none'],
			},
		},
	},
};

export default config;
