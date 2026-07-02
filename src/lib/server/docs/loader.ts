import { env } from '$env/dynamic/public';
import type { DocEntry, DocSection } from '$lib/docs/types';
import { renderBlogPost } from '$lib/server/blog/pipeline';
import type { TocEntry } from '$lib/server/blog/types';
import { getEntry, getManifest, getRawMarkdown } from './manifest';

export { getManifest, getEntry };

export interface RenderedDoc {
	entry: DocEntry;
	html: string;
	toc: TocEntry[];
}

// Rendered docs are a pure function of the source markdown, which is bundled and
// build-frozen (import.meta.glob) — the heavy Shiki+remark pipeline produces
// byte-identical, visitor-independent HTML on every request. Memoize per source
// path so warm instances skip the pipeline entirely. Bounded by the doc count.
// Skipped in dev (import.meta.env.PROD === false) so live doc edits still render.
const renderCache = new Map<string, RenderedDoc>();

export async function renderDoc(section: DocSection, slug: string): Promise<RenderedDoc | null> {
	const entry = getEntry(section, slug);
	if (!entry) return null;

	const cached = import.meta.env.PROD ? renderCache.get(entry.sourcePath) : undefined;
	if (cached) return cached;

	const raw = getRawMarkdown(entry.sourcePath);
	if (raw === null) return null;

	// Strip the leading "# Title" line if we derived title from it — avoids double rendering
	// since DocLeaf displays the title via PageHeader already.
	const stripped = raw.replace(/^\s*#\s+.+\n+/, '');
	const result = await renderBlogPost(stripped);
	const rendered: RenderedDoc = { entry, html: result.html, toc: result.toc };
	if (import.meta.env.PROD) renderCache.set(entry.sourcePath, rendered);
	return rendered;
}

export function docsSourceUrl(sourcePath: string): string | null {
	const base = env.PUBLIC_DOCS_SOURCE_BASE;
	if (!base) return null;
	return `${base.replace(/\/$/, '')}/${sourcePath}`;
}
