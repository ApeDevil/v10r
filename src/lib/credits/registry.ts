/**
 * Credits registry — the single source of truth for the `/credits` page.
 *
 * Curated, not generated: the most credit-worthy pieces of the stack are not
 * npm packages (Neon, Aura, Vercel, R2, Podman, Bun), and the per-entry "role"
 * line is editorial. Drift is caught by `registry.gate.test.ts` instead:
 * every `npm`-sourced entry must exist in `package.json`, its `license` must
 * match the installed package's metadata, and every `docs`/`showcase` link
 * must resolve to a published doc / real showcase route.
 *
 * Lives in `$lib` (not the route tree) so the sitemap and tests can read it
 * without a `$lib → routes` back-edge — same reasoning as `../showcases/`.
 * All human-visible copy is Paraglide message references (`LabelFn`); brand
 * names and SPDX license strings stay untranslated by design.
 */
import type { LabelFn } from '../nav/types';
import * as m from '../paraglide/messages.js';

/** Where an entry comes from — drives what the gate test can verify. */
export type CreditSource =
	/** Installed npm package: presence + license are gate-checked. */
	| { kind: 'npm'; pkg: string }
	/** Hosted platform/service — nothing installed, no license claim. */
	| { kind: 'service' }
	/** Host/container tooling outside `package.json` (license is well-known, unchecked). */
	| { kind: 'tool' };

export type CreditGroupId =
	| 'framework'
	| 'data'
	| 'auth'
	| 'forms'
	| 'i18n'
	| 'ui'
	| 'viz'
	| 'content'
	| 'ai'
	| 'platform';

export interface CreditGroupMeta {
	id: CreditGroupId;
	label: LabelFn;
}

/** Ordered group list — `/credits` section order follows this. */
export const creditGroups: CreditGroupMeta[] = [
	{ id: 'framework', label: m.credits_group_framework },
	{ id: 'data', label: m.credits_group_data },
	{ id: 'auth', label: m.credits_group_auth },
	{ id: 'forms', label: m.credits_group_forms },
	{ id: 'i18n', label: m.credits_group_i18n },
	{ id: 'ui', label: m.credits_group_ui },
	{ id: 'viz', label: m.credits_group_viz },
	{ id: 'content', label: m.credits_group_content },
	{ id: 'ai', label: m.credits_group_ai },
	{ id: 'platform', label: m.credits_group_platform },
];

export interface CreditEntry {
	id: string;
	/** Brand name — untranslated everywhere. */
	name: string;
	group: CreditGroupId;
	/** One-line "why it's here", per locale. */
	role: LabelFn;
	/** Official project/provider site. */
	url: string;
	/** SPDX expression for software; omitted for hosted services. */
	license?: string;
	/** In-app `/docs/...` page covering the technology. */
	docs?: string;
	/** In-app showcase route that proves the integration works. */
	showcase?: string;
	source: CreditSource;
}

