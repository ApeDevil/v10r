<script lang="ts">
import { LinkCard } from '$lib/components';
import { BackLink, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';

let { data } = $props();
</script>
<PageContainer width="wide" class="pt-7">
	<PageHeader
		title="Foundation"
		description="Why this project exists, what constraints drive decisions, and how features should behave."
		breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Docs', href: '/docs' }, { label: 'Foundation' }]}
	/>

	<div class="entry-list">
		{#each data.entries as entry (entry.slug)}
			<LinkCard
				href={`/docs/foundation/${entry.slug}`}
				title={entry.title}
				description={entry.description}
			/>
		{/each}
	</div>

	<BackLink href="/docs" label="Docs" />
</PageContainer>

<style>
	.entry-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: var(--spacing-5);
		margin-bottom: var(--spacing-7);
	}
</style>
