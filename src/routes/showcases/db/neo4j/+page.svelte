<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
</script>

<svelte:head>
	<title>Graph - Database - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Graph"
		description="Graph database via HTTP Query API — live connection, schema model, and graph traversal patterns."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB', href: '/showcases/db' },
			{ label: 'Graph' }
		]}
	/>

	<nav class="neo4j-nav">
		<LinkCard
			href="/showcases/db/neo4j/connection"
			icon="i-lucide-activity"
			title="Connection"
			description="Aura health check, query latency, cold start detection, and instance metadata"
		/>
		<LinkCard
			href="/showcases/db/neo4j/model"
			icon="i-lucide-git-fork"
			title="Model"
			description="Node labels, relationship types, property inspection, and interactive graph visualization"
		/>
		<LinkCard
			href="/showcases/db/neo4j/traversal"
			icon="i-lucide-route"
			title="Traversal"
			description="Browse nodes, shortest paths, recommendations, Cypher REPL, and graph vs SQL comparison"
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

	.neo4j-nav {
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
