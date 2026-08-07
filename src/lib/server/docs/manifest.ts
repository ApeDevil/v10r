import { type DocEntry, type DocSection, type DocsManifest, STACK_LAYER_ORDER } from '$lib/docs/types';
import { deriveTitle, isBlocked, parseFrontmatter, slugify } from './doc-filter';

const rawModules = import.meta.glob('/docs/**/*.md', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

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

function buildEntry(absPath: string, raw: string): DocEntry | null {
	const sourcePath = absPath.replace(/^\//, '');
	if (!sourcePath.startsWith('docs/')) return null;
	if (isBlocked(sourcePath)) return null;

	const parts = sourcePath.split('/');
	const sectionDir = parts[1];
	const section: DocSection | null =
		sectionDir === 'foundation'
			? 'foundation'
			: sectionDir === 'blueprint'
				? 'blueprint'
				: sectionDir === 'stack'
					? 'stack'
					: sectionDir === 'pattern-library'
						? 'pattern-library'
						: null;
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
	} else if (section === 'pattern-library') {
		// Generated pattern pages: flat slug (= registry id); the generator stamps
		// the category title into frontmatter, which becomes the grouping key.
		slug = slugify(fileBase);
		group = typeof frontmatter.category === 'string' ? frontmatter.category : undefined;
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
	const patternLibrary: DocEntry[] = [];

	for (const [absPath, raw] of Object.entries(rawModules)) {
		const entry = buildEntry(absPath, raw);
		if (!entry) continue;
		if (entry.section === 'foundation') foundation.push(entry);
		else if (entry.section === 'blueprint') blueprint.push(entry);
		else if (entry.section === 'pattern-library') patternLibrary.push(entry);
		else stack.push(entry);
	}

	// Uniqueness: flat-slug sections must be collision-free
	const stackSlugs = new Set<string>();
	for (const e of stack) {
		if (stackSlugs.has(e.slug)) {
			throw new Error(`[docs/manifest] duplicate stack slug: ${e.slug} (${e.sourcePath})`);
		}
		stackSlugs.add(e.slug);
	}
	const patternSlugs = new Set<string>();
	for (const e of patternLibrary) {
		if (patternSlugs.has(e.slug)) {
			throw new Error(`[docs/manifest] duplicate pattern-library slug: ${e.slug} (${e.sourcePath})`);
		}
		patternSlugs.add(e.slug);
	}

	const layerIdx = (l?: string) => {
		const i = STACK_LAYER_ORDER.indexOf(l as (typeof STACK_LAYER_ORDER)[number]);
		return i === -1 ? STACK_LAYER_ORDER.length : i;
	};

	foundation.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title));
	stack.sort(
		(a, b) =>
			layerIdx(a.layer) - layerIdx(b.layer) || (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title),
	);
	blueprint.sort(
		(a, b) =>
			(a.group ?? '').localeCompare(b.group ?? '') || (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title),
	);
	patternLibrary.sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.title.localeCompare(b.title));

	return { foundation, blueprint, stack, 'pattern-library': patternLibrary };
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
