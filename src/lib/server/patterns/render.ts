/**
 * Pure renderers for the pattern library's generated surfaces: the README
 * Pattern Index region, the per-pattern pages under docs/pattern-library/
 * (its own top-level docs section), and that directory's README hub. One
 * registry in, deterministic markdown out. The section's index page at
 * /docs/pattern-library is a live route (see catalog.ts), not markdown.
 *
 * Vite-free leaf (no `$lib`, no `$env`, no `import.meta`): the Bun build script
 * (`scripts/patterns/build-derived.ts`) imports this by relative path, the same
 * contract `doc-filter.ts` and `rawrag/plan.ts` follow. All I/O — reading the
 * registry, checking doc publication, writing files — belongs to the script;
 * `RenderOpts.isPublishedDoc` injects the one predicate the renderers need.
 */
import type { PatternRecord, Registry, RegRef } from '../mcp/patterns/data';

export interface RenderOpts {
	/** True when a repo-relative docs path is published (not blocked, not draft). */
	isPublishedDoc(path: string): boolean;
}

/**
 * Where the generated per-pattern pages live, repo-relative. The directory IS
 * the `pattern-library` docs section: pages surface at /docs/pattern-library/<id>
 * (flat slug = registry id) and flow into /llms.txt and RAG ingest automatically.
 */
export const PATTERN_PAGES_DIR = 'docs/pattern-library';

export const README_MARKER_START =
	'<!-- PATTERN-INDEX:START — generated from mcp/patterns.registry.json by scripts/patterns/build-derived.ts; do not edit (bun run patterns:build) -->';
export const README_MARKER_END = '<!-- PATTERN-INDEX:END -->';

const GENERATED_NOTE =
	'> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.';

/** GitHub's heading→anchor algorithm, for the TOC links ("A & B" → "a--b"). */
export function anchorFor(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9 -]/g, '')
		.replace(/ /g, '-');
}

/**
 * Repo docs path → in-app URL, mirroring the manifest's slug rules
 * (src/lib/server/docs/manifest.ts): blueprint keeps its nested path, stack,
 * foundation, and pattern-library flatten to a slugified basename, and the two
 * repo-root entry-point docs are served by the `.md` layer's ROOT_DOCS. Returns
 * null for anything unpublished or outside those spaces — callers render an
 * unlinked code span instead of a dead link.
 */
export function docsUrlFor(path: string, isPublished: boolean): string | null {
	if (!isPublished) return null;
	const clean = path.split('#')[0];
	if (!clean.startsWith('docs/') || !clean.endsWith('.md')) return null;
	const parts = clean.split('/');
	const base = slugifyBase(parts[parts.length - 1]);
	if (parts.length === 2) {
		// Repo-root docs (system-abstraction, codebase-organization) render at
		// /docs/<slug> — the ROOT_DOCS route, outside the manifest.
		return `/docs/${base}`;
	}
	const section = parts[1];
	if (section === 'blueprint') {
		return `/docs/blueprint/${parts.slice(2).join('/').replace(/\.md$/, '')}`;
	}
	if (section === 'foundation' || section === 'stack' || section === 'pattern-library') {
		return `/docs/${section}/${base}`;
	}
	return null;
}

