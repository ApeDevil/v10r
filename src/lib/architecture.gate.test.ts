/**
 * ARCHITECTURE GATE.
 *
 * CLAUDE.md and docs/codebase-organization.md declare four invariants for the server
 * tree and one layer order for components. Nothing ever executed them, so both
 * documents drifted from the code they describe: the framework-import exception list
 * named a module that no longer imports the framework while omitting three that do,
 * and "the import graph is a DAG" was false for 20 of the 41 server domains.
 *
 * A rule that only a human re-reading Markdown can check is not an invariant, it is a
 * hope. This file is the executable form.
 *
 * Where the counts stand: framework imports 0 · environment reads 30 · cross-domain deep
 * imports 64 · `db/`-upward imports 4 · mutually-recursive domains 18 · component layer
 * inversions 3. The environment axis is newly measured rather than newly broken — `$env`
 * was invisible to this file until it got a rule of its own.
 *
 * RATCHET, NOT A CLIFF. Each rule carries the violations that existed when it was
 * written. A NEW violation fails; so does a STALE allowance — an entry that no longer
 * corresponds to a real violation must be deleted. The lists can therefore only
 * shrink, which is what makes the counts quoted above trustworthy over time.
 *
 * When a move makes an entry obsolete, delete the line. Never add one to make the
 * suite pass without saying why in the commit.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SERVER_ROOT = join(ROOT, 'src/lib/server');
const COMPONENT_ROOT = join(ROOT, 'src/lib/components');

/**
 * Static import edges only. `import()` expressions are included because several
 * domains lazy-load siblings, and a cycle through a dynamic import is still a cycle.
 */
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

interface Edge {
	/** Repo-relative path of the importing file. */
	from: string;
	/** Repo-relative path the specifier resolves to, extension-less. */
	to: string;
	specifier: string;
	/** The whole matched import statement, so clause-level checks need no re-read. */
	statement: string;
}

function sourceFiles(dir: string, extensions: RegExp, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) sourceFiles(path, extensions, out);
		else if (extensions.test(path) && !/\.test\.ts$/.test(path)) out.push(path);
	}
	return out;
}

/** Resolve `$lib/…` and relative specifiers to repo-relative paths; null for packages. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
	if (specifier.startsWith('$lib/')) return relative(ROOT, join(ROOT, 'src/lib', specifier.slice('$lib/'.length)));
	if (specifier.startsWith('.')) return relative(ROOT, resolve(dirname(fromFile), specifier));
	return null;
}

function edgesIn(root: string, extensions: RegExp): Edge[] {
	const edges: Edge[] = [];
	for (const file of sourceFiles(root, extensions)) {
		const source = readFileSync(file, 'utf8');
		for (const match of source.matchAll(IMPORT_RE)) {
			const specifier = match[1] ?? match[2];
			if (!specifier) continue;
			const to = resolveSpecifier(file, specifier);
			edges.push({ from: relative(ROOT, file), to: to ?? '', specifier, statement: match[0].trim() });
		}
	}
	return edges;
}

/**
 * Compare found violations against the recorded allowance. Fails on anything new AND
 * on anything recorded that has since been fixed — the second half is what forces the
 * list to shrink instead of accumulating.
 */
function expectRatchet(found: string[], allowed: readonly string[], rule: string) {
	const foundSet = new Set(found);
	const introduced = found.filter((v) => !allowed.includes(v)).sort();
	const fixed = allowed.filter((v) => !foundSet.has(v)).sort();

	expect(introduced, `${rule}: new violation(s) — fix them, do not append to the allowance`).toEqual([]);
	expect(fixed, `${rule}: allowance is stale — delete these lines, they no longer violate`).toEqual([]);
}

/**
 * `showcases/` is a container, not a domain: each showcase under it is its own unit with
 * its own barrel, so `showcases/cycle` and `showcases/cache` are as separate as `blog` and
 * `auth`. Collapsing them to one node would hide edges between unrelated demos.
 */