export const credits: CreditEntry[] = [
	// ── framework ─────────────────────────────────────────────────────────
	{
		id: 'sveltekit',
		name: 'SvelteKit',
		group: 'framework',
		role: m.credits_role_sveltekit,
		url: 'https://svelte.dev/docs/kit',
		license: 'MIT',
		docs: '/docs/stack/sveltekit',
		showcase: '/showcases/cycle',
		source: { kind: 'npm', pkg: '@sveltejs/kit' },
	},
	{
		id: 'svelte',
		name: 'Svelte',
		group: 'framework',
		role: m.credits_role_svelte,
		url: 'https://svelte.dev',
		license: 'MIT',
		docs: '/docs/stack/svelte',
		source: { kind: 'npm', pkg: 'svelte' },
	},
	{
		id: 'vite',
		name: 'Vite',
		group: 'framework',
		role: m.credits_role_vite,
		url: 'https://vite.dev',
		license: 'MIT',
		source: { kind: 'npm', pkg: 'vite' },
	},

	// ── data ──────────────────────────────────────────────────────────────
	{
		id: 'neon',
		name: 'Neon (PostgreSQL)',
		group: 'data',
		role: m.credits_role_neon,
		url: 'https://neon.tech',
		docs: '/docs/stack/postgres',
		showcase: '/showcases/db/relational',
		source: { kind: 'service' },
	},
	{
		id: 'neo4j-aura',
		name: 'Neo4j Aura',
		group: 'data',
		role: m.credits_role_neo4j_aura,
		url: 'https://neo4j.com/product/auradb/',
		docs: '/docs/stack/neo4j',
		showcase: '/showcases/db/graph',
		source: { kind: 'service' },
	},
	{
		id: 'drizzle',
		name: 'Drizzle ORM',
		group: 'data',
		role: m.credits_role_drizzle,
		url: 'https://orm.drizzle.team',
		license: 'Apache-2.0',
		docs: '/docs/stack/drizzle',
		showcase: '/showcases/db/relational',
		source: { kind: 'npm', pkg: 'drizzle-orm' },
	},
	{
		id: 'upstash-redis',
		name: 'Upstash Redis',
		group: 'data',
		role: m.credits_role_upstash_redis,
		url: 'https://upstash.com',
		docs: '/docs/stack/redis',
		showcase: '/showcases/db/cache',
		source: { kind: 'service' },
	},
	{
		id: 'cloudflare-r2',
		name: 'Cloudflare R2',
		group: 'data',
		role: m.credits_role_cloudflare_r2,
		url: 'https://developers.cloudflare.com/r2/',
		docs: '/docs/stack/r2',
		showcase: '/showcases/db/storage',
		source: { kind: 'service' },
	},

	// ── auth ──────────────────────────────────────────────────────────────
	{
		id: 'better-auth',
		name: 'Better Auth',
		group: 'auth',
		role: m.credits_role_better_auth,
		url: 'https://better-auth.com',
		license: 'MIT',
		docs: '/docs/stack/better-auth',
		showcase: '/showcases/auth',
		source: { kind: 'npm', pkg: 'better-auth' },
	},
	{
		id: 'altcha',
		name: 'ALTCHA',
		group: 'auth',
		role: m.credits_role_altcha,
		url: 'https://altcha.org',
		license: 'MIT',
		showcase: '/showcases/abuse/captcha',
		source: { kind: 'npm', pkg: 'altcha' },
	},

	// ── forms ─────────────────────────────────────────────────────────────
	{
		id: 'valibot',
		name: 'Valibot',
		group: 'forms',
		role: m.credits_role_valibot,
		url: 'https://valibot.dev',
		license: 'MIT',
		docs: '/docs/stack/valibot',
		showcase: '/showcases/forms/validation',
		source: { kind: 'npm', pkg: 'valibot' },
	},
	{
		id: 'superforms',
		name: 'Superforms',
		group: 'forms',
		role: m.credits_role_superforms,
		url: 'https://superforms.rocks',
		license: 'MIT',
		docs: '/docs/stack/superforms',
		showcase: '/showcases/forms',
		source: { kind: 'npm', pkg: 'sveltekit-superforms' },
	},

	// ── i18n ──────────────────────────────────────────────────────────────
	{
		id: 'paraglide',
		name: 'Paraglide JS',
		group: 'i18n',
		role: m.credits_role_paraglide,
		url: 'https://inlang.com/m/gerre34r/library-inlang-paraglideJs',
		license: 'MIT',
		docs: '/docs/stack/paraglide',
		showcase: '/showcases/i18n',
		source: { kind: 'npm', pkg: '@inlang/paraglide-js' },
	},

	// ── ui ────────────────────────────────────────────────────────────────
	{
		id: 'unocss',
		name: 'UnoCSS',
		group: 'ui',
		role: m.credits_role_unocss,
		url: 'https://unocss.dev',
		license: 'MIT',
		docs: '/docs/stack/unocss',
		showcase: '/showcases/ui/tokens',
		source: { kind: 'npm', pkg: 'unocss' },
	},
	{
		id: 'bits-ui',
		name: 'Bits UI',
		group: 'ui',
		role: m.credits_role_bits_ui,
		url: 'https://bits-ui.com',
		license: 'MIT',
		docs: '/docs/stack/bits-ui',
		showcase: '/showcases/ui/components',
		source: { kind: 'npm', pkg: 'bits-ui' },
	},
	{
		id: 'lucide',
		name: 'Lucide',
		group: 'ui',
		role: m.credits_role_lucide,
		url: 'https://lucide.dev',
		license: 'ISC',
		source: { kind: 'npm', pkg: '@iconify-json/lucide' },
	},
	{
		id: 'fontsource',
		name: 'Fontsource',
		group: 'ui',
		role: m.credits_role_fontsource,
		url: 'https://fontsource.org',
		license: 'OFL-1.1',
		showcase: '/showcases/ui/typography',
		source: { kind: 'npm', pkg: '@fontsource-variable/inter' },
	},

	// ── viz ───────────────────────────────────────────────────────────────
	{
		id: 'threejs',
		name: 'Three.js',
		group: 'viz',
		role: m.credits_role_threejs,
		url: 'https://threejs.org',
		license: 'MIT',
		docs: '/docs/stack/3d-web',
		showcase: '/showcases/3d',
		source: { kind: 'npm', pkg: 'three' },
	},
	{
		id: 'threlte',
		name: 'Threlte',
		group: 'viz',
		role: m.credits_role_threlte,
		url: 'https://threlte.xyz',
		license: 'MIT',
		docs: '/docs/stack/3d-web',
		showcase: '/showcases/3d',
		source: { kind: 'npm', pkg: '@threlte/core' },
	},
	{
		id: 'maplibre',
		name: 'MapLibre GL JS',
		group: 'viz',
		role: m.credits_role_maplibre,
		url: 'https://maplibre.org',
		license: 'BSD-3-Clause',
		docs: '/docs/stack/viz',
		showcase: '/showcases/viz/maps',
		source: { kind: 'npm', pkg: 'maplibre-gl' },
	},
	{
		id: 'chartjs',
		name: 'Chart.js',
		group: 'viz',
		role: m.credits_role_chartjs,
		url: 'https://www.chartjs.org',
		license: 'MIT',
		docs: '/docs/stack/viz',
		showcase: '/showcases/viz/charts',
		source: { kind: 'npm', pkg: 'chart.js' },
	},
	{
		id: 'd3',
		name: 'D3 modules',
		group: 'viz',
		role: m.credits_role_d3,
		url: 'https://d3js.org',
		license: 'ISC',
		docs: '/docs/stack/viz',
		showcase: '/showcases/viz/graphs',
		source: { kind: 'npm', pkg: 'd3-force' },
	},
	{
		id: 'svelte-flow',
		name: 'Svelte Flow',
		group: 'viz',
		role: m.credits_role_svelte_flow,
		url: 'https://svelteflow.dev',
		license: 'MIT',
		showcase: '/showcases/viz/diagrams',
		source: { kind: 'npm', pkg: '@xyflow/svelte' },
	},

	// ── content ───────────────────────────────────────────────────────────
	{
		id: 'unified',
		name: 'unified (remark · rehype)',
		group: 'content',
		role: m.credits_role_unified,
		url: 'https://unifiedjs.com',
		license: 'MIT',
		source: { kind: 'npm', pkg: 'unified' },
	},
	{
		id: 'shiki',
		name: 'Shiki',
		group: 'content',
		role: m.credits_role_shiki,
		url: 'https://shiki.style',
		license: 'MIT',
		source: { kind: 'npm', pkg: 'shiki' },
	},

	// ── ai ────────────────────────────────────────────────────────────────
	{
		id: 'ai-sdk',
		name: 'Vercel AI SDK',
		group: 'ai',
		role: m.credits_role_ai_sdk,
		url: 'https://ai-sdk.dev',
		license: 'Apache-2.0',
		docs: '/docs/stack/ai-sdk',
		showcase: '/showcases/ai/chat',
		source: { kind: 'npm', pkg: 'ai' },
	},
	{
		id: 'gemini',
		name: 'Google Gemini',
		group: 'ai',
		role: m.credits_role_gemini,
		url: 'https://ai.google.dev',
		showcase: '/showcases/ai/retrieval',
		source: { kind: 'service' },
	},
	{
		id: 'groq',
		name: 'Groq',
		group: 'ai',
		role: m.credits_role_groq,
		url: 'https://groq.com',
		showcase: '/showcases/ai/chat',
		source: { kind: 'service' },
	},

	// ── platform ──────────────────────────────────────────────────────────
	{
		id: 'vercel',
		name: 'Vercel',
		group: 'platform',
		role: m.credits_role_vercel,
		url: 'https://vercel.com',
		docs: '/docs/stack/deployment',
		source: { kind: 'service' },
	},
	{
		id: 'bun',
		name: 'Bun',
		group: 'platform',
		role: m.credits_role_bun,
		url: 'https://bun.sh',
		license: 'MIT',
		docs: '/docs/stack/bun',
		source: { kind: 'tool' },
	},
	{
		id: 'podman',
		name: 'Podman',
		group: 'platform',
		role: m.credits_role_podman,
		url: 'https://podman.io',
		license: 'Apache-2.0',
		docs: '/docs/stack/podman',
		source: { kind: 'tool' },
	},
	{
		id: 'biome',
		name: 'Biome',
		group: 'platform',
		role: m.credits_role_biome,
		url: 'https://biomejs.dev',
		license: 'MIT OR Apache-2.0',
		docs: '/docs/stack/biome',
		source: { kind: 'npm', pkg: '@biomejs/biome' },
	},
	{
		id: 'vitest',
		name: 'Vitest',
		group: 'platform',
		role: m.credits_role_vitest,
		url: 'https://vitest.dev',
		license: 'MIT',
		source: { kind: 'npm', pkg: 'vitest' },
	},
];
