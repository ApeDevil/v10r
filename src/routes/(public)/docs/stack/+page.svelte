<script lang="ts">
import { BackLink, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';

let { data } = $props();
</script>
<PageContainer width="wide" class="pt-7">
	<PageHeader
		title="Stack"
		description="Every tool, why it was chosen, and how to use it."
		breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Docs', href: '/docs' }, { label: 'Stack' }]}
	/>

	<div class="stack">
		{#each data.layers as layer (layer.layer)}
			<section class="layer">
				<h2 id={layer.layer}>{layer.layer}</h2>
				<dl>
					{#each layer.items as item (item.slug)}
						<a class="row" href={`/docs/stack/${item.slug}`}>
							<dt>{item.title}</dt>
							<dd>{item.description}</dd>
						</a>
					{/each}
				</dl>
			</section>
		{/each}
	</div>

	<BackLink href="/docs" label="Docs" />
</PageContainer>

<style>
	.stack {
		margin-bottom: var(--spacing-7);
	}

	.layer {
		margin-top: var(--spacing-7);
	}
	.layer:first-child {
		margin-top: 0;
	}

	.layer h2 {
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-muted);
		margin: 0 0 var(--spacing-3);
		scroll-margin-top: var(--spacing-6);
	}

	dl {
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 12rem) minmax(0, 1fr);
		gap: var(--spacing-5);
		align-items: baseline;
		padding: var(--spacing-3) var(--spacing-4);
		border-left: 2px solid transparent;
		text-decoration: none;
		color: inherit;
		transition: background-color var(--duration-fast), border-color var(--duration-fast);
	}

	.row:hover {
		background-color: color-mix(in srgb, var(--color-muted) 8%, transparent);
		border-left-color: var(--color-accent, var(--color-primary));
	}

	.row:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	dt {
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--color-fg);
		margin: 0;
	}

	dd {
		font-size: var(--text-sm);
		color: var(--color-muted);
		margin: 0;
		line-height: 1.5;
	}

	@media (max-width: 640px) {
		.row {
			grid-template-columns: 1fr;
			gap: var(--spacing-1);
		}
	}
</style>
