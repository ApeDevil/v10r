<script lang="ts">
	import { PageHeader } from '$lib/components/composites';
	import { LinkCard } from '$lib/components/ui';
</script>

<svelte:head>
	<title>Docs - Velociraptor</title>
</svelte:head>

<div class="page">
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
			icon="⚙️"
			title="Stack"
			description="Technology stack documentation"
		/>

		<LinkCard
			href="/docs/blueprint"
			icon="📐"
			title="Blueprint"
			description="Application blueprint and architecture"
		/>
	</nav>
</div>

<style>
	.page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.docs-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
	}
</style>