function slugifyBase(filename: string): string {
	return filename
		.replace(/\.md$/, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

function categoryTitle(registry: Registry, id: string): string {
	return registry.categories.find((category) => category.id === id)?.title ?? id;
}

function patternsInCategory(registry: Registry, categoryId: string): PatternRecord[] {
	return registry.patterns.filter((pattern) => pattern.category === categoryId);
}

function collapse(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/** Frontmatter description: one collapsed line, word-truncated to ≤160 chars. */
export function frontmatterDescription(summary: string): string {
	const text = collapse(summary);
	if (text.length <= 160) return text;
	const slice = text.slice(0, 159);
	const lastSpace = slice.lastIndexOf(' ');
	return `${(lastSpace > 100 ? slice.slice(0, lastSpace) : slice).replace(/[,;:—–-]\s*$/, '')}…`;
}

// README Pattern Index region

function readmeDocsCell(refs: RegRef[]): string {
	if (refs.length === 0) return '—';
	return refs
		.map((ref) => {
			const label = ref.path.replace(/^docs\//, '');
			return `[${label}](${ref.path})${ref.note ? ` (${ref.note})` : ''}`;
		})
		.join(' · ');
}

function readmeCodeCell(refs: RegRef[]): string {
	if (refs.length === 0) return '—';
	return refs
		.map((ref) => {
			const shown = ref.kind === 'dir' ? `${ref.path}/` : ref.path;
			return `[${shown}](${shown})${ref.note ? ` (${ref.note})` : ''}`;
		})
		.join(' · ');
}

function readmeShowcaseCell(refs: RegRef[]): string {
	const routes = refs.filter((ref) => ref.kind === 'route');
	const approutes = refs.filter((ref) => ref.kind === 'approute');
	const routePart = routes.map((ref) => `\`${ref.path}\``).join(' · ');
	const appPart = approutes.map((ref) => `\`${ref.note ? `${ref.note} ` : ''}${ref.path}\``).join(' · ');
	if (routePart && appPart) return `${routePart} · (${appPart})`;
	if (routePart) return routePart;
	if (appPart) return `— (${appPart})`;
	return '—';
}

function readmeRow(pattern: PatternRecord): string {
	const page = `${PATTERN_PAGES_DIR}/${pattern.id}.md`;
	const title = pattern.tier === 'deep' ? `[**${pattern.title}**](${page})` : `[${pattern.title}](${page})`;
	// Exception badge: only non-proven rows are marked, so the table stays quiet
	// for the proven majority instead of growing a fifth column.
	const badge = pattern.maturity === 'proven' ? '' : ` _(${pattern.maturity})_`;
	return `| ${title}${badge} | ${readmeDocsCell(pattern.docs)} | ${readmeCodeCell(pattern.code)} | ${readmeShowcaseCell(pattern.showcases)} |`;
}

/** The full marker-delimited README region, markers included. */
export function renderReadmeIndex(registry: Registry): string {
	const lines: string[] = [README_MARKER_START, ''];
	lines.push(
		'> **Bold** patterns are deep-tier: their pages carry invariants and emulation notes; the rest are index',
		'> rows pointing at docs, code, and proof. Showcase routes live on disk under',
		'> `src/routes/[[locale=locale]]/(public)/showcases/` — append the route path shown. Routes in parentheses,',
		'> like (`/desk`), mean there is no showcase; the pattern is live at that app route.',
		'> Unmarked rows are **proven** (a linked test or showcase, verified at a recorded date); _(implemented)_',
		'> means the code exists but no proof surface is linked yet, _(planned)_ that it is design-only.',
		'',
	);
	for (const group of registry.groups) {
		const categoryLinks = registry.categories
			.filter((category) => category.group === group.id)
			.map((category) => `[${category.title}](#${anchorFor(category.title)})`)
			.join(' · ');
		lines.push(`- **${group.title}:** ${categoryLinks}`);
	}
	for (const category of registry.categories) {
		const patterns = patternsInCategory(registry, category.id);
		if (patterns.length === 0) continue;
		lines.push('', `### ${category.title}`, '', '| Pattern | Docs | Code | Showcase |', '|---|---|---|---|');
		for (const pattern of patterns) {
			lines.push(readmeRow(pattern));
		}
	}
	lines.push('', README_MARKER_END);
	return lines.join('\n');
}

// Per-pattern pages

const REPO_GITHUB = 'https://github.com/ApeDevil/v10r';
const REPO_GITLAB = 'https://gitlab.com/ApeDevil/v10r';

/**
 * GitHub + GitLab source views for a repo-relative path (tree URLs for dir
 * refs). Every docs/code/tests ref line carries both, so readers of the in-app
 * page can open the actual file on either host; `#fragment` suffixes are
 * dropped because the hosts' heading-anchor scheme doesn't match ours.
 */
function hostLinks(path: string, isDir: boolean): string {
	const clean = path.split('#')[0];
	const view = isDir ? 'tree' : 'blob';
	return `([GitHub](${REPO_GITHUB}/${view}/main/${clean}) · [GitLab](${REPO_GITLAB}/-/${view}/main/${clean}))`;
}

function pageDocsLines(refs: RegRef[], opts: RenderOpts): string {
	return refs
		.map((ref) => {
			// A `dir` ref points at a folder of related docs — never a single
			// published page, so it can't resolve to a /docs URL.
			if (ref.kind === 'dir')
				return `- \`${ref.path}/\`${ref.note ? ` — ${ref.note}` : ''} ${hostLinks(ref.path, true)}`;
			const url = docsUrlFor(ref.path, opts.isPublishedDoc(ref.path.split('#')[0]));
			const shown = url ? `[${ref.path}](${url})` : `\`${ref.path}\``;
			return `- ${shown}${ref.note ? ` — ${ref.note}` : ''} ${hostLinks(ref.path, false)}`;
		})
		.join('\n');
}

function pageRefLines(refs: RegRef[]): string {
	return refs
		.map((ref) => {
			const isDir = ref.kind === 'dir';
			const shown = isDir ? `\`${ref.path}/\`` : `\`${ref.path}\``;
			return `- ${shown}${ref.note ? ` — ${ref.note}` : ''} ${hostLinks(ref.path, isDir)}`;
		})
		.join('\n');
}

function pageProofLines(refs: RegRef[]): string {
	return refs
		.map((ref) => {
			// Both showcase routes and app routes are live URLs — link them; the note trails the link.
			const suffix = ref.kind === 'approute' ? ' (app route, no showcase)' : '';
			const note = ref.note ? ` — ${ref.note}` : '';
			return `- [\`${ref.path}\`](${ref.path})${suffix}${note}`;
		})
		.join('\n');
}

function bulletLines(items: string[]): string {
	return items.map((item) => `- ${item}`).join('\n');
}

/** One generated docs page per pattern record — pointers, never copied prose. */
export function renderPatternPage(pattern: PatternRecord, registry: Registry, opts: RenderOpts): string {
	const byId = new Map(registry.patterns.map((entry) => [entry.id, entry]));
	const sections: string[] = [
		'---',
		`title: ${JSON.stringify(pattern.title)}`,
		`description: ${JSON.stringify(frontmatterDescription(pattern.summary))}`,
		// The docs manifest reads this as the entry's group — it drives the
		// category grouping in /llms.txt and any grouped section listing.
		`category: ${JSON.stringify(categoryTitle(registry, pattern.category))}`,
		'---',
		'',
		`# ${pattern.title}`,
		'',
		GENERATED_NOTE,
		'',
	];
	if (pattern.tier === 'light') {
		sections.push(
			'_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._',
			'',
		);
	}
	sections.push(
		`**Category:** ${categoryTitle(registry, pattern.category)} · **Tier:** ${pattern.tier} · **Maturity:** ${pattern.maturity}${pattern.verifiedAt ? ` (verified ${pattern.verifiedAt}${pattern.verifiedSha ? ` @ ${pattern.verifiedSha}` : ''})` : ''} · **Risk:** ${pattern.risk}`,
		'',
		pattern.summary,
		'',
		`**When to use:** ${pattern.when_to_use}`,
		'',
		`## Docs`,
		'',
		pageDocsLines(pattern.docs, opts),
	);
	if (pattern.code.length > 0) {
		sections.push('', '## Code', '', pageRefLines(pattern.code));
	}
	if (pattern.tests.length > 0) {
		sections.push('', '## Tests', '', pageRefLines(pattern.tests));
	}
	if (pattern.showcases.length > 0) {
		sections.push('', '## Proof', '', pageProofLines(pattern.showcases));
	}
	if (pattern.tier === 'deep') {
		sections.push('', '## Invariants', '', bulletLines(pattern.invariants));
		sections.push('', '## Emulation notes', '', bulletLines(pattern.emulation_notes));
	}
	if (pattern.depends_on.length > 0) {
		const deps = pattern.depends_on.map((dep) => {
			const record = byId.get(dep);
			return `- [${record?.title ?? dep}](/${PATTERN_PAGES_DIR}/${dep})`;
		});
		sections.push('', '## Depends on', '', deps.join('\n'));
	}
	sections.push('', '---', '', `_Machine-readable record: \`${pattern.id}\` in \`mcp/patterns.registry.json\`._`, '');
	return sections.join('\n');
}

/** The docs/pattern-library/README.md navigation hub (README convention; doc-filter keeps any README out of the in-app manifest, so this is a GitHub-only surface). */
export function renderPatternsHub(registry: Registry): string {
	const deepCount = registry.patterns.filter((pattern) => pattern.tier === 'deep').length;
	const lines: string[] = [
		'# Pattern Library',
		'',
		GENERATED_NOTE,
		'',
		`One page per pattern record — ${registry.patterns.length} patterns (${deepCount} deep cards / ${registry.patterns.length - deepCount} index rows) across ${registry.categories.length} categories. Each page points to the docs that explain the pattern, the code that implements it, and the showcase that proves it; **bold** entries are deep-tier cards with invariants and emulation notes.`,
		'',
		'This README is the GitHub navigation hub; in-app, this directory is the Pattern Library docs section — the catalog lives at `/docs/pattern-library` and every page below at `/docs/pattern-library/<id>`.',
		'',
	];
	for (const category of registry.categories) {
		const patterns = patternsInCategory(registry, category.id);
		if (patterns.length === 0) continue;
		lines.push(`### ${category.title}`, '');
		for (const pattern of patterns) {
			const link =
				pattern.tier === 'deep'
					? `[**${pattern.title}**](./${pattern.id}.md)`
					: `[${pattern.title}](./${pattern.id}.md)`;
			lines.push(`- ${link}`);
		}
		lines.push('');
	}
	return lines.join('\n');
}
