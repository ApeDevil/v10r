<script lang="ts">
import { LinkCard } from '$lib/components';
import { BackLink, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
</script>

<svelte:head>
	<title>Docs - Velociraptor</title>
</svelte:head>

<PageContainer width="wide" class="pt-7">
	<PageHeader
		title="Documentation"
		description="Technical documentation and guides for the Velociraptor template."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Docs' }
		]}
	/>

	<nav class="docs-nav">
		<LinkCard
			href="/docs"
			icon="i-lucide-compass"
			title="Foundation"
			description="Core vision, principles, architecture"
			class="card-disabled"
		/>
		<LinkCard
			href="/docs/stack"
			icon="i-lucide-settings"
			title="Stack"
			description="Technology decisions per layer"
		/>
		<LinkCard
			href="/docs"
			icon="i-lucide-drafting-compass"
			title="Blueprint"
			description="Architecture specs and feature designs"
			class="card-disabled"
		/>
		<LinkCard
			href="/docs"
			icon="i-lucide-hammer"
			title="Implementation"
			description="What shipped, what diverged"
			class="card-disabled"
		/>
	</nav>

	<BackLink href="/" label="Home" />
</PageContainer>

<style>
	.docs-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-6);
	}

	.docs-nav :global(.card-disabled) {
		opacity: 0.5;
		pointer-events: none;
	}
</style>
