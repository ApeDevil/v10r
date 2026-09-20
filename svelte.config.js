import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		// `fra1`: the functions sit next to the database. Neon runs in eu-central-1, and until
		// 2026-09-13 every function ran in Vercel's default `iad1` (measured: `x-vercel-id:
		// fra1::iad1::…`), so each query crossed the Atlantic. Route-level `config` exports
		// merge over these defaults, so the region holds for the AI routes too.
		adapter: adapter({ runtime: 'nodejs22.x', regions: ['fra1'] }),

		// The pattern library is the product, not an implementation detail of any one
		// transport: `mcp/` (stdio) and `src/lib/server/mcp/` (hosted HTTP) are both
		// readers of it. It sits outside `src/` because the stdio server runs under bare
		// Bun in an ephemeral container with no Vite, so it must reach the JSON by
		// relative path — this alias gives the app the same file without six `../` hops.
		alias: { $patterns: 'pattern-library' },

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
				// The sha256 entry allowlists the theme-flash inline script in app.html
				// (a nonce can't be used: /offline is prerendered — no request, no nonce).
				// If that script's body changes, recompute from the repo root with:
				//   python3 -c "import re,hashlib,base64;b=re.search(r'<script[^>]*>(.*?)</script>',open('src/app.html').read(),re.S).group(1);print('sha256-'+base64.b64encode(hashlib.sha256(b.encode()).digest()).decode())"
				// Dev never enforces CSP, so a stale hash only surfaces in production.
				'script-src': ['self', 'wasm-unsafe-eval', 'sha256-aeayArXAuaCRaYFGpT47t+MbCCMSeme0VkyIP8RT1Kw='],
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
