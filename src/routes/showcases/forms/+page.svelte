<script lang="ts">
	import { EmptyState } from '$lib/components/composites/empty-state';
	import { PageHeader, BackLink } from '$lib/components/composites';
</script>

<svelte:head>
	<title>Forms - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Forms Showcase"
		description="Placeholder for form validation demonstrations with Valibot + Superforms."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Forms' }
		]}
	/>

	<EmptyState
		icon="i-lucide-file-edit"
		title="Coming Soon"
		description="Interactive form examples with validation, error handling, and progressive enhancement."
	/>

	<BackLink href="/showcases" label="Showcases" />
</div>

<style>
	.page {
		max-width: var(--layout-narrow-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
	}
</style>
