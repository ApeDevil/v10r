/**
 * Registry drift guard: structural schema, referential integrity, DAG check, and
 * filesystem existence for every referenced path. Exits non-zero on any error.
 *
 * Run (host):  podman run --rm -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/mcp/validate-registry.ts
 * Run (container): bun run mcp:validate
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildById, loadRegistry, type RegRef, topoSort } from './registry.ts';

const ROOT = process.env.V10R_ROOT ?? resolve(import.meta.dir, '..');
const SHOWCASE_REGISTRY = 'src/lib/showcases/registry.ts';
// Route groups an approute may live under, tried in order. `(public)` covers
// showcase-adjacent pages, the bare locale dir covers /account, /admin, /desk,
// /pair, and src/routes covers locale-less endpoints like /api/*.
const APPROUTE_ROOTS = ['src/routes/[[locale=locale]]/(public)', 'src/routes/[[locale=locale]]', 'src/routes'];

const errors: string[] = [];
const warnings: string[] = [];

/**
 * `kind: 'route'` refs must be members of the showcase registry, not merely
 * directories on disk — an unregistered route is invisible to the catalog and
 * to docs resolution. The hrefs are scraped from the module SOURCE (the same
 * technique the drift tests use) because importing it would pull in generated
 * Paraglide output, which the documented ephemeral read-only-clone run of this
 * script does not have.
 */
function loadShowcaseHrefs(): Set<string> {
	const source = readFileSync(join(ROOT, SHOWCASE_REGISTRY), 'utf8');
	const hrefs = new Set<string>();
	for (const match of source.matchAll(/href: '(\/showcases[^']*)'/g)) {
		hrefs.add(match[1]);
	}
	return hrefs;
}

const showcaseHrefs = loadShowcaseHrefs();

function checkRef(ref: RegRef, where: string): void {
	const kind = ref.kind ?? 'file';
	if (kind === 'route') {
		if (!showcaseHrefs.has(ref.path)) {
			errors.push(`${where}: route '${ref.path}' is not an href in ${SHOWCASE_REGISTRY}`);
		}
		return;
	}
	if (kind === 'approute') {
		if (!APPROUTE_ROOTS.some((root) => existsSync(join(ROOT, root, ref.path)))) {
			errors.push(`${where}: approute '${ref.path}' has no directory under any of: ${APPROUTE_ROOTS.join(', ')}`);
		}
		return;
	}
	const target = join(ROOT, ref.path.split('#')[0]);
	if (!existsSync(target)) {
		errors.push(`${where}: path '${ref.path}' does not exist`);
		return;
	}
	const stats = statSync(target);
	if (kind === 'file' && !stats.isFile()) {
		errors.push(`${where}: '${ref.path}' exists but is not a file (set kind: "dir"?)`);
	}
	if (kind === 'dir' && !stats.isDirectory()) {
		errors.push(`${where}: '${ref.path}' exists but is not a directory`);
	}
}

const { registry, error } = loadRegistry();
if (!registry) {
	console.error(`FAIL structural: ${error}`);
	process.exit(1);
}

const byId = buildById(registry);
const allIds = registry.patterns.map((pattern) => pattern.id);
const { cyclic } = topoSort(allIds, byId, allIds);
if (cyclic) {
	errors.push('depends_on graph contains a cycle');
}

for (const pattern of registry.patterns) {
	const lists: Array<[string, RegRef[]]> = [
		['docs', pattern.docs],
		['code', pattern.code],
		['tests', pattern.tests],
		['showcases', pattern.showcases],
	];
	for (const [field, refs] of lists) {
		refs.forEach((ref, index) => {
			checkRef(ref, `${pattern.id}.${field}[${index}]`);
		});
	}
	// Deep-tier depth (invariants/notes/capabilities/keywords/docs non-empty) and the
	// light-tier docs floor are structural errors in registry.ts. The only advisory
	// left: a light record with no keywords still loses search recall.
	if (pattern.tier === 'light' && pattern.keywords.length === 0) {
		warnings.push(`${pattern.id}: no keywords — search recall will be weak`);
	}
}

for (const warning of warnings) {
	console.error(`WARN ${warning}`);
}
if (errors.length > 0) {
	for (const message of errors) {
		console.error(`FAIL ${message}`);
	}
	console.error(`registry INVALID: ${errors.length} error(s), ${warnings.length} warning(s)`);
	process.exit(1);
}
const deepCount = registry.patterns.filter((pattern) => pattern.tier === 'deep').length;
console.error(
	`registry OK: ${registry.patterns.length} patterns (${deepCount} deep / ${registry.patterns.length - deepCount} light), 0 errors, ${warnings.length} warning(s)`,
);
