<script lang="ts">
import { BackLink, NavGrid, NavSection, PageHeader } from '#lib/components/composites/index.ts';
import { LinkCard } from '#lib/components/index.ts';
import { PageContainer } from '#lib/components/layout/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { groupWorkflowsByCategory, workflowHref } from '#lib/workflows/catalog.ts';

const categoryGroups = groupWorkflowsByCategory();

const sections = $derived(categoryGroups.map((g) => ({ id: g.category.id, label: g.category.label() })));
</script>

<PageContainer width="wide" class="pt-7">
	<PageHeader
		title={m.workflow_index_title()}
		description={m.workflow_index_description()}
		breadcrumbs={[{ label: m.nav_home(), href: '/' }, { label: m.nav_workflows() }]}
	/>

	{#if sections.length > 1}
		<NavSection {sections} ariaLabel={m.workflow_index_jumpnav_aria()} />
	{/if}

	<div class="categories">
		{#each categoryGroups as group}
			<section class="category-section" id={group.category.id}>
				<h2 class="category-title">{group.category.label()}</h2>
				<p class="category-description">{group.category.description()}</p>
				<div class="category-grid" style:--n={group.cards.length}>
					<NavGrid>
						{#each group.cards as card}
							<LinkCard
								href={workflowHref(card)}
								icon={card.icon}
								title={card.title()}
								description={card.description()}
							/>
						{/each}
					</NavGrid>
				</div>
			</section>
		{/each}
	</div>

	<BackLink href="/" label={m.nav_home()} />
</PageContainer>

<style>
	.categories {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-7);
		padding-block: var(--spacing-6);
	}

	/* Anchor jumps must clear the sticky NavSection chip bar. */
	.category-section {
		scroll-margin-top: 5rem;
	}

	.category-title {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
		margin: 0 0 var(--spacing-2);
	}

	.category-description {
		color: var(--color-muted);
		max-width: 65ch;
		margin: 0 0 var(--spacing-4);
	}

	/* Same cap as the showcase hub: a one-card category keeps the card at grid width. */
	.category-grid {
		max-width: min(100%, calc(var(--n) * 280px + (var(--n) - 1) * 1.5rem));
	}
</style>
