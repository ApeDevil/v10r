#!/usr/bin/env bun
/**
 * Lab snapshot — turns a build into a committed, diffable set of numbers.
 *
 * The shell probes in this directory print to a terminal and the numbers vanish.
 * That is why a 561 KB shared baseline could sit there for months: nothing
 * compared today's build to last week's. This writes the measurements to
 * `src/lib/server/perf/snapshot.json`, which is committed, rendered by
 * /admin/perf, and asserted by `src/lib/server/perf/snapshot.gate.test.ts`.
 *
 * MUST be run against a production build. A dev-mode build inflates client JS by
 * ~9% and every verdict with it, so the snapshot records the NODE_ENV it saw and
 * the gate refuses to score anything that does not say `production`.
 *
 * MUST know which source it measured. The container has no git binary, so the
 * host passes `GIT_SHA` (short SHA, `-dirty` when the tree differs from it); a
 * write without it is refused rather than recorded as `null`, because a committed
 * number nobody can reproduce is worse than no number. `vr` sets it on every
 * container run; by hand:
 *
 *   podman exec -e NODE_ENV=production -e GIT_SHA=$(git rev-parse --short HEAD) v10r bun run perf:snapshot
 *
 * --check: measure the build and score it against the budgets.json ceilings
 * WITHOUT touching the committed snapshot.json. This is the `validate:build`
 * leg that `vr ship` runs after `validate` — a pre-ship build check must not
 * dirty the tree (`vr ship` requires it clean), and the committed snapshot's
 * accepted numbers stay the ratchet baseline until deliberately regenerated.
 * Provenance is not required here: nothing is written.
 */

import { gzipSync } from 'node:zlib';
import { checkRatchets, isScoreable, type LabSnapshot } from '#lib/server/perf/snapshot.ts';

const CHECK = process.argv.includes('--check');

const CLIENT_MANIFEST = '.svelte-kit/output/client/.vite/manifest.json';
/** SvelteKit 3 writes the build's generated client under `generated/build/`. */
const GENERATED = '.svelte-kit/generated/build/client-optimized';
/** Generated client entry — its `dictionary` maps each route to the nodes it loads. */
const CLIENT_APP = `${GENERATED}/app.js`;
const NODE_PREFIX = `${GENERATED}/nodes/`;
const CLIENT_ROOT = '.svelte-kit/output/client';
const STATIC_ROOT = '.vercel/output/static';
const OUT = 'src/lib/server/perf/snapshot.json';

/** The client entry. Since SvelteKit 3 it loads the client runtime with a dynamic import. */
const CLIENT_ENTRY = 'node_modules/@sveltejs/kit/src/runtime/client/entry.js';

/** Chunks loaded on every single route: the client runtime, the app shell, the root layout. */
const BASELINE_ENTRIES = [CLIENT_ENTRY, CLIENT_APP, `${NODE_PREFIX}0.js`];

interface ManifestChunk {
	file: string;
	imports?: string[];
	dynamicImports?: string[];
	css?: string[];
	isEntry?: boolean;
}

type Manifest = Record<string, ManifestChunk>;

const gzCache = new Map<string, number>();

async function gzipBytes(relPath: string): Promise<number> {
	const cached = gzCache.get(relPath);
	if (cached !== undefined) return cached;
	const file = Bun.file(`${CLIENT_ROOT}/${relPath}`);
	if (!(await file.exists())) {
		gzCache.set(relPath, 0);
		return 0;
	}
	const size = gzipSync(Buffer.from(await file.arrayBuffer())).byteLength;
	gzCache.set(relPath, size);
	return size;
}

/** Transitive static-import closure. These load together, so they are one payload. */
function closure(manifest: Manifest, roots: string[]): Set<string> {
	const seen = new Set<string>();
	const queue = [...roots];
	while (queue.length > 0) {
		const key = queue.pop();
		if (!key || seen.has(key)) continue;
		const chunk = manifest[key];
		if (!chunk) continue;
		seen.add(key);
		for (const dep of chunk.imports ?? []) queue.push(dep);
	}
	return seen;
}

async function totalGzip(manifest: Manifest, keys: Iterable<string>): Promise<number> {
	let total = 0;
	for (const key of keys) {
		const chunk = manifest[key];
		if (!chunk) continue;
		total += await gzipBytes(chunk.file);
		for (const css of chunk.css ?? []) total += await gzipBytes(css);
	}
	return total;
}

const kb = (bytes: number) => Math.round((bytes / 1024) * 10) / 10;

