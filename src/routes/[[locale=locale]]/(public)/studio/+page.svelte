<script lang="ts">
import { BackLink, NavGrid, PageHeader } from '#lib/components/composites/index.ts';
import { LinkCard } from '#lib/components/index.ts';
import { PageContainer } from '#lib/components/layout/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { studioAreaHref, studioAreas } from '#lib/studio/catalog.ts';
</script>

<PageContainer width="wide" class="pt-7">
	<PageHeader
		title={m.studio_index_title()}
		description={m.studio_index_description()}
		breadcrumbs={[{ label: m.nav_home(), href: '/' }, { label: m.nav_studio() }]}
	/>

	<section class="areas" aria-label={m.studio_index_areas_aria()}>
		<div class="area-grid" style:--n={studioAreas.length}>
			<NavGrid>
				{#each studioAreas as area}
					<LinkCard href={studioAreaHref(area)} icon={area.icon} title={area.title()} description={area.description()} />
				{/each}
			</NavGrid>
		</div>
		<p class="more">{m.studio_index_more()}</p>
	</section>

	<BackLink href="/" label={m.nav_home()} />
</PageContainer>

<style>
	.areas {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		padding-block: var(--spacing-6);
	}

	/* Same cap as the workflow hub: a one-card hub keeps the card at grid width. */
	.area-grid {
		max-width: min(100%, calc(var(--n) * 280px + (var(--n) - 1) * 1.5rem));
	}

	.more {
		color: var(--color-muted);
		max-width: 65ch;
		margin: 0;
	}
</style>
