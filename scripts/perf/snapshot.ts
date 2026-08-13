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
 *   podman exec -e NODE_ENV=production v10r bun run build
 *   podman exec -e NODE_ENV=production v10r bun run scripts/perf/snapshot.ts
 */

import { gzipSync } from 'node:zlib';

const CLIENT_MANIFEST = '.svelte-kit/output/client/.vite/manifest.json';
const CLIENT_ROOT = '.svelte-kit/output/client';
const STATIC_ROOT = '.vercel/output/static';
const OUT = 'src/lib/server/perf/snapshot.json';

/** Chunks loaded on every single route: the client runtime, the app shell, the root layout. */
const BASELINE_ENTRIES = [
	'node_modules/@sveltejs/kit/src/runtime/client/entry.js',
	'.svelte-kit/generated/client-optimized/app.js',
	'.svelte-kit/generated/client-optimized/nodes/0.js',
];

interface ManifestChunk {
	file: string;
	imports?: string[];
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
 * Provenance for the snapshot. `GIT_SHA` is checked first because the container
 * this runs in has no git binary, so the spawn is only a fallback for running it
 * on a host that does:
 *
 *   podman exec -e NODE_ENV=production -e GIT_SHA=$(git rev-parse --short HEAD) v10r ...
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

	const baselineKeys = closure(
		manifest,
		BASELINE_ENTRIES.filter((k) => manifest[k]),
	);
	const baselineBytes = await totalGzip(manifest, baselineKeys);

	// Per-route weight = baseline plus whatever that route's node pulls in on top.
	// Reported as a total, not a delta, because the total is what a visitor with a
	// cold cache actually downloads.
	const nodeKeys = Object.keys(manifest).filter((k) => k.includes('/client-optimized/nodes/'));
	const routeTotals: { node: string; gzipKb: number }[] = [];
	for (const nodeKey of nodeKeys) {
		const keys = closure(manifest, [...baselineKeys, nodeKey]);
		routeTotals.push({
			node: nodeKey.replace('.svelte-kit/generated/client-optimized/nodes/', '').replace('.js', ''),
			gzipKb: kb(await totalGzip(manifest, keys)),
		});
	}
	routeTotals.sort((a, b) => b.gzipKb - a.gzipKb);

	const median = routeTotals.length > 0 ? routeTotals[Math.floor(routeTotals.length / 2)].gzipKb : 0;
	const heaviest = routeTotals[0] ?? { node: 'n/a', gzipKb: 0 };

	let allJsBytes = 0;
	let chunkCount = 0;
	const jsGlob = new Bun.Glob('_app/immutable/**/*.js');
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
			/** Heaviest single route, baseline included — the number `route_js_kb` budgets. */
			route_js_kb: heaviest.gzipKb,
			heaviest_route_node: heaviest.node,
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