/**
 * Every client route with the node indices it loads on arrival: its layouts, then its
 * page. The root layout (node 0) is implicit and already in the baseline; error nodes
 * are left out because they load only when a page fails.
 *
 * Read from SvelteKit's generated `dictionary` — `"/route": [~page, [layouts], [errors]]`,
 * `~` marking a node with a server load and an empty slot a group without a layout file.
 * A route is the unit a visitor downloads. Scoring single page nodes instead left every
 * intermediate layout out: the `(public)` shell alone is ~160 KB gz, and the median it
 * reported was ~80 KB lighter than any public page actually is.
 */
async function routeNodes(): Promise<{ route: string; nodes: number[] }[]> {
	const source = await Bun.file(CLIENT_APP).text();
	const start = source.indexOf('export const dictionary');
	const end = source.indexOf('};', start);
	if (start < 0 || end < 0) throw new Error(`No route dictionary in ${CLIENT_APP} — did SvelteKit change its output?`);
	const routes: { route: string; nodes: number[] }[] = [];
	const indices = (list: string | undefined) =>
		(list ?? '')
			.split(',')
			.map((slot) => slot.trim().replace('~', ''))
			.filter((slot) => slot !== '')
			.map(Number);
	for (const entry of source.slice(start, end).matchAll(/"([^"]+)":\s*\[(~?\d+)(?:,\s*\[([^\]]*)\])?/g)) {
		routes.push({ route: entry[1], nodes: [...indices(entry[3]), ...indices(entry[2])] });
	}
	if (routes.length === 0) throw new Error(`Parsed zero routes from ${CLIENT_APP} — the dictionary format changed.`);
	return routes;
}

/**
 * The root layout's stylesheet carries every UnoCSS utility the app uses (`import 'uno.css'`
 * in `src/routes/+layout.svelte`, global mode). If UnoCSS cannot find Vite's CSS plugin for an
 * output directory, it warns and emits nothing, and the build still passes; under SvelteKit 3
 * (one output directory per environment) UnoCSS < 66.11 did exactly that, which read as a
 * 20 KB improvement here while every page lost its layout. The floor sits far below the ~490
 * class rules a healthy build carries and far above the dozen an empty one does.
 */
const MIN_ROOT_CLASS_RULES = 200;

