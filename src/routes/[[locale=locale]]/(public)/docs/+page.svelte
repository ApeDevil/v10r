<script lang="ts">
import { LinkCard } from '$lib/components';
import { BackLink, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import { DOCS_SECTIONS } from '$lib/docs/sections';
</script>
<PageContainer width="wide" class="pt-7">
	<PageHeader
		title="Documentation"
		description="Reference docs for how Velociraptor is built — the pattern library, stack decisions, and the principles behind them."
		breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Docs' }]}
	/>

	<!-- Same list as the Docs flyout (nav.ts) — one source, two projections. -->
	<nav class="docs-nav">
		{#each DOCS_SECTIONS as section (section.href)}
			<LinkCard href={section.href} icon={section.icon} title={section.title()} description={section.description()} />
		{/each}
	</nav>

	<BackLink href="/" label="Home" />
</PageContainer>

<style>
	.docs-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: var(--spacing-6);
		margin-bottom: var(--spacing-7);
	}
</style>
