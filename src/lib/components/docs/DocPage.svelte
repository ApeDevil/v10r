<script lang="ts">
import { BackLink, createScrollSpy, MarkdownProse, NavSection, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import type { DocEntry } from '$lib/docs/types';
import type { TocEntry } from '$lib/server/blog/types';

interface Breadcrumb {
	label: string;
	href?: string;
}

interface Props {
	// Root docs (ROOT_DOCS) have no manifest entry — they pass title/description
	// only, plus an explicit markdownHref, since their .md URL has no section.
	entry: Pick<DocEntry, 'title' | 'description'> & Partial<Pick<DocEntry, 'section' | 'slug'>>;
	html: string;
	toc: TocEntry[];
	breadcrumbs: Breadcrumb[];
	backHref: string;
	backLabel: string;
	sourceUrl?: string | null;
	/** Overrides the `/docs/<section>/<slug>.md` default alternate link. */
	markdownHref?: string;
}

let { entry, html, toc, breadcrumbs, backHref, backLabel, sourceUrl, markdownHref }: Props = $props();

const mdHref = $derived(
	markdownHref ?? (entry.section && entry.slug ? `/docs/${entry.section}/${entry.slug}.md` : null),
);

const navToc = $derived(toc.filter((t) => t.depth === 2 || t.depth === 3));

// Mobile chip bar carries top-level headings only — h3s would overflow it into noise.
const chipSections = $derived(toc.filter((t) => t.depth === 2).map((t) => ({ id: t.id, label: t.text })));

// The desktop aside highlights the heading currently in view. It tracks every entry
// it renders (h2 + h3), unlike the chip bar.
const spy = createScrollSpy(() => navToc.map((t) => t.id));

// Long TOCs scroll inside the sticky aside, so the active item can drift out of
// its visible window — nudge only the aside's own scrollTop (scrollIntoView would
// also yank the page, fighting the scroll the user is mid-way through).
let tocEl = $state<HTMLElement>();

$effect(() => {
	if (!spy.current || !tocEl) return;
	const active = tocEl.querySelector<HTMLElement>('li.active');
	if (!active) return;
	const top = active.offsetTop;
	const bottom = top + active.offsetHeight;
	if (top < tocEl.scrollTop) tocEl.scrollTop = top;
	else if (bottom > tocEl.scrollTop + tocEl.clientHeight) tocEl.scrollTop = bottom - tocEl.clientHeight;
});
</script>

<svelte:head>
	<meta name="description" content={entry.description} />
	{#if mdHref}
		<link rel="alternate" type="text/markdown" href={mdHref} />
	{/if}
</svelte:head>

<PageContainer width="wide">
	<PageHeader title={entry.title} description={entry.description} {breadcrumbs}>
		{#if sourceUrl}
			<a class="source-link" href={sourceUrl} target="_blank" rel="noopener">View source</a>
		{/if}
	</PageHeader>

	{#if chipSections.length > 0}
		<div class="toc-mobile">
			<NavSection sections={chipSections} ariaLabel="On this page" />
		</div>
	{/if}

	<div class="leaf-layout">
		<MarkdownProse {html} />

		{#if navToc.length > 0}
			<aside class="toc-desktop" aria-label="On this page" bind:this={tocEl}>
				<p class="toc-label">On this page</p>
				<ul>
					{#each navToc as item}
						<li data-depth={item.depth} class:active={spy.current === item.id}>
							<a href={`#${item.id}`} aria-current={spy.current === item.id ? 'true' : undefined}>
								{item.text}
							</a>
						</li>
					{/each}
				</ul>
			</aside>
		{/if}
	</div>

	<BackLink href={backHref} label={backLabel} />
</PageContainer>

<style>
	.source-link {
		font-size: var(--text-xs);
		color: var(--color-muted);
		text-decoration: none;
	}
	.source-link:hover {
		color: var(--color-fg);
	}

	.leaf-layout {
		display: block;
		margin-bottom: var(--spacing-7);
	}

	/* Mobile: the sticky NavSection chip bar replaces the old <details> accordion —
	   it stays reachable while scrolling and marks the heading currently in view. */
	.toc-mobile {
		margin-bottom: var(--spacing-6);
	}

	.toc-desktop ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.toc-desktop li[data-depth='3'] a {
		padding-left: var(--spacing-4);
	}
	.toc-desktop a {
		display: block;
		color: var(--color-muted);
		text-decoration: none;
		transition: color var(--duration-fast);
		/* Path-bearing headings ("… (src/lib/components/index.ts)") have no break
		   points and would force a horizontal scrollbar in the 14rem column. */
		overflow-wrap: anywhere;
	}
	.toc-desktop a:hover {
		color: var(--color-primary);
	}
	.toc-desktop li.active > a {
		color: var(--color-primary);
		font-weight: 500;
	}

	.toc-desktop {
		display: none;
	}

	@media (min-width: 900px) {
		.toc-mobile {
			display: none;
		}
		.leaf-layout {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 14rem;
			gap: var(--spacing-7);
			align-items: start;
		}
		.toc-desktop {
			display: block;
			position: sticky;
			top: var(--spacing-6);
			font-size: var(--text-sm);
			/* Long TOCs (system-abstraction has ~30 entries) must scroll inside the
			   sticky box, not bleed past the viewport; contain keeps a wheel at the
			   list's end from yanking the page. */
			max-height: calc(100dvh - 2 * var(--spacing-6));
			overflow-y: auto;
			overflow-x: hidden;
			overscroll-behavior: contain;
		}
		.toc-desktop .toc-label {
			font-size: var(--text-xs);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--color-muted);
			margin: 0 0 var(--spacing-3);
		}
		.toc-desktop ul {
			display: flex;
			flex-direction: column;
		}
		/* Rail lives on each row, not the list, so the active row can light its own
		   segment. Padding (not gap) keeps the line continuous between rows. */
		.toc-desktop li {
			border-left: 1px solid var(--color-border);
			padding: var(--spacing-2) 0 var(--spacing-2) var(--spacing-4);
			transition: border-color var(--duration-fast);
		}
		.toc-desktop li.active {
			border-left-color: var(--color-primary);
		}
	}
</style>
