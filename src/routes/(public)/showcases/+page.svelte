<script lang="ts">
import { LinkCard } from '$lib/components';
import { BackLink, NavGrid, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import * as m from '$lib/paraglide/messages';
import { showcases } from './showcases';
</script>
<PageContainer width="wide" class="pt-7">
	<PageHeader
		title={m.showcase_index_title()}
		description={m.showcase_index_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases() }
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

	<BackLink href="/" label={m.showcase_breadcrumb_home()} />
</PageContainer>
