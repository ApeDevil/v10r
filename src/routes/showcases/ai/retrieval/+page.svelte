<script lang="ts">
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
</script>

<svelte:head>
	<title>Retrieval - AI - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer width="wide" class="pt-7">
	<PageHeader
		title="Recursive Retrieval"
		description="Three-tier RAG system: contextual BM25 + pgvector hybrid, parent-child small-to-big, and Neo4j graph traversal."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'AI', href: '/showcases/ai' },
			{ label: 'Retrieval' }
		]}
	/>

	<nav class="retrieval-nav">
		<LinkCard
			href="/showcases/ai/retrieval/ingest"
			icon="i-lucide-file-plus"
			title="Ingest"
			description="Upload documents, watch the chunking and embedding pipeline in action"
		/>

		<LinkCard
			href="/showcases/ai/retrieval/contextual"
			icon="i-lucide-search"
			title="Tier 1: Contextual"
			description="Hybrid vector + BM25 retrieval with reciprocal rank fusion"
		/>

		<LinkCard
			href="/showcases/ai/retrieval/parent-child"
			icon="i-lucide-git-branch"
			title="Tier 2: Parent-Child"
			description="Small-to-big retrieval — search child chunks, return parent context"
		/>

		<LinkCard
			href="/showcases/ai/retrieval/graph"
			icon="i-lucide-share-2"
			title="Tier 3: Graph"
			description="Neo4j entity graph traversal — seed from vectors, expand through relationships"
		/>

		<LinkCard
			href="/showcases/ai/retrieval/chat"
			icon="i-lucide-message-square-plus"
			title="RAG Chat"
			description="Chat with retrieval-augmented generation — context injected from your documents"
		/>
	</nav>

	<BackLink href="/showcases/ai" label="AI" />
</PageContainer>

<style>
	.retrieval-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-6);
	}
</style>
