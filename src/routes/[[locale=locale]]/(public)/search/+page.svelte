<script lang="ts">
import { PageHeader } from '$lib/components/composites';
import { localizeHref } from '$lib/i18n/runtime';
import { type SearchResult, type SearchSurface, SURFACE_ORDER } from '$lib/search/types';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

const GROUP_LABEL: Record<SearchSurface, string> = {
	page: 'Pages',
	showcase: 'Showcases',
	section: 'Elements',
	doc: 'Docs',
	blog: 'Blog',
};

const SURFACE_ICON: Record<SearchSurface, string> = {
	page: 'i-lucide-file-text',
	showcase: 'i-lucide-view',
	section: 'i-lucide-component',
	doc: 'i-lucide-book-open',
	blog: 'i-lucide-newspaper',
};

const grouped = $derived.by(() => {
	const map = new Map<SearchSurface, SearchResult[]>();
	for (const r of data.results) {
		const arr = map.get(r.surface) ?? [];
		arr.push(r);
		map.set(r.surface, arr);
	}
	return SURFACE_ORDER.filter((s) => map.has(s)).map((s) => ({ surface: s, items: map.get(s) ?? [] }));
});

function hrefFor(r: SearchResult): string {
	return localizeHref(r.path) + (r.anchor ?? '');
}

function segments(snippet: string, highlight?: [number, number][]) {
	if (!highlight || highlight.length === 0) return [{ text: snippet, mark: false }];
	const out: { text: string; mark: boolean }[] = [];
	let pos = 0;
	for (const [s, e] of highlight) {
		if (s > pos) out.push({ text: snippet.slice(pos, s), mark: false });
		out.push({ text: snippet.slice(s, e), mark: true });
		pos = e;
	}
	if (pos < snippet.length) out.push({ text: snippet.slice(pos), mark: false });
	return out;
}
</script>

<svelte:head>
	<title>{data.q ? `Search: ${data.q}` : 'Search'} — v10r</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<PageHeader
	title="Search"
	description={data.q ? `${data.results.length} result${data.results.length === 1 ? '' : 's'} for “${data.q}”` : 'Find pages, documentation, blog posts, and showcase elements.'}
/>

<div class="search-page">
	{#if !data.q}
		<p class="search-empty">Type a query in the search palette (⌘K) or append <code>?q=</code> to the URL.</p>
	{:else if data.results.length === 0}
		<p class="search-empty">No results found for “{data.q}”.</p>
	{:else}
		{#each grouped as group (group.surface)}
			<section class="search-group">
				<h2 class="search-group-heading">{GROUP_LABEL[group.surface]}</h2>
				<ul class="search-list">
					{#each group.items as r (r.id)}
						<li>
							<a class="search-result" href={hrefFor(r)}>
								<span class={`${r.icon ?? SURFACE_ICON[r.surface]} search-result-icon`} aria-hidden="true"></span>
								<span class="search-result-body">
									<span class="search-result-title">
										{r.title}
										{#if r.badge === 'en-fallback'}<span class="search-badge" aria-label="English content">EN</span>{/if}
									</span>
									{#if r.breadcrumb.length > 0}
										<span class="search-result-crumb">{r.breadcrumb.join(' / ')}</span>
									{/if}
									{#if r.snippet}
										<span class="search-result-snippet"
											>{#each segments(r.snippet, r.highlight) as seg}{#if seg.mark}<mark>{seg.text}</mark>{:else}{seg.text}{/if}{/each}</span
										>
									{/if}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
</div>

<style>
	.search-page {
		max-width: 56rem;
		margin: 0 auto;
		padding: var(--space-5) var(--space-4) var(--space-8);
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.search-empty {
		color: var(--color-muted);
	}

	.search-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.search-group-heading {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
	}

	.search-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.search-result {
		display: flex;
		gap: var(--space-3);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
	}

	.search-result:hover {
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.search-result-icon {
		width: 1.1rem;
		height: 1.1rem;
		flex-shrink: 0;
		margin-top: 0.15rem;
		color: var(--color-muted);
	}

	.search-result-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.search-result-title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 500;
	}

	.search-result-crumb {
		font-size: 0.75rem;
		color: var(--color-muted);
	}

	.search-result-snippet {
		font-size: 0.8125rem;
		color: var(--color-muted);
		line-height: 1.4;
	}

	.search-result-snippet :global(mark) {
		background: transparent;
		color: var(--color-fg);
		font-weight: 600;
	}

	.search-badge {
		font-size: 10px;
		font-weight: 600;
		line-height: 1;
		padding: 2px 4px;
		border-radius: var(--radius-sm);
		color: var(--color-muted);
		background-color: color-mix(in srgb, var(--color-muted) 18%, transparent);
	}
</style>
