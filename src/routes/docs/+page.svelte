<script lang="ts">
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
</script>

<svelte:head>
	<title>Docs - Velociraptor</title>
</svelte:head>

<PageContainer width="wide">
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
			href="/docs/stack"
			icon="i-lucide-settings"
			title="Stack"
			description="Technology stack documentation"
		/>

		<LinkCard
			href="/docs/blueprint"
			icon="i-lucide-ruler"
			title="Blueprint"
			description="Application blueprint and architecture"
		/>
	</nav>
</PageContainer>

<style>

	.docs-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
	}
</style>
