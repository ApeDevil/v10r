<script lang="ts">
import { BackLink, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';

let { data } = $props();

const counts = $derived(data.catalog.counts);
const description = $derived(
	`Every pattern in v10r — ${counts.total} records across ${counts.categories} categories, with its purpose in one line. ` +
		`${counts.deep} deep-tier patterns carry invariants and emulation notes on their pages; the rest are index cards pointing at docs, code, and proof.`,
);
</script>

<PageContainer width="wide" class="pt-7">
	<PageHeader
		title="Pattern Library"
		{description}
		breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Docs', href: '/docs' }, { label: 'Pattern Library' }]}
	/>

	<div class="catalog">
		{#each data.catalog.groups as group (group.title)}
			<section class="group">
				<h2>{group.title}</h2>
				{#each group.categories as category (category.title)}
					<section class="category">
						<h3>{category.title}</h3>
						<dl>
							{#each category.patterns as pattern (pattern.id)}
								<a class="row" href={pattern.href}>
									<dt>
										{pattern.title}
										{#if pattern.tier === 'deep'}<span class="tier">deep</span>{/if}
									</dt>
									<dd>{pattern.summary}</dd>
								</a>
							{/each}
						</dl>
					</section>
				{/each}
			</section>
		{/each}
	</div>

	<BackLink href="/docs" label="Docs" />
</PageContainer>

<style>
	.catalog {
		margin-bottom: var(--spacing-7);
	}

	.group {
		margin-top: var(--spacing-7);
	}
	.group:first-child {
		margin-top: 0;
	}

	.group h2 {
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-muted);
		margin: 0 0 var(--spacing-3);
		scroll-margin-top: var(--spacing-6);
	}

	.category {
		margin-top: var(--spacing-5);
	}

	.category h3 {
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--color-fg);
		margin: 0 0 var(--spacing-2);
	}

	dl {
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 14rem) minmax(0, 1fr);
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

	.tier {
		display: inline-block;
		vertical-align: middle;
		margin-left: var(--spacing-2);
		padding: 0 var(--spacing-2);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--color-primary);
		background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
		border-radius: 999px;
	}

	@media (max-width: 640px) {
		.row {
			grid-template-columns: 1fr;
			gap: var(--spacing-1);
		}
	}
</style>
