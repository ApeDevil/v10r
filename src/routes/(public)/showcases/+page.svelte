<script lang="ts">
import { LinkCard } from '$lib/components';
import { BackLink, NavGrid, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import { showcases } from './showcases';
</script>
<PageContainer width="wide" class="pt-7">
	<PageHeader
		title="Showcases"
		description="Feature demonstrations and examples showing the capabilities of the Velociraptor stack."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases' }
		]}
	/>

	<NavGrid>
		{#each showcases as card}
			<LinkCard
				href={card.href}
				icon={card.icon}
				title={card.title}
				description={card.description}
				sublinks={card.sublinks}
			/>
		{/each}
	</NavGrid>

	<BackLink href="/" label="Home" />
</PageContainer>
