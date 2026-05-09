<script lang="ts">
import { hydrateEmbeds } from '$lib/actions/hydrate-embeds';
import { Renderer } from '$lib/components/blog';
import { PageContainer, Stack } from '$lib/components/layout';
import { Typography } from '$lib/components/primitives';
import { formatDate } from '$lib/i18n';

export const csr = false;

let { data } = $props();

const driftLabel = $derived.by(() => {
	if (data.drift.status === 'not-pushed') return 'Not yet pushed to DB';
	if (data.drift.status === 'up-to-date') {
		return `Up to date with DB (last push ${formatDate(data.drift.lastPublishedAt, data.locale)})`;
	}
	return `Local changes ahead of DB (last push ${formatDate(data.drift.lastPublishedAt, data.locale)})`;
});

const driftKind = $derived(data.drift.status);
</script>

<svelte:head>
	<title>Preview · {data.frontmatter.title} · {data.locale}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<PageContainer width="content" class="pt-7 pb-8">
	<Stack class="gap-6">
		<header class="preview-header">
			<div class="preview-meta">
				<span class="preview-eyebrow">file preview · {data.slug}</span>
				<span class="preview-hash" title={data.fileHash}>hash {data.fileHash.slice(0, 12)}…</span>
			</div>

			<div class="drift-banner" data-state={driftKind}>
				<span class="drift-dot" aria-hidden="true"></span>
				<span class="drift-label">{driftLabel}</span>
			</div>

			<nav class="locale-tabs" aria-label="Preview locale">
				{#each data.supportedLocales as locale (locale)}
					<a
						href="/admin/content/posts/preview/{data.slug}/{locale}"
						class="locale-tab"
						aria-current={locale === data.locale ? 'page' : undefined}
					>
						{locale}
					</a>
				{/each}
			</nav>
		</header>

		<header class="post-header">
			<Typography variant="h1">{data.frontmatter.title}</Typography>
			{#if data.frontmatter.summary}
				<p class="post-summary">{data.frontmatter.summary}</p>
			{/if}
		</header>

		<div use:hydrateEmbeds={data.embeds ?? []}>
			<Renderer html={data.html} />
		</div>
	</Stack>
</PageContainer>

<style>
	.preview-header {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding-bottom: var(--spacing-4);
		border-bottom: 1px dashed var(--color-input-border);
	}

	.preview-meta {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 0.75rem;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.preview-hash {
		font-family: var(--font-mono, ui-monospace, monospace);
		text-transform: none;
		letter-spacing: 0;
	}

	.drift-banner {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3) var(--spacing-4);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		background: color-mix(in srgb, var(--color-muted) 8%, transparent);
		color: var(--color-fg);
	}

	.drift-banner[data-state='not-pushed'] {
		background: color-mix(in srgb, var(--color-warning, var(--color-primary)) 10%, transparent);
	}

	.drift-banner[data-state='ahead'] {
		background: color-mix(in srgb, var(--color-warning, var(--color-primary)) 14%, transparent);
	}

	.drift-banner[data-state='up-to-date'] {
		background: color-mix(in srgb, var(--color-success, var(--color-primary)) 10%, transparent);
	}

	.drift-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-muted);
	}

	.drift-banner[data-state='not-pushed'] .drift-dot,
	.drift-banner[data-state='ahead'] .drift-dot {
		background: var(--color-warning, var(--color-primary));
	}

	.drift-banner[data-state='up-to-date'] .drift-dot {
		background: var(--color-success, var(--color-primary));
	}

	.locale-tabs {
		display: flex;
		gap: var(--spacing-2);
	}

	.locale-tab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 3rem;
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-input-border);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		text-decoration: none;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
		transition: color var(--duration-fast), border-color var(--duration-fast), background var(--duration-fast);
	}

	.locale-tab:hover {
		color: var(--color-fg);
		border-color: var(--color-fg);
	}

	.locale-tab[aria-current='page'] {
		color: var(--color-primary);
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.post-header {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.post-summary {
		color: var(--color-muted);
		font-size: 1.05rem;
	}
</style>
