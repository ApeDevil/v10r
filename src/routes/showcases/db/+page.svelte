<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
	import { PageContainer } from '$lib/components/layout';
</script>

<svelte:head>
	<title>Database - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer class="py-7">
	<PageHeader
		title="Database"
		description="Database engines, connection patterns, type systems, and data strategies."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB' }
		]}
	/>

	<nav class="nav-grid">
		<LinkCard
			href="/showcases/db/relational"
			icon="i-lucide-database"
			title="Relational"
			description="Neon serverless — type system, JSONB, arrays, ranges, and mutability patterns via Drizzle ORM"
		/>
		<LinkCard
			href="/showcases/db/graph"
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
</PageContainer>

<style>
	.nav-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-6);
	}
</style>
