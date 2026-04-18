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

export async function renderDoc(section: DocSection, slug: string): Promise<RenderedDoc | null> {
	const entry = getEntry(section, slug);
	if (!entry) return null;
	const raw = getRawMarkdown(entry.sourcePath);
	if (raw === null) return null;

	// Strip the leading "# Title" line if we derived title from it — avoids double rendering
	// since DocLeaf displays the title via PageHeader already.
	const stripped = raw.replace(/^\s*#\s+.+\n+/, '');
	const result = await renderBlogPost(stripped);
	return { entry, html: result.html, toc: result.toc };
}

export function docsSourceUrl(sourcePath: string): string | null {
	const base = env.PUBLIC_DOCS_SOURCE_BASE;
	if (!base) return null;
	return `${base.replace(/\/$/, '')}/${sourcePath}`;
}
