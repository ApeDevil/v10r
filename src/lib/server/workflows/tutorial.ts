import type { Locale } from '#lib/i18n/index.ts';
import { renderBlogPost, type TocEntry } from '#lib/server/blog/index.ts';
import { findWorkflow, type WorkflowCard } from '#lib/workflows/catalog.ts';

/**
 * Workflow tutorials are markdown files at `content/workflows/<category>/<slug>/<locale>.md`,
 * bundled at build time like the docs. The catalog decides which ones exist; a file
 * without a catalog entry is never served. A locale without its own file falls back to
 * English.
 */
const tutorialSources = import.meta.glob('/content/workflows/*/*/*.md', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

export interface RenderedWorkflowTutorial {
	card: WorkflowCard;
	locale: Locale;
	html: string;
	toc: TocEntry[];
}

export function tutorialSourcePath(card: WorkflowCard, locale: Locale): string {
	return `/content/workflows/${card.category}/${card.slug}/${locale}.md`;
}

// Rendering is a pure function of a build-frozen file, so warm instances reuse it.
// Skipped in dev so edits to a tutorial show on reload.
const renderCache = new Map<string, RenderedWorkflowTutorial>();

export async function renderWorkflowTutorial(slug: string, locale: Locale): Promise<RenderedWorkflowTutorial | null> {
	const card = findWorkflow(slug);
	if (!card) return null;

	const sourceLocale: Locale = tutorialSources[tutorialSourcePath(card, locale)] === undefined ? 'en' : locale;
	const cacheKey = `${slug}:${sourceLocale}`;
	const cached = import.meta.env.PROD ? renderCache.get(cacheKey) : undefined;
	if (cached) return cached;

	const raw = tutorialSources[tutorialSourcePath(card, sourceLocale)];
	if (raw === undefined) return null;

	// The page header shows the catalog title, so the file's own H1 is dropped.
	const result = await renderBlogPost(raw.replace(/^\s*#\s+.+\n+/, ''));
	const rendered: RenderedWorkflowTutorial = { card, locale: sourceLocale, html: result.html, toc: result.toc };
	if (import.meta.env.PROD) renderCache.set(cacheKey, rendered);
	return rendered;
}
