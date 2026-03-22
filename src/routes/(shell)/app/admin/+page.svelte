<script lang="ts">
import { PageHeader, LinkCard } from '$lib/components/composites';
</script>

<svelte:head>
	<title>Admin - Velociraptor</title>
</svelte:head>

<PageHeader
	title="Admin"
	description="System administration and monitoring."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'App', href: '/app' },
		{ label: 'Admin' },
	]}
/>

<div class="grid grid-cols-1 gap-6 md:grid-cols-2 mt-6">
	<LinkCard
		href="/app/admin/db"
		title="Infrastructure"
		description="Monitor database usage and free tier limits"
		icon="i-lucide-database"
	/>
	<LinkCard
		href="/app/admin/branding"
		title="Branding"
		description="Manage visual identity and theme"
		icon="i-lucide-palette"
	/>
</div>
