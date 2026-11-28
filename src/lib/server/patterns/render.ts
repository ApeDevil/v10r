/**
 * Pure renderers for the pattern library's generated surfaces: the README
 * Pattern Index region, the per-pattern pages under docs/pattern-library/
 * (its own top-level docs section), and that directory's README hub. One
 * registry in, deterministic markdown out. The section's index page at
 * /docs/pattern-library is a live route (see catalog.ts), not markdown.
 *
 * Vite-free leaf (no `#lib`, no `$app/env`, no `import.meta`): the Bun build script
 * (`scripts/patterns/build-derived.ts`) imports this by relative path, the same
 * contract `doc-filter.ts` and `retrieval/plan.ts` follow. All I/O — reading the
 * registry, checking doc publication, writing files — belongs to the script;
 * `RenderOpts.isPublishedDoc` injects the one predicate the renderers need.
 */
import { needsSummary } from '#patterns/infrastructure-needs.ts';
import { graphOf } from '#patterns/pattern-graph.ts';
import { ADOPTION_SEMANTICS } from '#patterns/schema.ts';
import { headingAnchors } from '../../docs/heading-anchors.server';
import type { PatternRecord, Registry, RegRef } from './registry';

export interface RenderOpts {
	/** True when a repo-relative docs path is published (not blocked, not draft). */
	isPublishedDoc(path: string): boolean;
}

/**
 * Where the generated per-pattern pages live, repo-relative. The directory IS
 * the `pattern-library` docs section: pages surface at /docs/pattern-library/<id>
 * (flat slug = registry id) and flow into /llms.txt and retrieval ingest automatically.
 */
export const PATTERN_PAGES_DIR = 'docs/pattern-library';

export const README_MARKER_START =
	'<!-- PATTERN-INDEX:START — generated from pattern-library/registry.json by scripts/patterns/build-derived.ts; do not edit (bun run patterns:build) -->';
export const README_MARKER_END = '<!-- PATTERN-INDEX:END -->';

const GENERATED_NOTE =
	'> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.';

/**
 * The anchor a heading renders to ("A & B" → "a--b"), for the TOC links. GitHub and the docs
 * renderer both slug with github-slugger; `headingAnchors` is the one place that runs it.
 */
export function anchorFor(title: string): string {
	return [...headingAnchors(`# ${title}`)][0] ?? '';
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
	return clipAtWord(summary, 160);
}

/**
 * One collapsed line of at most `max` characters, cut at a word boundary (unless that
 * would drop more than ~40% of the budget) and closed with an ellipsis when cut.
 */
export function clipAtWord(input: string, max: number): string {
	const text = collapse(input);
	if (text.length <= max) return text;
	const slice = text.slice(0, max - 1);
	const lastSpace = slice.lastIndexOf(' ');
	return `${(lastSpace > Math.round(max * 0.625) ? slice.slice(0, lastSpace) : slice).replace(/[,;:—–-]\s*$/, '')}…`;
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
	// Exception badge: only non-pattern kinds and non-proven rows are marked, so the table stays
	// quiet for the proven-pattern majority instead of growing a fifth column.
	const marks = [
		pattern.kind === 'pattern' ? '' : pattern.kind,
		pattern.maturity === 'proven' ? '' : pattern.maturity,
	].filter((mark) => mark.length > 0);
	const badge = marks.length > 0 ? ` _(${marks.join(', ')})_` : '';
	// The index is the surface agents actually load (research: on-demand MCP lookups are
	// rarely made), so the deep rows carry their headline contraindication inline.
	const avoid =
		pattern.tier === 'deep' && pattern.avoid_when.length > 0 ? `<br>_Avoid when:_ ${pattern.avoid_when[0]}` : '';
	return `| ${title}${badge}${avoid} | ${readmeDocsCell(pattern.docs)} | ${readmeCodeCell(pattern.code)} | ${readmeShowcaseCell(pattern.showcases)} |`;
}

