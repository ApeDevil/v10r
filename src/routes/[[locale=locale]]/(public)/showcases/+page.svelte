<script lang="ts">
import { LinkCard } from '$lib/components';
import { BackLink, NavGrid, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import * as m from '$lib/paraglide/messages';
import { groupByDomain } from './showcases';

const domainGroups = groupByDomain();

let headerHeight = $state(0);
</script>
<PageContainer width="wide" class="pt-7">
	<PageHeader
		sticky
		bind:headerHeight
		title={m.showcase_index_title()}
		description={m.showcase_index_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases() }
		]}
	/>

	<nav class="jump-nav" aria-label={m.showcase_index_jumpnav_aria()}>
		{#each domainGroups as group}
			<a class="jump-link focus-ring" href="#{group.domain.id}">{group.domain.label()}</a>
		{/each}
	</nav>

	<div class="domains" style:--sticky-offset="{headerHeight}px">
		{#each domainGroups as group}
			<section class="domain-section">
				<h2 class="domain-title" id={group.domain.id}>{group.domain.label()}</h2>
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
	.jump-nav {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-3) var(--spacing-5);
	}

	.jump-link {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		text-decoration: none;
		transition: color var(--duration-fast) ease-out;
	}

	.jump-link:hover {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.domains {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-7);
		padding-block: var(--spacing-6);
	}

	.domain-title {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
		margin: 0 0 var(--spacing-4);
		/* Anchor jumps must clear the sticky PageHeader (measured height + breathing room). */
		scroll-margin-top: calc(var(--sticky-offset, 10rem) + var(--spacing-4));
	}

	/* Cap small groups so 1fr tracks don't balloon cards past the flat-grid width
	   (1.5rem = NavGrid's --spacing-6 gap). No-op for groups wide enough to wrap. */
	.domain-grid {
		max-width: min(100%, calc(var(--n) * 280px + (var(--n) - 1) * 1.5rem));
	}
</style>
