<script lang="ts">
	import { EmptyState } from '$lib/components/composites/empty-state';
	import { PageHeader, BackLink } from '$lib/components/composites';
</script>

<svelte:head>
	<title>Stack - Docs - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Stack Documentation"
		description="Placeholder for technology stack documentation."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Docs', href: '/docs' },
			{ label: 'Stack' }
		]}
	/>

	<EmptyState
		icon="i-lucide-settings"
		title="Coming Soon"
		description="Detailed documentation on SvelteKit, Drizzle, Better Auth, and the full stack."
	/>

	<BackLink href="/docs" label="Docs" />
</div>

<style>
	.page {
		max-width: var(--layout-narrow-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
	}
</style>
