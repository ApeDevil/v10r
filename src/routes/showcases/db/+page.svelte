<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
</script>

<svelte:head>
	<title>Database - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Database"
		description="Database engines, connection patterns, type systems, and data strategies."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB' }
		]}
	/>

	<nav class="db-nav">
		<LinkCard
			href="/showcases/db/postgres"
			icon="i-lucide-database"
			title="Relational"
			description="Neon serverless — type system, JSONB, arrays, ranges, and mutability patterns via Drizzle ORM"
		/>
		<LinkCard
			href="/showcases/db/neo4j"
			icon="i-lucide-share-2"
			title="Graph"
			description="Aura graph database — nodes, relationships, Cypher queries, and traversals"
		/>
		<LinkCard
			href="/showcases/db/storage"
			icon="i-lucide-hard-drive"
			title="Storage"
			description="Object storage — presigned URLs, file uploads, and bucket management"
		/>
	</nav>

	<BackLink href="/showcases" label="Showcases" />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.db-nav {
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
