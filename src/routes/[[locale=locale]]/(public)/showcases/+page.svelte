<script lang="ts">
import { LinkCard } from '$lib/components';
import { BackLink, NavGrid, NavSection, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import * as m from '$lib/paraglide/messages';
import { groupByDomain } from './showcases';

const domainGroups = groupByDomain();

const sections = $derived(domainGroups.map((g) => ({ id: g.domain.id, label: g.domain.label() })));
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

	<NavSection {sections} ariaLabel={m.showcase_index_jumpnav_aria()} />

	<div class="domains">
		{#each domainGroups as group}
			<section class="domain-section" id={group.domain.id}>
				<h2 class="domain-title">{group.domain.label()}</h2>
				<div class="domain-grid" style:--n={group.cards.length}>
					<NavGrid>
						{#each group.cards as card}
							<LinkCard
								href={card.href}
								icon={card.icon}
								title={card.title()}
								description={card.description()}
								sublinks={card.sublinks?.map((s) => ({ label: s.label(), href: s.href }))}
							/>
						{/each}
					</NavGrid>
				</div>
			</section>
		{/each}
	</div>

	<BackLink href="/" label={m.showcase_breadcrumb_home()} />
</PageContainer>

<style>
	.domains {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-7);
		padding-block: var(--spacing-6);
	}

	/* Anchor jumps must clear the sticky NavSection chip bar. */
	.domain-section {
		scroll-margin-top: 5rem;
	}

	.domain-title {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
		margin: 0 0 var(--spacing-4);
	}

	/* Cap small groups so 1fr tracks don't balloon cards past the flat-grid width
	   (1.5rem = NavGrid's --spacing-6 gap). No-op for groups wide enough to wrap. */
	.domain-grid {
		max-width: min(100%, calc(var(--n) * 280px + (var(--n) - 1) * 1.5rem));
	}
</style>
