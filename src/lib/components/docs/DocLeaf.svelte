<script lang="ts">
import Renderer from '$lib/components/blog/Renderer.svelte';
import { BackLink, PageHeader } from '$lib/components/composites';
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

	{#if navToc.length > 0}
		<details class="toc-mobile">
			<summary>On this page</summary>
			<ul>
				{#each navToc as item}
					<li data-depth={item.depth}>
						<a href={`#${item.id}`}>{item.text}</a>
					</li>
				{/each}
			</ul>
		</details>
	{/if}

	<div class="leaf-layout">
		<Renderer {html} />

		{#if navToc.length > 0}
			<aside class="toc-desktop" aria-label="On this page">
				<p class="toc-label">On this page</p>
				<ul>
					{#each navToc as item}
						<li data-depth={item.depth}>
							<a href={`#${item.id}`}>{item.text}</a>
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

	.toc-mobile {
		margin-bottom: var(--spacing-6);
		font-size: var(--text-sm);
		color: var(--color-muted);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md, 8px);
		padding: var(--spacing-3) var(--spacing-4);
	}
	.toc-mobile summary {
		cursor: pointer;
		color: var(--color-fg);
		font-weight: 500;
	}
	.toc-mobile ul,
	.toc-desktop ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.toc-mobile ul {
		margin-top: var(--spacing-3);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}
	.toc-mobile li[data-depth='3'],
	.toc-desktop li[data-depth='3'] {
		padding-left: var(--spacing-4);
	}
	.toc-mobile a,
	.toc-desktop a {
		color: var(--color-muted);
		text-decoration: none;
	}
	.toc-mobile a:hover,
	.toc-desktop a:hover {
		color: var(--color-primary);
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
			gap: var(--spacing-2);
			border-left: 1px solid var(--color-border);
			padding-left: var(--spacing-4);
		}
	}
</style>