function serverDomain(repoPath: string): string {
	// The extension is stripped first so a file is named the same whether it is the importer
	// (`shiki.ts`) or the target (`shiki`, as the resolver returns it). Without this a
	// root-level module is two different nodes and cycles through it are invisible to the
	// SCC check — which is how `config.ts` went unmeasured for as long as it did.
	const segments = repoPath
		.replace(/^src\/lib\/server\//, '')
		.replace(/\.ts$/, '')
		.split('/');
	if (segments[0] === 'showcases' && segments.length > 1) return `showcases/${segments[1]}`;
	return segments[0];
}

const serverEdges = edgesIn(SERVER_ROOT, /\.ts$/);

describe('server domain boundaries', () => {
	/**
	 * Invariant 1 — domain modules are framework-free.
	 *
	 * The allowance is mechanical rather than a list of filenames, because a hand-kept
	 * filename list is exactly what went stale before. The system has three adapter
	 * shapes and each announces itself by location or name:
	 *
	 *   server/http/**    the HTTP toolkit every route adapter shares
	 *   *.hook.ts         a SvelteKit `Handle` composed into hooks.server.ts
	 *   *.adapter.ts      a domain-local adapter onto one transport (e.g. mcp/http.adapter.ts)
	 *
	 * The `dev`/`building` flags are build-time constants, not framework coupling, so
	 * importing those alone stays inside the rule.
	 */
	it('domain modules import no SvelteKit or $app surface', () => {
		const violations: string[] = [];
		for (const edge of serverEdges) {
			if (edge.specifier !== '@sveltejs/kit' && !edge.specifier.startsWith('$app/')) continue;
			if (edge.from.startsWith('src/lib/server/http/')) continue;
			if (/\.(hook|adapter)\.ts$/.test(edge.from)) continue;
			if (edge.specifier === '$app/environment') {
				const named = (edge.statement.match(/import\s+(?:type\s+)?\{([^}]*)\}/)?.[1] ?? '')
					.split(',')
					.map((n) =>
						n
							.trim()
							.split(/\s+as\s+/)[0]
							.trim(),
					)
					.filter(Boolean);
				if (named.length > 0 && named.every((n) => n === 'dev' || n === 'building')) continue;
			}
			violations.push(`${edge.from} -> ${edge.specifier}`);
		}
		expectRatchet(violations, KNOWN_FRAMEWORK_IMPORTS, 'invariant 1 (framework-free domains)');
	});

	/**
	 * Environment coupling — a second axis, deliberately separate from invariant 1.
	 *
	 * `$env/*` is as much a SvelteKit virtual module as `$app/*`: it does not resolve under
	 * bare Bun, so a module importing it cannot be reached by the standalone ingest scripts
	 * or the stdio MCP server. But it is not TRANSPORT coupling — reading a secret does not
	 * tie a function to one caller shape the way `redirect()` does — so folding it into
	 * invariant 1 would force ~30 modules to thread config through every call site for a
	 * problem they do not have.
	 *
	 * It gets its own ratchet instead: the count is recorded rather than argued about, and
	 * it can only shrink. `KNOWN_FRAMEWORK_IMPORTS` stays empty.
	 */
	it('environment reads stay inside the recorded set', () => {
		const violations: string[] = [];
		for (const edge of serverEdges) {
			if (!edge.specifier.startsWith('$env/')) continue;
			if (edge.from.startsWith('src/lib/server/http/')) continue;
			if (/\.(hook|adapter)\.ts$/.test(edge.from)) continue;
			violations.push(`${edge.from} -> ${edge.specifier}`);
		}
		expectRatchet([...new Set(violations)].sort(), KNOWN_ENV_IMPORTS, 'environment coupling');
	});

	/**
	 * Invariant 3 — cross-domain access goes through the target's `index.ts`.
	 *
	 * `db/` is the shared sink and `http/` is the adapter kit; both are reached by
	 * file, so neither counts as a cross-domain deep import.
	 *
	 * A domain's POLICY LEAF — `config.ts`, or a `*-config.ts` like
	 * `retrieval-shared/embed-config` — is reached by file for the same reason. Routing a
	 * constant through the owning barrel would drag that domain's whole implementation
	 * graph in behind it: `imagemeta` reading `ai`'s token ceiling would construct the
	 * provider registry, and `jobs` reading a backoff factor would pull the outbox. The
	 * leaf exists precisely so callers can take the policy without the machinery — the
	 * same reason `auth/admin-ids` is deep-imported on purpose.
	 */
	it('cross-domain imports resolve to the target barrel', () => {
		const violations: string[] = [];
		for (const edge of serverEdges) {
			if (!edge.to.startsWith('src/lib/server/')) continue;
			const from = serverDomain(edge.from);
			const to = serverDomain(edge.to);
			if (from === to || from === 'db' || to === 'db' || to === 'http') continue;
			const withinTarget = edge.to.replace(`src/lib/server/${to}`, '').replace(/^\//, '');
			if (withinTarget === '' || withinTarget === 'index') continue;
			if (withinTarget === 'config' || withinTarget.endsWith('-config')) continue;
			violations.push(`${edge.from} -> ${to}/${withinTarget}`);
		}
		expectRatchet(violations, KNOWN_DEEP_CROSS_DOMAIN_IMPORTS, 'invariant 3 (barrel-only cross-domain)');
	});

	/** Invariant 4 — `db/` is the sink; everything flows toward it and nothing back out. */
	it('db imports no sibling domain', () => {
		const violations: string[] = [];
		for (const edge of serverEdges) {
			if (!edge.from.startsWith('src/lib/server/db/')) continue;
			if (!edge.to.startsWith('src/lib/server/')) continue;
			const to = serverDomain(edge.to);
			if (to === 'db') continue;
			violations.push(`${edge.from} -> ${to}`);
		}
		expectRatchet(violations, KNOWN_DB_UPWARD_IMPORTS, 'invariant 4 (db is the sink)');
	});

	/**
	 * Invariant 2 — the domain graph is acyclic.
	 *
	 * Reported as strongly-connected components rather than as cycle paths: the same
	 * few back-edges generate dozens of paths, so a path list churns on every edit
	 * while the component membership is stable and actually names the problem.
	 */
	it('domain graph has no growing mutually-recursive cluster', () => {
		const graph = new Map<string, Set<string>>();
		for (const edge of serverEdges) {
			if (!edge.to.startsWith('src/lib/server/')) continue;
			const from = serverDomain(edge.from);
			const to = serverDomain(edge.to);
			if (from === to) continue;
			if (!graph.has(from)) graph.set(from, new Set());
			graph.get(from)?.add(to);
		}

		let counter = 0;
		const index = new Map<string, number>();
		const lowlink = new Map<string, number>();
		const onStack = new Set<string>();
		const stack: string[] = [];
		const components: string[][] = [];

		const visit = (node: string) => {
			index.set(node, counter);
			lowlink.set(node, counter);
			counter += 1;
			stack.push(node);
			onStack.add(node);
			for (const next of graph.get(node) ?? []) {
				if (!index.has(next)) {
					visit(next);
					lowlink.set(node, Math.min(lowlink.get(node) ?? 0, lowlink.get(next) ?? 0));
				} else if (onStack.has(next)) {
					lowlink.set(node, Math.min(lowlink.get(node) ?? 0, index.get(next) ?? 0));
				}
			}
			if (lowlink.get(node) === index.get(node)) {
				const component: string[] = [];
				let popped: string | undefined;
				do {
					popped = stack.pop();
					if (popped === undefined) break;
					onStack.delete(popped);
					component.push(popped);
				} while (popped !== node);
				if (component.length > 1) components.push(component.sort());
			}
		};

		const nodes = new Set([...graph.keys(), ...[...graph.values()].flatMap((set) => [...set])]);
		for (const node of nodes) if (!index.has(node)) visit(node);

		const cyclic = components.flat().sort();
		expectRatchet(cyclic, KNOWN_CYCLIC_DOMAINS, 'invariant 2 (acyclic domain graph)');
	});
});

const COMPONENT_LAYERS: Record<string, number> = {
	primitives: 0,
	composites: 1,
	layout: 2,
	shell: 3,
};
/** Feature directories sit alongside `shell/` at the top and may not import one another. */
const FEATURE_RANK = 3;

const componentDir = (repoPath: string) => repoPath.replace(/^src\/lib\/components\//, '').split('/')[0];
const rankOf = (dir: string) => COMPONENT_LAYERS[dir] ?? FEATURE_RANK;

describe('component layering', () => {
	/**
	 * `primitives ← composites ← layout ← shell + feature dirs`, and no two top-rank
	 * directories may import each other. A leaf layer reaching up into a feature dir
	 * inverts the arrow the whole barrel-size rule depends on.
	 */
	it('components import downward only', () => {
		const violations: string[] = [];
		for (const edge of edgesIn(COMPONENT_ROOT, /\.(ts|svelte)$/)) {
			if (!edge.to.startsWith('src/lib/components/')) continue;
			const from = componentDir(edge.from);
			const to = componentDir(edge.to);
			if (from === to) continue;
			const fromRank = rankOf(from);
			const toRank = rankOf(to);
			const sidewaysAtTop = fromRank === FEATURE_RANK && toRank === FEATURE_RANK;
			if (fromRank > toRank && !sidewaysAtTop) continue;
			violations.push(`${edge.from} -> ${to}`);
		}
		expectRatchet(violations, KNOWN_LAYER_INVERSIONS, 'component layer direction');
	});

	/**
	 * The default barrel is the cheap surface: anything pulling a heavy or optional
	 * dependency (viz engines, Three.js, the markdown sanitiser) or app-specific
	 * chrome must be deep-imported instead. The prose version of this list named two
	 * of the fourteen exclusions and omitted `3d/` entirely, so the set is asserted
	 * here rather than described there.
	 */
	it('default barrel re-exports only the cheap layers', () => {
		const barrel = readFileSync(join(COMPONENT_ROOT, 'index.ts'), 'utf8');
		const exported = [...barrel.matchAll(/export \* from '\.\/([\w-]+)'/g)].map((m) => m[1]).sort();
		expect(exported).toEqual(['composites', 'layout', 'primitives']);

		const composites = readFileSync(join(COMPONENT_ROOT, 'composites/index.ts'), 'utf8');
		const compositeExports = [...composites.matchAll(/export \* from '\.\/([\w-]+)'/g)].map((m) => m[1]);
		for (const heavy of HEAVY_COMPOSITES) {
			expect(compositeExports, `composites barrel must not re-export ${heavy}`).not.toContain(heavy);
		}
	});
});

/** Composite directories whose dependency graph is too heavy for the default barrel. */
const HEAVY_COMPOSITES = ['chatbot', 'info-dialog'] as const;

// ─── Recorded allowances (see the RATCHET note at the top of this file) ───

/**
 * Empty, and it must stay that way. Every adapter now lives under `server/http/` or
 * carries a `*.hook.ts` / `*.adapter.ts` suffix, so this rule holds with no exceptions.
 * Do not re-open this list: a domain module that needs the framework is an adapter, and
 * belongs in one of those three places.
 */
const KNOWN_FRAMEWORK_IMPORTS: readonly string[] = [];

/**
 * Modules that read `$env/*` directly. Each one is a module the bare-Bun scripts cannot
 * import. Shrink by threading the value in from the composition root, or by moving the read
 * to a `*.adapter.ts`; never grow.
 */
const KNOWN_ENV_IMPORTS: readonly string[] = [
	'src/lib/server/abuse/config.ts -> $env/dynamic/private',
	'src/lib/server/ai/providers.ts -> $env/dynamic/private',
	'src/lib/server/auth/index.ts -> $env/dynamic/private',
	'src/lib/server/auth/send-auth-email.ts -> $env/dynamic/private',
	'src/lib/server/cache/index.ts -> $env/dynamic/private',
	'src/lib/server/db/index.ts -> $env/dynamic/private',
	'src/lib/server/docs/loader.ts -> $env/dynamic/public',
	'src/lib/server/graph/index.ts -> $env/dynamic/private',
	'src/lib/server/jobs/dbops-refresh.ts -> $env/dynamic/private',
	'src/lib/server/jobs/delivery-scheduler.ts -> $env/dynamic/private',
	'src/lib/server/jobs/scheduler.ts -> $env/dynamic/private',
	'src/lib/server/mcp/auth.ts -> $env/dynamic/private',
	'src/lib/server/mcp/server-info.ts -> $env/dynamic/private',
	'src/lib/server/mcp/telemetry/observer.ts -> $env/dynamic/private',
	'src/lib/server/monitoring/r2.ts -> $env/dynamic/private',
	'src/lib/server/monitoring/upstash.ts -> $env/dynamic/private',
	'src/lib/server/neon/branches.ts -> $env/dynamic/private',
	'src/lib/server/neon/client.ts -> $env/dynamic/private',
	'src/lib/server/notifications/crypto.ts -> $env/dynamic/private',
	'src/lib/server/notifications/health.ts -> $env/dynamic/private',
	'src/lib/server/notifications/channels/discord.ts -> $env/dynamic/private',
	'src/lib/server/notifications/channels/email.ts -> $env/dynamic/private',
	'src/lib/server/notifications/channels/telegram.ts -> $env/dynamic/private',
	'src/lib/server/notifications/channels/web-push.ts -> $env/dynamic/private',
	'src/lib/server/pairing/cookie.ts -> $env/dynamic/private',
	'src/lib/server/platform/index.ts -> $env/dynamic/private',
	'src/lib/server/retrieval/embed.ts -> $env/dynamic/private',
	'src/lib/server/security/subkey.ts -> $env/dynamic/private',
	'src/lib/server/showcases/image-kit/embed.ts -> $env/dynamic/private',
	'src/lib/server/store/index.ts -> $env/dynamic/private',
];

/**
 * Six domains still have no `index.ts` at all — `analytics`, `docs`, `mcp`, `retrieval-shared`,
 * `security`, `test` — so for those the rule is not merely broken but unfollowable, and
 * giving them a public surface is the next step. Three of the original nine are done:
 * `schemas` and `style` gained barrels, and `branding` was absorbed into `style`.
 * (`http/` and `showcases/` are excluded: the first is a sink reached by file, the second
 * a container whose subdirectories are the real domains.) The rest reach past a barrel
 * that already exports the symbol.
 *
 * `auth/admin-ids` is deliberate: a framework-free leaf that exists precisely so callers
 * can avoid pulling the Better Auth instance out of `auth/index.ts`.
 */
const KNOWN_DEEP_CROSS_DOMAIN_IMPORTS: readonly string[] = [
	'src/lib/server/agents/render.ts -> blog/pipeline',
	'src/lib/server/ai/chat-orchestrator.ts -> auth/admin-ids',
	'src/lib/server/ai/citations/drill.ts -> retrieval/queries',
	'src/lib/server/ai/context-assembly.ts -> retrieval/embed',
	'src/lib/server/ai/context-assembly.ts -> retrieval/types',
	'src/lib/server/ai/deskbot-retrieval.ts -> retrieval/ingest',
	'src/lib/server/ai/deskbot-retrieval.ts -> retrieval/types',
	'src/lib/server/ai/guard.ts -> abuse/decision.adapter',
	'src/lib/server/ai/tools/desk-read.ts -> desk/file-tree',
	'src/lib/server/ai/tools/get-source-chunks.ts -> retrieval/queries',
	'src/lib/server/ai/tools/search-pattern-library.ts -> mcp/patterns/search',
	'src/lib/server/analytics/confirm-token.ts -> security/subkey',
	'src/lib/server/analytics/visitor.ts -> security/subkey',
	'src/lib/server/auth/factor-changes.ts -> admin/audit',
	'src/lib/server/auth/grant-requests.ts -> admin/audit',
	'src/lib/server/auth/grants.ts -> admin/audit',
	'src/lib/server/blog/comments/mutations.ts -> admin/audit',
	'src/lib/server/blog/index.ts -> content/hash',
	'src/lib/server/blog/mutations.ts -> content/hash',
	'src/lib/server/blog/mutations.ts -> search/regconfig',
	'src/lib/server/blog/queries.ts -> search/regconfig',
	'src/lib/server/cache/admin/mutations.ts -> admin/announcements',
	'src/lib/server/cache/admin/queries.ts -> admin/announcements',
	'src/lib/server/cache/admin/queries.ts -> monitoring/upstash',
	'src/lib/server/content/push.ts -> auth/admin-ids',
	'src/lib/server/content/push.ts -> blog/pipeline',
	'src/lib/server/desk/file-tree.ts -> blog/queries',
	'src/lib/server/docs/loader.ts -> blog/pipeline',
	'src/lib/server/docs/loader.ts -> blog/types',
	'src/lib/server/docs/markdown-urls.ts -> agents/registry',
	'src/lib/server/graph/catalog.ts -> search/catalog-projection',
	'src/lib/server/http/guards.ts -> auth/admin-ids',
	'src/lib/server/imagemeta/extract.ts -> ai/budget',
	'src/lib/server/imagemeta/extract.ts -> ai/pricing',
	'src/lib/server/imagemeta/extract.ts -> store/image',
	'src/lib/server/imagemeta/handlers.ts -> store/image',
	'src/lib/server/jobs/blog-orphan-reaper.ts -> blog/queries',
	'src/lib/server/jobs/blog-orphan-reaper.ts -> store/blog',
	'src/lib/server/jobs/bot-ranges-refresh.ts -> analytics/bot-ranges',
	'src/lib/server/jobs/bot-ranges-refresh.ts -> analytics/datacenter-ranges',
	'src/lib/server/jobs/desk-retrieval-sync.ts -> ai/deskbot-retrieval',
	'src/lib/server/jobs/discord-token-refresh.ts -> notifications/channels/discord',
	'src/lib/server/jobs/grant-request-expiry.ts -> auth/grant-requests',
	'src/lib/server/jobs/notification-delivery.ts -> notifications/outbox',
	'src/lib/server/jobs/notification-delivery.ts -> notifications/channels',
	'src/lib/server/jobs/notification-delivery.ts -> notifications/channels/types',
	'src/lib/server/jobs/notification-delivery.ts -> notifications/render-message',
	'src/lib/server/jobs/notification-digest.ts -> notifications/digest',
	'src/lib/server/llmwiki/search.ts -> retrieval/embed',
	'src/lib/server/mcp/demo/state.ts -> admin/audit',
	'src/lib/server/privacy/mutations.ts -> auth/admin-ids',
	'src/lib/server/privacy/mutations.ts -> graph/retrieval/mutations',
	'src/lib/server/privacy/mutations.ts -> store/image',
	'src/lib/server/retrieval/embed.ts -> ai/provider-usage',
	'src/lib/server/retrieval/ingest/graph-store.ts -> graph/retrieval/mutations',
	'src/lib/server/retrieval/tiers/graph.ts -> graph/retrieval/queries',
	'src/lib/server/search/adapters/docs.ts -> docs/manifest',
	'src/lib/server/showcases/image-kit/cost-estimate.ts -> ai/pricing',
	'src/lib/server/showcases/image-kit/embed.ts -> ai/provider-usage',
	'src/lib/server/showcases/image-kit/embed.ts -> retrieval/embed',
	'src/lib/server/showcases/image-kit/vision.ts -> ai/budget',
	'src/lib/server/showcases/image-kit/vision.ts -> ai/pricing',
	'src/lib/server/store/blog/mutations.ts -> security/subkey',
	'src/lib/server/store/blog/mutations.ts -> security/ticket',
];

/**
 * What remains after the 116-constant `server/config.ts` was split into domain-owned
 * policy leaves: `db/analytics` reaching up for types and IP normalisation, and
 * `db/errors` for the shared `ServerError` base.
 */
const KNOWN_DB_UPWARD_IMPORTS: readonly string[] = [
	'src/lib/server/db/analytics/aggregations.ts -> analytics',
	'src/lib/server/db/analytics/mutations.ts -> analytics',
	'src/lib/server/db/errors.ts -> errors',
];

/**
 * Eighteen of the server domains are mutually recursive. Removing just the
 * `db ->` back-edges above splits this into a 10-domain and a 3-domain cluster.
 */
const KNOWN_CYCLIC_DOMAINS: readonly string[] = [
	'abuse',
	'admin',
	'agents',
	'ai',
	'analytics',
	'auth',
	'blog',
	'cache',
	'content',
	'db',
	'docs',
	'graph',
	'http',
	'llmwiki',
	'monitoring',
	'retrieval',
	'search',
	'store',
];

/**
 * Two composites reaching into `layout/`, and one showcase reaching into `viz/`.
 *
 * The other three were the same shape — a shared component parked inside the first feature
 * that needed it — and were fixed by moving the shared piece down a layer: the prose
 * renderer the blog, docs viewer and desk preview all use became
 * `composites/markdown/MarkdownProse`, and the brand marks the footer and homepage draw
 * became `primitives/logo/`. `viz/` is the remaining case of the same kind: a chart
 * library that a showcase reaches sideways for.
 */
const KNOWN_LAYER_INVERSIONS: readonly string[] = [
	'src/lib/components/composites/feedback-band/FeedbackBand.svelte -> layout',
	'src/lib/components/composites/showcase-layout/ShowcaseLayout.svelte -> layout',
	'src/lib/components/showcases/cycle/CycleWaterfall.svelte -> viz',
];
