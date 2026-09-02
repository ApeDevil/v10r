import { env } from '$env/dynamic/public';
import type { DocEntry, DocSection } from '$lib/docs/types';
import { renderBlogPost } from '$lib/server/blog/pipeline';
import type { TocEntry } from '$lib/server/blog/types';
import { getEntry, getManifest, getRawMarkdown } from './manifest';
import { ROOT_DOCS, type RootDoc } from './markdown-urls';

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
	// since DocPage displays the title via PageHeader already.
	const stripped = raw.replace(/^\s*#\s+.+\n+/, '');
	const result = await renderBlogPost(stripped);
	const rendered: RenderedDoc = { entry, html: result.html, toc: result.toc };
	if (import.meta.env.PROD) renderCache.set(entry.sourcePath, rendered);
	return rendered;
}

export interface RenderedRootDoc {
	doc: RootDoc;
	html: string;
	toc: TocEntry[];
}

const rootRenderCache = new Map<string, RenderedRootDoc>();

/**
 * The two repo-root entry-point docs (ROOT_DOCS) sit outside the manifest —
 * buildEntry can't hold them — but they still deserve rendered HTML pages at
 * /docs/<slug>, or every human-facing link lands on the raw `.md` layer.
 * Same pipeline, same H1 strip, same memoization as renderDoc.
 */
export async function renderRootDoc(slug: string): Promise<RenderedRootDoc | null> {
	const doc = ROOT_DOCS.find((entry) => entry.slug === slug);
	if (!doc) return null;

	const cached = import.meta.env.PROD ? rootRenderCache.get(doc.sourcePath) : undefined;
	if (cached) return cached;

	const raw = getRawMarkdown(doc.sourcePath);
	if (raw === null) return null;

	const stripped = raw.replace(/^\s*#\s+.+\n+/, '');
	const result = await renderBlogPost(stripped);
	const rendered: RenderedRootDoc = { doc, html: result.html, toc: result.toc };
	if (import.meta.env.PROD) rootRenderCache.set(doc.sourcePath, rendered);
	return rendered;
}

export function docsSourceUrl(sourcePath: string): string | null {
	const base = env.PUBLIC_DOCS_SOURCE_BASE;
	if (!base) return null;
	return `${base.replace(/\/$/, '')}/${sourcePath}`;
}
