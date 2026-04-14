import { parse as parseYaml } from 'yaml';
import {
	type DocEntry,
	type DocSection,
	type DocsManifest,
	STACK_LAYER_ORDER,
} from '$lib/docs/types';

const rawModules = import.meta.glob('/docs/**/*.md', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

const BLOCKLIST = new Set([
	'docs/blueprint/blog.md',
	'docs/blueprint/style-randomizer.md',
	'docs/blueprint/style-randomizer-v2.md',
	'docs/blueprint/style-randomizer-implementation-plan.md',
	'docs/blueprint/color-differentiation-plan.md',
	'docs/blueprint/visual-identity-architecture.md',
	'docs/blueprint/admin-expansion.md',
	'docs/stack/vendors.md',
]);

const BLOCKED_PREFIXES = ['docs/guides/', 'docs/blueprint/desk/', 'docs/blueprint/design/'];

interface ParsedFile {
	frontmatter: Record<string, unknown>;
	body: string;
}

function parseFrontmatter(raw: string): ParsedFile {
	if (!raw.startsWith('---\n')) {
		return { frontmatter: {}, body: raw };
	}
	const end = raw.indexOf('\n---', 4);
	if (end === -1) return { frontmatter: {}, body: raw };
	const yamlBlock = raw.slice(4, end);
	const body = raw.slice(end + 4).replace(/^\n/, '');
	try {
		const fm = parseYaml(yamlBlock) as Record<string, unknown> | null;
		return { frontmatter: fm ?? {}, body };
	} catch {
		return { frontmatter: {}, body: raw };
	}
}

function deriveTitle(body: string): string | null {
	for (const line of body.split('\n')) {
		const m = /^#\s+(.+)$/.exec(line.trim());
		if (m) return m[1].trim();
	}
	return null;
}

function deriveDescription(body: string): string {
	const lines = body.split('\n');
	let inFirstParagraph = false;
	const buf: string[] = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (!inFirstParagraph) {
			if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('---')) continue;
			inFirstParagraph = true;
		} else if (!trimmed) {
			break;
		}
		buf.push(trimmed);
	}
	const text = buf
		.join(' ')
		.replace(/\*\*(.+?)\*\*/g, '$1')
		.replace(/\*(.+?)\*/g, '$1')
		.replace(/`(.+?)`/g, '$1')
		.replace(/\[(.+?)\]\([^)]+\)/g, '$1')
		.replace(/\s+/g, ' ')
		.trim();
	if (text.length <= 180) return text;
	// Prefer the first sentence, or the first two sentences if the first is very short.
	const firstEnd = text.search(/[.!?](\s|$)/);
	if (firstEnd !== -1 && firstEnd <= 180) {
		if (firstEnd >= 60) return text.slice(0, firstEnd + 1);
		const rest = text.slice(firstEnd + 1).trimStart();
		const secondEnd = rest.search(/[.!?](\s|$)/);
		if (secondEnd !== -1 && firstEnd + 2 + secondEnd <= 180) {
			return `${text.slice(0, firstEnd + 1)} ${rest.slice(0, secondEnd + 1)}`;
		}
		return text.slice(0, firstEnd + 1);
	}
	// Fall back to word-boundary truncation.
	const slice = text.slice(0, 180);
	const lastSpace = slice.lastIndexOf(' ');
	const cut = lastSpace > 120 ? slice.slice(0, lastSpace) : slice;
	return `${cut.replace(/[,;:—–-]\s*$/, '')}…`;
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

function isBlocked(sourcePath: string): boolean {
	if (BLOCKLIST.has(sourcePath)) return true;
	if (sourcePath.endsWith('/README.md')) return true;
	for (const p of BLOCKED_PREFIXES) if (sourcePath.startsWith(p)) return true;
	return false;
}

