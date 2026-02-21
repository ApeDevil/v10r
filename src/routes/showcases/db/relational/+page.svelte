<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
	import { PageContainer } from '$lib/components/layout';
</script>

<svelte:head>
	<title>Relational - Database - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer class="py-7">
	<PageHeader
		title="Relational"
		description="Relational database via Drizzle ORM — live connection, type system showcase, and mutability patterns."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB', href: '/showcases/db' },
			{ label: 'Relational' }
		]}
	/>

	<nav class="nav-grid">
		<LinkCard
			href="/showcases/db/relational/connection"
			icon="i-lucide-activity"
			title="Connection"
			description="Neon health check, query latency, cold start detection, and database metadata"
		/>
		<LinkCard
			href="/showcases/db/relational/types"
			icon="i-lucide-layers"
			title="Type System"
			description="Every PostgreSQL type with live data: numeric, text, temporal, JSON, arrays, UUID, ranges, network"
		/>
		<LinkCard
			href="/showcases/db/relational/mutability"
			icon="i-lucide-git-branch"
			title="Mutability"
			description="Append-only logs, soft deletes, versioned records, temporal data, and mutable CRUD"
		/>
	</nav>

	<BackLink href="/showcases/db" label="Database" />
</PageContainer>

<style>
	.nav-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-6);
	}
</style>
