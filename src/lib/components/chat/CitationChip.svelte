<script lang="ts">
/**
 * Citation chip — a grounded link to a real project surface (page, showcase/
 * component, doc section, blog post) the chatbot referenced. The href is built
 * from the catalog's exact path (never model-generated), so the bot can only
 * link to surfaces that actually exist. Native `<a>` so middle-click / open-in-
 * new-tab / screen-reader navigation all work. EN badge mirrors the ⌘K palette's
 * locale-fallback signal (WCAG 3.1.2); icon + text surface tag give a non-color
 * provenance cue (WCAG 1.4.1). Copy (surface labels, EN tooltip) is provisional —
 * CONY to localize en/de/ru.
 */
import { localizeHref } from '$lib/i18n';
import { cn } from '$lib/utils/cn';

type Surface = 'page' | 'showcase' | 'section' | 'doc' | 'blog';

interface Props {
	surface: Surface;
	title: string;
	/** Locale-bare catalog path; localized here via `localizeHref`. */
	path: string;
	anchor?: string | null;
	breadcrumb?: string[];
	/** UnoCSS icon class, e.g. `i-lucide-book-open`. */
	icon?: string;
	/** `'en-fallback'` → render an EN badge (content is English for a de/ru reader). */
	badge?: 'en-fallback' | null;
}

let { surface, title, path, anchor = null, breadcrumb = [], icon, badge = null }: Props = $props();

const SURFACE_LABEL: Record<Surface, string> = {
	page: 'Page',
	showcase: 'Showcase',
	section: 'Section',
	doc: 'Doc',
	blog: 'Blog',
};

const href = $derived(localizeHref(path) + (anchor ?? ''));
const surfaceLabel = $derived(SURFACE_LABEL[surface] ?? surface);
const trail = $derived(breadcrumb.length ? breadcrumb.join(' / ') : '');
const ariaLabel = $derived(
	`${surfaceLabel}: ${title}${trail ? `, ${trail}` : ''}${badge === 'en-fallback' ? ', English content' : ''}`,
);
</script>

<a {href} class="citation-chip" aria-label={ariaLabel}>
	<span class={cn(icon ?? 'i-lucide-link', 'chip-icon')} aria-hidden="true"></span>
	<span class="chip-title">{title}</span>
	<span class="chip-surface">{surfaceLabel}</span>
	{#if badge === 'en-fallback'}
		<span class="chip-en" title="Content is in English">EN</span>
	{/if}
</a>

<style>
	.citation-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		min-height: 44px;
		max-width: 100%;
		padding: 0.25rem 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background-color: color-mix(in srgb, var(--color-muted) 8%, transparent);
		color: var(--color-fg);
		text-decoration: none;
		font-size: 0.8125rem;
		line-height: 1.2;
		transition: background-color 120ms ease;
	}
	.citation-chip:hover {
		background-color: color-mix(in srgb, var(--color-muted) 16%, transparent);
	}
	.citation-chip:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
	.chip-icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		color: var(--color-primary);
	}
	.chip-title {
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chip-surface {
		flex-shrink: 0;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--color-muted);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 0.05rem 0.3rem;
	}
	.chip-en {
		flex-shrink: 0;
		font-size: 0.625rem;
		font-weight: 700;
		color: var(--color-primary);
		border: 1px solid var(--color-primary);
		border-radius: 4px;
		padding: 0.02rem 0.25rem;
	}
</style>
