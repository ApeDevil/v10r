<script lang="ts">
	import { EmptyState } from '$lib/components/composites/empty-state';
	import { PageHeader, BackLink } from '$lib/components/composites';
</script>

<svelte:head>
	<title>Auth - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Auth Showcase"
		description="Placeholder for Better Auth authentication demonstrations."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Auth' }
		]}
	/>

	<EmptyState
		icon="i-lucide-lock"
		title="Coming Soon"
		description="Authentication flows, session management, and OAuth integration examples."
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
