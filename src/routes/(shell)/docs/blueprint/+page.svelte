<script lang="ts">
import { LinkCard } from '$lib/components';
import { BackLink, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';

let { data } = $props();
</script>

<svelte:head>
	<title>Blueprint — Docs — Velociraptor</title>
</svelte:head>

<PageContainer width="wide" class="pt-7">
	<PageHeader
		title="Blueprint"
		description="Implementation patterns — how features are wired together using the stack."
		breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Docs', href: '/docs' }, { label: 'Blueprint' }]}
	/>

	{#each data.groups as group (group.name)}
		<section class="group">
			<h2>{group.name}</h2>
			<div class="entry-list">
				{#each group.items as entry (entry.slug)}
					<LinkCard
						href={`/docs/blueprint/${entry.slug}`}
						title={entry.title}
						description={entry.description}
					/>
				{/each}
			</div>
		</section>
	{/each}

	<BackLink href="/docs" label="Docs" />
</PageContainer>

<style>
	.group {
		margin-bottom: var(--spacing-7);
	}
	.group h2 {
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
		margin: 0 0 var(--spacing-4);
	}
	.entry-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: var(--spacing-5);
	}
</style>
