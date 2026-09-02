/**
 * Build (or verify) the pattern library's generated markdown surfaces from
 * `pattern-library/registry.json`:
 *
 *   - the README.md Pattern Index region (between the PATTERN-INDEX markers)
 *   - one docs page per pattern under docs/pattern-library/<id>.md (the
 *     `pattern-library` docs section — its /docs/pattern-library index page is
 *     a live route over the registry, not a generated file)
 *   - docs/pattern-library/README.md (the directory's GitHub navigation hub)
 *
 *   bun run patterns:build     # regenerate all three (commit the result)
 *   bun run patterns:check     # fail if any committed surface is stale (wired into the gate)
 *
 * Determinism: everything derives from the registry in registry order — no
 * timestamps, no environment reads — so regeneration is byte-stable and
 * `--check` reliably detects a stale surface. Orphaned pages (an id removed
 * from the registry) are deleted on build and fail `--check`, mirroring the
 * ingest script's reconcile step.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isBlocked, parseFrontmatter } from '../../src/lib/server/docs/doc-filter.ts';
import { REGISTRY } from '../../src/lib/server/patterns/registry.ts';
import {
	PATTERN_PAGES_DIR,
	README_MARKER_END,
	README_MARKER_START,
	type RenderOpts,
	renderPatternPage,
	renderPatternsHub,
	renderReadmeIndex,
} from '../../src/lib/server/patterns/render.ts';

const ROOT = resolve(import.meta.dir, '../..');
const README_PATH = resolve(ROOT, 'README.md');
const PAGES_DIR = resolve(ROOT, PATTERN_PAGES_DIR);
const CHECK = process.argv.includes('--check');

/**
 * Same publication predicate the /docs manifest and the RAG ingester apply:
 * shared block rules from doc-filter plus the file's own frontmatter flags.
 * A path that does not exist is unpublished (renders as a code span, not a link).
 */
const opts: RenderOpts = {
	isPublishedDoc(path: string): boolean {
		if (isBlocked(path)) return false;
		const abs = resolve(ROOT, path);
		// Directories (registry `kind: "dir"` refs) are never published pages.
		if (!existsSync(abs) || !statSync(abs).isFile()) return false;
		const { frontmatter } = parseFrontmatter(readFileSync(abs, 'utf8'));
		return frontmatter.published !== false && frontmatter.draft !== true;
	},
};

interface Surface {
	/** Repo-relative label for messages. */
	label: string;
	current: string | null;
	generated: string;
	write(): void;
}

function readOrNull(path: string): string | null {
	try {
		return readFileSync(path, 'utf8');
	} catch {
		return null;
	}
}

function spliceReadme(readme: string, region: string): string {
	const start = readme.indexOf(README_MARKER_START);
	const end = readme.indexOf(README_MARKER_END);
	if (start === -1 || end === -1 || end < start) {
		console.error(
			'FAIL README.md is missing the PATTERN-INDEX markers — the generated region has nowhere to go. Restore both marker comments.',
		);
		process.exit(1);
	}
	return readme.slice(0, start) + region + readme.slice(end + README_MARKER_END.length);
}

const surfaces: Surface[] = [];

// 1. README region (whole-file compare so the splice itself is verified).
const readmeCurrent = readOrNull(README_PATH);
if (readmeCurrent === null) {
	console.error('FAIL README.md not found');
	process.exit(1);
}
const readmeGenerated = spliceReadme(readmeCurrent, renderReadmeIndex(REGISTRY));
surfaces.push({
	label: 'README.md (Pattern Index region)',
	current: readmeCurrent,
	generated: readmeGenerated,
	write: () => writeFileSync(README_PATH, readmeGenerated),
});

// 2. One page per pattern + the directory hub.
const pages = new Map<string, string>();
for (const pattern of REGISTRY.patterns) {
	pages.set(`${pattern.id}.md`, renderPatternPage(pattern, REGISTRY, opts));
}
pages.set('README.md', renderPatternsHub(REGISTRY));

for (const [name, generated] of pages) {
	const abs = resolve(PAGES_DIR, name);
	surfaces.push({
		label: `${PATTERN_PAGES_DIR}/${name}`,
		current: readOrNull(abs),
		generated,
		write: () => writeFileSync(abs, generated),
	});
}

// 3. Orphans: committed pages whose id left the registry.
const orphans = existsSync(PAGES_DIR)
	? readdirSync(PAGES_DIR).filter((name) => name.endsWith('.md') && !pages.has(name))
	: [];

const stale = surfaces.filter((surface) => surface.current !== surface.generated);

if (CHECK) {
	if (stale.length > 0 || orphans.length > 0) {
		for (const surface of stale) {
			console.error(`FAIL stale: ${surface.label}`);
		}
		for (const orphan of orphans) {
			console.error(`FAIL orphaned page: ${PATTERN_PAGES_DIR}/${orphan} (id no longer in the registry)`);
		}
		console.error('Regenerate: bun run patterns:build');
		process.exit(1);
	}
	console.error(`pattern surfaces OK: README region + ${pages.size} page(s) in sync with the registry`);
} else {
	mkdirSync(PAGES_DIR, { recursive: true });
	for (const surface of stale) {
		surface.write();
	}
	for (const orphan of orphans) {
		rmSync(resolve(PAGES_DIR, orphan));
	}
	console.error(
		`wrote ${stale.length} changed surface(s) of ${surfaces.length} (README region + ${pages.size} pages), removed ${orphans.length} orphan(s)`,
	);
}
