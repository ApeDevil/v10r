/**
 * Registry drift guard: structural schema, referential integrity, DAG check, and
 * filesystem existence for every referenced path. Exits non-zero on any error.
 *
 * Run (host):  podman run --rm -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/mcp/validate-registry.ts
 * Run (container): bun run mcp:validate
 */
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildById, loadRegistry, type RegRef, topoSort } from './registry.ts';

const ROOT = process.env.V10R_ROOT ?? resolve(import.meta.dir, '..');
const SHOWCASE_ROUTES_DIR = 'src/routes/[[locale=locale]]/(public)';

const errors: string[] = [];
const warnings: string[] = [];

function checkRef(ref: RegRef, where: string): void {
	const kind = ref.kind ?? 'file';
	if (kind === 'route') {
		const routeDir = join(ROOT, SHOWCASE_ROUTES_DIR, ref.path);
		if (!existsSync(routeDir)) {
			errors.push(`${where}: route '${ref.path}' has no directory under ${SHOWCASE_ROUTES_DIR}`);
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
	if (pattern.capabilities.length === 0) {
		warnings.push(`${pattern.id}: no capabilities — trace/recommend cannot match it`);
	}
	if (pattern.keywords.length === 0) {
		warnings.push(`${pattern.id}: no keywords — search recall will be weak`);
	}
	if (pattern.docs.length === 0) {
		warnings.push(`${pattern.id}: no docs refs`);
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
console.error(`registry OK: ${registry.patterns.length} patterns, 0 errors, ${warnings.length} warning(s)`);
