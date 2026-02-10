<script lang="ts">
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
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
			href="/docs/stack"
			icon="i-lucide-settings"
			title="Stack"
			description="Technology stack documentation"
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
</style>