async function assertUtilityCss(manifest: Manifest): Promise<void> {
	let rules = 0;
	for (const css of manifest[`${NODE_PREFIX}0.js`]?.css ?? []) {
		rules += (await Bun.file(`${CLIENT_ROOT}/${css}`).text()).match(/\.[a-z][\w-]*\{/g)?.length ?? 0;
	}
	if (rules < MIN_ROOT_CLASS_RULES) {
		throw new Error(
			`The root stylesheet has ${rules} class rules (floor ${MIN_ROOT_CLASS_RULES}): the UnoCSS utilities are missing. ` +
				'Look for "[unocss] failed to find vite:css-post plugin" in the build output.',
		);
	}
}

/**
 * Provenance for the snapshot. `GIT_SHA` is checked first because the container
 * this runs in has no git binary, so the spawn is only a fallback for running it
 * on a host that does. The value may carry a `-dirty` suffix — an honest snapshot
 * of an uncommitted tree says so rather than naming a commit it does not match.
 */
function gitSha(): string | null {
	const fromEnv = process.env.GIT_SHA?.trim();
	if (fromEnv) return fromEnv;
	try {
		const out = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD']);
		const sha = new TextDecoder().decode(out.stdout).trim();
		return sha.length > 0 ? sha : null;
	} catch {
		return null;
	}
}

async function largestPrerenderedHtml(): Promise<{ path: string; gzipKb: number; count: number } | null> {
	const glob = new Bun.Glob('**/*.html');
	let best: { path: string; gzipKb: number } | null = null;
	let count = 0;
	for await (const rel of glob.scan({ cwd: STATIC_ROOT })) {
		count++;
		const bytes = gzipSync(Buffer.from(await Bun.file(`${STATIC_ROOT}/${rel}`).arrayBuffer())).byteLength;
		if (!best || bytes / 1024 > best.gzipKb) best = { path: `/${rel}`, gzipKb: kb(bytes) };
	}
	return best ? { ...best, count } : null;
}

async function main() {
	const manifestFile = Bun.file(CLIENT_MANIFEST);
	if (!(await manifestFile.exists())) {
		console.error(`No client manifest at ${CLIENT_MANIFEST}. Run a build first:`);
		console.error('  podman exec -e NODE_ENV=production v10r bun run build');
		process.exit(2);
	}
	const manifest: Manifest = await manifestFile.json();

	// A missing key used to be skipped, which shrank the baseline instead of failing when
	// SvelteKit moved its generated files. A measurement of nothing is not a measurement.
	const missing = BASELINE_ENTRIES.filter((k) => !manifest[k]);
	if (missing.length > 0) throw new Error(`Baseline entries missing from ${CLIENT_MANIFEST}: ${missing.join(', ')}`);
	// The runtime the entry imports on start is loaded on every route too, statically or not.
	const runtime = manifest[CLIENT_ENTRY].dynamicImports ?? [];
	const baselineKeys = closure(manifest, [...BASELINE_ENTRIES, ...runtime]);
	const baselineBytes = await totalGzip(manifest, baselineKeys);
	await assertUtilityCss(manifest);

	// Per-route weight = baseline plus whatever that route's node pulls in on top.
	// Reported as a total, not a delta, because the total is what a visitor with a
	// cold cache actually downloads.
	const routeTotals: { route: string; gzipKb: number }[] = [];
	for (const { route, nodes } of await routeNodes()) {
		const keys = closure(manifest, [...baselineKeys, ...nodes.map((n) => `${NODE_PREFIX}${n}.js`)]);
		routeTotals.push({ route, gzipKb: kb(await totalGzip(manifest, keys)) });
	}
	routeTotals.sort((a, b) => b.gzipKb - a.gzipKb);

	const median = routeTotals.length > 0 ? routeTotals[Math.floor(routeTotals.length / 2)].gzipKb : 0;
	const heaviest = routeTotals[0] ?? { route: 'n/a', gzipKb: 0 };

	let allJsBytes = 0;
	let chunkCount = 0;
	// `_app/` rather than `_app/immutable/`: SvelteKit 3 also emits `_app/manifest.js`.
	const jsGlob = new Bun.Glob('_app/**/*.js');
	for await (const rel of jsGlob.scan({ cwd: CLIENT_ROOT })) {
		allJsBytes += await gzipBytes(rel);
		chunkCount++;
	}

	const html = await largestPrerenderedHtml();

	const snapshot = {
		_comment:
			'GENERATED by scripts/perf/snapshot.ts — do not hand-edit. Regenerate with a production build; see the header of that script. Scored against src/lib/server/perf/budgets.json by snapshot.gate.test.ts.',
		generatedAt: new Date().toISOString(),
		gitSha: gitSha(),
		/** The gate refuses to score a snapshot that does not say `production`. */
		nodeEnv: process.env.NODE_ENV ?? 'unknown',
		metrics: {
			/** Gzipped JS every route loads, regardless of which page you land on. */
			baseline_js_kb: kb(baselineBytes),
			/** Heaviest route — baseline, every layout and the page — the number `route_js_kb` budgets. */
			route_js_kb: heaviest.gzipKb,
			heaviest_route: heaviest.route,
			median_route_js_kb: median,
			/** Every emitted client chunk, gzipped. Not per-visitor; a corpus-size trend. */
			total_client_js_kb: kb(allJsBytes),
			chunk_count: chunkCount,
			route_count: routeTotals.length,
			/** Largest prerendered document, gzipped — catches inline-asset bloat. */
			doc_html_kb: html?.gzipKb ?? 0,
			largest_html_path: html?.path ?? null,
			prerendered_page_count: html?.count ?? 0,
		},
	};

	if (CHECK) {
		const computed = snapshot as LabSnapshot;
		if (!isScoreable(computed)) {
			console.error(
				`[validate:build] build was made with NODE_ENV=${computed.nodeEnv} — dev builds inflate client JS ~9%.`,
			);
			console.error('  Rebuild with: podman exec -e NODE_ENV=production v10r bun run validate:build');
			process.exit(1);
		}
		const checks = checkRatchets(computed);
		console.table(checks);
		const over = checks.filter((c) => c.exceeds);
		for (const c of over) {
			console.error(
				`[validate:build] ${c.metric} = ${c.value} exceeds the accepted ceiling ${c.ceiling} (${-c.slackKb} KB over).`,
			);
		}
		if (over.length > 0) {
			console.error(
				'[validate:build] a heavy dependency landed — shrink it, or deliberately re-accept via a snapshot regen.',
			);
			process.exit(1);
		}
		console.log(
			`[validate:build] OK — ${checks.length} ratchet(s) within ceilings (production build; committed snapshot.json untouched).`,
		);
		return;
	}

	if (!snapshot.gitSha) {
		console.error('[perf:snapshot] refusing to write a snapshot with no source revision.');
		console.error('  The container has no git — pass it in: -e GIT_SHA=$(git rev-parse --short HEAD)');
		process.exit(1);
	}

	await Bun.write(OUT, `${JSON.stringify(snapshot, null, '\t')}\n`);

	console.log(`Wrote ${OUT} (NODE_ENV=${snapshot.nodeEnv})`);
	console.table(snapshot.metrics);
	if (snapshot.nodeEnv !== 'production') {
		console.warn('\nWARNING: not a production build — these numbers are inflated and the gate will reject them.');
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
