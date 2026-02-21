<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
	import { PageContainer } from '$lib/components/layout';
</script>

<svelte:head>
	<title>Graph - Database - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer class="py-7">
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

	<nav class="nav-grid">
		<LinkCard
			href="/showcases/db/graph/connection"
			icon="i-lucide-activity"
			title="Connection"
			description="Aura health check, query latency, cold start detection, and instance metadata"
		/>
		<LinkCard
			href="/showcases/db/graph/model"
			icon="i-lucide-git-fork"
			title="Model"
			description="Node labels, relationship types, property inspection, and interactive graph visualization"
		/>
		<LinkCard
			href="/showcases/db/graph/traversal"
			icon="i-lucide-route"
			title="Traversal"
			description="Browse nodes, shortest paths, recommendations, Cypher REPL, and graph vs SQL comparison"
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
