<script lang="ts">
import Renderer from '$lib/components/blog/Renderer.svelte';
import { BackLink, createScrollSpy, NavSection, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import type { DocEntry } from '$lib/docs/types';
import type { TocEntry } from '$lib/server/blog/types';

interface Breadcrumb {
	label: string;
	href?: string;
}

interface Props {
	entry: DocEntry;
	html: string;
	toc: TocEntry[];
	breadcrumbs: Breadcrumb[];
	backHref: string;
	backLabel: string;
	sourceUrl?: string | null;
}

let { entry, html, toc, breadcrumbs, backHref, backLabel, sourceUrl }: Props = $props();

const navToc = $derived(toc.filter((t) => t.depth === 2 || t.depth === 3));

// Mobile chip bar carries top-level headings only — h3s would overflow it into noise.
const chipSections = $derived(toc.filter((t) => t.depth === 2).map((t) => ({ id: t.id, label: t.text })));

// The desktop aside highlights the heading currently in view. It tracks every entry
// it renders (h2 + h3), unlike the chip bar.
const spy = createScrollSpy(() => navToc.map((t) => t.id));
</script>

<svelte:head>
	<meta name="description" content={entry.description} />
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
		<Renderer {html} />

		{#if navToc.length > 0}
			<aside class="toc-desktop" aria-label="On this page">
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