function buildEntry(absPath: string, raw: string): DocEntry | null {
	const sourcePath = absPath.replace(/^\//, '');
	if (!sourcePath.startsWith('docs/')) return null;
	if (isBlocked(sourcePath)) return null;

	const parts = sourcePath.split('/');
	const sectionDir = parts[1];
	const section: DocSection | null =
		sectionDir === 'foundation' ? 'foundation' : sectionDir === 'blueprint' ? 'blueprint' : sectionDir === 'stack' ? 'stack' : null;
	if (!section) return null;

	const { frontmatter, body } = parseFrontmatter(raw);

	const publishedRaw = frontmatter.published;
	const draftRaw = frontmatter.draft;
	if (publishedRaw === false || draftRaw === true) return null;

	const fmTitle = typeof frontmatter.title === 'string' ? frontmatter.title : null;
	const title = fmTitle ?? deriveTitle(body);
	if (!title) {
		console.warn(`[docs/manifest] skipping ${sourcePath}: no title (frontmatter.title or # H1)`);
		return null;
	}

	const fmDesc = typeof frontmatter.description === 'string' ? frontmatter.description : null;
	const description = fmDesc ?? deriveDescription(body);

	const order = typeof frontmatter.order === 'number' ? frontmatter.order : undefined;

	const fileBase = parts[parts.length - 1].replace(/\.md$/, '');
	let slug: string;
	let layer: string | undefined;
	let group: string | undefined;

	if (section === 'stack') {
		slug = slugify(fileBase);
		layer = parts.length >= 4 ? parts[2] : undefined;
	} else if (section === 'blueprint') {
		const sub = parts.slice(2).join('/').replace(/\.md$/, '');
		slug = sub;
		group = parts.length >= 4 ? parts[2] : 'general';
	} else {
		slug = slugify(fileBase);
	}

	return {
		section,
		slug,
		title,
		description,
		sourcePath,
		layer,
		group,
		order,
		published: true,
	};
}

function buildManifest(): DocsManifest {
	const foundation: DocEntry[] = [];
	const blueprint: DocEntry[] = [];
	const stack: DocEntry[] = [];

	for (const [absPath, raw] of Object.entries(rawModules)) {
		const entry = buildEntry(absPath, raw);
		if (!entry) continue;
		if (entry.section === 'foundation') foundation.push(entry);
		else if (entry.section === 'blueprint') blueprint.push(entry);
		else stack.push(entry);
	}

	// Uniqueness: stack slugs must be globally unique
	const stackSlugs = new Set<string>();
	for (const e of stack) {
		if (stackSlugs.has(e.slug)) {
			throw new Error(`[docs/manifest] duplicate stack slug: ${e.slug} (${e.sourcePath})`);
		}
		stackSlugs.add(e.slug);
	}

	const layerIdx = (l?: string) => {
		const i = STACK_LAYER_ORDER.indexOf(l as (typeof STACK_LAYER_ORDER)[number]);
		return i === -1 ? STACK_LAYER_ORDER.length : i;
	};

	foundation.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title));
	stack.sort(
		(a, b) =>
			layerIdx(a.layer) - layerIdx(b.layer) ||
			(a.order ?? 0) - (b.order ?? 0) ||
			a.title.localeCompare(b.title),
	);
	blueprint.sort(
		(a, b) =>
			(a.group ?? '').localeCompare(b.group ?? '') ||
			(a.order ?? 0) - (b.order ?? 0) ||
			a.title.localeCompare(b.title),
	);

	return { foundation, blueprint, stack };
}

let cached: DocsManifest | null = null;

export function getManifest(): DocsManifest {
	if (!cached) cached = buildManifest();
	return cached;
}

export function getEntry(section: DocSection, slug: string): DocEntry | null {
	const list = getManifest()[section];
	return list.find((e) => e.slug === slug) ?? null;
}

export function getRawMarkdown(sourcePath: string): string | null {
	const abs = `/${sourcePath}`;
	return rawModules[abs] ?? null;
}
