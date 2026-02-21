<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
</script>

<svelte:head>
	<title>PostgreSQL - Database - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="PostgreSQL"
		description="Neon serverless PostgreSQL + Drizzle ORM — live connection, type system showcase, and mutability patterns."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB', href: '/showcases/db' },
			{ label: 'PostgreSQL' }
		]}
	/>

	<nav class="pg-nav">
		<LinkCard
			href="/showcases/db/postgres/connection"
			icon="i-lucide-activity"
			title="Connection"
			description="Neon health check, query latency, cold start detection, and database metadata"
		/>
		<LinkCard
			href="/showcases/db/postgres/types"
			icon="i-lucide-layers"
			title="Type System"
			description="Every PostgreSQL type with live data: numeric, text, temporal, JSON, arrays, UUID, ranges, network"
		/>
		<LinkCard
			href="/showcases/db/postgres/mutability"
			icon="i-lucide-git-branch"
			title="Mutability"
			description="Append-only logs, soft deletes, versioned records, temporal data, and mutable CRUD"
		/>
	</nav>

	<BackLink href="/showcases/db" label="Database" />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.pg-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-6);
	}

	@media (min-width: 768px) {
		.page {
			padding: var(--spacing-7);
		}
	}

	@media (max-width: 640px) {
		.page {
			padding: var(--spacing-4);
		}
	}
</style>