/** The full marker-delimited README region, markers included. */
export function renderReadmeIndex(registry: Registry): string {
	const lines: string[] = [README_MARKER_START, ''];
	lines.push(
		'> **Bold** patterns are deep-tier: their pages carry invariants and emulation notes; the rest are index',
		'> rows pointing at docs, code, and proof. Showcase routes live on disk under',
		'> `src/routes/[[locale=locale]]/(public)/showcases/` — append the route path shown. Routes in parentheses,',
		'> like (`/admin/db`), mean there is no showcase; the pattern is live at that app route.',
		'> Unmarked rows are **proven** (a linked test or showcase, verified at a recorded date); _(implemented)_',
		'> means the code exists but no proof surface is linked yet, _(planned)_ that it is design-only.',
		'> Each deep row ends with its headline *Avoid when* — the first reason not to adopt it; the page lists the rest.',
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

/**
 * How a pattern body links out. The docs site resolves published docs to in-app URLs and
 * links showcases and dependencies inside the app; a portable copy (an agent skill
 * reference, read outside this repo and outside the app) can only link the source hosts
 * and the production site. The sections and their order are the same for both — one body,
 * two link styles — so an agent skill reference cannot drift from the docs page it mirrors.
 */
interface PatternLinkStyle {
	docsLines(refs: RegRef[]): string;
	proofLines(refs: RegRef[]): string;
	dependencyHref(id: string): string;
}

/** The production site, where showcase routes are live for a reader outside the app. */
const SITE_ORIGIN = 'https://www.v10r.dev';

function portableProofLines(refs: RegRef[]): string {
	return refs
		.map((ref) => {
			const note = ref.note ? ` — ${ref.note}` : '';
			if (ref.kind === 'approute') return `- \`${ref.path}\` (app route, no showcase)${note}`;
			return `- [\`${ref.path}\`](${SITE_ORIGIN}${ref.path})${note}`;
		})
		.join('\n');
}

/** The canonical GitHub view of a pattern's generated docs page — the link a portable copy can follow. */
export function patternPageSourceUrl(id: string): string {
	return `${REPO_GITHUB}/blob/main/${PATTERN_PAGES_DIR}/${id}.md`;
}

/** One generated docs page per pattern record — pointers, never copied prose. */
export function renderPatternPage(pattern: PatternRecord, registry: Registry, opts: RenderOpts): string {
	const links: PatternLinkStyle = {
		docsLines: (refs) => pageDocsLines(refs, opts),
		proofLines: pageProofLines,
		dependencyHref: (id) => `/${PATTERN_PAGES_DIR}/${id}`,
	};
	return [
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
		...patternBody(pattern, registry, links),
	].join('\n');
}

/**
 * The same record as a portable reference file (an agent skill's `references/<id>.md`):
 * no docs frontmatter (it is not a docs page), source-host and production-site links only.
 * `dependencyHref` decides where a relationship link goes — a sibling reference when the
 * related record ships in the same agent skill, its GitHub page otherwise.
 */
export function renderPatternReference(
	pattern: PatternRecord,
	registry: Registry,
	generatedNote: string,
	dependencyHref: (id: string) => string,
): string {
	const links: PatternLinkStyle = { docsLines: pageRefLines, proofLines: portableProofLines, dependencyHref };
	return [`# ${pattern.title}`, '', generatedNote, '', ...patternBody(pattern, registry, links)].join('\n');
}

/**
 * A record's relationships with their rationale, then the derived inverses. Each label says what
 * the relationship does to an adopter, so a reader never has to know the field names.
 */
function relationshipSections(
	pattern: PatternRecord,
	graph: ReturnType<typeof graphOf>,
	link: (id: string) => string,
): string[] {
	const lines: string[] = [];
	const block = (title: string, items: string[]) => {
		if (items.length > 0) lines.push(`**${title}**`, '', items.join('\n'), '');
	};
	block(
		'Builds on (must be available; the target’s own equivalent satisfies it)',
		pattern.builds_on.map((entry) => `- ${link(entry.id)} — ${entry.why}`),
	);
	block(
		'Composes (constituents of its solution)',
		pattern.composes.map(
			(entry) => `- ${link(entry.id)} — ${entry.level}${entry.when ? ` when ${entry.when}` : ''}: ${entry.why}`,
		),
	);
	block(
		'Specializes (its invariants hold here; it is never built twice)',
		pattern.specializes ? [`- ${link(pattern.specializes.id)} — ${pattern.specializes.why}`] : [],
	);
	block(
		'References (context only, never a step)',
		pattern.references.map((entry) => `- ${link(entry.id)} — ${entry.why}`),
	);
	const assumptions = graph.assumptionsFor(pattern.id);
	block(
		'Applies (principles to review the work against)',
		assumptions
			.filter((entry) => graph.byId.get(entry.id)?.kind === 'principle')
			.map((entry) => `- ${link(entry.id)} — ${entry.why}`),
	);
	block(
		'Assumes (platform conventions in scope)',
		assumptions
			.filter((entry) => graph.byId.get(entry.id)?.kind !== 'principle')
			.map((entry) => `- ${link(entry.id)} — ${entry.why}`),
	);
	const inverse = (type: 'builds_on' | 'composes' | 'specializes' | 'references') =>
		graph.edgesTo(pattern.id, type).map((edge) => `- ${link(edge.from)}${edge.level ? ` (${edge.level})` : ''}`);
	block('Part of', inverse('composes'));
	block('Built on by', inverse('builds_on'));
	block('Specialized by', inverse('specializes'));
	block('Referenced by', inverse('references'));
	return lines;
}

/** Light-tier notice through the record footer: every field the record carries, in page order. */
function patternBody(pattern: PatternRecord, registry: Registry, links: PatternLinkStyle): string[] {
	const graph = graphOf(registry);
	const byId = graph.byId;
	const sections: string[] = [];
	if (pattern.tier === 'light') {
		sections.push(
			'_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._',
			'',
		);
	}
	sections.push(
		`**Kind:** ${pattern.kind} — ${ADOPTION_SEMANTICS[pattern.kind]}`,
		'',
		`**Category:** ${categoryTitle(registry, pattern.category)} · **Tier:** ${pattern.tier} · **Maturity:** ${pattern.maturity}${pattern.verifiedAt ? ` (verified ${pattern.verifiedAt}${pattern.verifiedSha ? ` @ ${pattern.verifiedSha}` : ''})` : ''} · **Risk:** ${pattern.risk}`,
		'',
		pattern.summary,
		'',
		`**When to use:** ${pattern.when_to_use}`,
		'',
	);
	const link = (id: string) => `[${byId.get(id)?.title ?? id}](${links.dependencyHref(id)})`;
	const needs = graph.needs(pattern.id);
	if (needs.length > 0) {
		sections.push(`**Needs:** ${needsSummary(needs, { condition: true })}`, '');
	}
	if (pattern.avoid_when.length > 0) {
		sections.push('## Avoid when', '', bulletLines(pattern.avoid_when), '');
	}
	if (pattern.alternatives.length > 0) {
		sections.push(
			'## Alternatives',
			'',
			bulletLines(pattern.alternatives.map((alt) => `**${alt.approach}** — prefer when ${alt.prefer_when}`)),
			'',
		);
	}
	sections.push(`## Docs`, '', links.docsLines(pattern.docs));
	if (pattern.code.length > 0) {
		sections.push('', '## Code', '', pageRefLines(pattern.code));
	}
	if (pattern.tests.length > 0) {
		sections.push('', '## Tests', '', pageRefLines(pattern.tests));
	}
	if (pattern.showcases.length > 0) {
		sections.push('', '## Proof', '', links.proofLines(pattern.showcases));
	}
	const inherited = graph.inheritedInvariants(pattern.id);
	if (pattern.tier === 'deep' || inherited.length > 0) {
		sections.push('', '## Invariants', '');
		if (pattern.invariants.length > 0) sections.push(bulletLines(pattern.invariants));
		for (const entry of inherited) {
			sections.push('', `Inherited from ${link(entry.from)} (specializes):`, '', bulletLines(entry.invariants));
		}
	}
	if (pattern.tier === 'deep') {
		sections.push('', '## Emulation notes', '', bulletLines(pattern.emulation_notes));
	}
	const relationships = relationshipSections(pattern, graph, link);
	if (relationships.length > 0) sections.push('', '## Relationships', '', ...relationships);
	sections.push(
		'',
		'---',
		'',
		`_Machine-readable record: \`${pattern.id}\` in \`pattern-library/registry.json\`._`,
		'',
	);
	return sections;
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
